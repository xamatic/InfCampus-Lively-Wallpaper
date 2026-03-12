// Content script - runs on test.html pages and communicates with background
(function() {
  // Check if this page has the grades widget elements
  const gradesContent = document.getElementById('grades-content');
  const statusText = document.getElementById('status-text');
  const loginPrompt = document.getElementById('login-prompt');
  
  if (!gradesContent) {
    console.log('Grades Widget: No grades-content element found, skipping.');
    return;
  }
  
  console.log('Grades Widget: Content script loaded, fetching grades...');
  
  // Override the fetchGrades function to use extension messaging
  window.fetchGrades = function() {
    if (statusText) {
      statusText.textContent = "Loading via extension...";
      statusText.style.color = "#3498db";
    }
    
    chrome.runtime.sendMessage({ action: "fetchGrades" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Extension error:', chrome.runtime.lastError);
        if (statusText) {
          statusText.textContent = "Extension error";
          statusText.style.color = "#e74c3c";
        }
        return;
      }
      
      if (response && response.success) {
        // Display the grades
        gradesContent.innerHTML = displayGrades(response.data);
        gradesContent.style.display = 'block';
        if (loginPrompt) loginPrompt.style.display = 'none';
        
        const date = new Date(response.timestamp);
        if (statusText) {
          if (response.cached) {
            statusText.textContent = `Cached: ${date.toLocaleTimeString()}`;
            statusText.style.color = "#f39c12";
          } else {
            statusText.textContent = `Updated: ${date.toLocaleTimeString()}`;
            statusText.style.color = "#27ae60";
          }
        }
      } else {
        // Show login prompt
        gradesContent.style.display = 'none';
        if (loginPrompt) loginPrompt.style.display = 'block';
        if (statusText) {
          statusText.textContent = "Login required";
          statusText.style.color = "#e74c3c";
        }
      }
    });
  };
  
  // Grade display functions (same as in popup.js)
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
    if (!data || data.length === 0) {
      return '<p class="error">No enrollment data found.</p>';
    }

    const enrollmentData = getEnrollmentData(data);
    if (!enrollmentData) {
      return '<p class="error">No enrollment data found.</p>';
    }

    const terms = [...(enrollmentData.terms || [])].sort((a, b) => a.termSeq - b.termSeq);
    let html = '';

    const currentTermSeq = getCurrentTermSeq(terms);

    const termNames = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };

    const courseEntries = buildCourseEntries(enrollmentData);

    // Current-term average
    const currentEntries = courseEntries.filter(e => e.termSeq === currentTermSeq);
    if (currentEntries.length > 0) {
      const avg = (currentEntries.reduce((sum, entry) => sum + getGradeValue(entry.task), 0) / currentEntries.length).toFixed(1);
      html += `<div class="gpa-display">
        <div class="gpa-label">${termNames[currentTermSeq]} Average</div>
        <div class="gpa-value">${avg}%</div>
      </div>`;
    }

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

    return html;
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
  
  // Fetch grades immediately
  window.fetchGrades();
  
  // Set up auto-refresh every 5 minutes
  setInterval(window.fetchGrades, 5 * 60 * 1000);
})();
