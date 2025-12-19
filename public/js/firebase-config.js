// Firebase configuration
// Replace with your project's actual configuration
const firebaseConfig = {
    apiKey: "AIzaSyDWoQZhcURsHi17Z10yauvG26fjtDvVPls",
    authDomain: "omroom-899ce.firebaseapp.com",
    projectId: "omroom-899ce",
    storageBucket: "omroom-899ce.firebasestorage.app",
    messagingSenderId: "1038426587852",
    appId: "1:1038426587852:web:0f7e4f58072984aed17869",
    measurementId: "G-1WS4N6N85P",
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getDatabase, ref, push, onValue, off, set, update, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

export { app, auth, provider, signInWithPopup, onAuthStateChanged, signOut, db, rtdb, storage, doc, getDoc, setDoc, updateDoc, ref, push, onValue, off, set, update, remove, storageRef, uploadBytes, getDownloadURL };
