// js/student-dashboard.js
import { auth, db } from "./firebase-config.js";
import { doc, getDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    // Check if accessing via guest view (QR Code)
    const urlParams = new URLSearchParams(window.location.search);
    const viewResidenceId = urlParams.get('view_residence');
    if (viewResidenceId) {
        localStorage.setItem('dtech_residence_id', viewResidenceId);
        localStorage.setItem('dtech_user_role', 'student');
        localStorage.setItem('dtech_guest_mode', 'true');
        // Clean URL to not show parameter continuously if desired,
        // but leaving it is fine too for bookmarking.
    }

    const residenceId = localStorage.getItem('dtech_residence_id');
    const role = localStorage.getItem('dtech_user_role');
    const isGuest = localStorage.getItem('dtech_guest_mode') === 'true';

    if (!residenceId || role !== 'student') {
        window.location.href = 'index.html'; // Redirect unauthorized
        return;
    }

    const residenceNameEl = document.getElementById('residence-name');
    const studentAlertsEl = document.getElementById('student-alerts');
    const btnLogout = document.getElementById('btn-logout');

    btnLogout.addEventListener('click', async () => {
        if (!isGuest) {
            try {
                await signOut(auth);
            } catch (e) {
                console.warn('Sign out error:', e);
            }
        }
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // Load Residence Info
    const resDoc = await getDoc(doc(db, "residences", residenceId));
    if (resDoc.exists()) {
        residenceNameEl.textContent = `🏠 ${resDoc.data().name || `Residence ${residenceId}`}`;
    }

    // Listen to Issues/Alerts
    const issuesRef = collection(db, "residences", residenceId, "issues");
    onSnapshot(issuesRef, (snapshot) => {
        studentAlertsEl.innerHTML = '';
        if (snapshot.empty) {
            studentAlertsEl.innerHTML = '<li class="alert-item green">All systems operational. No current alerts.</li>';
            return;
        }

        snapshot.forEach(doc => {
            const issue = doc.data();
            const li = document.createElement('li');
            const icon = issue.severity === 'critical' ? '🔴' : '🟡';
            li.className = `alert-item ${issue.severity === 'critical' ? 'red' : 'yellow'}`;
            li.innerHTML = `${icon} <strong>${issue.elementName}</strong> (Floor ${issue.floorLevel !== undefined ? issue.floorLevel : "?"}, ${issue.roomName || "Unknown"}) is currently unavailable: ${issue.description}`;
            studentAlertsEl.appendChild(li);
        });
    });
});
