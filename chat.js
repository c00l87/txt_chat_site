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
// Screens
const authScreen = document.getElementById("auth-screen");
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");

// Auth Modals
const modalLogin = document.getElementById("modal-login");
const modalSignup = document.getElementById("modal-signup");
const btnShowLogin = document.getElementById("btn-show-login");
const btnShowSignup = document.getElementById("btn-show-signup");
const closeModals = document.querySelectorAll(".close-modal");
const formLogin = document.getElementById("form-login");
const formSignup = document.getElementById("form-signup");
const btnLogout = document.getElementById("btn-logout");

// Join & Chat
const joinForm = document.getElementById("join-form");
const msgForm = document.getElementById("msg-form");
const historyContainer = document.getElementById("history-container");
const historyList = document.getElementById("room-history-list");
const messagesDiv = document.getElementById("messages");
const pendingArea = document.getElementById("pending-area");
const roomTitle = document.getElementById("room-title");
const roomCodeInput = document.getElementById("room-code");
const msgInput = document.getElementById("msg-input");
const backBtn = document.getElementById("back-btn");
const welcomeMsg = document.getElementById("welcome-msg");
const joinStatus = document.getElementById("join-status");

// State
let currentRoom = null;
let msgListener = null;
let pendingListener = null;
let approvalListener = null;

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

// --- AUTH LOGIC ---

// 1. Handle UI Switching
onAuthStateChanged(auth, (user) => {
  if (user) {
    authScreen.classList.add("hidden");
    joinScreen.classList.remove("hidden");
    welcomeMsg.textContent = `Logged in as ${user.displayName}`;
    loadRoomHistory();
  } else {
    joinScreen.classList.add("hidden");
    chatScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    authScreen.classList.add("fade-in");
    welcomeMsg.textContent = "";
  }
});

// 2. Button Listeners
btnShowLogin.addEventListener("click", () => toggleModal(modalLogin, true));
btnShowSignup.addEventListener("click", () => toggleModal(modalSignup, true));
closeModals.forEach(btn => btn.addEventListener("click", () => {
    toggleModal(modalLogin, false);
    toggleModal(modalSignup, false);
}));
btnLogout.addEventListener("click", () => signOut(auth));

// 3. Login Submit
formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value;
    const email = `${username}@flochat.com`; // Fake email

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        toggleModal(modalLogin, false);
        formLogin.reset();
    } catch (err) {
        alert("Login failed: " + err.message);
    }
});

// 4. Signup Submit
formSignup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("signup-user").value.trim();
    const pass = document.getElementById("signup-pass").value;
    const email = `${username}@flochat.com`; 

    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        // Save display name
        await updateProfile(userCred.user, { displayName: username });
        
        toggleModal(modalSignup, false);
        formSignup.reset();
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            alert("That username is already taken.");
        } else {
            alert("Error: " + err.message);
        }
    }
});

// --- ROOM LOGIC ---

// History
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
        joinForm.requestSubmit();
    }
  });
  li.querySelector(".delete-btn").addEventListener("click", async (e) => {
    e.stopPropagation();
    const uid = auth.currentUser?.uid;
    await remove(ref(db, `users/${uid}/history/${code}`));
    li.remove();
  });
  historyList.prepend(li); // Newest first
}

// --- JOINING & WAITING ROOM LOGIC ---

joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = roomCodeInput.value.trim().toLowerCase();
  if (!code) return;

  const uid = auth.currentUser.uid;
  const displayName = auth.currentUser.displayName;

  // UI Feedback
  const btn = joinForm.querySelector("button");
  btn.disabled = true;
  joinStatus.textContent = "Checking room status...";
  joinStatus.classList.remove("hidden");

  // 1. Check if messages exist in the room
  const msgsRef = ref(db, `rooms/${code}/messages`);
  const snapshot = await get(query(msgsRef, limitToLast(1)));

  const isEmpty = !snapshot.exists();

  if (isEmpty) {
    // Room is empty -> Auto Join
    await enterChat(code);
  } else {
    // Room has history -> Check if already allowed
    const allowedRef = ref(db, `rooms/${code}/allowed/${uid}`);
    const allowedSnap = await get(allowedRef);

    if (allowedSnap.exists()) {
        await enterChat(code);
    } else {
        // Not allowed yet -> Add to pending
        joinStatus.textContent = "Request sent to host. Waiting for approval...";
        
        await set(ref(db, `rooms/${code}/pending/${uid}`), {
            name: displayName,
            timestamp: serverTimestamp()
        });

        // Listen for approval
        approvalListener = onValue(ref(db, `rooms/${code}/allowed/${uid}`), (snap) => {
            if (snap.exists()) {
                // Approved!
                off(ref(db, `rooms/${code}/allowed/${uid}`)); // stop listening
                enterChat(code);
            }
        });
    }
  }
  
  btn.disabled = false;
});

async function enterChat(code) {
  currentRoom = code;
  const uid = auth.currentUser.uid;

  // Add self to allowed list (so I can rejoin later without asking)
  await set(ref(db, `rooms/${code}/allowed/${uid}`), true);

  // Remove self from pending if I was there
  remove(ref(db, `rooms/${code}/pending/${uid}`));

  // UI Switch
  joinScreen.classList.add("hidden");
  joinStatus.classList.add("hidden");
  joinStatus.textContent = "";
  chatScreen.classList.remove("hidden");
  roomTitle.textContent = `#${code}`;
  messagesDiv.innerHTML = "";
  pendingArea.innerHTML = "";
  pendingArea.classList.add("hidden");

  saveRoomToHistory(code);

  // 1. Listen for Messages
  const msgsQuery = query(ref(db, `rooms/${code}/messages`), limitToLast(50));
  msgListener = onChildAdded(msgsQuery, (snap) => {
    addMessageToUI(snap.val());
  });

  // 2. Listen for Pending Requests (I am now a host because I am in)
  const pendingQuery = query(ref(db, `rooms/${code}/pending`));
  
  pendingListener = onChildAdded(pendingQuery, (snap) => {
    const pUser = snap.val();
    const pUid = snap.key;
    renderPendingRequest(pUid, pUser.name);
  });

  // Handle removals (if another host approves them)
  onChildRemoved(pendingQuery, (snap) => {
    const el = document.getElementById(`pending-${snap.key}`);
    if (el) el.remove();
    if (pendingArea.children.length === 0) pendingArea.classList.add("hidden");
  });
}

// --- PENDING REQUEST UI (Host Side) ---
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
        // 1. Add to allowed
        await set(ref(db, `rooms/${currentRoom}/allowed/${reqUid}`), true);
        // 2. Remove from pending
        await remove(ref(db, `rooms/${currentRoom}/pending/${reqUid}`));
        // UI handles removal via onChildRemoved listener above
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
  // Detach listeners
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
  loadRoomHistory(); // Refresh history
});