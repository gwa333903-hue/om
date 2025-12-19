// app.js - Main application logic

import { auth, provider, signInWithPopup, onAuthStateChanged, signOut, db, rtdb, storage, doc, getDoc, setDoc, updateDoc, ref, push, onValue, off, set, update, remove, storageRef, uploadBytes, getDownloadURL } from "./firebase-config.js";

let currentUser = null;
let currentRoomId = null;
let player;
let isAdmin = false;
let youtubePlayerReady = false;

// --- Utility Functions ---
function redirectTo(path) {
    window.location.href = path;
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase(); // 5-digit alphanumeric
}

// Function to generate a unique device ID and store it in local storage
function generateDeviceId() {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
}

// Function to store device ID for a logged-in user in Firestore
async function linkDeviceToUser(uid, deviceId) {
    const userDevicesRef = doc(db, "userDevices", uid);
    await setDoc(userDevicesRef, { [deviceId]: true }, { merge: true });
}

// Function to check if the current device is linked to the user (optional, for future server-side analysis)
async function isDeviceLinked(uid, deviceId) {
    const userDevicesRef = doc(db, "userDevices", uid);
    const docSnap = await getDoc(userDevicesRef);
    return docSnap.exists() && docSnap.data()[deviceId] === true;
}

// --- Authentication ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const currentDeviceId = generateDeviceId(); // Ensure device ID is generated on every load

    if (user) {
        console.log("User is logged in:", user.uid);
        // Link the current device to the user in Firestore
        linkDeviceToUser(user.uid, currentDeviceId);

        const userProfileRef = doc(db, "users", user.uid);
        const userProfileSnap = await getDoc(userProfileRef);

        if (!userProfileSnap.exists() && window.location.pathname !== "/profile.html") {
            // New user, redirect to profile setup
            redirectTo("/profile.html");
        } else if (window.location.pathname === "/login.html" || window.location.pathname === "/index.html" || window.location.pathname === "/signup.html") {
            // Logged in and on login/index/signup page, redirect to dashboard
            redirectTo("/dashboard.html");
        }
    } else {
        console.log("User is logged out.");
        if (window.location.pathname !== "/login.html" && window.location.pathname !== "/index.html" && window.location.pathname !== "/signup.html") {
            // Logged out and not on login/index/signup page, redirect to login
            redirectTo("/login.html");
        }
        // If on index.html, login.html, or signup.html and logged out, do nothing, allow them to see login/signup buttons.
        // Firebase handles session persistence. If a user was previously signed in on this device and hasn't
        // explicitly logged out, onAuthStateChanged will detect the active session and 'user' will not be null.
        // Therefore, explicit 'auto-login' logic for a logged out user based solely on device ID is not
        // directly implemented here, as it typically requires server-side authentication for security reasons.
    }
});

// Handle Google Sign-In button click
document.getElementById("google-signin-btn")?.addEventListener("click", async () => {
    console.log("Sign-in button clicked.");
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Google Sign-In successful.", result);
        const user = result.user;
        console.log("User object:", user);
    } catch (error) {
        console.error("Error during Google Sign-In:", error.code, error.message);
    }
});

// Handle Google Sign-Up button click
document.getElementById("google-signup-btn")?.addEventListener("click", async () => {
    console.log("Sign-up button clicked.");
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Google Sign-Up successful.", result);
        const user = result.user;
        console.log("User object:", user);
    } catch (error) {
        console.error("Error during Google Sign-Up:", error.code, error.message);
    }
});

// Handle Logout button click
document.querySelectorAll("#logout-btn")?.forEach(button => {
    button.addEventListener("click", async () => {
        try {
            await signOut(auth);
            localStorage.removeItem("deviceId"); // Clear device ID on logout
            redirectTo("/login.html");
        } catch (error) {
            console.error("Error during logout:", error);
        }
    });
});

// --- Profile Management ---
if (window.location.pathname === "/profile.html") {
    const profileForm = document.getElementById("profile-form");
    const nameInput = document.getElementById("name");
    const dobInput = document.getElementById("dob");
    const genderSelect = document.getElementById("gender");
    const profilePicInput = document.getElementById("profile-pic");
    const profilePicPreview = document.getElementById("profile-pic-preview");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userProfileRef = doc(db, "users", user.uid);
            const userProfileSnap = await getDoc(userProfileRef);

            if (userProfileSnap.exists()) {
                const data = userProfileSnap.data();
                nameInput.value = data.name || "";
                dobInput.value = data.dob || "";
                genderSelect.value = data.gender || "";
                if (data.profilePictureUrl) {
                    profilePicPreview.src = data.profilePictureUrl;
                    profilePicPreview.style.display = "block";
                }
            }
        } else {
            redirectTo("/login.html");
        }
    });

    profileForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const name = nameInput.value;
        const dob = dobInput.value;
        const gender = genderSelect.value;
        let profilePictureUrl = profilePicPreview.src === "" ? "" : profilePicPreview.src;

        // Calculate age
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        // Upload profile picture if selected
        const file = profilePicInput.files[0];
        if (file) {
            const pRef = storageRef(storage, `profilePictures/${currentUser.uid}`);
            await uploadBytes(pRef, file);
            profilePictureUrl = await getDownloadURL(pRef);
        }

        await setDoc(doc(db, "users", currentUser.uid), {
            uid: currentUser.uid,
            name,
            dob,
            age,
            gender,
            profilePictureUrl,
            email: currentUser.email
        }, { merge: true });

        alert("Profile saved successfully!");
        redirectTo("/dashboard.html");
    });

    profilePicInput?.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                profilePicPreview.src = e.target.result;
                profilePicPreview.style.display = "block";
            };
            reader.readAsDataURL(file);
        } else {
            profilePicPreview.src = "";
            profilePicPreview.style.display = "none";
        }
    });
}

// --- Dashboard ---
if (window.location.pathname === "/dashboard.html") {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userProfileRef = doc(db, "users", user.uid);
            const userProfileSnap = await getDoc(userProfileRef);

            if (userProfileSnap.exists()) {
                const data = userProfileSnap.data();
                document.getElementById("user-name").textContent = data.name || user.displayName || "User";
            } else {
                document.getElementById("user-name").textContent = user.displayName || "User";
            }
        } else {
            redirectTo("/login.html");
        }
    });

    document.getElementById("create-room-btn")?.addEventListener("click", async () => {
        if (!currentUser) {
            alert("Please log in to create a room.");
            return;
        }
        const roomId = generateRoomId();
        await set(ref(rtdb, `rooms/${roomId}`), {
            adminUid: currentUser.uid,
            videoUrl: "",
            playbackTime: 0,
            isPlaying: false,
            active: true,
            createdAt: new Date().toISOString()
        });
        redirectTo(`/room.html?roomId=${roomId}`);
    });

    document.getElementById("join-room-btn")?.addEventListener("click", () => {
        document.getElementById("join-room-section").style.display = "block";
    });

    document.getElementById("submit-join-room-btn")?.addEventListener("click", async () => {
        const roomIdInput = document.getElementById("room-id-input");
        const roomId = roomIdInput.value.toUpperCase();
        const joinRoomError = document.getElementById("join-room-error");
        joinRoomError.textContent = "";

        if (roomId.length !== 5) {
            joinRoomError.textContent = "Room ID must be 5 digits.";
            return;
        }

        const roomRef = ref(rtdb, `rooms/${roomId}`);
        onValue(roomRef, async (snapshot) => {
            const roomData = snapshot.val();
            if (roomData && roomData.active) {
                await set(ref(rtdb, `rooms/${roomId}/users/${currentUser.uid}`), {
                    name: currentUser.displayName || "Guest",
                    joinedAt: new Date().toISOString()
                });
                redirectTo(`/room.html?roomId=${roomId}`);
            } else {
                joinRoomError.textContent = "Invalid or inactive Room ID.";
            }
        }, { onlyOnce: true });
    });

    document.getElementById("edit-profile-btn")?.addEventListener("click", () => {
        redirectTo("/profile.html");
    });
}

// --- Room Functionality ---
if (window.location.pathname === "/room.html") {
    const urlParams = new URLSearchParams(window.location.search);
    currentRoomId = urlParams.get("roomId");

    if (!currentRoomId) {
        alert("No room ID provided. Redirecting to dashboard.");
        redirectTo("/dashboard.html");
        return;
    }

    document.getElementById("room-id-display").textContent = currentRoomId;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const roomRef = ref(rtdb, `rooms/${currentRoomId}`);
            onValue(roomRef, async (snapshot) => {
                const roomData = snapshot.val();
                if (!roomData || !roomData.active) {
                    alert("Room has ended or is inactive. Redirecting to dashboard.");
                    redirectTo("/dashboard.html");
                    return;
                }

                isAdmin = (currentUser.uid === roomData.adminUid);
                if (isAdmin) {
                    document.getElementById("admin-controls").style.display = "flex";
                    document.getElementById("video-link-input").value = roomData.videoUrl || "";
                } else {
                    document.getElementById("admin-controls").style.display = "none";
                }

                // Handle video loading and sync
                if (roomData.videoUrl && youtubePlayerReady) {
                    loadVideo(roomData.videoUrl, roomData.playbackTime, roomData.isPlaying);
                }

                // Update chat messages
                updateChatDisplay(roomData.chat || {});

            });

            // Set user presence
            const userRoomRef = ref(rtdb, `rooms/${currentRoomId}/users/${currentUser.uid}`);
            await set(userRoomRef, { name: user.displayName || "Guest", presence: true });
            onDisconnect(userRoomRef).remove();

        } else {
            redirectTo("/login.html");
        }
    });

    // YouTube Iframe API Ready
    window.onYouTubeIframeAPIReady = () => {
        youtubePlayerReady = true;
        if (player) return; // Prevent multiple player creations
        player = new YT.Player("player", {
            height: "400",
            width: "100%",
            videoId: "", // Default empty video
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
            },
        });
    };

    function onPlayerReady(event) {
        // Admin controls
        if (isAdmin) {
            document.getElementById("play-pause-btn")?.addEventListener("click", () => {
                if (player.getPlayerState() === YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                } else {
                    player.playVideo();
                }
            });

            document.getElementById("seek-slider")?.addEventListener("input", () => {
                const seekTime = player.getDuration() * (document.getElementById("seek-slider").value / 100);
                player.seekTo(seekTime, true);
                update(ref(rtdb, `rooms/${currentRoomId}`), { playbackTime: seekTime });
            });

            document.getElementById("load-video-btn")?.addEventListener("click", async () => {
                const videoLink = document.getElementById("video-link-input").value;
                if (videoLink) {
                    await update(ref(rtdb, `rooms/${currentRoomId}`), { videoUrl: videoLink, playbackTime: 0, isPlaying: false });
                }
            });

            document.getElementById("end-room-btn")?.addEventListener("click", async () => {
                if (confirm("Are you sure you want to end this room for everyone?")) {
                    await remove(ref(rtdb, `rooms/${currentRoomId}`));
                    redirectTo("/dashboard.html");
                }
            });
        }

        // Sync initial state if not admin
        if (!isAdmin) {
            const roomRef = ref(rtdb, `rooms/${currentRoomId}`);
            onValue(roomRef, (snapshot) => {
                const roomData = snapshot.val();
                if (roomData) {
                    if (roomData.isPlaying && player.getPlayerState() !== YT.PlayerState.PLAYING) {
                        player.seekTo(roomData.playbackTime, true);
                        player.playVideo();
                    } else if (!roomData.isPlaying && player.getPlayerState() === YT.PlayerState.PLAYING) {
                        player.seekTo(roomData.playbackTime, true);
                        player.pauseVideo();
                    }
                }
            });
        }
    }

    function onPlayerStateChange(event) {
        if (!isAdmin) return; // Only admin updates state

        const roomRef = ref(rtdb, `rooms/${currentRoomId}`);
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                update(roomRef, { isPlaying: true, playbackTime: player.getCurrentTime() });
                break;
            case YT.PlayerState.PAUSED:
                update(roomRef, { isPlaying: false, playbackTime: player.getCurrentTime() });
                break;
            case YT.PlayerState.ENDED:
                update(roomRef, { isPlaying: false, playbackTime: 0 });
                break;
        }
    }

    function loadVideo(url, time, isPlaying) {
        let videoId = "";
        if (url.includes("youtube.com/watch?v=")) {
            videoId = url.split("v=")[1].split("&")[0];
        } else if (url.includes("youtu.be/")) {
            videoId = url.split("youtu.be/")[1].split("&")[0];
        } else if (url.includes("drive.google.com")) {
            // For Google Drive, this is more complex. Direct embedding usually requires
            // the file to be publicly accessible and an embed link.
            // For simplicity, we'll assume a direct embeddable URL is provided or convert.
            // This part would need actual Google Drive API integration for robust solution.
            // For now, if it's a direct mp4 link, we can use it.
            // If it's a Google Drive share link, it needs conversion to embeddable link
            // e.g. https://drive.google.com/file/d/FILE_ID/view?usp=sharing
            // becomes https://drive.google.com/file/d/FILE_ID/preview
            const fileIdMatch = url.match(/id=([^&]+)/) || url.match(/d\/([a-zA-Z0-9_-]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
                const fileId = fileIdMatch[1];
                const embedUrl = `https://www.youtube.com/iframe_api`; // This is wrong, should be Google Drive embed
                // If player is YouTube, we can't play Google Drive video directly.
                // A more robust solution would dynamically create a <video> element.
                // For now, sticking with YouTube player logic for simplicity.
                alert("Google Drive video support is limited. Please provide a direct embeddable link or YouTube link.");
                return;
            }
        }

        if (videoId) {
            player.loadVideoById(videoId, time);
            if (isPlaying) {
                player.playVideo();
            } else {
                player.pauseVideo();
            }
        }
    }

    // Chat functionality
    document.getElementById("send-chat-btn")?.addEventListener("click", async () => {
        const chatInput = document.getElementById("chat-input");
        const message = chatInput.value.trim();
        if (message && currentUser && currentRoomId) {
            const userProfileRef = doc(db, "users", currentUser.uid);
            const userProfileSnap = await getDoc(userProfileRef);
            const userData = userProfileSnap.data();
            const userName = userData?.name || currentUser.displayName || "Guest";

            await push(ref(rtdb, `rooms/${currentRoomId}/chat`), {
                uid: currentUser.uid,
                name: userName,
                message: message,
                timestamp: new Date().toISOString()
            });
            chatInput.value = "";
        }
    });

    document.getElementById("leave-room-btn")?.addEventListener("click", async () => {
        if (confirm("Are you sure you want to leave this room?")) {
            if (isAdmin) {
                // Admin leaving means room ends
                await remove(ref(rtdb, `rooms/${currentRoomId}`));
            } else {
                // Non-admin just leaves their presence
                await remove(ref(rtdb, `rooms/${currentRoomId}/users/${currentUser.uid}`));
            }
            redirectTo("/dashboard.html");
        }
    });
}
