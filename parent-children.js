// parent-children.js - FIXED VERSION with proper error handling and auth headers

(() => {
  const API_BASE_URL = 'http://localhost:8080/api/v1';

  function safeShowMessage(title, message, type = 'info') {
    if (typeof window.showMessage === 'function') {
      try { window.showMessage(title, message, type); return; } catch (e) { /* ignore */ }
    }
    console[type === 'error' ? 'error' : 'log'](`[${title}] ${message}`);
  }

  function getAuthToken() {
    return localStorage.getItem('authToken');
  }

  function getCurrentUserRaw() {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  // return a normalized parent id from many possible shapes
  function resolveParentId(user) {
    if (!user) return null;
    return user.id || user.studentId || user.student_id || user.userId || user.username || user.email || null;
  }

  function buildAuthHeaders() {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // ADD user info as headers for backend authorization
    const user = getCurrentUserRaw();
    if (user && user.id) {
      headers['X-User-Id'] = user.id;
      headers['X-User-Role'] = user.role || 'parent';
    }

    return headers;
  }

  async function fetchLinkedChildren(parentId) {
    console.debug('fetchLinkedChildren: parentId=', parentId);
    if (!parentId) {
      console.warn('fetchLinkedChildren called with empty parentId');
      return [];
    }
    const headers = buildAuthHeaders();
    try {
      const resp = await fetch(`${API_BASE_URL}/parents/${encodeURIComponent(parentId)}/children`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.warn('fetchLinkedChildren failed', resp.status, resp.statusText, text);
        const err = new Error(`HTTP ${resp.status} ${resp.statusText}`);
        err.status = resp.status;
        err.body = text;
        throw err;
      }

      const data = await resp.json().catch(() => null);
      if (!Array.isArray(data)) {
        console.warn('fetchLinkedChildren: server returned non-array payload', data);
        return [];
      }
      console.debug('fetchLinkedChildren: got', data.length, 'children');
      return data;
    } catch (err) {
      console.error('fetchLinkedChildren error', err);
      throw err;
    }
  }

  async function fetchFeesForChild(childId) {
    const headers = buildAuthHeaders();
    return fetch(`${API_BASE_URL}/fees/student/${encodeURIComponent(childId)}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
  }

  async function fetchStudentDetails(studentId) {
    if (!studentId) return null;
    try {
      const resp = await fetch(`${API_BASE_URL}/students/${encodeURIComponent(studentId)}`, {
        method: 'GET',
        headers: buildAuthHeaders(),
        credentials: 'include'
      });
      if (!resp.ok) return null;
      return resp.json();
    } catch (err) {
      console.error('fetchStudentDetails error', err);
      return null;
    }
  }

  async function fetchEnrollmentsForStudent(studentId) {
    try {
      const resp = await fetch(`${API_BASE_URL}/enrollments/student/${encodeURIComponent(studentId)}`, {
        method: 'GET',
        headers: buildAuthHeaders(),
        credentials: 'include'
      });
      if (!resp.ok) return [];
      return resp.json();
    } catch (err) {
      console.error('fetchEnrollmentsForStudent error', err);
      return [];
    }
  }

  function gradeToPoints(grade) {
    switch (grade) {
      case 'A+':
      case 'A': return 4.0;
      case 'B+': return 3.0;
      case 'B': return 2.0;
      case 'C': return 1.0;
      default: return 0.0;
    }
  }

  function computeGPAFromEnrollments(rows) {
    let totalPoints = 0;
    let totalCreditsForGpa = 0;
    let creditsEarned = 0;
    for (const r of rows) {
      const credits = Number(r.credits ?? r.courseCredits ?? r.course_credits ?? 0);
      const grade = r.grade ?? null;
      if (!isNaN(credits) && credits > 0) {
        if (grade && grade !== 'N/A' && grade !== 'F' && grade !== '') creditsEarned += credits;
        const points = gradeToPoints(grade);
        totalPoints += points * credits;
        if (points > 0) totalCreditsForGpa += credits;
      }
    }
    const gpa = totalCreditsForGpa > 0 ? (totalPoints / totalCreditsForGpa) : null;
    return { gpa, creditsEarned };
  }

  async function populateParentFinancialOverview(childId) {
    const statBalanceEl = document.getElementById('parent-current-balance-display');
    const statDueDateEl = document.getElementById('fee-due-date');
    const detailBalanceEl = document.getElementById('parent-current-balance');
    const lastPaymentEl = document.getElementById('parent-last-payment');
    const trackingLineEl = document.getElementById('student-tracking-line');

    if (!statBalanceEl || !detailBalanceEl || !lastPaymentEl || !trackingLineEl) {
      console.warn('populateParentFinancialOverview: required DOM elements not found; aborting update');
      return;
    }

    [statBalanceEl, detailBalanceEl, lastPaymentEl].forEach(el => { if (el) el.innerText = 'Loading...'; });
    if (statDueDateEl) statDueDateEl.innerText = 'Checking...';
    if (trackingLineEl) trackingLineEl.textContent = `Tracking performance for: ID ${childId}...`;

    if (!childId) {
      [statBalanceEl, detailBalanceEl, lastPaymentEl].forEach(el => { if (el) el.innerText = 'N/A'; });
      if (statDueDateEl) statDueDateEl.innerText = 'N/A';
      if (trackingLineEl) trackingLineEl.textContent = `Tracking performance for: No child selected`;
      return;
    }

    try {
      const resp = await fetchFeesForChild(childId);
      if (!resp.ok) {
        const txt = await resp.text().catch(()=>'');
        console.warn('Fees fetch failed', resp.status, txt);
        if (resp.status === 404) {
          [statBalanceEl, detailBalanceEl].forEach(el => { if (el) el.innerText = '₹0.00'; });
          if (lastPaymentEl) lastPaymentEl.innerText = 'No payments yet';
          if (statDueDateEl) statDueDateEl.innerText = 'No dues';
          if (trackingLineEl) trackingLineEl.textContent = `Tracking performance for: ID ${childId} (No fee data)`;
          return;
        }
        throw new Error(`HTTP ${resp.status}: ${txt}`);
      }

      const fees = await resp.json().catch(() => []);
      const totalPending = (fees || []).filter(f => f.status !== 'Paid').reduce((s,f)=>s+parseFloat(f.amount||0),0);
      const paid = (fees || []).filter(f => f.status === 'Paid');
      const lastPayment = paid.length ? paid.sort((a,b)=>new Date(b.dueDate)-new Date(a.dueDate))[0] : null;
      const pending = (fees || []).filter(f => f.status !== 'Paid');
      const nextDue = pending.length ? pending.sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0] : null;

      const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
      const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedBalance = currencyFormatter.format(totalPending);

      statBalanceEl.innerText = formattedBalance;
      detailBalanceEl.innerText = formattedBalance;
      if (lastPaymentEl) lastPaymentEl.innerText = lastPayment ? dateFormatter.format(new Date(lastPayment.dueDate)) : 'No payments yet';
      if (statDueDateEl) statDueDateEl.innerText = nextDue ? `Due Date: ${dateFormatter.format(new Date(nextDue.dueDate))}` : (totalPending > 0 ? 'Due Date: N/A' : 'No dues');
      if (trackingLineEl) trackingLineEl.innerText = `Tracking performance for: ID ${childId} (Fees: ${formattedBalance} pending)`;
    } catch (err) {
      console.error('populateParentFinancialOverview error', err);
      [statBalanceEl, detailBalanceEl, lastPaymentEl].forEach(el => { if (el) el.innerText = 'Error'; });
      if (statDueDateEl) statDueDateEl.innerText = 'Error';
      safeShowMessage("API Error", `Failed to fetch data for ID ${childId}: ${err.message}`, 'error');
    }
  }

  function handleChildChange(event) {
    const selectedChildId = event.target.value;
    if (selectedChildId) {
      localStorage.setItem('selectedChildId', selectedChildId);
      populateParentFinancialOverview(selectedChildId);
      updateChildOverview(selectedChildId);
    } else {
      populateParentFinancialOverview(null);
      updateChildOverview(null);
    }
  }

  async function updateChildOverview(childId) {
    const welcomeEl = document.getElementById('parent-welcome');
    const trackingLineEl = document.getElementById('student-tracking-line');
    const gpaTitleEl = document.getElementById('gpa-title');
    const gpaValueEl = document.getElementById('gpa-value');
    const gpaContextEl = document.getElementById('gpa-context');
    const attendanceValueEl = document.getElementById('attendance-value');
    const attendanceContextEl = document.getElementById('attendance-context');
    const recentBody = document.getElementById('recent-academics-body');

    // Reset to "No child selected" state
    if (!childId) {
      if (welcomeEl) welcomeEl.innerText = 'Welcome';
      if (trackingLineEl) trackingLineEl.innerText = 'Tracking performance for: No child selected';
      if (gpaTitleEl) gpaTitleEl.innerText = 'Latest GPA';
      if (gpaValueEl) gpaValueEl.innerText = 'N/A';
      if (gpaContextEl) gpaContextEl.innerText = 'Select a child';
      if (attendanceValueEl) attendanceValueEl.innerText = 'N/A';
      if (attendanceContextEl) attendanceContextEl.innerText = 'Select a child';
      if (recentBody) recentBody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">No child selected</td></tr>';
      return;
    }

    // Show loading states
    if (gpaValueEl) gpaValueEl.innerText = 'Loading...';
    if (gpaContextEl) gpaContextEl.innerText = '';
    if (attendanceValueEl) attendanceValueEl.innerText = 'Loading...';
    if (attendanceContextEl) attendanceContextEl.innerText = '';
    if (recentBody) recentBody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">Loading academic data...</td></tr>';

    try {
      // Fetch student and enrollments with individual error handling
      let student = null;
      let enrollments = [];

      try {
        student = await fetchStudentDetails(childId);
        console.log('Fetched student details:', student);
      } catch (err) {
        console.error('Failed to fetch student details:', err);
        safeShowMessage('Student Error', `Could not load student details: ${err.message}`, 'error');
      }

      try {
        enrollments = await fetchEnrollmentsForStudent(childId);
        console.log('Fetched enrollments:', enrollments);
      } catch (err) {
        console.error('Failed to fetch enrollments:', err);
        // Don't show error message, just use empty array
      }

      // Update welcome message
      const name = student && (student.firstName || student.name || student.first_name)
        ? `${student.firstName || student.name || ''} ${student.lastName || student.last_name || ''}`.trim()
        : `Student ${childId}`;

      if (welcomeEl) welcomeEl.innerText = `Welcome, ${name}!`;
      if (trackingLineEl) trackingLineEl.innerText = `Tracking performance for: ${name} (ID ${childId})`;

      // Update GPA title
      if (gpaTitleEl) {
        const firstName = student?.firstName || student?.name || 'Student';
        gpaTitleEl.innerText = `${firstName}'s Latest GPA`;
      }

      // Compute and display GPA
      const { gpa } = computeGPAFromEnrollments(enrollments || []);
      if (gpaValueEl) {
        gpaValueEl.innerText = (gpa !== null && !isNaN(gpa)) ? gpa.toFixed(2) : 'N/A';
      }
      if (gpaContextEl) {
        if (gpa >= 3.5) gpaContextEl.innerText = 'Excellent performance';
        else if (gpa >= 3.0) gpaContextEl.innerText = 'Consistent performance';
        else if (gpa >= 2.0) gpaContextEl.innerText = 'Needs improvement';
        else gpaContextEl.innerText = 'Below average';
      }

      // Generate random attendance (70-94%)
      const att = Math.floor(Math.random() * (94 - 70 + 1)) + 70;
      if (attendanceValueEl) attendanceValueEl.innerText = `${att}%`;
      if (attendanceContextEl) {
        if (att >= 90) attendanceContextEl.innerText = 'Excellent attendance';
        else if (att >= 80) attendanceContextEl.innerText = 'Good standing';
        else attendanceContextEl.innerText = 'Needs improvement';
      }

      // Populate recent academics table
      if (recentBody) {
        if (!enrollments || enrollments.length === 0) {
          recentBody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">No enrollments found.</td></tr>';
        } else {
          recentBody.innerHTML = enrollments.map(e => {
            const course = e.courseName || e.course_name || e.courseCode || 'Course';
            const grade = e.grade || 'N/A';
            const instructor = student?.advisor || 'N/A';
            const gradeBadge = (grade === 'A+' || grade === 'A') ? 'bg-green-500' :
                               (grade === 'B+' || grade === 'B') ? 'bg-blue-500' :
                               (grade === 'C') ? 'bg-yellow-500' : 'bg-gray-400';
            return `
              <tr>
                <td class="px-6 py-5 whitespace-nowrap">
                  <div class="text-sm font-semibold text-gray-900">${course}</div>
                </td>
                <td class="px-6 py-5 whitespace-nowrap">
                  <span class="px-4 py-2 text-xs font-bold rounded-xl text-white ${gradeBadge}">${grade}</span>
                </td>
                <td class="px-6 py-5 whitespace-nowrap">
                  <div class="text-sm text-gray-700 font-medium">${instructor}</div>
                </td>
                <td class="px-6 py-5 whitespace-nowrap">
                  <button onclick="showMessage('View Course', 'Course: ${course.replace(/'/g, "\\'")}', 'info')" class="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-semibold transition duration-200">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                        </svg>
                                        <span>View</span>
                                    </button>
                                  </td>
                                </tr>
                              `;
                            }).join('');
                          }
                        }

                      } catch (err) {
                        console.error('updateChildOverview error', err);
                        if (gpaValueEl) gpaValueEl.innerText = 'Error';
                        if (gpaContextEl) gpaContextEl.innerText = 'Failed to load';
                        if (attendanceValueEl) attendanceValueEl.innerText = 'Error';
                        if (attendanceContextEl) attendanceContextEl.innerText = 'Failed to load';
                        if (recentBody) recentBody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">Failed to load academic data</td></tr>';
                        safeShowMessage('Overview Error', 'Failed to update child overview: ' + (err.message || err), 'error');
                      }
                    }

                    async function initParentPage() {
                      try {
                        const rawUser = getCurrentUserRaw();
                        console.debug('initParentPage currentUser raw=', rawUser);
                        if (!rawUser) {
                          console.warn('initParentPage: no currentUser in localStorage; aborting init');
                          return;
                        }
                        const parentId = resolveParentId(rawUser);
                        console.debug('initParentPage: resolved parentId=', parentId);
                        if (!parentId) {
                          console.warn('initParentPage: could not resolve parent ID from currentUser; user object:', rawUser);
                          safeShowMessage('Init Warning', 'Could not determine parent ID from login. Check localStorage.currentUser.', 'error');
                          return;
                        }

                        if (rawUser.role && rawUser.role !== 'parent') {
                          console.log('User not a parent. Aborting parent page init.');
                          return;
                        }

                        const childrenSelect = document.getElementById('children-select');
                        if (!childrenSelect) {
                          console.warn('initParentPage: children-select element not found in DOM');
                          return;
                        }

                        let children = (rawUser.children && Array.isArray(rawUser.children) && rawUser.children.length > 0) ? rawUser.children : null;

                        try {
                          if (!children) {
                            console.log('No children in currentUser, fetching from API...');
                            children = await fetchLinkedChildren(parentId);
                          }
                        } catch (err) {
                          console.error('Could not fetch children for parent', parentId, err);
                          safeShowMessage('Children Load Failed', `Could not load linked children for parent ${parentId}: ${err.message}`, 'error');
                          childrenSelect.innerHTML = '<option value="">Failed to load children</option>';
                          childrenSelect.disabled = true;
                          return;
                        }

                        let initialChildId = localStorage.getItem('selectedChildId');

                        childrenSelect.innerHTML = '<option value="">-- Select a child --</option>';
                        if (!children || children.length === 0) {
                          childrenSelect.innerHTML = '<option value="">No children linked</option>';
                          childrenSelect.disabled = true;
                          populateParentFinancialOverview(null);
                          updateChildOverview(null);
                          return;
                        }

                        children.forEach((child, idx) => {
                          const option = document.createElement('option');
                          // Support various property names returned by backend
                          const firstName = child.firstName || child.first_name || '';
                          const lastName = child.lastName || child.last_name || '';
                          const fullName = `${firstName} ${lastName}`.trim();
                          const label = fullName || child.name || child.id || child.studentId || child.student_id || 'Unknown';
                          const value = child.id || child.studentId || child.student_id;

                          option.value = value;
                          option.textContent = label;
                          childrenSelect.appendChild(option);
                          if (!initialChildId && idx === 0) initialChildId = value;
                        });

                        childrenSelect.disabled = false;
                        if (initialChildId) childrenSelect.value = initialChildId;
                        const chosen = childrenSelect.value || initialChildId;

                        console.log('Initializing with child:', chosen);
                        populateParentFinancialOverview(chosen);
                        updateChildOverview(chosen);
                        childrenSelect.addEventListener('change', handleChildChange);
                      } catch (err) {
                        console.error('initParentPage unexpected error', err);
                        safeShowMessage('Initialization Error', 'Parent page failed to initialize: ' + (err.message || err), 'error');
                      }
                    }

                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', initParentPage);
                    } else {
                      initParentPage();
                    }
                  })();