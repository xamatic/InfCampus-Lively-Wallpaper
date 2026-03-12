import { openLoginTabIfNeeded } from "./universal.js";

// Background service worker - handles fetching grades and assignments, syncing to backend
const GRADES_URL = "https://410.ncsis.gov/campus/resources/portal/grades";
const ASSIGNMENTS_URL = "https://410.ncsis.gov/campus/api/portal/assignment/recentlyScored";
const TERMS_URL = "https://410.ncsis.gov/campus/resources/term?structureID=2698";
const MISSING_URL = "https://410.ncsis.gov/campus/api/portal/assignment/missing";
const BACKEND_URL = "http://localhost:3001";
const LOGIN_URL = "https://410.ncsis.gov/campus/nav-wrapper/student/portal/student/home?appName=psu410guilfordco";
const BASE_URL = "https://410.ncsis.gov/campus";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchGrades") {
    fetchGrades().then(sendResponse);
    return true; // Keep the message channel open for async response
  }
  if (request.action === "fetchAssignments") {
    fetchAssignments().then(sendResponse);
    return true;
  }
  if (request.action === "fetchAll") {
    fetchAll().then(sendResponse);
    return true;
  }
  if (request.action === "fetchMissing") {
    fetchTerms().then(termsResult => {
      return fetchMissing(termsResult.success ? termsResult.data : null);
    }).then(sendResponse);
    return true;
  }
});

// Get date 60 days ago for assignments query (extended range to catch more assignments)
function getModifiedDate() {
  const date = new Date();
  date.setDate(date.getDate() - 60);
  return date.toISOString().split('T')[0] + 'T00:00:00';
}

async function fetchGrades() {
  try {
    const response = await fetch(GRADES_URL, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Only open login tab if not already open
      openLoginTabIfNeeded();
      throw new Error('Not logged in');
    }
    const data = await response.json();
    chrome.storage.local.set({ 
      gradesData: data, 
      lastUpdated: Date.now() 
    });
    // Broadcast grades update to tabs
    broadcastUpdate('grades', { grades: data, lastUpdated: Date.now() });
    try {
      await fetch(`${BACKEND_URL}/grades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      console.log('Grades synced to backend server');
    } catch (backendErr) {
      // Only log, do not trigger any reload or retry
      console.warn('Could not sync to backend:', backendErr);
    }
    return { success: true, data: data, timestamp: Date.now() };
  } catch (error) {
    // Prevent any reload or infinite error loop
    console.error('Fetch error:', error);
    openLoginTabIfNeeded();
    // Try to get cached data
    const cached = await chrome.storage.local.get(['gradesData', 'lastUpdated']);
    if (cached.gradesData) {
      return { success: true, data: cached.gradesData, timestamp: cached.lastUpdated, cached: true };
    }
    // Return error, but do not reload or retry
    return { success: false, error: error.message };
  }
}

async function fetchAssignments() {
  try {
    const modifiedDate = getModifiedDate();
    const response = await fetch(`${ASSIGNMENTS_URL}?modifiedDate=${modifiedDate}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Only open login tab if not already open
      openLoginTabIfNeeded();
      throw new Error('Not logged in');
    }
    const data = await response.json();
    chrome.storage.local.set({ 
      assignmentsData: data, 
      assignmentsLastUpdated: Date.now() 
    });
    // Broadcast assignments update to tabs
    broadcastUpdate('assignments', { assignments: data, assignmentsLastUpdated: Date.now() });
    try {
      await fetch(`${BACKEND_URL}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      console.log('Assignments synced to backend server');
    } catch (backendErr) {
      // Only log, do not trigger any reload or retry
      console.warn('Could not sync assignments to backend:', backendErr);
    }
    return { success: true, data: data, timestamp: Date.now() };
  } catch (error) {
    // Prevent any reload or infinite error loop
    console.error('Assignments fetch error:', error);
    openLoginTabIfNeeded();
    // Try to get cached data
    const cached = await chrome.storage.local.get(['assignmentsData', 'assignmentsLastUpdated']);
    if (cached.assignmentsData) {
      return { success: true, data: cached.assignmentsData, timestamp: cached.assignmentsLastUpdated, cached: true };
    }
    // Return error, but do not reload or retry
    return { success: false, error: error.message };
  }
}

async function fetchAll() {
  // First get terms to determine current termID
  const termsResult = await fetchTerms();

  const [gradesResult, assignmentsResult, missingResult] = await Promise.all([
    fetchGrades(),
    fetchAssignments(),
    fetchMissing(termsResult.success ? termsResult.data : null)
  ]);

  return {
    grades: gradesResult,
    assignments: assignmentsResult,
    missing: missingResult,
    terms: termsResult,
    timestamp: Date.now()
  };
}

// Find the term whose date range contains today; fall back to highest seq
function getCurrentTermID(termsData) {
  if (!termsData || !termsData.length) return null;
  const now = new Date();
  const current = termsData.find(t => {
    const start = new Date(t.startDate);
    const end = new Date(t.endDate);
    return now >= start && now <= end;
  });
  return current
    ? current.termID
    : termsData.reduce((a, b) => a.seq > b.seq ? a : b).termID;
}

function getMissingAssignmentKey(item) {
  return [
    item.assignmentID ?? item.assignmentName ?? '',
    item.sectionID ?? item.courseName ?? '',
    item.dueDate ?? item.scoreModifiedDate ?? ''
  ].join('|');
}

function getOrderedTermIDs(termsData) {
  if (!Array.isArray(termsData) || !termsData.length) return [];

  const currentTermID = getCurrentTermID(termsData);
  const ordered = [...termsData]
    .sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0))
    .map(term => term.termID)
    .filter(termID => Number.isFinite(termID));

  if (!currentTermID) return [...new Set(ordered)];

  return [currentTermID, ...ordered.filter(termID => termID !== currentTermID)];
}

async function fetchMissingForTerm(termID) {
  const response = await fetch(`${MISSING_URL}?termID=${termID}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    openLoginTabIfNeeded();
    throw new Error('Not logged in');
  }

  return response.json();
}

function mergeMissingResults(results) {
  const missingAssignments = [];
  const seen = new Set();
  let hasOtherMissing = false;

  for (const result of results) {
    if (!result) continue;

    hasOtherMissing = hasOtherMissing || !!result.hasOtherMissing;

    const assignments = Array.isArray(result.missingAssignments) ? result.missingAssignments : [];
    for (const assignment of assignments) {
      const key = getMissingAssignmentKey(assignment);
      if (!seen.has(key)) {
        seen.add(key);
        missingAssignments.push(assignment);
      }
    }
  }

  missingAssignments.sort((a, b) => {
    const left = new Date(a.dueDate || a.scoreModifiedDate || 0).getTime();
    const right = new Date(b.dueDate || b.scoreModifiedDate || 0).getTime();
    return left - right;
  });

  return {
    hasOtherMissing,
    missingAssignments,
    missingAssignmentsTotal: missingAssignments.length
  };
}

async function fetchTerms() {
  try {
    const response = await fetch(TERMS_URL, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      openLoginTabIfNeeded();
      throw new Error('Not logged in');
    }
    const data = await response.json();
    chrome.storage.local.set({ termsData: data, termsLastUpdated: Date.now() });
    broadcastUpdate('terms', { terms: data, termsLastUpdated: Date.now() });
    try {
      await fetch(`${BACKEND_URL}/terms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      console.log('Terms synced to backend server');
    } catch (e) { console.warn('Could not sync terms to backend:', e); }
    return { success: true, data, timestamp: Date.now() };
  } catch (error) {
    console.error('Terms fetch error:', error);
    const cached = await chrome.storage.local.get(['termsData', 'termsLastUpdated']);
    if (cached.termsData) return { success: true, data: cached.termsData, timestamp: cached.termsLastUpdated, cached: true };
    return { success: false, error: error.message };
  }
}

async function fetchMissing(termSource) {
  const termIDs = Array.isArray(termSource)
    ? getOrderedTermIDs(termSource)
    : (Number.isFinite(termSource) ? [termSource] : []);

  if (!termIDs.length) return { success: false, error: 'No termID' };

  try {
    const settled = await Promise.allSettled(termIDs.map(fetchMissingForTerm));
    const successful = settled
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    if (!successful.length) {
      const firstError = settled.find(result => result.status === 'rejected');
      throw firstError?.reason || new Error('No missing data returned');
    }

    const data = mergeMissingResults(successful);
    chrome.storage.local.set({ missingData: data, missingLastUpdated: Date.now() });
    broadcastUpdate('missing', { missing: data, missingLastUpdated: Date.now() });
    try {
      await fetch(`${BACKEND_URL}/missing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      console.log('Missing assignments synced to backend server');
    } catch (e) { console.warn('Could not sync missing data to backend:', e); }
    return { success: true, data, timestamp: Date.now() };
  } catch (error) {
    console.error('Missing fetch error:', error);
    const cached = await chrome.storage.local.get(['missingData', 'missingLastUpdated']);
    if (cached.missingData) return { success: true, data: cached.missingData, timestamp: cached.missingLastUpdated, cached: true };
    return { success: false, error: error.message };
  }
}

// ============ BACKGROUND AUTO-UPDATE ============
// Update every 5 minutes in the background
const UPDATE_INTERVAL_MINUTES = 5;

// Use Chrome's alarm API for reliable background updates
chrome.alarms.create('fetchData', { periodInMinutes: UPDATE_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchData') {
    console.log(`[${new Date().toLocaleTimeString()}] ⏰ Background update triggered`);
    safeFetchAll();
  }
});

// Helper: Check if the current active tab is on a blocked site
function isBlockedSite(url) {
  // Add more URLs as needed
  return url.startsWith("http://127.0.0.1:5500/sites/wallpaper/") ||
         url.startsWith("http://127.0.0.1:5500/sites/settings/");
}

// Helper: Only run fetchAll if not on blocked site
function safeFetchAll() {
  return new Promise((resolve) => {
    chrome.tabs.query({active: true, lastFocusedWindow: true}, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url && isBlockedSite(tabs[0].url)) {
        console.log('Skipping background fetch: on blocked site', tabs[0].url);
        resolve();
        return;
      }
      fetchAll().then(result => {
        if (result.grades.success || result.assignments.success) {
          console.log(`[${new Date().toLocaleTimeString()}] ✅ Background sync complete`);
        }
        resolve(result);
      }).catch(err => {
        console.log(`[${new Date().toLocaleTimeString()}] ❌ Background sync failed:`, err.message);
        resolve();
      });
    });
  });
}

// Helper: Broadcast update to all relevant tabs (wallpaper/settings)
function broadcastUpdate(type, payload) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (
        tab.url &&
        (
          tab.url.startsWith("http://127.0.0.1:5500/sites/wallpaper/") ||
          tab.url.startsWith("http://127.0.0.1:5500/sites/settings/")
        )
      ) {
        chrome.tabs.sendMessage(tab.id, { type, payload });
      }
    });
  });
}

// Also fetch immediately when extension starts/installs
chrome.runtime.onInstalled.addListener(() => {
  console.log('Grades Extension installed - fetching initial data...');
  safeFetchAll();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started - fetching grades data...');
  safeFetchAll();
});

// Fetch when service worker wakes up (keep data fresh)
safeFetchAll().then(() => {
  console.log('Service worker started - initial fetch complete');
}).catch(() => {});
