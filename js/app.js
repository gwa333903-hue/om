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

// --- Page Initializers ---

function initDashboardPage(user, userProfile) {
    document.getElementById("user-name").textContent = userProfile.name || user.displayName || "User";

    document.getElementById("create-room-btn")?.addEventListener("click", async () => {
        if (!user) return;
        const roomId = generateRoomId();
        await set(ref(rtdb, `rooms/${roomId}`), {
            adminUid: user.uid,
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
                await set(ref(rtdb, `rooms/${roomId}/users/${user.uid}`), {
                    name: user.displayName || "Guest",
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

function initProfilePage(user, userProfile) {
    const profileForm = document.getElementById("profile-form");
    const nameInput = document.getElementById("name");
    const dobInput = document.getElementById("dob");
    const genderSelect = document.getElementById("gender");
    const profilePicInput = document.getElementById("profile-pic");
    const profilePicPreview = document.getElementById("profile-pic-preview");

    if (userProfile) {
        nameInput.value = userProfile.name || "";
        dobInput.value = userProfile.dob || "";
        genderSelect.value = userProfile.gender || "";
        if (userProfile.profilePictureUrl) {
            profilePicPreview.src = userProfile.profilePictureUrl;
            profilePicPreview.style.display = "block";
        }
    }

    profileForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = nameInput.value;
        const dob = dobInput.value;
        const gender = genderSelect.value;
        let profilePictureUrl = profilePicPreview.src === "" ? "" : profilePicPreview.src;

        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        const file = profilePicInput.files[0];
        if (file) {
            const pRef = storageRef(storage, `profilePictures/${user.uid}`);
            await uploadBytes(pRef, file);
            profilePictureUrl = await getDownloadURL(pRef);
        }

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name,
            dob,
            age,
            gender,
            profilePictureUrl,
            email: user.email
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

function initRoomPage(user, userProfile) {
    const urlParams = new URLSearchParams(window.location.search);
    currentRoomId = urlParams.get("roomId");

    if (!currentRoomId) {
        alert("No room ID provided. Redirecting to dashboard.");
        redirectTo("/dashboard.html");
        return;
    }

    document.getElementById("room-id-display").textContent = currentRoomId;

    const roomRef = ref(rtdb, `rooms/${currentRoomId}`);
    onValue(roomRef, async (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData || !roomData.active) {
            alert("Room has ended or is inactive. Redirecting to dashboard.");
            redirectTo("/dashboard.html");
            return;
        }

        isAdmin = (user.uid === roomData.adminUid);
        if (isAdmin) {
            document.getElementById("admin-controls").style.display = "flex";
            document.getElementById("video-link-input").value = roomData.videoUrl || "";
        } else {
            document.getElementById("admin-controls").style.display = "none";
        }

        if (typeof updateChatDisplay === 'function') {
            updateChatDisplay(roomData.chat || {});
        }
        
        if (roomData.videoUrl && youtubePlayerReady) {
            loadVideo(roomData.videoUrl, roomData.playbackTime, roomData.isPlaying);
        }
    });

    const userRoomRef = ref(rtdb, `rooms/${currentRoomId}/users/${user.uid}`);
    set(userRoomRef, { name: userProfile.name || user.displayName || "Guest", presence: true });
    onDisconnect(userRoomRef).remove();

    // YouTube Iframe API Ready
    window.onYouTubeIframeAPIReady = () => {
        youtubePlayerReady = true;
        if (player) return;
        player = new YT.Player("player", {
            height: "400",
            width: "100%",
            videoId: "",
            events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange },
        });
    };

    function onPlayerReady(event) {
        if (isAdmin) {
            document.getElementById("play-pause-btn")?.addEventListener("click", () => {
                if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
                else player.playVideo();
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
                }
            });
        }

        onValue(ref(rtdb, `rooms/${currentRoomId}`), (snapshot) => {
            const roomData = snapshot.val();
            if (roomData && !isAdmin) {
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

    function onPlayerStateChange(event) {
        if (!isAdmin) return;
        const roomRef = ref(rtdb, `rooms/${currentRoomId}`);
        const currentTime = player.getCurrentTime();
        switch (event.data) {
            case YT.PlayerState.PLAYING: update(roomRef, { isPlaying: true, playbackTime: currentTime }); break;
            case YT.PlayerState.PAUSED: update(roomRef, { isPlaying: false, playbackTime: currentTime }); break;
            case YT.PlayerState.ENDED: update(roomRef, { isPlaying: false, playbackTime: 0 }); break;
        }
    }

    function loadVideo(url, time, isPlaying) {
        let videoId = "";
        if (url.includes("youtube.com/watch?v=")) videoId = url.split("v=")[1].split("&")[0];
        else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1].split("&")[0];
        
        if (videoId) {
            player.loadVideoById(videoId, time);
            if (isPlaying) player.playVideo();
            else player.pauseVideo();
        }
    }

    document.getElementById("send-chat-btn")?.addEventListener("click", async () => {
        const chatInput = document.getElementById("chat-input");
        const message = chatInput.value.trim();
        if (message) {
            await push(ref(rtdb, `rooms/${currentRoomId}/chat`), {
                uid: user.uid,
                name: userProfile.name || user.displayName || "Guest",
                message: message,
                timestamp: new Date().toISOString()
            });
            chatInput.value = "";
        }
    });

    document.getElementById("leave-room-btn")?.addEventListener("click", async () => {
        if (confirm("Are you sure you want to leave this room?")) {
            await remove(ref(rtdb, `rooms/${currentRoomId}/users/${user.uid}`));
            if (isAdmin) {
                await remove(ref(rtdb, `rooms/${currentRoomId}`));
            }
            redirectTo("/dashboard.html");
        }
    });
}

// --- Main Auth Router ---
onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    const isPublicPage = ["/login.html", "/signup.html", "/index.html"].includes(currentPath);

    if (user) {
        currentUser = user;
        linkDeviceToUser(user.uid, generateDeviceId());

        const userProfileRef = doc(db, "users", user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        const userProfile = userProfileSnap.data();

        if (!userProfile && currentPath !== "/profile.html") {
            return redirectTo("/profile.html");
        }
        
        if (userProfile && isPublicPage) {
            return redirectTo("/dashboard.html");
        }
        
        // If we are on the correct page, initialize it
        if (currentPath === "/dashboard.html") initDashboardPage(user, userProfile);
        else if (currentPath === "/profile.html") initProfilePage(user, userProfile);
        else if (currentPath === "/room.html") initRoomPage(user, userProfile);

    } else {
        currentUser = null;
        if (!isPublicPage) {
            redirectTo("/login.html");
        }
    }
});

// --- Auth Button Handlers ---
document.getElementById("google-signin-btn")?.addEventListener("click", () => signInWithPopup(auth, provider).catch(err => console.error("Sign-in error", err)));
document.getElementById("google-signup-btn")?.addEventListener("click", () => signInWithPopup(auth, provider).catch(err => console.error("Sign-up error", err)));
document.querySelectorAll("#logout-btn")?.forEach(button => {
    button.addEventListener("click", async () => {
        try {
            await signOut(auth);
            localStorage.removeItem("deviceId");
            redirectTo("/login.html");
        } catch (error) {
            console.error("Error during logout:", error);
        }
    });
});
