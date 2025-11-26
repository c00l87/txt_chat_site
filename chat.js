import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- DOM Elements ---
const authScreen = document.getElementById("auth-screen");
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const modalLogin = document.getElementById("modal-login");
const modalSignup = document.getElementById("modal-signup");
const btnShowLogin = document.getElementById("btn-show-login");
const btnShowSignup = document.getElementById("btn-show-signup");
const closeModals = document.querySelectorAll(".close-modal");
const formLogin = document.getElementById("form-login");
const formSignup = document.getElementById("form-signup");
const btnLogout = document.getElementById("btn-logout");
const joinForm = document.getElementById("join-form");
const msgForm = document.getElementById("msg-form");
const historyContainer = document.getElementById("history-container");
const historyList = document.getElementById("room-history-list");
const messagesDiv = document.getElementById("messages");
const pendingArea = document.getElementById("pending-area");
const roomTitle = document.getElementById("room-title");
const roomCodeInput = document.getElementById("room-code");
// NEW element
const roomPasswordInput = document.getElementById("room-password");
const roomPassDisplay = document.getElementById("room-pass-display");
const msgInput = document.getElementById("msg-input");
const backBtn = document.getElementById("back-btn");
const welcomeMsg = document.getElementById("welcome-msg");
const joinStatus = document.getElementById("join-status");

// State
let currentRoom = null;
let msgListener = null;
let pendingListener = null;
let approvalListener = null;
const MASTER_PASS = "admin 67";

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
}

// Generate random 6-char password (lowercase + numbers)
function generateRoomPassword() {
    return Math.random().toString(36).substring(2, 8);
}

// --- AUTH LOGIC ---

onAuthStateChanged(auth, (user) => {
  if (user) {
    authScreen.classList.add("hidden");
    joinScreen.classList.remove("hidden");
    // FIX: Display actual displayName
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

btnShowLogin.addEventListener("click", () => toggleModal(modalLogin, true));
btnShowSignup.addEventListener("click", () => toggleModal(modalSignup, true));
closeModals.forEach(btn => btn.addEventListener("click", () => {
    toggleModal(modalLogin, false);
    toggleModal(modalSignup, false);
}));
btnLogout.addEventListener("click", () => signOut(auth));

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value;
    const email = `${username}@flochat.com`;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        toggleModal(modalLogin, false);
        formLogin.reset();
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
        formSignup.reset();
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

// --- ROOM HISTORY LOGIC ---

async function saveRoomToHistory(code) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await set(ref(db, `users/${uid}/history/${code}`), {
    roomCode: code,
    lastVisited: serverTimestamp()
  });
}

async function loadRoomHistory() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const historyRef = ref(db, `users/${uid}/history`);
  const snapshot = await get(historyRef);

  historyList.innerHTML = "";
  if (snapshot.exists()) {
    historyContainer.classList.remove("hidden");
    snapshot.forEach((child) => {
      renderHistoryItem(child.val().roomCode);
    });
  } else {
    historyContainer.classList.add("hidden");
  }
}

function renderHistoryItem(code) {
  const li = document.createElement("li");
  li.className = "history-item";
  li.innerHTML = `
    <span class="history-room">#${code}</span>
    <button class="delete-btn">×</button>
  `;
  li.addEventListener("click", (e) => {
    if (!e.target.classList.contains("delete-btn")) {
        roomCodeInput.value = code;
        // Don't auto-submit, let them enter password if needed
        roomPasswordInput.focus(); 
    }
  });
  li.querySelector(".delete-btn").addEventListener("click", async (e) => {
    e.stopPropagation();
    const uid = auth.currentUser?.uid;
    await remove(ref(db, `users/${uid}/history/${code}`));
    li.remove();
  });
  historyList.prepend(li);
}

// --- JOINING & PASSWORD LOGIC ---

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
      // 1. Check Master Password
      if (inputPass === MASTER_PASS) {
           await enterChat(code);
           btn.disabled = false;
           return;
      }

      // 2. Check Room Metadata
      const metaRef = ref(db, `rooms/${code}/metadata`);
      const metaSnap = await get(metaRef);

      if (!metaSnap.exists()) {
          // Room doesn't exist (or is old pre-password room). 
          // Create it with a new password.
          const newPass = generateRoomPassword();
          await set(metaRef, {
              password: newPass,
              createdAt: serverTimestamp()
          });
          // Enter immediately as creator
          await enterChat(code);
      } else {
          // Room exists, check password
          const realPass = metaSnap.val().password;
          if (inputPass === realPass) {
              // Password match, proceed to normal join flow
              await handleNormalJoinFlow(code);
          } else {
              joinStatus.textContent = "Incorrect Room Password.";
              joinStatus.style.color = "var(--danger)";
          }
      }
  } catch (err) {
      joinStatus.textContent = "Error: " + err.message;
  }
  
  btn.disabled = false;
});

// Handle Allowed/Pending status after password is verified
async function handleNormalJoinFlow(code) {
  const uid = auth.currentUser.uid;
  const displayName = auth.currentUser.displayName;

  const allowedRef = ref(db, `rooms/${code}/allowed/${uid}`);
  const allowedSnap = await get(allowedRef);

  if (allowedSnap.exists()) {
      await enterChat(code);
  } else {
      joinStatus.textContent = "Password accepted. Waiting for host approval...";
      joinStatus.style.color = "var(--primary)";
      
      await set(ref(db, `rooms/${code}/pending/${uid}`), {
          name: displayName,
          timestamp: serverTimestamp()
      });

      approvalListener = onValue(ref(db, `rooms/${code}/allowed/${uid}`), (snap) => {
          if (snap.exists()) {
              off(ref(db, `rooms/${code}/allowed/${uid}`));
              enterChat(code);
          }
      });
  }
}

async function enterChat(code) {
  currentRoom = code;
  const uid = auth.currentUser.uid;

  // Ensure allowed
  await set(ref(db, `rooms/${code}/allowed/${uid}`), true);
  remove(ref(db, `rooms/${code}/pending/${uid}`));

  // UI Switch
  joinScreen.classList.add("hidden");
  joinStatus.classList.add("hidden");
  joinStatus.textContent = "";
  joinStatus.style.color = "var(--primary)";
  roomPasswordInput.value = ""; // Clear pass input

  chatScreen.classList.remove("hidden");
  roomTitle.textContent = `#${code}`;
  messagesDiv.innerHTML = "";
  pendingArea.innerHTML = "";
  pendingArea.classList.add("hidden");

  // Get and display password
  const passSnap = await get(ref(db, `rooms/${code}/metadata/password`));
  if(passSnap.exists()) {
      roomPassDisplay.textContent = `Pass: ${passSnap.val()}`;
      roomPassDisplay.classList.remove("hidden");
  }

  saveRoomToHistory(code);

  // Listeners
  const msgsQuery = query(ref(db, `rooms/${code}/messages`), limitToLast(50));
  msgListener = onChildAdded(msgsQuery, (snap) => {
    addMessageToUI(snap.val());
  });

  const pendingQuery = query(ref(db, `rooms/${code}/pending`));
  pendingListener = onChildAdded(pendingQuery, (snap) => {
    renderPendingRequest(snap.key, snap.val().name);
  });

  onChildRemoved(pendingQuery, (snap) => {
    const el = document.getElementById(`pending-${snap.key}`);
    if (el) el.remove();
    if (pendingArea.children.length === 0) pendingArea.classList.add("hidden");
  });
}

// --- PENDING REQUEST UI ---
function renderPendingRequest(reqUid, reqName) {
    pendingArea.classList.remove("hidden");
    const div = document.createElement("div");
    div.id = `pending-${reqUid}`;
    div.className = "pending-item";
    div.innerHTML = `
        <span><b>${reqName}</b> wants to join</span>
        <button class="btn-approve">Allow</button>
    `;
    div.querySelector(".btn-approve").addEventListener("click", async () => {
        await set(ref(db, `rooms/${currentRoom}/allowed/${reqUid}`), true);
        await remove(ref(db, `rooms/${currentRoom}/pending/${reqUid}`));
    });
    pendingArea.appendChild(div);
}

// --- CHAT MESSAGING ---
function addMessageToUI(msg) {
  const isSelf = msg.uid === auth.currentUser?.uid;
  const div = document.createElement("div");
  div.className = `msg ${isSelf ? "self" : "other"}`;
  const nameHtml = isSelf ? "" : `<span class="sender-name">${msg.sender}</span>`;
  
  div.innerHTML = `
    ${nameHtml}
    <div class="text">${msg.text}</div>
    <div class="msg-time">${formatTime(msg.createdAt)}</div>
  `;
  messagesDiv.appendChild(div);
  scrollToBottom();
}

msgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || !currentRoom) return;

  await push(ref(db, `rooms/${currentRoom}/messages`), {
    text,
    sender: auth.currentUser.displayName,
    uid: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });
  msgInput.value = "";
  msgInput.focus();
  scrollToBottom();
});

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
  roomPassDisplay.classList.add("hidden"); // Hide pass on exit
  loadRoomHistory();
});