// ==UserScript==
// @name         Grades Widget
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Display grades in a widget on the school portal
// @author       You
// @match        https://410.ncsis.gov/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Create the widget container
    const widget = document.createElement('div');
    widget.id = 'grades-widget';
    widget.innerHTML = `
        <style>
            #grades-widget {
                position: fixed;
                top: 10px;
                right: 10px;
                width: 320px;
                max-height: 400px;
                overflow-y: auto;
                background: white;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 999999;
                font-family: Arial, sans-serif;
                padding: 15px;
            }
            #grades-widget h2 {
                margin: 0 0 10px 0;
                font-size: 16px;
                color: #2c3e50;
                border-bottom: 2px solid #3498db;
                padding-bottom: 5px;
            }
            #grades-widget table {
                width: 100%;
                border-collapse: collapse;
            }
            #grades-widget th, #grades-widget td {
                padding: 8px;
                text-align: left;
                border-bottom: 1px dotted #eee;
            }
            #grades-widget th {
                color: #7f8c8d;
                font-size: 12px;
            }
            #grades-widget .grade-a { color: #27ae60; font-weight: bold; }
            #grades-widget .grade-b { color: #f39c12; font-weight: bold; }
            #grades-widget .grade-c { color: #e74c3c; font-weight: bold; }
            #grades-widget .close-btn {
                position: absolute;
                top: 5px;
                right: 10px;
                cursor: pointer;
                font-size: 18px;
                color: #95a5a6;
            }
            #grades-widget .close-btn:hover { color: #e74c3c; }
            #grades-widget .loading { text-align: center; padding: 20px; color: #7f8c8d; }
            #grades-widget .error { color: #e74c3c; padding: 10px; }
            #grades-widget .minimize-btn {
                position: absolute;
                top: 5px;
                right: 35px;
                cursor: pointer;
                font-size: 18px;
                color: #95a5a6;
            }
            #grades-widget.minimized {
                width: auto;
                height: auto;
                padding: 10px;
            }
            #grades-widget.minimized .widget-content { display: none; }
            #grades-widget.minimized h2 { margin: 0; border: none; padding: 0; }
        </style>
        <span class="minimize-btn" onclick="this.parentElement.classList.toggle('minimized')">_</span>
        <span class="close-btn" onclick="this.parentElement.remove()">×</span>
        <h2>📊 Current Grades</h2>
        <div class="widget-content">
            <div class="loading">Loading grades...</div>
        </div>
    `;
    document.body.appendChild(widget);

    // Fetch and display grades
    fetch('https://410.ncsis.gov/campus/resources/portal/grades', {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to fetch grades');
        return response.json();
    })
    .then(data => {
        const content = widget.querySelector('.widget-content');
        
        if (!data || data.length === 0) {
            content.innerHTML = '<p class="error">No enrollment data found.</p>';
            return;
        }

        // Find current term (Q2)
        const currentTermSeq = 2;
        const enrollmentData = data[0];
        const currentTermData = enrollmentData.terms.find(term => term.termSeq === currentTermSeq);

        if (!currentTermData || !currentTermData.courses || currentTermData.courses.length === 0) {
            content.innerHTML = '<p>No active courses for Q2.</p>';
            return;
        }

        let html = '<table><thead><tr><th>Course</th><th style="text-align:right">Grade</th></tr></thead><tbody>';

        currentTermData.courses.forEach(course => {
            const courseName = course.courseName;
            let gradeScore = "N/A";
            let gradeClass = "";

            const termGradeTask = course.gradingTasks.find(task =>
                task.termID === currentTermData.termID && task.taskID === 2 && task.progressScore
            );

            if (termGradeTask) {
                gradeScore = termGradeTask.progressScore;
                const score = parseInt(gradeScore);
                if (score >= 90) gradeClass = 'grade-a';
                else if (score >= 80) gradeClass = 'grade-b';
                else gradeClass = 'grade-c';
            }

            html += `<tr><td>${courseName}</td><td style="text-align:right" class="${gradeClass}">${gradeScore}</td></tr>`;
        });

        html += '</tbody></table>';
        content.innerHTML = html;
    })
    .catch(err => {
        const content = widget.querySelector('.widget-content');
        content.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    });
})();
