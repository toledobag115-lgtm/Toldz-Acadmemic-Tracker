document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES (CRITICAL: MUST EXIST IN index.html) ---
    const form = document.getElementById('assessment-form');
    const tableBody = document.querySelector('#assessment-table tbody');
    
    // Profile Management Elements
    const profileSelect = document.getElementById('profile-select');
    const profileSettingsBtn = document.getElementById('profile-settings-btn');
    const profileMenu = document.getElementById('profile-menu');
    const addProfileButton = document.getElementById('add-profile-btn');
    const renameProfileButton = document.getElementById('rename-profile-btn');
    const deleteProfileButton = document.getElementById('delete-profile-btn');
    
    // Export/Import Buttons
    const exportDataButton = document.getElementById('export-data-btn');
    const importDataButton = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file');
    
    // Filter and Tab Elements
    const searchInput = document.getElementById('search-input');
    const subjectFilter = document.getElementById('subject-filter');
    const tabControls = document.getElementById('tab-controls');

    // View Controls
    const viewToggle = document.getElementById('view-toggle');
    const listView = document.getElementById('list-view');
    const calendarView = document.getElementById('calendar-view');
    
    // Calendar Elements
    const calendarHeader = document.getElementById('current-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    // Form Field References
    const subjectInput = document.getElementById('subject');
    const assessmentInput = document.getElementById('assessment');
    const deadlineInput = document.getElementById('deadline');
    const weightingInput = document.getElementById('weighting');
    const notesInput = document.getElementById('notes'); 
    const subjectColorPreview = document.getElementById('subject-color-preview'); 

    // Form Button Reference
    const submitButton = form.querySelector('button[type="submit"]');

    // Notification Banner Elements
    const reminderBanner = document.getElementById('reminder-banner');
    const reminderMessage = document.getElementById('reminder-message');
    const reminderCloseBtn = document.getElementById('reminder-close-btn');
    
    // --- CRITICAL STATE VARIABLES & CONSTANTS ---
    let currentSortColumn = 'deadline'; 
    let sortDirection = 1; 
    let currentTab = 'active';
    let currentView = 'list';
    let currentCalendarDate = new Date(); 
    let editingTaskId = null; 
    
    const DEFAULT_PROFILE = 'My Profile';
    const STORAGE_KEY = 'trackerData';
    const COLORS = ['#FF6347', '#4682B4', '#3CB371', '#FFD700', '#9370DB', '#00CED1', '#FFA07A', '#F08080']; 


    // =================================================================
    // PERSISTENCE (Local Storage) Functions - ROBUST DATA CHECK
    // =================================================================

    function getTrackerData() {
        const defaultData = {
            activeProfile: DEFAULT_PROFILE,
            profiles: {
                [DEFAULT_PROFILE]: {
                    tasks: [],
                    subjectColors: {}
                }
            }
        };
        
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            try {
                const parsedData = JSON.parse(data);

                // 1. Check if the top-level structure is missing/invalid
                if (!parsedData || typeof parsedData !== 'object' || !parsedData.profiles) {
                     console.warn("Local storage data was malformed or missing the 'profiles' object. Reverting to default structure.");
                     return defaultData;
                }
                
                // 2. Ensure every profile has the necessary keys (tasks and subjectColors)
                for (const profileName in parsedData.profiles) {
                    let profile = parsedData.profiles[profileName];
                    
                    // Handle legacy format where profile data was just an array of tasks
                    if (Array.isArray(profile)) {
                         profile = { tasks: profile, subjectColors: {} };
                    }
                    
                    if (!profile.tasks) profile.tasks = [];
                    if (!profile.subjectColors) profile.subjectColors = {};

                    parsedData.profiles[profileName] = profile;
                }
                
                // 3. Ensure an active profile is set and exists
                const profileKeys = Object.keys(parsedData.profiles);
                if (!parsedData.activeProfile || !parsedData.profiles.hasOwnProperty(parsedData.activeProfile)) {
                     // Set the active profile to the first available profile if the current one is missing
                     parsedData.activeProfile = profileKeys[0] || DEFAULT_PROFILE;
                }
                
                // 4. If profiles list is empty for some reason, ensure default is present
                if (profileKeys.length === 0) {
                    return defaultData;
                }

                return parsedData;

            } catch (e) {
                console.error("Error parsing data from local storage. Starting fresh.", e);
                // If parsing fails (e.g., bad JSON), use the default structure
                return defaultData;
            }
        }
        // If no data exists in local storage, return the default structure
        return defaultData;
    }
    
    function setTrackerData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getAssessments() {
        const data = getTrackerData();
        const profile = data.profiles[data.activeProfile];
        return (profile && profile.tasks) ? profile.tasks : [];
    }
    
    function updateCurrentProfileAssessments(newTasks) {
        const data = getTrackerData();
        const profile = data.profiles[data.activeProfile] || { tasks: [], subjectColors: {} };
        profile.tasks = newTasks;
        data.profiles[data.activeProfile] = profile;
        setTrackerData(data);
    }
    
    function getSubjectColorMap() {
        const data = getTrackerData();
        const profile = data.profiles[data.activeProfile];
        return (profile && profile.subjectColors) ? profile.subjectColors : {};
    }

    function setSubjectColor(subject, color) {
        const data = getTrackerData();
        const profile = data.profiles[data.activeProfile];
        if (profile) {
            profile.subjectColors[subject] = color;
            setTrackerData(data);
        }
    }

    // =================================================================
    // CORE ASSESSMENT MANIPULATION FUNCTIONS
    // =================================================================
    
    function updateAssessment(updatedTask) {
        let tasks = getAssessments();
        const taskIndex = tasks.findIndex(task => task.id === updatedTask.id);
        if (taskIndex > -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], ...updatedTask };
            updateCurrentProfileAssessments(tasks);
        }
        filterAssessments();
        renderCalendar();
    }
    
    function deleteAssessment(id) {
        if (confirm('Are you sure you want to delete this assessment?')) {
            let tasks = getAssessments();
            tasks = tasks.filter(task => task.id !== id);
            updateCurrentProfileAssessments(tasks);
            filterAssessments();
            renderCalendar();
        }
    }


    // =================================================================
    // EXPORT / IMPORT FUNCTIONS
    // =================================================================
    
    function exportData() {
        const data = getTrackerData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `academic_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Data exported successfully!');
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                if (!importedData.profiles || typeof importedData.profiles !== 'object') {
                    throw new Error("Invalid tracker data structure.");
                }

                const currentData = getTrackerData();
                
                // Merge profiles, prioritizing imported data if a profile name conflicts
                const mergedProfiles = { ...currentData.profiles, ...importedData.profiles };
                
                currentData.profiles = mergedProfiles;
                
                // Set the active profile to the imported active profile if it exists, otherwise keep current
                if (importedData.activeProfile && mergedProfiles.hasOwnProperty(importedData.activeProfile)) {
                    currentData.activeProfile = importedData.activeProfile;
                } else if (Object.keys(mergedProfiles).length === 0) {
                     // If everything was wiped somehow, revert to default
                     currentData.activeProfile = DEFAULT_PROFILE;
                     currentData.profiles = { [DEFAULT_PROFILE]: { tasks: [], subjectColors: {} } };
                }

                setTrackerData(currentData);
                loadProfiles(); 
                filterAssessments();
                renderCalendar();
                alert('Data imported and merged successfully!');

            } catch (error) {
                console.error("Import failed:", error);
                alert(`Error importing data: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }
    
    // =================================================================
    // NOTIFICATION & REMINDER SYSTEM
    // =================================================================
    
    function checkForUrgentTasks() {
        const tasks = getAssessments().filter(task => !task.completed);
        let urgentCount = 0;
        let overdueCount = 0;
        const today = new Date(new Date().toDateString());

        tasks.forEach(task => {
            const deadline = new Date(task.deadline);
            const daysUntil = (deadline - today) / (1000 * 60 * 60 * 24);

            if (daysUntil < 0) {
                overdueCount++;
            } else if (daysUntil <= 3) { // 3 days is the threshold for 'urgent'
                urgentCount++;
            }
        });

        if (overdueCount > 0) {
            reminderMessage.textContent = `🚨 ${overdueCount} task(s) are overdue! Please address them.`;
            reminderBanner.classList.remove('hidden');
            reminderBanner.style.backgroundColor = '#d9534f'; // Red for overdue
        } else if (urgentCount > 0) {
            reminderMessage.textContent = `⚠️ ${urgentCount} task(s) are due in the next 3 days.`;
            reminderBanner.classList.remove('hidden');
            reminderBanner.style.backgroundColor = '#ff9800'; // Orange for urgent
        } else {
            reminderBanner.classList.add('hidden');
        }
    }
    
    // =================================================================
    // TASK RENDERING
    // =================================================================

    function renderAssessmentRow(task) {
        const row = tableBody.insertRow();
        row.id = `task-${task.id}`;
        
        // Apply color to the left border of the row
        const color = getSubjectColorMap()[task.subject] || 'transparent';
        row.style.borderLeft = `5px solid ${color}`;
        
        // Apply urgent/overdue styling for Notification feature
        const daysUntil = (new Date(task.deadline) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24);
        if (!task.completed && daysUntil < 0) {
            row.classList.add('overdue');
        } else if (!task.completed && daysUntil <= 3) { 
            row.classList.add('urgent');
        }
        
        // 1. Subject Cell
        row.insertCell().textContent = task.subject;
        
        // 2. Assessment Cell
        row.insertCell().textContent = task.assessment;
        
        // 3. Deadline Cell
        row.insertCell().textContent = task.deadline;

        // 4. Weighting Cell
        row.insertCell().textContent = task.weighting ? `${task.weighting}%` : '-';
        
        // 5. Notes Cell (Icon)
        const notesCell = row.insertCell();
        if (task.notes && task.notes.trim()) {
            const notesIcon = document.createElement('span');
            notesIcon.className = 'notes-indicator';
            notesIcon.innerHTML = '&#9998;'; // Pencil emoji for notes
            notesIcon.title = task.notes; // Tooltip to show content on hover
            notesIcon.onclick = () => alert(`Notes for ${task.assessment}:\n\n${task.notes}`);
            notesCell.appendChild(notesIcon);
        } else {
            notesCell.textContent = '-';
        }
        
        // 6. Actions Cell
        const actionsCell = row.insertCell();
        
        // Mark Complete Button
        const completeBtn = document.createElement('button');
        completeBtn.textContent = task.completed ? 'Undo' : 'Complete';
        completeBtn.classList.add('complete-btn');
        completeBtn.onclick = () => toggleCompletion(task.id);
        actionsCell.appendChild(completeBtn);
        
        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        editBtn.onclick = () => startEditing(task.id);
        actionsCell.appendChild(editBtn);
        
        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = () => deleteAssessment(task.id);
        actionsCell.appendChild(deleteBtn);
    }
    
    function renderAllAssessments(tasks) {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (tasks.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 6;
            cell.textContent = 'No assessments found for this view.';
            cell.style.textAlign = 'center';
            return;
        }
        tasks.forEach(renderAssessmentRow);
    }

    // =================================================================
    // CUSTOM COLOR/ICON PER SUBJECT FUNCTIONS
    // =================================================================

    function renderColorPicker(subject) {
        const existingPicker = document.getElementById('subject-color-picker');
        if (existingPicker) existingPicker.remove();
        if (!subject || !notesInput) return; // Ensure notesInput exists for insertion

        const container = document.createElement('div');
        container.id = 'subject-color-picker';
        container.classList.add('color-picker-container');
        
        const currentColor = getSubjectColorMap()[subject] || 'transparent';
        const label = document.createElement('span');
        label.textContent = `Choose color for "${subject}":`;
        container.appendChild(label);

        COLORS.forEach(color => {
            const option = document.createElement('div');
            option.className = 'color-option';
            option.style.backgroundColor = color;
            option.setAttribute('data-color', color);
            
            if (color === currentColor) {
                option.classList.add('selected');
            }

            option.addEventListener('click', () => {
                // Deselect all and select current
                container.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                // Update storage and UI
                setSubjectColor(subject, color);
                updateSubjectPreview(subject); 
                filterAssessments(); 
            });
            container.appendChild(option);
        });

        // Insert the picker before the notes input
        notesInput.parentNode.insertBefore(container, notesInput);
    }
    
    function updateSubjectPreview(subject) {
        if (!subjectColorPreview) return;
        const color = getSubjectColorMap()[subject];
        subjectColorPreview.style.backgroundColor = color || 'transparent';
        subjectColorPreview.style.border = color ? '1px solid #333' : '1px dashed #ced4da';
    }

    // =================================================================
    // FORM SUBMISSION
    // =================================================================

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const subject = subjectInput.value.trim();
        const assessment = assessmentInput.value.trim();
        const deadline = deadlineInput.value;
        const weighting = weightingInput.value ? parseInt(weightingInput.value) : null; 
        const notes = notesInput.value.trim(); 

        const taskData = { subject, assessment, deadline, weighting, notes };

        if (weighting !== null && (weighting < 0 || weighting > 100)) {
            alert('Weighting must be between 0 and 100.');
            return;
        }

        if (editingTaskId) {
            // Edit existing task
            const updatedTask = { ...taskData, id: editingTaskId };
            updateAssessment(updatedTask);
            editingTaskId = null;
            submitButton.textContent = 'Deploy Assessment';
        } else {
            // Add new task
            const newTask = {
                ...taskData,
                id: Date.now(),
                completed: false
            };
            
            // Handle Subject Color Assignment
            const subjectMap = getSubjectColorMap();
            const currentSelectedColor = document.querySelector('#subject-color-picker .color-option.selected')?.getAttribute('data-color');
            
            if (!subjectMap.hasOwnProperty(subject) && currentSelectedColor) {
                setSubjectColor(subject, currentSelectedColor);
            } else if (!subjectMap.hasOwnProperty(subject)) {
                 // New subject, but no color selected, use the first color as a default
                setSubjectColor(subject, COLORS[0]);
            }
            
            const tasks = getAssessments();
            tasks.push(newTask);
            updateCurrentProfileAssessments(tasks);
        }

        form.reset();
        // Clean up UI
        updateSubjectPreview('');
        const existingPicker = document.getElementById('subject-color-picker');
        if (existingPicker) existingPicker.remove();
        filterAssessments(); 
        renderCalendar();
    });

    // --- Task Management Functions ---
    
    function toggleCompletion(id) {
        let tasks = getAssessments();
        const taskIndex = tasks.findIndex(task => task.id == id);
        if (taskIndex > -1) {
            tasks[taskIndex].completed = !tasks[taskIndex].completed;
            updateCurrentProfileAssessments(tasks);
        }
        filterAssessments();
        renderCalendar();
    }
    
    function startEditing(id) {
        const tasks = getAssessments();
        const task = tasks.find(t => t.id == id);
        if (!task) return;

        editingTaskId = id;
        subjectInput.value = task.subject;
        assessmentInput.value = task.assessment;
        deadlineInput.value = task.deadline;
        weightingInput.value = task.weighting || '';
        notesInput.value = task.notes || ''; 
        
        updateSubjectPreview(task.subject);
        renderColorPicker(task.subject);

        submitButton.textContent = 'Save Changes';
    }

    // =================================================================
    // FILTER, SORT, AND UI CONTROL FUNCTIONS
    // =================================================================
    
    function sortAssessments(tasks) {
        const compare = (a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            if (currentSortColumn === 'deadline') {
                valA = new Date(valA);
                valB = new Date(valB);
            } else if (currentSortColumn === 'weighting') {
                valA = valA || 0;
                valB = valB || 0;
            }

            if (valA < valB) return -1 * sortDirection;
            if (valA > valB) return 1 * sortDirection;
            return 0;
        };
        tasks.sort(compare);
        return tasks;
    }
    
    function filterAssessments() {
        let tasks = getAssessments();
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const selectedSubject = subjectFilter?.value;

        // 1. Tab Filtering
        if (currentTab === 'active') {
            tasks = tasks.filter(task => !task.completed);
        } else if (currentTab === 'completed') {
            tasks = tasks.filter(task => task.completed);
        } // 'all' tab uses the full list

        // 2. Search Filtering
        if (searchTerm) {
            tasks = tasks.filter(task => 
                task.subject.toLowerCase().includes(searchTerm) ||
                task.assessment.toLowerCase().includes(searchTerm) ||
                (task.notes && task.notes.toLowerCase().includes(searchTerm))
            );
        }

        // 3. Subject Filtering
        if (selectedSubject && selectedSubject !== 'All Subjects') {
            tasks = tasks.filter(task => task.subject === selectedSubject);
        }

        // 4. Sorting
        tasks = sortAssessments(tasks);

        renderAllAssessments(tasks);
        updateSubjectFilter(getAssessments()); // Pass ALL tasks to update the filter list
        checkForUrgentTasks();
    }

    function updateSubjectFilter(tasks) {
        if (!subjectFilter) return;
        
        const uniqueSubjects = [...new Set(tasks.map(task => task.subject))].sort();
        const currentValue = subjectFilter.value;
        
        subjectFilter.innerHTML = '<option>All Subjects</option>';
        uniqueSubjects.forEach(subject => {
            const option = document.createElement('option');
            option.textContent = subject;
            option.value = subject;
            subjectFilter.appendChild(option);
        });
        
        // Retain selected filter if possible
        if (currentValue && (currentValue === 'All Subjects' || uniqueSubjects.includes(currentValue))) {
             subjectFilter.value = currentValue;
        } else {
             subjectFilter.value = 'All Subjects';
        }
    }

    // =================================================================
    // PROFILE MANAGEMENT FUNCTIONS (CRITICAL)
    // =================================================================
    
    function loadProfiles() {
        if (!profileSelect) {
            console.error("Profile select element is missing. Profile system non-functional.");
            return;
        }
        
        const data = getTrackerData();
        const profileNames = Object.keys(data.profiles);
        
        console.log("Loading profiles:", profileNames, "Active:", data.activeProfile);
        
        profileSelect.innerHTML = ''; // Clear existing options
        
        profileNames.forEach(profileName => {
            const option = document.createElement('option');
            option.textContent = profileName;
            option.value = profileName;
            if (profileName === data.activeProfile) {
                option.selected = true;
                console.log(`Setting active profile in dropdown: ${profileName}`);
            }
            profileSelect.appendChild(option);
        });
        
        // Ensure the menu is closed after loading
        profileMenu?.classList.add('hidden'); 
    }
    
    function switchProfile(newProfileName) {
        const data = getTrackerData();
        
        if (!data.profiles.hasOwnProperty(newProfileName)) {
            console.error(`Attempted to switch to non-existent profile: ${newProfileName}`);
            return;
        }
        
        data.activeProfile = newProfileName;
        console.log(`Switching profile to: ${newProfileName}`);
        
        setTrackerData(data); // CRITICAL: Save the change immediately
        
        loadProfiles();
        filterAssessments();
        renderCalendar();
    }
    
    function createNewProfile() {
        const name = prompt("Enter a name for the new profile:");
        if (name && name.trim()) {
            const trimmedName = name.trim();
            const data = getTrackerData();
            if (data.profiles.hasOwnProperty(trimmedName)) {
                alert("A profile with this name already exists.");
                return;
            }
            
            // Create the new profile structure
            data.profiles[trimmedName] = { tasks: [], subjectColors: {} };
            setTrackerData(data); // Save the creation
            
            // Switch to the newly created profile, which calls loadProfiles()
            switchProfile(trimmedName); 
        }
    }
    
    function renameCurrentProfile() {
        const data = getTrackerData();
        const oldName = data.activeProfile;
        const newName = prompt(`Rename profile "${oldName}" to:`);

        if (newName && newName.trim() && newName.trim() !== oldName) {
            const trimmedNewName = newName.trim();
            if (data.profiles.hasOwnProperty(trimmedNewName)) {
                alert("A profile with this name already exists.");
                return;
            }

            const profileData = data.profiles[oldName];
            delete data.profiles[oldName];
            data.profiles[trimmedNewName] = profileData;
            data.activeProfile = trimmedNewName;
            
            setTrackerData(data);
            loadProfiles();
        }
    }

    function deleteCurrentProfile() {
        const data = getTrackerData();
        const activeProfile = data.activeProfile;
        const profileKeys = Object.keys(data.profiles);

        if (profileKeys.length <= 1) {
            alert("You must have at least one profile.");
            return;
        }

        if (confirm(`Are you sure you want to delete the profile "${activeProfile}" and all its data? This cannot be undone.`)) {
            delete data.profiles[activeProfile];
            
            // Switch to the next available profile
            const nextProfile = profileKeys.find(key => key !== activeProfile) || Object.keys(data.profiles)[0];
            data.activeProfile = nextProfile;
            
            setTrackerData(data);
            loadProfiles();
            filterAssessments();
            renderCalendar();
        }
    }


    // =================================================================
    // CALENDAR VIEW FUNCTIONS
    // =================================================================
    
    function renderCalendar() {
        if (!calendarGrid || !calendarHeader) return;
        
        calendarHeader.textContent = currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        // Days of the week header (7 items)
        calendarGrid.innerHTML = '<div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>'; 
        
        const tasks = getAssessments().filter(t => !t.completed);
        const subjectColorMap = getSubjectColorMap();
        
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        
        // Get the day of the week for the first day of the current month (0=Sun, 6=Sat)
        const firstDayOfMonth = new Date(year, month, 1).getDay(); 
        
        // Date object representing today, normalized to midnight
        const today = new Date(new Date().toDateString()).getTime();

        // Calculate the start date for the calendar grid (the first Sunday)
        const startDate = new Date(year, month, 1 - firstDayOfMonth);

        // Render 6 rows of 7 days (42 cells total) to ensure full month visibility
        for (let i = 0; i < 42; i++) { 
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayCell = document.createElement('div');
            
            // Display the day number
            dayCell.textContent = date.getDate();
            
            // Add class for visual separation of current month
            if (date.getMonth() === month) {
                dayCell.classList.add('current-month');
            } else {
                dayCell.style.opacity = '0.5'; 
            }
            
            // Highlight today's date
            if (date.getTime() === today) {
                dayCell.classList.add('today');
            }
            
            // Add task markers
            tasks.forEach(task => {
                const taskDate = new Date(task.deadline);
                // Check if the task deadline matches the current calendar day
                if (taskDate.toDateString() === date.toDateString()) {
                    const marker = document.createElement('span');
                    marker.className = 'task-marker';
                    marker.textContent = task.assessment;
                    marker.title = `${task.subject}: ${task.assessment}`;
                    marker.style.backgroundColor = subjectColorMap[task.subject] || '#007bff';
                    dayCell.appendChild(marker);
                }
            });

            calendarGrid.appendChild(dayCell);
        }
    }


    // =================================================================
    // EVENT LISTENERS
    // =================================================================
    
    // Notifications Dismiss
    reminderCloseBtn?.addEventListener('click', () => {
        reminderBanner?.classList.add('hidden');
    });

    // Subject Color Picker trigger on input
    subjectInput?.addEventListener('input', () => {
        const subject = subjectInput.value.trim();
        updateSubjectPreview(subject);
        renderColorPicker(subject);
    });

    // Profile Settings Toggle
    profileSettingsBtn?.addEventListener('click', () => {
        profileMenu?.classList.toggle('hidden');
    });
    
    // Profile Management Listeners
    profileSelect?.addEventListener('change', (e) => switchProfile(e.target.value));
    addProfileButton?.addEventListener('click', createNewProfile);
    renameProfileButton?.addEventListener('click', renameCurrentProfile);
    deleteProfileButton?.addEventListener('click', deleteCurrentProfile);
    
    // Export Data Listener
    exportDataButton?.addEventListener('click', exportData);
    
    // Import Data Listener
    importDataButton?.addEventListener('click', () => importFileInput.click());
    importFileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importData(file);
        }
    });

    // Tab Controls
    tabControls?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelector('#tab-controls button.active')?.classList.remove('active');
            e.target.classList.add('active');
            currentTab = e.target.getAttribute('data-tab');
            filterAssessments();
        }
    });

    // Filter/Search Controls
    searchInput?.addEventListener('input', filterAssessments);
    subjectFilter?.addEventListener('change', filterAssessments);

    // View Toggle
    viewToggle?.addEventListener('click', (e) => {
        if (e.target.closest('button')) {
            const button = e.target.closest('button');
            const newView = button.getAttribute('data-view');
            
            if (newView !== currentView) {
                 document.querySelector('#view-toggle button.active')?.classList.remove('active');
                 button.classList.add('active');
                 currentView = newView;
                 
                 listView?.classList.toggle('active', currentView === 'list');
                 calendarView?.classList.toggle('active', currentView === 'calendar');
                 
                 if (currentView === 'calendar') {
                     renderCalendar();
                 }
            }
        }
    });

    // Sorting
    document.querySelector('#assessment-table thead')?.addEventListener('click', (e) => {
        let th = e.target.closest('th');
        if (th && th.getAttribute('data-column')) {
            const newColumn = th.getAttribute('data-column');
            
            // Reset previous sort indicator
            document.querySelectorAll('#assessment-table th').forEach(h => {
                h.classList.remove('sort-active', 'sort-asc', 'sort-desc');
                const icon = h.querySelector('i');
                if (icon) icon.className = 'fas fa-sort';
            });

            if (currentSortColumn === newColumn) {
                sortDirection *= -1;
            } else {
                currentSortColumn = newColumn;
                sortDirection = 1; // Default to ascending for a new column
            }

            th.classList.add('sort-active', sortDirection === 1 ? 'sort-asc' : 'sort-desc');
            const icon = th.querySelector('i');
            if (icon) icon.className = sortDirection === 1 ? 'fas fa-sort-up' : 'fas fa-sort-down';
            
            filterAssessments();
        }
    });

    // Calendar Navigation
    prevMonthBtn?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
    
    // --- Initialization ---

    function init() {
        // Load profiles first to establish data context
        loadProfiles(); 
        
        // Render UI based on the active profile
        filterAssessments();
        renderCalendar();
        checkForUrgentTasks();
    }
    
    init();

});