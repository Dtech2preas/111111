// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALuCm7naVsH_d8i6mJoShI3kK34Ueiv3c",
  authDomain: "res-management-441fb.firebaseapp.com",
  projectId: "res-management-441fb",
  storageBucket: "res-management-441fb.firebasestorage.app",
  messagingSenderId: "214618369279",
  appId: "1:214618369279:web:19d7780af77b39cc2d30ca",
  measurementId: "G-E8S2ZFEK0X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
