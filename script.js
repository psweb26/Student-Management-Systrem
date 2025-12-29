// script.js - Enhanced Scripts for Student Portal

// --- Configuration ---
// IMPORTANT: Replace this with the URL of your Java/Spring Boot Backend API
const API_BASE_URL = 'http://localhost:8080/api/v1';

// --- Custom Modal/Message Box Functions (Replaces alert() and confirm()) ---
const modal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

/**
 * Displays a custom modal message to the user.
 * @param {string} title - The title for the modal.
 * @param {string} message - The main message content.
 * @param {boolean|string} isError - If true or 'error', style the message as an error. If 'success', style success.
 */
function showMessage(title, message, isError = false) {
    if (!modal) return;
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Simple styling based on error status
    if (isError === true || isError === 'error') {
        modalTitle.classList.add('text-red-600');
        modalCloseBtn.classList.remove('bg-indigo-600');
        modalCloseBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else if (isError === 'success') {
        modalTitle.classList.remove('text-red-600');
        modalCloseBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        modalCloseBtn.classList.add('bg-green-600', 'hover:bg-green-700');
    } else {
        modalTitle.classList.remove('text-red-600');
        modalCloseBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        modalCloseBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Close modal when button is clicked
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
}
// Close modal when clicking outside (on the overlay)
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });
}


// ----------------------------------------------------------------------
// ----- LOGIN FORM LOGIC (index.html) - NOW CONNECTED TO API -----
// ----------------------------------------------------------------------
const loginForm = document.getElementById('loginForm');
if(loginForm) {
    loginForm.addEventListener('submit', function(e){
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if(username === "" || password === "") {
            showMessage("Login Error", "Please enter both username and password.", true);
            return;
        }

        const loginData = {
            username: username,
            password: password
        };

        showMessage("Logging In...", "Contacting the backend for authentication...", false);

        // --- API CALL TO YOUR SPRING BOOT BACKEND ---
        // NEW UPDATED LOGIN BLOCK START
        fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginData),
            credentials: 'include' // <-- important: accept/set cookies for session-based auth
        })
        .then(async response => {
            if (!response.ok) {
                const errBody = await response.json().catch(()=>({}));
                throw new Error(errBody.message || "Login failed. Invalid Credentials or Server Error.");
            }
            // Try to read JSON body (may include user + token)
            const data = await response.json().catch(()=>null);
            // If backend returns a token (JWT), store it
            if (data?.token) {
                localStorage.setItem('authToken', data.token);
            }
            // Save user info (the backend should return user summary)
            if (data?.user) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
            } else if (data?.id) {
                // some backends return user properties at top-level; store them
                localStorage.setItem('currentUser', JSON.stringify(data));
            }
            return data;
        })
        .then(data => {
            const role = (data?.user?.role || data?.role || (localStorage.getItem('currentUser') && JSON.parse(localStorage.getItem('currentUser')).role));
            let redirectUrl = 'profile.html';
            if (role === 'admin') redirectUrl = 'dashboard.html';
            else if (role === 'parent') redirectUrl = 'parent.html';
            showMessage("Success!", `Login successful! Redirecting to ${role?.toUpperCase()||'PORTAL'}...`, 'success');
            setTimeout(() => window.location.href = redirectUrl, 600);
        })
        .catch(error => {
            console.error('Login Error:', error);
            showMessage("Login Failed", error.message || "An unexpected error occurred. Check your server connection.", true);
        });
        // NEW UPDATED LOGIN BLOCK END
    });
}

// ----------------------------------------------------------------------
// ----- CORE API COMMUNICATION UTILITIES (Admin Panel Focus) -----
// ----------------------------------------------------------------------

/**
 * [R] Retrieves a list of students from the backend API.
 * This function is optimized for the Admin Dashboard (dashboard.html).
 */
async function fetchStudentRecords(searchTerm = '') {
    const tableBody = document.getElementById('student-records-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Fetching records from server...</td></tr>';

    try {
        showMessage("Loading Data", "Fetching student records from the Java backend...", false);

        const response = await fetch(`${API_BASE_URL}/students`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json(); // Data is a List<Student>

        // --- Filtering Logic (Client-side) ---
        const filteredData = data.filter(s =>
            (s.firstName && s.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (s.lastName && s.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (s.id && s.id.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        // --- End Filtering Logic ---

        showMessage("Data Loaded", `Successfully retrieved ${filteredData.length} student records.`, 'success');

        // Render the table rows
        if (tableBody) {
            tableBody.innerHTML = filteredData.map(student => `
                <tr class="hover:bg-gray-50 transition duration-100">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${student.firstName} ${student.lastName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${student.major}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button onclick="showMessage('Edit Student', 'Will call updateStudent(${student.id}, ...)')" class="text-indigo-600 hover:text-indigo-900 text-sm font-semibold">Edit</button>
                        <button onclick="deleteStudent('${student.id}')" class="text-red-600 hover:text-red-900 text-sm font-semibold">Delete</button>
                    </td>
                </tr>
            `).join('');
            if (filteredData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No records found.</td></tr>';
            }
        }

        return filteredData;

    } catch (error) {
        console.error('Fetch Student Records Error:', error);
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-600">ERROR: Failed to load data. Is the backend server running?</td></tr>';
        showMessage("API Error", `Failed to load student data: ${error.message}`, true);
        return [];
    }
}

/**
 * [C] Sends a request to the backend API to create a new student record.
 * @param {object} studentData - The data object for the new student.
 */
async function createStudent(studentData) {
    try {
        showMessage("Processing Request", `Sending new student data for ${studentData.firstName} to the backend...`, false);

        const response = await fetch(`${API_BASE_URL}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(studentData)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.message || `HTTP error! status: ${response.status}`);
        }

        const newRecord = await response.json();
        showMessage("Success!", `Student ${newRecord.firstName} (ID: ${newRecord.id}) added successfully!`);

        // Refresh the student list table after success
        fetchStudentRecords('');

    } catch (error) {
        console.error('Create Student Error:', error);
        showMessage("API Error", `Failed to create student: ${error.message}`, true);
    }
}

/**
 * [U] Sends a request to the backend API to update a grade.
 * @param {string} studentId - ID of the student to update.
 * @param {string} courseCode - Course to update.
 * @param {string} newGrade - The new grade value.
 */
async function updateGrade(studentId, courseCode, newGrade) {
    try {
        showMessage("Processing Update", `Updating grade for ${studentId}...`, false);

        const updateData = { studentId, courseCode, grade: newGrade };

        const response = await fetch(`${API_BASE_URL}/academics/grade`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage("Update Complete", `Grade updated successfully for ${studentId} in ${courseCode}.`);

    } catch (error) {
        console.error('Update Grade Error:', error);
        showMessage("API Error", `Failed to update grade: ${error.message}`, true);
    }
}

/**
 * [D] Sends a request to the backend API to delete a student record.
 * @param {string} studentId - ID of the student to delete.
 */
async function deleteStudent(studentId) {
    try {
        showMessage("Processing Deletion", `Attempting to delete student ${studentId}...`, false);

        const response = await fetch(`${API_BASE_URL}/students/${studentId}`, {
            method: 'DELETE',
        });

        if (response.status === 204 || response.ok) {
            showMessage("Deletion Success", `Student ${studentId} has been successfully deleted.`);
            fetchStudentRecords('');
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

    } catch (error) {
        console.error('Delete Student Error:', error);
        showMessage("API Error", `Failed to delete student: ${error.message}`, true);
    }
}


// ----------------------------------------------------------------------
// ----- FEE TRACKING API FUNCTIONS (NEW) -----
// ----------------------------------------------------------------------

async function fetchFeeRecords(studentId) {
    if (!studentId) {
        showMessage('Input Missing', 'Please enter a Student ID to check fees.', true);
        return [];
    }

    try {
        showMessage("Fee Check", `Checking fee records for ID ${studentId}...`, false);

        const response = await fetch(`${API_BASE_URL}/fees/student/${studentId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 404) {
            showMessage("Not Found", `No fee records found for student ID ${studentId}.`, true);
            return [];
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const feeRecords = await response.json();

        // change currency display to INR
        let totalPending = (feeRecords || []).filter(f => f.status !== 'Paid').reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);
        const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
        showMessage("Fee Data Loaded", `Successfully retrieved ${feeRecords.length} fee records. Total pending: ${formatter.format(totalPending)}`, 'success');
        return feeRecords;

    } catch (error) {
        console.log('Fetch Fee Records Error:', error);
        showMessage("API Error", `Failed to load fee data: ${error.message}. Check FeeService/Controller.`, true);
        return [];
    }
}

async function recordPayment(studentId) {
    const feeRecords = await fetchFeeRecords(studentId);

    const oldestPendingFee = feeRecords
        .filter(f => f.status !== 'Paid')
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

    if (!oldestPendingFee) {
        showMessage("No Dues", `Student ${studentId} has no pending fees to pay.`, true);
        return;
    }

    const feeIdToPay = oldestPendingFee.feeId;

    try {
        showMessage("Recording Payment", `Recording payment for fee ID ${feeIdToPay}...`, false);

        const response = await fetch(`${API_BASE_URL}/fees/${feeIdToPay}/pay`, {
            method: 'PUT'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const paidFee = await response.json();
        // show rupee symbol instead of dollar
        const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
        showMessage("Payment Success", `Fee ID ${paidFee.feeId} for ${formatter.format(paidFee.amount)} marked as PAID.`, 'success');

        return paidFee;

    } catch (error) {
        console.error('Record Payment Error:', error);
        showMessage("API Error", `Failed to record payment: ${error.message}`, true);
        return null;
    }
}


// ----------------------------------------------------------------------
// ----- ACADEMIC REPORTS PAGE (reports.html) dynamic initialization -----
// ----------------------------------------------------------------------

function initReportPage() {
    const progressBar = document.getElementById('degree-progress');
    if (progressBar) {
        const width = progressBar.style.getPropertyValue('--progress-width');
        progressBar.style.setProperty('--progress-width', '0');
        setTimeout(() => {
            progressBar.style.setProperty('--progress-width', width);
        }, 10);
    }
}

if (window.location.pathname.includes('reports.html') && document.readyState === 'complete') {
    initReportPage();
} else if (window.location.pathname.includes('reports.html')) {
    window.addEventListener('load', initReportPage);
}