// js/auth.js
import { auth, db } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const roleSelection = document.getElementById('role-selection');
    const authSection = document.getElementById('auth-section');
    const authTitle = document.getElementById('auth-title');
    const authForm = document.getElementById('auth-form');
    const btnBackRoles = document.getElementById('btn-back-roles');
    const toggleAuthMode = document.getElementById('toggle-auth-mode');
    const residenceGroup = document.getElementById('residence-group');
    const btnAuthSubmit = document.getElementById('btn-auth-submit');
    const authError = document.getElementById('auth-error');

    let currentRole = null; // 'student' or 'manager'
    let isLoginMode = true;

    // Role selection buttons
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentRole = e.currentTarget.getAttribute('data-role');
            roleSelection.classList.add('hidden');
            document.getElementById('welcome-text').classList.add('hidden');
            authSection.classList.remove('hidden');
            updateAuthUI();
        });
    });

    btnBackRoles.addEventListener('click', () => {
        authSection.classList.add('hidden');
        document.getElementById('welcome-text').classList.remove('hidden');
        roleSelection.classList.remove('hidden');
        currentRole = null;
        authError.textContent = '';
    });

    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        updateAuthUI();
        authError.textContent = '';
    });

    function updateAuthUI() {
        if (isLoginMode) {
            authTitle.textContent = `Log In as ${currentRole === 'manager' ? 'Manager' : 'Student'}`;
            btnAuthSubmit.textContent = 'Log In';
            toggleAuthMode.textContent = 'Need an account? Sign up';
            residenceGroup.classList.add('hidden');
            document.getElementById('residence-id').removeAttribute('required');
        } else {
            authTitle.textContent = `Sign Up as ${currentRole === 'manager' ? 'Manager' : 'Student'}`;
            btnAuthSubmit.textContent = 'Sign Up';
            toggleAuthMode.textContent = 'Already have an account? Log in';
            residenceGroup.classList.remove('hidden');
            document.getElementById('residence-id').setAttribute('required', 'true');
        }
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        btnAuthSubmit.disabled = true;

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const residenceId = document.getElementById('residence-id').value;

        try {
            if (isLoginMode) {
                // Log In
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                await handleUserRouting(userCredential.user);
            } else {
                // Sign Up
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // Save user profile to Firestore
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    email: email,
                    role: currentRole,
                    residenceId: residenceId
                });

                // For managers, create the initial residence structure if it doesn't exist
                if (currentRole === 'manager') {
                    const resDocRef = doc(db, "residences", residenceId);
                    const resDocSnap = await getDoc(resDocRef);

                    if (!resDocSnap.exists()) {
                        await setDoc(resDocRef, {
                            name: `Residence ${residenceId}`,
                            createdAt: new Date().toISOString()
                        });
                    }
                }

                await handleUserRouting(userCredential.user);
            }
        } catch (error) {
            console.error("Auth Error:", error);
            authError.textContent = error.message;
        } finally {
            btnAuthSubmit.disabled = false;
        }
    });

    async function handleUserRouting(user) {
        // Fetch user data to route them correctly
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();

                // Store minimal info locally for fast access in other pages without waiting for auth state
                localStorage.setItem('dtech_user_role', userData.role);
                localStorage.setItem('dtech_residence_id', userData.residenceId);

                if (userData.role === 'manager') {
                    window.location.href = 'manager.html';
                } else {
                    window.location.href = 'student.html';
                }
            } else {
                authError.textContent = 'User profile not found. Please contact support.';
            }
        } catch (err) {
            console.error("Routing error:", err);
            authError.textContent = "Error routing user. Try refreshing.";
        }
    }
});
