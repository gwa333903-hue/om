// app.js - Main application logic (GitHub Pages compatible)

/* ================= BASE PATH ================= */
const BASE_PATH = "/om"; // 🔴 IMPORTANT: your repo name

/* ================= IMPORTS ================= */
import {
  auth,
  provider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  db,
  rtdb,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  ref,
  push,
  onValue,
  set,
  update,
  remove,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL
} from "./firebase-config.js";

/* ================= GLOBAL STATE ================= */
let currentUser = null;
let currentRoomId = null;
let player;
let isAdmin = false;
let youtubePlayerReady = false;

/* ================= UTILITIES ================= */
function redirectTo(path) {
  window.location.href = `${BASE_PATH}${path}`;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function generateDeviceId() {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = "device_" + Math.random().toString(36).slice(2);
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

async function linkDeviceToUser(uid, deviceId) {
  await setDoc(doc(db, "userDevices", uid), { [deviceId]: true }, { merge: true });
}

/* ================= PAGE INIT ================= */
function initDashboardPage(user, profile) {
  document.getElementById("user-name").textContent =
    profile?.name || user.displayName || "User";

  document.getElementById("create-room-btn")?.addEventListener("click", async () => {
    const roomId = generateRoomId();
    await set(ref(rtdb, `rooms/${roomId}`), {
      adminUid: user.uid,
      active: true,
      createdAt: new Date().toISOString()
    });
    redirectTo(`/room.html?roomId=${roomId}`);
  });

  document.getElementById("edit-profile-btn")?.addEventListener("click", () => {
    redirectTo("/profile.html");
  });
}

function initProfilePage(user, profile) {
  const form = document.getElementById("profile-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value;
    const dob = document.getElementById("dob").value;
    const gender = document.getElementById("gender").value;

    await setDoc(
      doc(db, "users", user.uid),
      { name, dob, gender, email: user.email },
      { merge: true }
    );

    redirectTo("/dashboard.html");
  });
}

function initRoomPage(user) {
  const roomId = new URLSearchParams(window.location.search).get("roomId");
  if (!roomId) return redirectTo("/dashboard.html");

  document.getElementById("room-id-display").textContent = roomId;
}

/* ================= AUTH ROUTER ================= */
onAuthStateChanged(auth, async (user) => {
  let currentPath = window.location.pathname;

  // 🔥 Normalize GitHub Pages path
  if (currentPath.startsWith(BASE_PATH)) {
    currentPath = currentPath.replace(BASE_PATH, "");
  }

  if (currentPath === "" || currentPath === "/") {
    currentPath = "/index.html";
  }

  const publicPages = ["/index.html", "/login.html", "/signup.html"];
  const isPublicPage = publicPages.includes(currentPath);

  if (user) {
    currentUser = user;
    linkDeviceToUser(user.uid, generateDeviceId());

    const snap = await getDoc(doc(db, "users", user.uid));
    const profile = snap.data();

    if (!profile && currentPath !== "/profile.html") {
      return redirectTo("/profile.html");
    }

    if (profile && isPublicPage) {
      return redirectTo("/dashboard.html");
    }

    if (currentPath === "/dashboard.html") initDashboardPage(user, profile);
    if (currentPath === "/profile.html") initProfilePage(user, profile);
    if (currentPath === "/room.html") initRoomPage(user);
  } else {
    currentUser = null;
    if (!isPublicPage) redirectTo("/login.html");
  }
});

/* ================= BUTTON HANDLERS ================= */
document.getElementById("google-signin-btn")?.addEventListener("click", () => {
  signInWithPopup(auth, provider).catch(console.error);
});

document.getElementById("google-signup-btn")?.addEventListener("click", () => {
  signInWithPopup(auth, provider).catch(console.error);
});

document.querySelectorAll("#logout-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    await signOut(auth);
    localStorage.removeItem("deviceId");
    redirectTo("/login.html");
  });
});
