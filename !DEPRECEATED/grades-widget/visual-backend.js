// --- Grades Widget - Works on ANY browser ---
// Fetches grades from backend server (synced by extension)

const BACKEND_URL = "http://localhost:3001/grades";

/**
 * Fetch grades from backend server
 */
async function fetchGrades() {
    const statusEl = document.getElementById('status-text');
    const gradesEl = document.getElementById('grades-content');
    const loginEl = document.getElementById('login-prompt');
    
    statusEl.textContent = "Loading...";
    statusEl.style.color = "#3498db";
    
    try {
        const response = await fetch(BACKEND_URL);
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.grades) {
            throw new Error('No grades data available');
        }
        
        // Display the grades
        gradesEl.innerHTML = displayGrades(result.grades);
        gradesEl.style.display = 'block';
        loginEl.style.display = 'none';
        
        // Show when data was last updated
        if (result.lastUpdated) {
            const date = new Date(result.lastUpdated);
            statusEl.textContent = `Last synced: ${date.toLocaleString()}`;
            statusEl.style.color = "#27ae60";
        }
        
    } catch (error) {
        console.error('Fetch error:', error);
        gradesEl.innerHTML = `<p class="error">Could not load grades.<br><small>${error.message}</small></p>`;
        gradesEl.style.display = 'block';
        loginEl.style.display = 'block';
        statusEl.textContent = "Sync required";
        statusEl.style.color = "#e74c3c";
    }
}

/**
 * Parse and display grades from JSON data
 */
function displayGrades(data) {
    if (!data || data.length === 0) {
        return '<p class="error">No enrollment data found.</p>';
    }

    const enrollmentData = data[0];
    let html = '';
    
    // Calculate Q2 average
    const currentTermSeq = 2;
    const currentTermData = enrollmentData.terms.find(term => term.termSeq === currentTermSeq);
    
    if (currentTermData && currentTermData.courses) {
        let totalGrade = 0;
        let gradeCount = 0;
        
        currentTermData.courses.forEach(course => {
            const termGradeTask = course.gradingTasks.find(task => 
                task.termID === currentTermData.termID && task.taskID === 2 && task.progressScore
            );
            if (termGradeTask) {
                totalGrade += parseInt(termGradeTask.progressScore);
                gradeCount++;
            }
        });
        
        if (gradeCount > 0) {
            const avgGrade = (totalGrade / gradeCount).toFixed(1);
            html += `<div class="gpa-display">
                <div class="gpa-label">Q2 Average</div>
                <div class="gpa-value">${avgGrade}%</div>
            </div>`;
        }
    }

    // Display Q2 grades (current)
    if (currentTermData && currentTermData.courses && currentTermData.courses.length > 0) {
        html += '<div class="term-section">';
        html += '<div class="term-title">🟢 Q2 (Current)</div>';
        currentTermData.courses.forEach(course => {
            html += renderCourseRow(course, currentTermData);
        });
        html += '</div>';
    }

    // Display Q1 grades
    const q1Term = enrollmentData.terms.find(term => term.termSeq === 1);
    if (q1Term && q1Term.courses && q1Term.courses.length > 0) {
        html += '<div class="term-section">';
        html += '<div class="term-title">📅 Q1 (Completed)</div>';
        q1Term.courses.forEach(course => {
            html += renderCourseRow(course, q1Term);
        });
        html += '</div>';
    }

    return html;
}

/**
 * Render a single course row
 */
function renderCourseRow(course, termData) {
    const courseName = course.courseName;
    let gradeScore = "N/A";
    let gradeClass = "grade-na";
    
    const termGradeTask = course.gradingTasks.find(task => 
        task.termID === termData.termID && task.taskID === 2 && task.progressScore
    );

    if (termGradeTask) {
        gradeScore = termGradeTask.progressScore;
        const score = parseInt(gradeScore);
        if (score >= 90) gradeClass = 'grade-a';
        else if (score >= 80) gradeClass = 'grade-b';
        else gradeClass = 'grade-c';
    }

    return `<div class="course-row">
        <span class="course-name">${courseName}</span>
        <span class="course-grade ${gradeClass}">${gradeScore}</span>
    </div>`;
}

// Fetch on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchGrades();
    
    // Auto-refresh every minute
    setInterval(fetchGrades, 60 * 1000);
});
