import 'https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  remove,
  onChildAdded,
  onChildRemoved,
  onValue,
  query,
  limitToLast,
  serverTimestamp,
  off,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

import { 
  getStorage, 
  ref as sRef, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// --- Config ---
const firebaseConfig = {
  apiKey: "AIzaSyCSS-Ej-QDEosJD4EihZyr6y8l8ATzYaI8",
  authDomain: "txt-chat-site.firebaseapp.com",
  databaseURL: "https://txt-chat-site-default-rtdb.firebaseio.com",
  projectId: "txt-chat-site",
  storageBucket: "txt-chat-site.firebasestorage.app",
  messagingSenderId: "316750632828",
  appId: "1:316750632828:web:cfab60d020d90d01dcb6f9"
};

// --- GIPHY CONFIG ---
const GIPHY_API_KEY = "BBK6dAhShZbf3u9nE2rjOfmPX2NB4HgF"; 
const GIPHY_BASE_URL = "https://api.giphy.com/v1/gifs";


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app); 

// --- DOM Elements ---
const authScreen = document.getElementById("auth-screen");
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");

// Modals
const modalLogin = document.getElementById("modal-login");
const modalSignup = document.getElementById("modal-signup");
const modalSettings = document.getElementById("modal-change-pass"); 
const modalActiveUsers = document.getElementById("modal-active-users");
const btnShowLogin = document.getElementById("btn-show-login");
const btnShowSignup = document.getElementById("btn-show-signup");
const closeModals = document.querySelectorAll(".close-modal");

// Forms & Inputs
const formLogin = document.getElementById("form-login");
const formSignup = document.getElementById("form-signup");
const formSettings = document.getElementById("form-change-pass");
const btnLogout = document.getElementById("btn-logout");
const btnSettings = document.getElementById("btn-settings");
const btnForgotPass = document.getElementById("btn-forgot-pass");
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const btnMuteToggle = document.getElementById("btn-mute-toggle");
const btnActiveUsers = document.getElementById("btn-active-users");

const joinForm = document.getElementById("join-form");
const msgForm = document.getElementById("msg-form");
const historyContainer = document.getElementById("history-container");
const historyList = document.getElementById("room-history-list");
const messagesDiv = document.getElementById("messages");
const pendingArea = document.getElementById("pending-area");
const roomTitle = document.getElementById("room-title");
const roomCodeInput = document.getElementById("room-code");
const roomPasswordInput = document.getElementById("room-password");
const roomPassDisplay = document.getElementById("room-pass-display");
const msgInput = document.getElementById("msg-input");
const backBtn = document.getElementById("back-btn");
const welcomeMsg = document.getElementById("welcome-msg");
const joinStatus = document.getElementById("join-status");
const typingIndicator = document.getElementById("typing-indicator");
const activeUsersList = document.getElementById("active-users-list");
const msgSound = document.getElementById("msg-sound");


// GIF, Emoji, Mic, Image Elements
const btnGif = document.getElementById("btn-gif");
const gifPicker = document.getElementById("gif-picker");
const gifSearchInput = document.getElementById("gif-search-input");
const gifResults = document.getElementById("gif-results");
const btnEmoji = document.getElementById("btn-emoji");
const emojiPickerContainer = document.getElementById("emoji-picker-container");
const emojiPicker = document.querySelector("emoji-picker");
const btnMic = document.getElementById("btn-mic");

// Image Buttons
const btnGallery = document.getElementById("btn-gallery");
const fileInput = document.getElementById("file-input");

// Camera Elements (Button triggers modal now)
const btnCamera = document.getElementById("btn-camera");


// State
let currentRoom = null;
let msgListener = null;
let pendingListener = null;
let approvalListener = null;
let activeUsersAddListener = null; 
let activeUsersRemoveListener = null; 
let typingListener = null; 
const MASTER_PASS = "admin 67";
let gifSearchTimeout = null;
let recognition = null; 
let isDarkMode = false; 
let isMuted = false; 
let typingTimeout = null; 


// --- UTILS ---
function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

function toggleModal(modal, show) {
  modal.classList.toggle("hidden", !show);
  if(!show) {
      formLogin.reset();
      formSignup.reset();
      formSettings.reset();
  }
}

// Helper to play sound (checked mute state)
function playBeep() {
    if(isMuted) return; // Don't play if muted
    msgSound.currentTime = 0;
    msgSound.play().catch(e => console.log("Audio play prevented:", e));
}


function generateRoomPassword() {
    return Math.random().toString(36).substring(2, 8);
}


// --- THEME & MUTE LOGIC ---
const savedTheme = localStorage.getItem('flochat-theme');
if (savedTheme === 'dark') {
    enableDarkMode(true);
}

const savedMute = localStorage.getItem('flochat-muted');
if (savedMute === 'true') {
    toggleMute(true);
}

function enableDarkMode(enable) {
    isDarkMode = enable;
    document.body.classList.toggle('dark-mode', enable);
    localStorage.setItem('flochat-theme', enable ? 'dark' : 'light');
    btnThemeToggle.innerHTML = enable ? 
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>' :
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
}

function toggleMute(muted) {
    isMuted = muted;
    localStorage.setItem('flochat-muted', muted);
    btnMuteToggle.innerHTML = muted ? 
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>' : 
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
}

btnThemeToggle.addEventListener('click', () => {
    enableDarkMode(!isDarkMode);
});

btnMuteToggle.addEventListener('click', () => {
    toggleMute(!isMuted);
});


// --- AUTH LOGIC ---

onAuthStateChanged(auth, (user) => {
  if (user) {
    authScreen.classList.add("hidden");
    joinScreen.classList.remove("hidden");
    welcomeMsg.textContent = `Logged in as ${user.displayName || 'User'}`;
    loadRoomHistory();
  } else {
    joinScreen.classList.add("hidden");
    chatScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    authScreen.classList.add("fade-in");
    welcomeMsg.textContent = "";
  }
});

// Button Event Listeners
btnShowLogin.addEventListener("click", () => toggleModal(modalLogin, true));
btnShowSignup.addEventListener("click", () => toggleModal(modalSignup, true));
btnActiveUsers.addEventListener("click", () => toggleModal(modalActiveUsers, true)); 

// Open Settings
btnSettings.addEventListener("click", async () => {
    toggleModal(modalSettings, true);
});

closeModals.forEach(btn => btn.addEventListener("click", () => {
    toggleModal(modalLogin, false);
    toggleModal(modalSignup, false);
    toggleModal(modalSettings, false);
    toggleModal(modalActiveUsers, false);
    // Also try to close camera if open
    if(typeof stopCamera === "function") stopCamera();
}));
btnLogout.addEventListener("click", () => signOut(auth));


// --- PASSWORD MANAGEMENT (USERNAME BASED) ---

btnForgotPass.addEventListener("click", async () => {
    // Get username from the LOGIN form input
    const username = document.getElementById("login-user").value.trim();
    if(!username) {
        alert("Please enter your username in the Login box first.");
        return;
    }
    const email = `${username}@flochat.com`; // Fake email suffix
    try {
        // Send reset email (will go nowhere, but keeps Firebase happy)
        await sendPasswordResetEmail(auth, email);
        alert(`If an account exists for "${username}", a reset link has been sent to its registered email.`);
        toggleModal(modalLogin, false);
    } catch (error) {
        alert("Error: " + error.message);
    }
});

// Settings Form Handler (Password Only)
formSettings.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPass = document.getElementById("new-pass").value;
    const user = auth.currentUser;

    if(!user) return;
    if(!newPass) {
        alert("Please enter a new password to change it.");
        return;
    }

    try {
        await updatePassword(user, newPass);
        alert("Password updated successfully!");
        toggleModal(modalSettings, false);
    } catch (error) {
        alert("Error updating password: " + error.message + " (You may need to re-login first).");
    }
});


// --- AUTH FORMS (USERNAME BASED) ---
formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value;
    const email = `${username}@flochat.com`; // Fake email

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        toggleModal(modalLogin, false);
    } catch (err) {
        alert("Login failed: " + err.message);
    }
});

formSignup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("signup-user").value.trim();
    const pass = document.getElementById("signup-pass").value;
    
    if(!username || !pass) {
        alert("Please fill in all fields.");
        return;
    }

    const fakeAuthEmail = `${username}@flochat.com`; 

    try {
        // Create user with FAKE email for auth
        const userCred = await createUserWithEmailAndPassword(auth, fakeAuthEmail, pass);
        // Set their display name to the username
        await updateProfile(userCred.user, { displayName: username });
        
        toggleModal(modalSignup, false);
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            alert("That username is already taken.");
        } else if (err.code === 'auth/weak-password') {
             alert("Password should be at least 6 characters.");
        } else {
            alert("Error: " + err.message);
        }
    }
});


// --- SPEECH TO TEXT (STT) LOGIC ---

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true; 
  recognition.lang = 'en-US'; 

  btnMic.addEventListener('click', () => {
    if (btnMic.classList.contains('recording')) {
      recognition.stop();
    } else {
      emojiPickerContainer.classList.add("hidden");
      gifPicker.classList.add("hidden");
      recognition.start();
    }
  });

  recognition.onstart = function() {
    btnMic.classList.add('recording');
    msgInput.placeholder = "Listening...";
  };

  recognition.onend = function() {
    btnMic.classList.remove('recording');
    msgInput.placeholder = "Type a message...";
    msgInput.focus();
  };

  recognition.onresult = function(event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    msgInput.value = finalTranscript + interimTranscript;
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error', event.error);
    recognition.stop();
    if(event.error === 'not-allowed') {
        alert("Microphone access denied. Please allow microphone access to use speech-to-text.");
    }
  };
} else {
  btnMic.style.display = 'none';
}


// --- GIPHY & EMOJI LOGIC ---

btnGif.addEventListener("click", () => {
    emojiPickerContainer.classList.add("hidden");
    if(recognition) recognition.stop();
    gifPicker.classList.toggle("hidden");
    if (!gifPicker.classList.contains("hidden")) {
        loadTrendingGifs();
        gifSearchInput.focus();
    }
});

btnEmoji.addEventListener("click", () => {
    gifPicker.classList.add("hidden");
    if(recognition) recognition.stop();
    emojiPickerContainer.classList.toggle("hidden");
});

emojiPicker.addEventListener('emoji-click', event => {
  msgInput.value += event.detail.unicode;
  msgInput.focus();
});

document.addEventListener("click", (e) => {
    if (!gifPicker.contains(e.target) && !btnGif.contains(e.target)) {
        gifPicker.classList.add("hidden");
    }
    if (!emojiPickerContainer.contains(e.target) && !btnEmoji.contains(e.target)) {
        emojiPickerContainer.classList.add("hidden");
    }
});

async function fetchGifs(endpoint, params = {}) {
    const url = new URL(`${GIPHY_BASE_URL}/${endpoint}`);
    url.searchParams.append("api_key", GIPHY_API_KEY);
    url.searchParams.append("limit", 15);
    url.searchParams.append("rating", "g"); // safety
    for (const key in params) {
        url.searchParams.append(key, params[key]);
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        renderGifs(data.data);
    } catch (error) {
        console.error("Error fetching GIFs:", error);
        gifResults.innerHTML = "<p style='padding:10px;'>Error loading GIFs</p>";
    }
}

async function loadTrendingGifs() {
    gifResults.innerHTML = "<p style='padding:10px;'>Loading...</p>";
    await fetchGifs("trending");
}

gifSearchInput.addEventListener("input", (e) => {
    clearTimeout(gifSearchTimeout);
    const query = e.target.value.trim();
    if (query.length > 2) {
        gifResults.innerHTML = "<p style='padding:10px;'>Searching...</p>";
        gifSearchTimeout = setTimeout(() => {
            fetchGifs("search", { q: query });
        }, 500); // Debounce search
    } else if (query.length === 0) {
        loadTrendingGifs();
    }
});

function renderGifs(gifs) {
    gifResults.innerHTML = "";
    if (gifs.length === 0) {
        gifResults.innerHTML = "<p style='padding:10px;'>No results.</p>";
        return;
    }

    gifs.forEach(gif => {
        const img = document.createElement("img");
        img.src = gif.images.fixed_height_small.url;
        img.alt = gif.title;
        img.className = "gif-thumb";
        img.addEventListener("click", () => {
             sendMessage(gif.images.fixed_height.url, 'image');
             gifPicker.classList.add("hidden");
             gifSearchInput.value = "";
        });
        gifResults.appendChild(img);
    });
}


// --- CHAT & MESSAGE LOGIC ---

// --- CAMERA & IMAGE LOGIC ---

// Elements for Live Camera
const modalCamera = document.getElementById("modal-camera");
const cameraStream = document.getElementById("camera-stream");
const cameraCanvas = document.getElementById("camera-canvas");
const btnTakePhoto = document.getElementById("btn-take-photo");
const closeCameraBtn = document.getElementById("close-camera-btn");

let mediaStream = null;

// 1. REFACTORED: Generic Upload Function (Used by Gallery AND Camera)
async function uploadFileToChat(file) {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert("File is too large (Max 5MB).");
        return;
    }

    if (!currentRoom) {
        alert("You must be in a room to send images.");
        return;
    }

    // Visual feedback
    msgInput.placeholder = "Uploading image...";
    msgInput.disabled = true;

    try {
        // Create storage reference: rooms/{roomCode}/{timestamp_filename}
        // If it's a blob from camera, give it a name
        const fileName = file.name || `camera_${Date.now()}.jpg`;
        const storagePath = `rooms/${currentRoom}/${Date.now()}_${fileName}`;
        const storageReference = sRef(storage, storagePath);

        // Upload
        const snapshot = await uploadBytes(storageReference, file);
        
        // Get URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Send as message
        await sendMessage(downloadURL, 'image');

        // Close camera modal if open
        stopCamera();
        modalCamera.classList.add("hidden");

    } catch (error) {
        console.error("Upload failed:", error);
        alert("Failed to upload image.");
    } finally {
        // Reset inputs and UI
        fileInput.value = ""; 
        msgInput.placeholder = "Type a message...";
        msgInput.disabled = false;
        msgInput.focus();
    }
}

// 2. Gallery Input Handler
function handleGalleryUpload(e) {
    const file = e.target.files[0];
    uploadFileToChat(file);
}

// 3. Live Camera Functions
async function startCamera() {
    // Check if browser supports media devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera not supported on this browser.");
        return;
    }

    try {
        modalCamera.classList.remove("hidden");
        // Prefer rear camera on mobile ('environment'), fallback to user
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
        });
        cameraStream.srcObject = mediaStream;
    } catch (err) {
        console.error("Camera Error:", err);
        alert("Could not access camera. Please allow permissions.");
        modalCamera.classList.add("hidden");
    }
}

function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    cameraStream.srcObject = null;
    modalCamera.classList.add("hidden");
}

function takePhoto() {
    if (!mediaStream) return;

    // Set canvas size to match video stream
    cameraCanvas.width = cameraStream.videoWidth;
    cameraCanvas.height = cameraStream.videoHeight;

    const ctx = cameraCanvas.getContext("2d");
    // Draw current video frame to canvas
    ctx.drawImage(cameraStream, 0, 0, cameraCanvas.width, cameraCanvas.height);

    // Convert canvas to Blob (Image file)
    cameraCanvas.toBlob((blob) => {
        if (blob) {
            uploadFileToChat(blob);
        } else {
            alert("Failed to capture image.");
        }
    }, 'image/jpeg', 0.8); // 0.8 is quality (0 to 1)
}


// Open File Picker
btnGallery.addEventListener("click", () => {
    fileInput.click();
});

// Start Live Camera
btnCamera.addEventListener("click", () => {
    startCamera();
});

// Handle File Selection
fileInput.addEventListener("change", handleGalleryUpload);

// Handle Camera Snap
btnTakePhoto.addEventListener("click", takePhoto);

// Handle Camera Close
closeCameraBtn.addEventListener("click", stopCamera);

// Close camera if clicking outside the content
modalCamera.addEventListener("click", (e) => {
    if (e.target === modalCamera) {
        stopCamera();
    }
});



msgInput.addEventListener('input', () => {
    if (!currentRoom) return;
    const uid = auth.currentUser.uid;
    const typingRef = ref(db, `rooms/${currentRoom}/typing/${uid}`);
    
    clearTimeout(typingTimeout);
    set(typingRef, auth.currentUser.displayName);

    typingTimeout = setTimeout(() => {
        remove(typingRef);
    }, 2000);
});

async function sendMessage(content, type = 'text') {
  if (!content || !currentRoom) return;

  await push(ref(db, `rooms/${currentRoom}/messages`), {
    text: content,
    type: type,
    sender: auth.currentUser.displayName,
    uid: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });

  if(type === 'text') {
      msgInput.value = "";
      msgInput.focus();
      clearTimeout(typingTimeout);
      remove(ref(db, `rooms/${currentRoom}/typing/${auth.currentUser.uid}`));
  }
  scrollToBottom();
}

msgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  await sendMessage(text, 'text');
});


function addMessageToUI(msg) {
  const isSelf = msg.uid === auth.currentUser?.uid;
  const div = document.createElement("div");
  div.className = `msg ${isSelf ? "self" : "other"}`;
  
  const nameHtml = isSelf ? "" : `<span class="sender-name">${msg.sender}</span>`;
  const timeHtml = `<div class="msg-time">${formatTime(msg.createdAt)}</div>`;
  
  let contentHtml = '';
  if (msg.type === 'image') {
      contentHtml = `<img src="${msg.text}" class="msg-image" alt="GIF" />`;
  } else {
      contentHtml = `<div class="text">${msg.text}</div>`;
  }
  
  div.innerHTML = `${nameHtml}${contentHtml}${timeHtml}`;
  messagesDiv.appendChild(div);
  scrollToBottom();

  // Play sound if message is from someone else
  if (!isSelf) {
      playBeep();
  }
}


// --- ROOM JOINING & HISTORY ---

async function saveRoomToHistory(code) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await set(ref(db, `users/${uid}/history/${code}`), { roomCode: code, lastVisited: serverTimestamp() });
}

async function loadRoomHistory() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const snapshot = await get(ref(db, `users/${uid}/history`));
  historyList.innerHTML = "";
  if (snapshot.exists()) {
    historyContainer.classList.remove("hidden");
    snapshot.forEach((child) => { renderHistoryItem(child.val().roomCode); });
  } else {
    historyContainer.classList.add("hidden");
  }
}

function renderHistoryItem(code) {
  const li = document.createElement("li");
  li.className = "history-item";
  li.innerHTML = `<span class="history-room">#${code}</span><button class="delete-btn">×</button>`;
  
  li.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-btn")) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    roomCodeInput.value = code;
    
    joinStatus.textContent = "Checking access permissions...";
    joinStatus.classList.remove("hidden");
    joinStatus.style.color = "var(--primary)";
    li.style.pointerEvents = "none"; 
    li.style.opacity = "0.6";

    try {
        const allowedSnap = await get(ref(db, `rooms/${code}/allowed/${uid}`));

        if (allowedSnap.exists()) {
            joinStatus.textContent = "Access granted. Joining...";
            await enterChat(code);
        } else {
            roomPasswordInput.focus();
            joinStatus.textContent = "Please enter room password to rejoin.";
        }
    } catch (err) {
        console.error("Error checking access:", err);
        joinStatus.textContent = "Error checking access. Please try manually.";
        joinStatus.style.color = "var(--danger)";
        roomPasswordInput.focus();
    } finally {
        li.style.pointerEvents = "auto";
        li.style.opacity = "1";
    }
  });

  li.querySelector(".delete-btn").addEventListener("click", async (e) => {
    e.stopPropagation(); const uid = auth.currentUser?.uid;
    await remove(ref(db, `users/${uid}/history/${code}`)); li.remove();
  });
  historyList.prepend(li);
}

joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = roomCodeInput.value.trim().toLowerCase();
  const inputPass = roomPasswordInput.value.trim();
  if (!code) return;

  const btn = joinForm.querySelector("button");
  btn.disabled = true;
  joinStatus.textContent = "Verifying...";
  joinStatus.classList.remove("hidden");

  try {
      if (inputPass === MASTER_PASS) { await enterChat(code); btn.disabled = false; return; }

      const metaRef = ref(db, `rooms/${code}/metadata`);
      const metaSnap = await get(metaRef);

      if (!metaSnap.exists()) {
          const newPass = generateRoomPassword();
          await set(metaRef, { password: newPass, createdAt: serverTimestamp() });
          await enterChat(code);
      } else {
          if (inputPass === metaSnap.val().password) {
              await handleNormalJoinFlow(code);
          } else {
              joinStatus.textContent = "Incorrect Room Password.";
              joinStatus.style.color = "var(--danger)";
          }
      }
  } catch (err) { joinStatus.textContent = "Error: " + err.message; }
  btn.disabled = false;
});

async function handleNormalJoinFlow(code) {
  const uid = auth.currentUser.uid;
  const allowedSnap = await get(ref(db, `rooms/${code}/allowed/${uid}`));

  if (allowedSnap.exists()) {
      await enterChat(code);
  } else {
      joinStatus.textContent = "Password accepted. Waiting for host approval...";
      joinStatus.style.color = "var(--primary)";
      await set(ref(db, `rooms/${code}/pending/${uid}`), { name: auth.currentUser.displayName, timestamp: serverTimestamp() });

      approvalListener = onValue(ref(db, `rooms/${code}/allowed/${uid}`), (snap) => {
          if (snap.exists()) { off(ref(db, `rooms/${code}/allowed/${uid}`)); enterChat(code); }
      });
  }
}

async function enterChat(code) {
  currentRoom = code;
  const uid = auth.currentUser.uid;
  const displayName = auth.currentUser.displayName;

  // Clear list so we don't get duplicate beeps on re-entry
  activeUsersList.innerHTML = "";

  // 1. Set presence and setup disconnect handler
  const onlineRef = ref(db, `rooms/${code}/online/${uid}`);
  onDisconnect(onlineRef).remove();
  set(onlineRef, { name: displayName });

  // 2. Also setup disconnect for typing indicator just in case
  onDisconnect(ref(db, `rooms/${code}/typing/${uid}`)).remove();

  // 3. Normal join logic
  await set(ref(db, `rooms/${code}/allowed/${uid}`), true);
  remove(ref(db, `rooms/${code}/pending/${uid}`));

  joinScreen.classList.add("hidden");
  joinStatus.classList.add("hidden");
  joinStatus.textContent = "";
  joinStatus.style.color = "var(--primary)";
  roomPasswordInput.value = "";

  chatScreen.classList.remove("hidden");
  roomTitle.textContent = `#${code}`;
  messagesDiv.innerHTML = "";
  pendingArea.innerHTML = "";
  pendingArea.classList.add("hidden");
  typingIndicator.classList.add("hidden");

  const passSnap = await get(ref(db, `rooms/${code}/metadata/password`));
  if(passSnap.exists()) {
      roomPassDisplay.textContent = `Pass: ${passSnap.val()}`;
      roomPassDisplay.classList.remove("hidden");
  }
  saveRoomToHistory(code);

  // LISTENERS
  msgListener = onChildAdded(query(ref(db, `rooms/${code}/messages`), limitToLast(50)), (snap) => {
    addMessageToUI(snap.val());
  });

  pendingListener = onChildAdded(query(ref(db, `rooms/${code}/pending`)), (snap) => {
    renderPendingRequest(snap.key, snap.val().name);
  });

  onChildRemoved(query(ref(db, `rooms/${code}/pending`)), (snap) => {
    const el = document.getElementById(`pending-${snap.key}`);
    if (el) el.remove();
    if (pendingArea.children.length === 0) pendingArea.classList.add("hidden");
  });

  // Listen for active users ADDED (Join beep)
  activeUsersAddListener = onChildAdded(ref(db, `rooms/${code}/online`), (snap) => {
      const userUid = snap.key;
      const userData = snap.val();
      
      const li = document.createElement("li");
      li.id = `online-${userUid}`;
      li.className = "active-user-item";
      li.innerHTML = `<span class="online-dot"></span>${userData.name}`;
      activeUsersList.appendChild(li);

      // Play beep if it's someone else joining
      if (userUid !== uid) {
         playBeep();
      }
  });

  // Listen for active users REMOVED (Leave beep)
  activeUsersRemoveListener = onChildRemoved(ref(db, `rooms/${code}/online`), (snap) => {
      const userUid = snap.key;
      const el = document.getElementById(`online-${userUid}`);
      if(el) el.remove();

      // Play beep on leave
      playBeep();
  });


  // Listen for typing indicators
  typingListener = onValue(ref(db, `rooms/${code}/typing`), (snap) => {
      const typingNames = [];
      if(snap.exists()) {
          snap.forEach(child => {
              if(child.key !== uid) { 
                  typingNames.push(child.val());
              }
          });
      }

      if (typingNames.length > 0) {
          const text = typingNames.length > 2 ? "Several people are typing..." : 
                       typingNames.join(", ") + (typingNames.length === 1 ? " is typing..." : " are typing...");
          typingIndicator.textContent = text;
          typingIndicator.classList.remove("hidden");
      } else {
          typingIndicator.classList.add("hidden");
      }
      scrollToBottom();
  });
}

function renderPendingRequest(reqUid, reqName) {
    pendingArea.classList.remove("hidden");
    const div = document.createElement("div");
    div.id = `pending-${reqUid}`;
    div.className = "pending-item";
    div.innerHTML = `<span><b>${reqName}</b> wants to join</span><button class="btn-approve">Allow</button>`;
    div.querySelector(".btn-approve").addEventListener("click", async () => {
        await set(ref(db, `rooms/${currentRoom}/allowed/${reqUid}`), true);
        await remove(ref(db, `rooms/${currentRoom}/pending/${reqUid}`));
    });
    pendingArea.appendChild(div);
}

backBtn.addEventListener("click", () => {
  if (currentRoom) {
    const uid = auth.currentUser.uid;
    // Remove listeners
    off(query(ref(db, `rooms/${currentRoom}/messages`)));
    off(query(ref(db, `rooms/${currentRoom}/pending`)));
    off(ref(db, `rooms/${currentRoom}/online`)); // Clears both child listeners
    off(ref(db, `rooms/${currentRoom}/typing`));
    if (approvalListener) off(ref(db, `rooms/${currentRoom}/allowed`)); 

    // Manual cleanup on exit
    remove(ref(db, `rooms/${currentRoom}/online/${uid}`));
    remove(ref(db, `rooms/${currentRoom}/typing/${uid}`));
  }
  currentRoom = null;
  msgListener = null;
  pendingListener = null;
  activeUsersAddListener = null;
  activeUsersRemoveListener = null;
  typingListener = null;

  chatScreen.classList.add("hidden");
  joinScreen.classList.remove("hidden");
  roomPassDisplay.classList.add("hidden");
  gifPicker.classList.add("hidden"); 
  emojiPickerContainer.classList.add("hidden");
  loadRoomHistory();
});