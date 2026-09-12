// js/manager-dashboard.js
import { auth, db } from "./firebase-config.js";
import { doc, getDoc, collection, query, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    const residenceId = localStorage.getItem('dtech_residence_id');
    const role = localStorage.getItem('dtech_user_role');

    if (!residenceId || role !== 'manager') {
        window.location.href = 'index.html'; // Redirect unauthorized users
        return;
    }

    const residenceNameEl = document.getElementById('residence-name');
    const managerAlertsEl = document.getElementById('manager-alerts');
    const btnLogout = document.getElementById('btn-logout');

    btnLogout.addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // Load Residence Info
    const resDoc = await getDoc(doc(db, "residences", residenceId));
    if (resDoc.exists()) {
        residenceNameEl.textContent = resDoc.data().name || `Residence ${residenceId}`;
    }

    // QR Code Generation
    const btnGenerateQr = document.getElementById('btn-generate-qr');
    const qrModal = document.getElementById('qr-modal');
    const btnCloseQr = document.getElementById('btn-close-qr');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const qrLinkText = document.getElementById('qr-link-text');
    let qrCode = null;

    btnGenerateQr.addEventListener('click', () => {
        qrModal.classList.remove('hidden');
        qrCodeContainer.innerHTML = ''; // Clear previous

        const currentUrl = new URL(window.location.href);
        const joinUrl = `${currentUrl.origin}${currentUrl.pathname.replace('manager.html', 'index.html')}?join_residence=${residenceId}`;

        qrCode = new QRCode(qrCodeContainer, {
            text: joinUrl,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        qrLinkText.textContent = joinUrl;
    });

    btnCloseQr.addEventListener('click', () => {
        qrModal.classList.add('hidden');
    });

    // Close modal on outside click
    qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
            qrModal.classList.add('hidden');
        }
    });

    // Listen to Issues/Alerts
    const issuesRef = collection(db, "residences", residenceId, "issues");
    onSnapshot(issuesRef, (snapshot) => {
        managerAlertsEl.innerHTML = '';
        if (snapshot.empty) {
            managerAlertsEl.innerHTML = '<li class="alert-item green">All systems operational</li>';
            return;
        }

        snapshot.forEach(doc => {
            const issue = doc.data();
            const li = document.createElement('li');
            li.className = `alert-item ${issue.severity === 'critical' ? 'red' : 'yellow'}`;
            li.innerHTML = `<strong>${issue.elementName}</strong>: ${issue.description}`;
            managerAlertsEl.appendChild(li);
        });
    });
});
