// --- Firebase imports from CDN (modular SDK) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  query,
  limitToLast,
  serverTimestamp,
  off
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// --- 1) Paste YOUR firebaseConfig here ---
const firebaseConfig = {
  apiKey: "AIzaSyCSS-Ej-QDEosJD4EihZyr6y8l8ATzYaI8",
  authDomain: "txt-chat-site.firebaseapp.com",
  databaseURL: "https://txt-chat-site-default-rtdb.firebaseio.com",
  projectId: "txt-chat-site",
  storageBucket: "txt-chat-site.firebasestorage.app",
  messagingSenderId: "316750632828",
  appId: "1:316750632828:web:cfab60d020d90d01dcb6f9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- DOM elements ---
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const joinForm = document.getElementById("join-form");
const msgForm = document.getElementById("msg-form");
const roomTitle = document.getElementById("room-title");
const messagesDiv = document.getElementById("messages");
const roomCodeInput = document.getElementById("room-code");
const nameInput = document.getElementById("display-name");
const msgInput = document.getElementById("msg-input");
const leaveBtn = document.getElementById("leave-btn");

// State
let roomCode = null;
let displayName = null;
let childAddedCallback = null;

// --- Helpers ---
function addMessageToUI(msg) {
  const el = document.createElement("div");
  el.className = "msg";
  el.innerHTML = `<b>${msg.sender || "Anonymous"}:</b> ${msg.text}`;
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function clearMessagesUI() {
  messagesDiv.innerHTML = "";
}

// --- 2) Join a room ---
joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  roomCode = roomCodeInput.value.trim();
  displayName = nameInput.value.trim();

  if (!roomCode || !displayName) return;

  // Sign in anonymously so rules can require auth
  await signInAnonymously(auth);

  // Switch screens
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  roomTitle.textContent = `Room: ${roomCode}`;
  clearMessagesUI();

  // Listen for last 100 messages in this room
  const msgsQuery = query(ref(db, `rooms/${roomCode}/messages`), limitToLast(100));

  childAddedCallback = onChildAdded(msgsQuery, (snap) => {
    addMessageToUI(snap.val());
  });
});

// --- 3) Send a message ---
msgForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = msgInput.value.trim();
  if (!text || !roomCode) return;

  await push(ref(db, `rooms/${roomCode}/messages`), {
    text,
    sender: displayName,
    uid: auth.currentUser?.uid,
    createdAt: serverTimestamp()
  });

  msgInput.value = "";
});

// --- 4) Leave room (optional helper) ---
leaveBtn.addEventListener("click", () => {
  if (roomCode && childAddedCallback) {
    const msgsQuery = query(ref(db, `rooms/${roomCode}/messages`), limitToLast(100));
    off(msgsQuery, "child_added", childAddedCallback);
  }

  roomCode = null;
  displayName = null;
  childAddedCallback = null;

  chatScreen.classList.add("hidden");
  joinScreen.classList.remove("hidden");
  clearMessagesUI();
});
