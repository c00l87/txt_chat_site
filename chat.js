import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  remove,
  onChildAdded,
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

// --- DOM ---
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const historyContainer = document.getElementById("history-container");
const historyList = document.getElementById("room-history-list");
const joinForm = document.getElementById("join-form");
const msgForm = document.getElementById("msg-form");
const roomTitle = document.getElementById("room-title");
const messagesDiv = document.getElementById("messages");
const roomCodeInput = document.getElementById("room-code");
const nameInput = document.getElementById("display-name");
const msgInput = document.getElementById("msg-input");
const backBtn = document.getElementById("back-btn");

// State
let currentRoom = null;
let currentName = null;
let msgListener = null;

// --- Authentication & Init ---
// We need to wait for Auth to load history
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadRoomHistory();
  } else {
    signInAnonymously(auth);
  }
});

// --- History Logic ---
async function saveRoomToHistory(code) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  
  // Save to /users/{uid}/history/{roomCode}
  const historyRef = ref(db, `users/${uid}/history/${code}`);
  await set(historyRef, {
    roomCode: code,
    lastVisited: serverTimestamp()
  });
}

async function loadRoomHistory() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const historyRef = ref(db, `users/${uid}/history`);
  const snapshot = await get(historyRef);

  if (snapshot.exists()) {
    historyContainer.classList.remove("hidden");
    historyList.innerHTML = "";
    
    snapshot.forEach((child) => {
      const data = child.val();
      renderHistoryItem(data.roomCode);
    });
  } else {
    historyContainer.classList.add("hidden");
  }
}

function renderHistoryItem(code) {
  const li = document.createElement("li");
  li.className = "history-item";
  
  li.innerHTML = `
    <div class="history-info">
      <span class="history-room">#${code}</span>
      <span class="history-time">Tap to rejoin</span>
    </div>
    <button class="delete-btn" aria-label="Delete">×</button>
  `;

  // Click to Join
  li.addEventListener("click", (e) => {
    // Ignore if delete button was clicked
    if (e.target.classList.contains("delete-btn")) return;
    
    roomCodeInput.value = code;
    // If name is empty, focus it, otherwise submit
    if(!nameInput.value) {
        nameInput.focus();
    } else {
        // Trigger join
        joinForm.requestSubmit(); 
    }
  });

  // Click to Delete
  li.querySelector(".delete-btn").addEventListener("click", async (e) => {
    e.stopPropagation(); // prevent joining
    const uid = auth.currentUser?.uid;
    if(uid) {
        await remove(ref(db, `users/${uid}/history/${code}`));
        li.remove();
        if(historyList.children.length === 0) historyContainer.classList.add("hidden");
    }
  });

  // Prepend to list (newest top visually)
  historyList.prepend(li);
}

// --- Chat Logic ---

function addMessageToUI(msg) {
  const isSelf = msg.uid === auth.currentUser?.uid;
  
  const div = document.createElement("div");
  div.className = `msg ${isSelf ? "self" : "other"}`;
  
  // Only show name for others
  const nameHtml = isSelf ? "" : `<span class="sender-name">${msg.sender}</span>`;
  
  div.innerHTML = `
    ${nameHtml}
    <div class="text">${msg.text}</div>
  `;
  
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Join Room
joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = roomCodeInput.value.trim().toLowerCase(); // Normalize codes
  const name = nameInput.value.trim();

  if (!code || !name) return;

  currentRoom = code;
  currentName = name;

  // UI Updates
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  roomTitle.textContent = `#${code}`;
  messagesDiv.innerHTML = "";
  
  // Save to history
  await saveRoomToHistory(code);
  loadRoomHistory(); // refresh list in background

  // Listen for messages
  const msgsQuery = query(ref(db, `rooms/${code}/messages`), limitToLast(50));
  msgListener = onChildAdded(msgsQuery, (snap) => {
    addMessageToUI(snap.val());
  });
});

// Send Message
msgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  
  if (!text || !currentRoom) return;

  await push(ref(db, `rooms/${currentRoom}/messages`), {
    text,
    sender: currentName,
    uid: auth.currentUser?.uid,
    createdAt: serverTimestamp()
  });

  msgInput.value = "";
  msgInput.focus();
});

// Leave / Back
backBtn.addEventListener("click", () => {
  if (currentRoom && msgListener) {
    const msgsQuery = query(ref(db, `rooms/${currentRoom}/messages`));
    off(msgsQuery, "child_added", msgListener);
  }

  currentRoom = null;
  msgListener = null;

  chatScreen.classList.add("hidden");
  joinScreen.classList.remove("hidden");
});