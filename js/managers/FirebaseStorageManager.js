// js/managers/FirebaseStorageManager.js
import { db } from "../firebase-config.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

export class FirebaseStorageManager {
    static async saveToFirebase(residenceId, floorPlanData, floorLevel = 0) {
        if (!residenceId) {
            console.warn("No residenceId found. Skipping Firebase save.");
            return false;
        }

        try {
            const planRef = doc(db, "residences", residenceId, "floorPlans", `floor_${floorLevel}`);
            await setDoc(planRef, {
                data: floorPlanData,
                updatedAt: new Date().toISOString()
            });
            console.log("Floor plan saved to Firebase.");
            return true;
        } catch (e) {
            console.error("Failed to save to Firebase:", e);
            return false;
        }
    }

    static async loadFromFirebase(residenceId, floorLevel = 0) {
        if (!residenceId) return null;

        try {
            const planRef = doc(db, "residences", residenceId, "floorPlans", `floor_${floorLevel}`);
            const snapshot = await getDoc(planRef);
            if (snapshot.exists()) {
                return snapshot.data().data;
            }
        } catch (e) {
            console.error("Failed to load from Firebase:", e);
        }
        return null;
    }

    static async getAllFloors(residenceId) {
        if (!residenceId) return {};
        try {
            const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
            const plansRef = collection(db, "residences", residenceId, "floorPlans");
            const snapshot = await getDocs(plansRef);
            const floors = {};
            snapshot.forEach(doc => {
                const match = doc.id.match(/^floor_(\d+)$/);
                if (match) {
                    floors[parseInt(match[1])] = doc.data().data;
                } else if (doc.id === 'main') {
                    floors[0] = doc.data().data; // Fallback for old data
                }
            });
            return floors;
        } catch (e) {
            console.error("Failed to load all floors:", e);
            return {};
        }
    }

    static listenToFloorPlan(residenceId, floorLevel = 0, callback) {
        if (!residenceId) return () => {};

        const planRef = doc(db, "residences", residenceId, "floorPlans", `floor_${floorLevel}`);
        return onSnapshot(planRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.data().data);
            }
        });
    }

    // --- Issues / Alerts ---
    static async markIssue(residenceId, elementId, elementName, description, severity = 'critical', floorLevel = 0, roomName = 'Unassigned') {
        if (!residenceId) return;
        try {
            const issueRef = doc(db, "residences", residenceId, "issues", elementId);
            await setDoc(issueRef, {
                elementId,
                elementName,
                description,
                severity,
                floorLevel,
                roomName,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error("Failed to mark issue:", e);
        }
    }

    static async clearIssue(residenceId, elementId) {
        if (!residenceId) return;
        try {
            const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
            const issueRef = doc(db, "residences", residenceId, "issues", elementId);
            await deleteDoc(issueRef);
        } catch (e) {
            console.error("Failed to clear issue:", e);
        }
    }

    static listenToIssues(residenceId, callback) {
        if (!residenceId) return () => {};

        // Dynamic imports are asynchronous, but listener setup is sync normally.
        // We will just return a promise or let it handle async internally.
        import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js").then(({ collection }) => {
            const issuesRef = collection(db, "residences", residenceId, "issues");
            onSnapshot(issuesRef, (snapshot) => {
                const issues = {};
                snapshot.forEach(doc => {
                    issues[doc.id] = doc.data();
                });
                callback(issues);
            });
        });
    }

    static exportJSON(json, filename) {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
