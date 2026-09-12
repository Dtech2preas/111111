// js/student-dashboard.js
import { auth, db } from "./firebase-config.js";
import { doc, getDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    const residenceId = localStorage.getItem('dtech_residence_id');
    const role = localStorage.getItem('dtech_user_role');

    if (!residenceId || role !== 'student') {
        window.location.href = 'index.html'; // Redirect unauthorized
        return;
    }

    const residenceNameEl = document.getElementById('residence-name');
    const studentAlertsEl = document.getElementById('student-alerts');
    const btnLogout = document.getElementById('btn-logout');

    btnLogout.addEventListener('click', async () => {
        await signOut(auth);
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
            li.innerHTML = `${icon} <strong>${issue.elementName}</strong> is currently unavailable: ${issue.description}`;
            studentAlertsEl.appendChild(li);
        });
    });
});
