import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail, // NEW
  updatePassword // NEW
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
  off
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

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

// --- GIPHY CONFIG (IMPORTANT: REPLACE WITH YOUR KEY) ---
const GIPHY_API_KEY = "YOUR_GIPHY_API_KEY_HERE"; 
const GIPHY_BASE_URL = "https://api.giphy.com/v1/gifs";


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- DOM Elements ---
const authScreen = document.getElementById("auth-screen");
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");

// Modals
const modalLogin = document.getElementById("modal-login");
const modalSignup = document.getElementById("modal-signup");
const modalChangePass = document.getElementById("modal-change-pass"); // NEW
const btnShowLogin = document.getElementById("btn-show-login");
const btnShowSignup = document.getElementById("btn-show-signup");
const closeModals = document.querySelectorAll(".close-modal");

// Forms & Inputs
const formLogin = document.getElementById("form-login");
const formSignup = document.getElementById("form-signup");
const formChangePass = document.getElementById("form-change-pass"); // NEW
const btnLogout = document.getElementById("btn-logout");
const btnSettings = document.getElementById("btn-settings"); // NEW
const btnForgotPass = document.getElementById("btn-forgot-pass"); // NEW

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

// GIF Elements
const btnGif = document.getElementById("btn-gif");
const gifPicker = document.getElementById("gif-picker");
const gifSearchInput = document.getElementById("gif-search-input");
const gifResults = document.getElementById("gif-results");


// State
let currentRoom = null;
let msgListener = null;
let pendingListener = null;
let approvalListener = null;
const MASTER_PASS = "admin 67";
let gifSearchTimeout = null;


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
  // Reset forms on close
  if(!show) {
      formLogin.reset();
      formSignup.reset();
      formChangePass.reset();
  }
}

function generateRoomPassword() {
    return Math.random().toString(36).substring(2, 8);
}

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
btnSettings.addEventListener("click", () => toggleModal(modalChangePass, true)); // Show change pass modal
closeModals.forEach(btn => btn.addEventListener("click", () => {
    toggleModal(modalLogin, false);
    toggleModal(modalSignup, false);
    toggleModal(modalChangePass, false);
}));
btnLogout.addEventListener("click", () => signOut(auth));


// --- PASSWORD MANAGEMENT ---

// 1. Forgot Password (send reset email)
btnForgotPass.addEventListener("click", async () => {
    const username = document.getElementById("login-user").value.trim();
    if(!username) {
        alert("Please enter your username first.");
        return;
    }
    const email = `${username}@flochat.com`;
    try {
        await sendPasswordResetEmail(auth, email);
        alert(`Password reset email sent to the email associated with ${username}. Check your inbox (and spam).`);
        toggleModal(modalLogin, false);
    } catch (error) {
        alert("Error sending reset email: " + error.message);
    }
});

// 2. Change Password (when logged in)
formChangePass.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPass = document.getElementById("new-pass").value;
    const user = auth.currentUser;

    if(user) {
        try {
            await updatePassword(user, newPass);
            alert("Password updated successfully!");
            toggleModal(modalChangePass, false);
        } catch (error) {
            // Note: Firebase might require re-authentication if it's been too long.
            // For simplicity, we just show the error here.
            alert("Error updating password: " + error.message + " (You may need to log out and back in first).");
        }
    }
});


// --- AUTH FORMS ---
formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value;
    const email = `${username}@flochat.com`;

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
    const email = `${username}@flochat.com`; 

    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
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


// --- GIPHY LOGIC ---

// Toggle Picker
btnGif.addEventListener("click", () => {
    gifPicker.classList.toggle("hidden");
    if (!gifPicker.classList.contains("hidden")) {
        loadTrendingGifs();
        gifSearchInput.focus();
    }
});

// Close picker if clicking outside
document.addEventListener("click", (e) => {
    if (!gifPicker.contains(e.target) && !btnGif.contains(e.target)) {
        gifPicker.classList.add("hidden");
    }
});

async function fetchGifs(endpoint, params = {}) {
    if(GIPHY_API_KEY === "BBK6dAhShZbf3u9nE2rjOfmPX2NB4HgF") {
        console.error("Giphy API Key missing!");
        gifResults.innerHTML = "<p style='padding:10px; color: red;'>API Key Missing</p>";
        return;
    }
    
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

// Common send function for Text or Images
async function sendMessage(content, type = 'text') {
  if (!content || !currentRoom) return;

  await push(ref(db, `rooms/${currentRoom}/messages`), {
    text: content, // We re-use the 'text' field for the image URL
    type: type,    // 'text' or 'image'
    sender: auth.currentUser.displayName,
    uid: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });

  if(type === 'text') {
      msgInput.value = "";
      msgInput.focus();
  }
  scrollToBottom();
}

msgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  await sendMessage(text, 'text');
});

// Updated UI renderer to handle images
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
}


// --- ROOM JOINING & HISTORY (Mostly Unchanged from previous version) ---

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
  li.addEventListener("click", (e) => {
    if (!e.target.classList.contains("delete-btn")) {
        roomCodeInput.value = code; roomPasswordInput.focus(); 
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

  const passSnap = await get(ref(db, `rooms/${code}/metadata/password`));
  if(passSnap.exists()) {
      roomPassDisplay.textContent = `Pass: ${passSnap.val()}`;
      roomPassDisplay.classList.remove("hidden");
  }
  saveRoomToHistory(code);

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
    off(query(ref(db, `rooms/${currentRoom}/messages`)));
    off(query(ref(db, `rooms/${currentRoom}/pending`)));
    if (approvalListener) off(ref(db, `rooms/${currentRoom}/allowed`)); 
  }
  currentRoom = null;
  msgListener = null;
  pendingListener = null;
  chatScreen.classList.add("hidden");
  joinScreen.classList.remove("hidden");
  roomPassDisplay.classList.add("hidden");
  gifPicker.classList.add("hidden"); // Hide GIF picker on exit
  loadRoomHistory();
});