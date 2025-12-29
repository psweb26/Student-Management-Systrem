// profile-populate.js - FIXED VERSION
const API_BASE_URL = 'http://localhost:8080/api/v1';

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function getCurrentUserObj() {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
  } catch (e) {
    return null;
  }
}

function buildAuthHeaders() {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchJson(url, opts = {}) {
  const headers = Object.assign({}, buildAuthHeaders(), opts.headers || {});
  const res = await fetch(url, Object.assign({ headers, credentials: 'include' }, opts));
  return res;
}

async function fetchStudent(studentId) {
  const resp = await fetchJson(`${API_BASE_URL}/students/${encodeURIComponent(studentId)}`);
  if (!resp.ok) throw new Error('Failed to fetch student: ' + resp.status);
  return resp.json();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? '';
}

async function fetchEnrollments(studentId) {
  const resp = await fetchJson(`${API_BASE_URL}/enrollments/student/${encodeURIComponent(studentId)}`);
  if (!resp.ok) return [];
  return resp.json();
}

async function fetchFees(studentId) {
  const resp = await fetchJson(`${API_BASE_URL}/fees/student/${encodeURIComponent(studentId)}`);
  if (!resp.ok) return [];
  return resp.json();
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

async function fetchEnrollmentsAndComputeGPA(studentId) {
  try {
    const rows = await fetchEnrollments(studentId);
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
  } catch {
    return { gpa: null, creditsEarned: 0 };
  }
}

async function fetchFeeStatus(studentId) {
  try {
    const fees = await fetchFees(studentId);
    const totalPending = (fees || []).filter(f => f.status !== 'Paid').reduce((s,f)=>s+parseFloat(f.amount||0),0);
    const pendingRecord = (fees || []).filter(f => f.status !== 'Paid').sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    let status = 'PAID';
    if ((fees || []).some(f => f.status === 'Overdue')) status = 'OVERDUE';
    else if ((fees || []).some(f => f.status === 'Pending') || totalPending > 0) status = 'OUTSTANDING';
    return { totalPending, nextDueDate: pendingRecord ? pendingRecord.dueDate : null, status };
  } catch {
    return { totalPending: 0, nextDueDate: null, status: 'ERROR' };
  }
}

function formatCurrencyINR(amount) {
  try { return '₹ ' + (Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }
  catch { return '₹ 0.00'; }
}

async function refreshComputedSections(studentId) {
  try {
    const { gpa, creditsEarned } = await fetchEnrollmentsAndComputeGPA(studentId);
    const gpaEl = document.getElementById('profile-gpa');
    const creditsEl = document.getElementById('profile-credits');
    if (gpaEl) gpaEl.innerText = (gpa !== null && !isNaN(gpa)) ? gpa.toFixed(2) : 'N/A';
    if (creditsEl) creditsEl.innerText = `${creditsEarned ?? 0}/120`;
  } catch (err) {
    console.error('Error computing GPA/credits:', err);
  }

  try {
    const feeInfo = await fetchFeeStatus(studentId);
    const feeStatusEl = document.getElementById('fee-status');
    const dueAmountEl = document.getElementById('fee-due-amount');
    const dueDateEl = document.getElementById('fee-due-date');

    if (dueAmountEl) dueAmountEl.innerText = formatCurrencyINR(feeInfo.totalPending ?? 0);
    if (dueDateEl) dueDateEl.innerText = feeInfo.nextDueDate ? new Date(feeInfo.nextDueDate).toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' }) : 'N/A';

    if (feeStatusEl) {
      if (feeInfo.status === 'OVERDUE') {
        feeStatusEl.innerText = 'Overdue';
        feeStatusEl.className = 'text-red-700 font-bold text-lg';
      } else if (feeInfo.status === 'OUTSTANDING') {
        feeStatusEl.innerText = 'Outstanding';
        feeStatusEl.className = 'text-yellow-700 font-bold text-lg';
      } else {
        feeStatusEl.innerText = 'Paid Up';
        feeStatusEl.className = 'text-green-700 font-bold text-lg';
      }
    }
  } catch (err) {
    console.error('Error fetching fee status:', err);
  }
}

// Initialize from DOMContentLoaded - FIXED VERSION
document.addEventListener('DOMContentLoaded', async () => {
  // Only run if profile page elements exist
  if (!document.getElementById('profile-fullname')) {
    console.log('Profile elements not found, skipping profile-populate');
    return;
  }

  const user = getCurrentUserObj();
  if (!user || !user.id) {
    console.error('No user found in localStorage, redirecting to login');
    window.location.href = 'login.html';
    return;
  }

  if (user.role && user.role !== 'student') {
    if (window.showMessage) {
      window.showMessage('Access Denied','This page is for students only.','error');
    }
    return;
  }

  const studentId = user.id;

  // Show loading state
  setText('profile-fullname', 'Loading...');
  setText('profile-email', 'Loading...');
  setText('profile-phone', 'Loading...');
  setText('profile-gpa', 'Loading...');
  setText('profile-credits', 'Loading...');

  try {
    const studentData = await fetchStudent(studentId);
    window.currentStudentData = studentData;

    const fullName = `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim();
    const initials = (studentData.firstName ? studentData.firstName.charAt(0) : '') +
                    (studentData.lastName ? studentData.lastName.charAt(0) : '');

    // Update all fields with proper null checks
    const avatarInitials = document.getElementById('profile-avatar-initials');
    if (avatarInitials) avatarInitials.innerText = initials || 'PS';

    setText('profile-fullname', fullName || 'Student Name');
    setText('profile-id', studentData.id || 'N/A');
    setText('profile-email', studentData.email || 'N/A');
    setText('profile-phone', studentData.phoneNumber || 'N/A');
    setText('profile-dob', studentData.dateOfBirth || 'N/A');
    setText('profile-address', studentData.address || 'N/A');
    setText('profile-major', studentData.major || 'N/A');
    setText('profile-program', studentData.program || 'B.Tech');
    setText('profile-year', studentData.year || 'N/A');
    setText('profile-advisor', studentData.advisor || 'N/A');

    console.log('Profile data loaded successfully for student:', studentId);

    // Compute GPA and credits
    await refreshComputedSections(studentId);

  } catch (err) {
    console.error('Initial profile fetch failed:', err);
    setText('profile-fullname', 'Error loading profile');
    setText('profile-email', 'Error');
    setText('profile-phone', 'Error');
    if (window.showMessage) {
      window.showMessage('Error', 'Failed to load profile data: ' + err.message, 'error');
    }
  }

  // Setup logout
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      window.location.href = 'login.html';
    });
  }
});

// Export openEditModal and related functions for profile.html
window.openEditModal = function() {
  const modal = document.getElementById('edit-modal');
  if (!modal) return;

  const data = window.currentStudentData;
  if (!data) {
    alert('Student data not loaded yet.');
    return;
  }

  document.getElementById('edit-firstName').value = data.firstName || '';
  document.getElementById('edit-lastName').value = data.lastName || '';
  document.getElementById('edit-email').value = data.email || '';
  document.getElementById('edit-phone').value = data.phoneNumber || '';
  document.getElementById('edit-dob').value = data.dateOfBirth || '';
  document.getElementById('edit-address').value = data.address || '';
  document.getElementById('edit-major').value = data.major || '';
  document.getElementById('edit-program').value = data.program || '';
  document.getElementById('edit-year').value = data.year || '';
  document.getElementById('edit-advisor').value = data.advisor || '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

window.closeEditModal = function() {
  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// Setup edit modal handlers
document.addEventListener('DOMContentLoaded', () => {
  const editForm = document.getElementById('edit-form');
  const editCancel = document.getElementById('edit-cancel');

  if (editCancel) {
    editCancel.addEventListener('click', window.closeEditModal);
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const user = getCurrentUserObj();
      if (!user || !user.id) return;

      const updatedData = {
        id: user.id,
        firstName: document.getElementById('edit-firstName').value,
        lastName: document.getElementById('edit-lastName').value,
        email: document.getElementById('edit-email').value,
        phoneNumber: document.getElementById('edit-phone').value,
        dateOfBirth: document.getElementById('edit-dob').value,
        address: document.getElementById('edit-address').value,
        major: document.getElementById('edit-major').value,
        program: document.getElementById('edit-program').value,
        year: parseInt(document.getElementById('edit-year').value) || null,
        advisor: document.getElementById('edit-advisor').value,
        grade: window.currentStudentData?.grade || 0,
        password: '' // Don't update password
      };

      try {
        const resp = await fetchJson(`${API_BASE_URL}/students/${user.id}`, {
          method: 'PUT',
          body: JSON.stringify(updatedData)
        });

        if (resp.ok) {
          if (window.showMessage) {
            window.showMessage('Success', 'Profile updated successfully!', 'success');
          }
          window.closeEditModal();
          location.reload();
        } else {
          throw new Error('Update failed');
        }
      } catch (err) {
        if (window.showMessage) {
          window.showMessage('Error', 'Failed to update profile: ' + err.message, 'error');
        }
      }
    });
  }
});

// Photo upload handler
window.handleFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    if (window.showMessage) {
      window.showMessage('Invalid File', 'Please select an image file', 'error');
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const avatarEl = document.querySelector('.profile-avatar');
    if (avatarEl) {
      avatarEl.style.backgroundImage = `url(${e.target.result})`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.querySelector('span').style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
};