import { openLoginTabIfNeeded } from "./universal.js";

const GRADES_URL = "https://410.ncsis.gov/campus/resources/portal/grades";
const ASSIGNMENTS_URL = "https://410.ncsis.gov/campus/api/portal/assignment/recentlyScored";
const LOGIN_URL = 'https://410.ncsis.gov/';
const PORTAL_URL = 'https://410.ncsis.gov/campus/portal/students';
const BACKEND_URL = "http://localhost:3001";

// Get date 14 days ago for assignments query
function getModifiedDate() {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  return date.toISOString().split('T')[0] + 'T00:00:00';
}

async function fetchAll() {
  const statusEl = document.getElementById('status');
  const contentEl = document.getElementById('content');
  
  statusEl.textContent = "Loading...";
  statusEl.style.color = "#fff";
  
  try {
    // Fetch grades and assignments in parallel
    const [gradesResponse, assignmentsResponse] = await Promise.all([
      fetch(GRADES_URL, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`${ASSIGNMENTS_URL}?modifiedDate=${getModifiedDate()}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })
    ]);
    
    if (!gradesResponse.ok) {
      throw new Error(`HTTP ${gradesResponse.status}`);
    }
    
    const gradesContentType = gradesResponse.headers.get('content-type');
    if (!gradesContentType || !gradesContentType.includes('application/json')) {
      openLoginTabIfNeeded();
      throw new Error('Not logged in');
    }
    
    const gradesData = await gradesResponse.json();
    let assignmentsData = [];
    
    if (gradesResponse.ok && assignmentsResponse.ok && assignmentsResponse.status === 200 && gradesResponse.status === 200) {
      const assignmentsContentType = assignmentsResponse.headers.get('content-type');
      if (assignmentsContentType && assignmentsContentType.includes('application/json')) {
        assignmentsData = await assignmentsResponse.json();
      }
    } else {
      openLoginTabIfNeeded();
      throw new Error("Assignment (1), grade response (2): (1) " + gradesResponse.ok, ", (2)", assignmentsResponse.ok);
    }
    // Save to extension storage
    chrome.storage.local.set({ 
      gradesData: gradesData,
      assignmentsData: assignmentsData,
      lastUpdated: Date.now() 
    });
    
    // SYNC TO BACKEND SERVER - so any browser can access
    try {
      await Promise.all([
        fetch(`${BACKEND_URL}/grades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gradesData)
        }),
        fetch(`${BACKEND_URL}/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assignmentsData)
        })
      ]);
      console.log('✅ Grades & Assignments synced to backend!');
    } catch (backendErr) {
      console.warn('Backend sync failed:', backendErr);
    }
    
    displayGrades(gradesData);
    
    const now = new Date();
    statusEl.textContent = `Synced: ${now.toLocaleTimeString()} (${assignmentsData.length} assignments)`;
    statusEl.style.color = "#2ecc71";
    
  } catch (error) {
    console.error('Fetch error:', error);
    
    // Try to load cached data
    chrome.storage.local.get(['gradesData', 'assignmentsData', 'lastUpdated'], (result) => {
      if (result.gradesData) {
        displayGrades(result.gradesData);
        const date = new Date(result.lastUpdated);
        statusEl.textContent = `Cached: ${date.toLocaleDateString()}`;
        statusEl.style.color = "#f39c12";
      } else {
        showLoginPrompt();
        statusEl.textContent = "Login required";
        statusEl.style.color = "#e74c3c";
      }
    });
  }
}

// Keep old function name for compatibility
async function fetchGrades() {
  return fetchAll();
}

function getEnrollmentData(data) {
  if (Array.isArray(data)) {
    return data[0] || null;
  }
  if (data && Array.isArray(data.grades)) {
    return data.grades[0] || null;
  }
  return data && data.enrollmentID ? data : null;
}

function getGradeValue(task) {
  const rawValue = task?.progressScore ?? task?.score;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  const numericValue = Number.parseInt(rawValue, 10);
  if (Number.isNaN(numericValue)) {
    return null;
  }

  return numericValue;
}

function findTermGradeTask(course, term) {
  if (!course?.gradingTasks?.length || !term) {
    return null;
  }

  return course.gradingTasks.find((task) => {
    if (task.taskID !== 2) {
      return false;
    }
    if (getGradeValue(task) === null) {
      return false;
    }

    if (term.termID && task.termID === term.termID) {
      return true;
    }

    return task.termSeq === term.termSeq;
  }) || null;
}

function getCurrentTermSeq(terms) {
  if (!terms.length) {
    return 1;
  }

  const now = new Date();
  const activeTerm = terms.find((term) => {
    const start = term.startDate ? new Date(term.startDate) : null;
    const end = term.endDate ? new Date(term.endDate) : null;
    return start && end && now >= start && now <= end;
  });

  if (activeTerm) {
    return activeTerm.termSeq;
  }

  const gradedTerm = [...terms]
    .sort((a, b) => b.termSeq - a.termSeq)
    .find((term) => (term.courses || []).some((course) => findTermGradeTask(course, term)));

  return gradedTerm?.termSeq || terms[terms.length - 1].termSeq || 1;
}

function buildCourseEntries(enrollment) {
  const terms = [...(enrollment?.terms || [])].sort((a, b) => b.termSeq - a.termSeq);
  if (!terms.length) {
    return [];
  }

  const seenCourseKeys = new Set();
  const entries = [];

  terms.forEach((term) => {
    (term.courses || []).forEach((course) => {
      if (course.dropped) {
        return;
      }

      const task = findTermGradeTask(course, term);
      if (!task) {
        return;
      }

      const courseKey = String(course.courseID || course.sectionID || course.courseName);
      if (seenCourseKeys.has(courseKey)) {
        return;
      }

      seenCourseKeys.add(courseKey);
      entries.push({ course, task, termSeq: term.termSeq });
    });
  });

  return entries;
}

function displayGrades(data) {
  const contentEl = document.getElementById('content');
  
  if (!data || data.length === 0) {
    contentEl.innerHTML = '<p class="error">No data found.</p>';
    return;
  }

  const enrollmentData = getEnrollmentData(data);
  if (!enrollmentData) {
    contentEl.innerHTML = '<p class="error">No data found.</p>';
    return;
  }

  const terms = [...(enrollmentData.terms || [])].sort((a, b) => a.termSeq - b.termSeq);
  let html = '';

  const currentTermSeq = getCurrentTermSeq(terms);

  const termNames = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };

  const courseEntries = buildCourseEntries(enrollmentData);

  // Current-term average for GPA display
  const currentEntries = courseEntries.filter(e => e.termSeq === currentTermSeq);
  if (currentEntries.length > 0) {
    const avg = (currentEntries.reduce((sum, entry) => sum + getGradeValue(entry.task), 0) / currentEntries.length).toFixed(1);
    html += `<div class="gpa-display">
      <div class="gpa-label">${termNames[currentTermSeq]} Average</div>
      <div class="gpa-value">${avg}%</div>
    </div>`;
  }

  // Group by termSeq, show current first then older
  const groups = {};
  courseEntries.forEach(e => { if (!groups[e.termSeq]) groups[e.termSeq] = []; groups[e.termSeq].push(e); });
  const sortedSeqs = Object.keys(groups).map(Number).sort((a, b) => b - a);

  sortedSeqs.forEach(seq => {
    const isCurrent = seq === currentTermSeq;
    const label = isCurrent ? `🟢 ${termNames[seq]} (Current)` : `📅 ${termNames[seq]} (Completed)`;
    html += '<div class="term-section">';
    html += `<div class="term-title">${label}</div>`;
    groups[seq].forEach(({ course, task }) => { html += renderCourseRow(course.courseName, getGradeValue(task)); });
    html += '</div>';
  });

  contentEl.innerHTML = html;
}

function renderCourseRow(courseName, gradeScore) {
  let gradeClass = 'grade-na';
  if (gradeScore && gradeScore !== 'N/A') {
    const score = parseInt(gradeScore);
    if (score >= 90) gradeClass = 'grade-a';
    else if (score >= 80) gradeClass = 'grade-b';
    else gradeClass = 'grade-c';
  }
  return `<div class="course-row">
    <span class="course-name">${courseName}</span>
    <span class="course-grade ${gradeClass}">${gradeScore || 'N/A'}</span>
  </div>`;
}

function showLoginPrompt() {
  const contentEl = document.getElementById('content');
  contentEl.innerHTML = `
    <div class="login-prompt">
      <p>⚠️ Please log in to NCEdCloud</p>
      <a href="${openLoginTabIfNeeded()}" target="_blank" class="btn">
        Log In
      </a>
      <p style="font-size: 0.8em; margin-top: 15px; color: #95a5a6;">
        After logging in, click Refresh
      </p>
    </div>
  `;
}

function openSettings() {
    const newURL = chrome.runtime.getURL("/sites/wallpaper-settings/settings.html");
    chrome.tabs.create({ url: newURL });
}

function showMore() {
  if (document.getElementById('more').textContent === 'More') {
    document.getElementById('more').textContent = 'Less';
    document.getElementById('content').style.maxHeight = '500px';
  } else {
    document.getElementById('more').textContent = 'More';
    document.getElementById('content').style.maxHeight = '300px';
  }
}

// Event listeners
document.getElementById('refresh').addEventListener('click', fetchGrades);
document.getElementById('settings').addEventListener('click', openSettings);
document.getElementById('more').addEventListener('click', openSettings);

// Fetch on popup open
fetchGrades();
