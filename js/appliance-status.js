import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const residenceId = localStorage.getItem('dtech_residence_id');
    const role = localStorage.getItem('dtech_user_role');

    if (!residenceId || role !== 'manager') {
        window.location.href = 'index.html';
        return;
    }

    const container = document.getElementById('appliance-container');
    const loading = document.getElementById('loading-indicator');

    try {

        // 1. Fetch floor plan data from ALL floors
        const { FirebaseStorageManager } = await import('./managers/FirebaseStorageManager.js');
        const floorsData = await FirebaseStorageManager.getAllFloors(residenceId);

        let allAppliances = [];
        const applianceTypes = ['stove', 'fridge', 'sink', 'tv', 'shower', 'bath', 'toilet', 'washing_machine', 'microwave'];

        const isPointInPolygon = (point, vs) => {
            let x = point.x, y = point.y;
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                let xi = vs[i].x, yi = vs[i].y;
                let xj = vs[j].x, yj = vs[j].y;
                let intersect = ((yi > y) !== (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };


        const safeParse = (data) => {
            let parsed = data;
            while (typeof parsed === 'string') {
                try {
                    parsed = JSON.parse(parsed);
                } catch(e) {
                    return null;
                }
            }
            return parsed;
        };

        for (const [floorLevel, rawData] of Object.entries(floorsData)) {
            const data = safeParse(rawData);
            if (data && data.objects) {
                const apps = data.objects.filter(obj => applianceTypes.includes(obj.type));
                const rooms = data.rooms || [];

                apps.forEach(app => {
                    app.floorLevel = floorLevel;
                    let roomName = "Unassigned Area";
                    for (const room of rooms) {
                        if (room.boundary && isPointInPolygon(app.position, room.boundary)) {
                            roomName = room.name || room.type || "Room";
                            break;
                        }
                    }
                    app.roomName = roomName;
                    allAppliances.push(app);
                });
            }
        }

        if (allAppliances.length === 0) {
            loading.textContent = "No appliances found on any floor. Add stoves, fridges, etc. in the editor.";
            return;
        }

        // 2. Fetch current issues to pre-fill statuses

        const issuesRef = collection(db, "residences", residenceId, "issues");
        const issuesSnap = await getDocs(issuesRef);

        const currentIssues = {};
        issuesSnap.forEach(doc => {
            currentIssues[doc.id] = doc.data();
        });

        // 3. Group by Floor and Room
        const groupedAppliances = {};
        allAppliances.forEach(app => {
            const groupKey = `Floor ${app.floorLevel} - ${app.roomName}`;
            if (!groupedAppliances[groupKey]) {
                groupedAppliances[groupKey] = [];
            }
            groupedAppliances[groupKey].push(app);
        });

        // 4. Render UI

        loading.style.display = 'none';

        for (const [roomName, apps] of Object.entries(groupedAppliances)) {
            const roomGroup = document.createElement('div');
            roomGroup.className = 'room-group';

            const title = document.createElement('h2');
            title.className = 'room-title';
            title.textContent = roomName;
            roomGroup.appendChild(title);

            const list = document.createElement('ul');
            list.className = 'appliance-list';

            apps.forEach(app => {
                const li = document.createElement('li');
                li.className = 'appliance-item';

                const issue = currentIssues[app.id];
                const status = issue ? issue.status || 'not_working' : 'working';
                const note = issue ? issue.description : '';

                const niceName = app.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                li.innerHTML = `
                    <div class="appliance-header">
                        <span class="appliance-title">${niceName}</span>
                        <span class="appliance-room">ID: ${app.id.split('_').pop()}</span>
                    </div>
                    <div class="appliance-controls">
                        <select class="status-select" id="status-${app.id}">
                            <option value="working" ${status === 'working' ? 'selected' : ''}>🟢 Working</option>
                            <option value="maintenance" ${status === 'maintenance' ? 'selected' : ''}>🟡 Under Maintenance</option>
                            <option value="not_working" ${status === 'not_working' ? 'selected' : ''}>🔴 Not Working</option>
                        </select>
                        <input type="text" class="note-input" id="note-${app.id}" placeholder="Add a note (e.g. Technician called)..." value="${note}">
                        <button class="btn-update" id="btn-${app.id}">Save</button>
                    </div>
                `;

                list.appendChild(li);

                // Add event listener after appending
                setTimeout(() => {
                    document.getElementById(`btn-${app.id}`).addEventListener('click', async (e) => {
                        const btn = e.target;
                        const newStatus = document.getElementById(`status-${app.id}`).value;
                        const newNote = document.getElementById(`note-${app.id}`).value;

                        if (window.Toast) window.Toast.show('Saving status...', 'info');
                        btn.textContent = 'Saving...';
                        btn.disabled = true;

                        try {
                            const issueRef = doc(db, "residences", residenceId, "issues", app.id);

                            if (newStatus === 'working') {
                                // Remove issue
                                await deleteDoc(issueRef);
                            } else {

                                // Add/Update issue
                                await setDoc(issueRef, {
                                    elementId: app.id,
                                    elementName: niceName,
                                    description: newNote || `Appliance is ${newStatus.replace('_', ' ')}`,
                                    severity: newStatus === 'not_working' ? 'critical' : 'warning',
                                    status: newStatus,
                                    floorLevel: app.floorLevel,
                                    roomName: app.roomName,
                                    timestamp: new Date().toISOString()
                                });

                            }

                            if (window.Toast) window.Toast.show('Status saved successfully', 'success');
                            btn.textContent = 'Saved!';
                            btn.classList.add('saved');
                            setTimeout(() => {
                                btn.textContent = 'Save';
                                btn.classList.remove('saved');
                                btn.disabled = false;
                            }, 2000);

                        } catch (err) {
                            console.error("Error saving status", err);
                            if (window.Toast) window.Toast.show('Error saving status', 'error');
                            btn.textContent = 'Error';
                            setTimeout(() => {
                                btn.textContent = 'Save';
                                btn.disabled = false;
                            }, 2000);
                        }
                    });
                }, 0);
            });

            roomGroup.appendChild(list);
            container.appendChild(roomGroup);
        }

    } catch (e) {
        console.error("Error loading appliances:", e);
        loading.textContent = "Error loading data. Please try again.";
    }
});