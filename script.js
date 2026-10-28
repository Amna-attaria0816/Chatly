import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, updateDoc, deleteDoc, addDoc, collection, query,
  orderBy, where, limitToLast, onSnapshot, serverTimestamp, Timestamp, deleteField, arrayUnion
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCMuectAbru1H60KC42GCEcBYiO6YS55I4",
  authDomain: "chat-application-26c5f.firebaseapp.com",
  projectId: "chat-application-26c5f",
  storageBucket: "chat-application-26c5f.firebasestorage.app",
  messagingSenderId: "893484255406",
  appId: "1:893484255406:web:cb3a709ef0aae4ee7f053f",
  measurementId: "G-M2K5BKTCK8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const colors = ["#0b3d33", "#7a3e9d", "#1c6ea4", "#b4442e", "#8a6d1a"];

const state = { me: null, users: {}, statuses: [], tab: "chats", chat: null, msgs: {}, calls: [], unsubMsgs: null, unsubs: [], showPriv: false, once: false };

const avatar = (u, cls = "") => u && u.photoURL
  ? `<img class="av ${cls}" src="${u.photoURL}" alt="">`
  : `<div class="av ${cls}">${esc(((u && u.name) || "?")[0].toUpperCase())}</div>`;

const pairId = (uid) => [state.me.uid, uid].sort().join("_");
const statusTime = (s) => (s.createdAt ? s.createdAt.toMillis() : Date.now());

function toDataUrl(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const message = $("message");
const showMessage = (text, type = "error") => { message.textContent = text; message.className = "message " + type; message.hidden = false; };
const clearMessage = () => { message.hidden = true; };

function switchTab(toSignup) {
  clearMessage();
  $("login-form").hidden = toSignup;
  $("signup-form").hidden = !toSignup;
  $("tab-login").classList.toggle("active", !toSignup);
  $("tab-signup").classList.toggle("active", toSignup);
  $("tab-login").setAttribute("aria-selected", String(!toSignup));
  $("tab-signup").setAttribute("aria-selected", String(toSignup));
}

function friendlyError(code) {
  const messages = {
    "auth/invalid-email": "That email address isn't valid.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Wrong password. Try again.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account with this email already exists. Log in instead.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection."
  };
  return messages[code] || "Something went wrong. Please try again.";
}

$("tab-login").addEventListener("click", () => switchTab(false));
$("tab-signup").addEventListener("click", () => switchTab(true));

document.querySelectorAll(".toggle-pw").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.target);
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.textContent = visible ? "Show" : "Hide";
  });
});

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const email = $("login-email").value.trim();
  const password = $("login-password").value;
  if (!email || !password) return showMessage("Enter your email and password.");
  const button = $("login-btn");
  button.disabled = true;
  button.textContent = "Logging in…";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showMessage(friendlyError(error.code));
  } finally {
    button.disabled = false;
    button.textContent = "Log in";
  }
});

$("forgot").addEventListener("click", async () => {
  clearMessage();
  const email = $("login-email").value.trim();
  if (!email) return showMessage("Type your email above first, then tap “Forgot password?”.");
  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("Reset link sent. Check your inbox.", "ok");
  } catch (error) {
    showMessage(friendlyError(error.code));
  }
});

$("signup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const name = $("signup-name").value.trim();
  const email = $("signup-email").value.trim();
  const password = $("signup-password").value;
  if (name.length < 2) return showMessage("Enter your full name.");
  if (password.length < 6) return showMessage("Password must be at least 6 characters.");
  if (password !== $("signup-confirm").value) return showMessage("Passwords don't match.");
  const button = $("signup-btn");
  button.disabled = true;
  button.textContent = "Creating account…";
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid, name, email, photoURL: "",
      about: "Hey there! I am using Chatly.", online: true, createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    showMessage(friendlyError(error.code));
  } finally {
    button.disabled = false;
    button.textContent = "Create account";
  }
});

const setOnline = (online) => state.me && updateDoc(doc(db, "users", state.me.uid),
  online ? { online: true } : { online: false, lastSeen: serverTimestamp() }).catch(() => {});

let awayAt = 0;
document.addEventListener("visibilitychange", () => {
  setOnline(!document.hidden);
  if (document.hidden) awayAt = Date.now();
  else if (state.me && getPin() && $("lock").hidden && Date.now() - awayAt > 15000) askPin("Enter your PIN", false);
});
window.addEventListener("beforeunload", () => setOnline(false));

onAuthStateChanged(auth, async (user) => {
  state.unsubs.forEach((stop) => stop());
  state.unsubs = [];
  closeChat();
  if (!user) {
    state.me = null;
    $("app-view").hidden = true;
    $("auth-view").hidden = false;
    return;
  }
  state.me = user;
  $("auth-view").hidden = true;
  $("app-view").hidden = false;
  if (getPin()) askPin("Welcome back, enter your PIN", false);
  await setDoc(doc(db, "users", user.uid), { uid: user.uid, email: user.email, online: true }, { merge: true });
  state.unsubs.push(onSnapshot(collection(db, "users"), (snap) => {
    state.users = {};
    snap.forEach((d) => { state.users[d.id] = d.data(); });
    if (state.tab !== "profile") render();
    refreshHeader();
  }));
  const since = Timestamp.fromMillis(Date.now() - 864e5);
  state.unsubs.push(onSnapshot(query(collection(db, "statuses"), where("createdAt", ">", since), orderBy("createdAt")), (snap) => {
    state.statuses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (state.tab === "status") render();
  }));
  state.unsubs.push(onSnapshot(query(collection(db, "calls"), where("participants", "array-contains", user.uid)), (snap) => {
    state.calls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (state.tab === "calls") render();
    snap.docChanges().forEach((ch) => {
      const d = ch.doc.data();
      const fresh = d.createdAt && Date.now() - d.createdAt.toMillis() < 45000;
      if (ch.type === "added" && d.callee === user.uid && d.status === "ringing" && fresh && !call) showIncoming(ch.doc.id, d);
      if (incoming && incoming.id === ch.doc.id && d.status !== "ringing") hideIncoming();
    });
  }));
  render();
  const target = new URLSearchParams(location.search).get("chat");
  if (target && target !== user.uid) openChat(target === "global" ? "global" : pairId(target), target === "global" ? null : target);
  if (target) history.replaceState(null, "", location.pathname);
});

function render() {
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  $("side-title").textContent = { chats: "Chats", status: "Status", calls: "Calls", profile: "Settings" }[state.tab];
  $("search").hidden = state.tab !== "chats";
  if (state.tab !== "chats") state.showPriv = false;
  if (state.tab === "chats") renderChats();
  else if (state.tab === "status") renderStatus();
  else if (state.tab === "calls") renderCalls();
  else renderProfile();
}

const row = (attrs, av, name, sub) =>
  `<div class="row" ${attrs}>${av}<div class="meta"><b>${esc(name)}</b><span>${esc(sub)}</span></div></div>`;

function renderChats() {
  const q = $("search").value.trim().toLowerCase();
  const P = priv();
  const people = Object.values(state.users).filter((u) => u.uid !== state.me.uid && (u.name || "").toLowerCase().includes(q) && (state.showPriv ? P.includes(pairId(u.uid)) : !P.includes(pairId(u.uid))));
  let html = row('data-priv="1"', '<div class="av global">🔒</div>', state.showPriv ? "Back to all chats" : "Private chats", "Protected by your PIN");
  if (!state.showPriv && "global chat".includes(q)) html += row('data-chat="global"', '<div class="av global">🌐</div>', "Global Chat", "Everyone is here");
  html += people.map((u) => row(`data-chat="${u.uid}"`, avatar(u), u.name, u.online ? "online" : u.about || "")).join("");
  if (!people.length) html += `<p class="empty-note">${q ? "No one found." : "No one else has joined yet. Invite friends to sign up."}</p>`;
  $("list").innerHTML = html;
}

function renderStatus() {
  const groups = {};
  state.statuses.forEach((s) => (groups[s.uid] = groups[s.uid] || []).push(s));
  const mine = groups[state.me.uid];
  let html = `<div class="row" ${mine ? `data-view="${state.me.uid}"` : "data-add=\"1\""}>
    <div class="av-wrap">${avatar({ ...state.users[state.me.uid], name: state.me.displayName }, mine ? "ring" : "")}<span class="plus" data-add="1">+</span></div>
    <div class="meta"><b>My status</b><span>${mine ? mine.length + " update(s)" : "Tap to add a status update"}</span></div></div>`;
  const others = Object.keys(groups).filter((uid) => uid !== state.me.uid)
    .sort((a, b) => statusTime(groups[b].at(-1)) - statusTime(groups[a].at(-1)));
  html += others.map((uid) => row(`data-view="${uid}"`, avatar(state.users[uid], "ring"),
    (state.users[uid] || {}).name || "Unknown", clock(statusTime(groups[uid].at(-1))))).join("");
  if (!others.length) html += '<p class="empty-note">Status updates from others appear here for 24 hours.</p>';
  $("list").innerHTML = html;
}

function renderProfile() {
  const u = state.users[state.me.uid] || {};
  $("list").innerHTML = `<div class="profile">
    <label class="photo">${avatar({ ...u, name: u.name || state.me.displayName }, "big")}<input type="file" id="p-photo" accept="image/*" hidden></label>
    <p class="hint">Tap the photo to change it</p>
    <label>Name<input id="p-name" value="${esc(u.name || state.me.displayName)}" maxlength="40"></label>
    <label>About<input id="p-about" value="${esc(u.about)}" maxlength="80"></label>
    <button class="primary" id="p-save">Save changes</button>
    <button class="ghost" id="p-lock">${getPin() ? "Change app lock PIN" : "Set app lock PIN"}</button>${getPin() ? '<button class="ghost" id="p-unlock">Remove app lock</button>' : ""}<button class="ghost" id="p-qr">My QR code</button><button class="ghost" id="p-out">Log out</button></div>`;
}

async function saveProfile() {
  const name = $("p-name").value.trim();
  if (name.length < 2) return;
  await updateProfile(auth.currentUser, { displayName: name });
  await updateDoc(doc(db, "users", state.me.uid), { name, about: $("p-about").value.trim() });
  $("p-save").textContent = "Saved";
  setTimeout(() => { const b = $("p-save"); if (b) b.textContent = "Save changes"; }, 1500);
}

$("list").addEventListener("click", (event) => {
  const t = event.target;
  if (t.closest("[data-add]")) { $("modal").hidden = false; return; }
  const view = t.closest("[data-view]");
  if (view) return openViewer(view.dataset.view);
  const chat = t.closest("[data-chat]");
  if (chat) {
    const peer = chat.dataset.chat;
    return openChat(peer === "global" ? "global" : pairId(peer), peer === "global" ? null : peer);
  }
  if (t.closest("[data-priv]")) return togglePriv();
  if (t.id === "p-lock") return setPin();
  if (t.id === "p-unlock") return removePin();
  if (t.id === "p-save") saveProfile();
  if (t.id === "p-out") logout();
});

$("list").addEventListener("change", async (event) => {
  if (event.target.id !== "p-photo" || !event.target.files[0]) return;
  const photoURL = await toDataUrl(event.target.files[0], 256);
  await updateDoc(doc(db, "users", state.me.uid), { photoURL });
  renderProfile();
});

document.querySelectorAll(".nav button").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; render(); }));
$("search").addEventListener("input", () => state.me && renderChats());

async function logout() {
  await setOnline(false);
  await signOut(auth);
}

function closeChat() {
  if (state.unsubMsgs) state.unsubMsgs();
  if (state.unTyping) state.unTyping();
  state.unTyping = null;
  state.typers = 0;
  clearReply();
  state.unsubMsgs = null;
  state.chat = null;
  $("app-view").classList.remove("chat-open");
  $("chat").hidden = true;
  $("empty").hidden = false;
}

function openChat(id, peer) {
  closeChat();
  state.chat = { id, peer };
  $("app-view").classList.add("chat-open");
  $("empty").hidden = true;
  $("chat").hidden = false;
  $("msgs").innerHTML = "";
  $("csearch").hidden = true;
  $("csearch-in").value = "";
  refreshHeader();
  state.unsubMsgs = onSnapshot(query(collection(db, "chats", id, "messages"), orderBy("createdAt"), limitToLast(100)), (snap) => renderMessages(snap.docs));
  $("text").focus();
  watchTyping(id);
}

function refreshHeader() {
  const c = state.chat;
  if (!c) return;
  const u = c.peer ? state.users[c.peer] : null;
  $("chat-name").textContent = u ? u.name : "Global Chat";
  $("call-audio").hidden = !c.peer;
  $("call-video").hidden = !c.peer;
  $("qr-btn").hidden = !!c.peer;
  $("priv-btn").hidden = !c.peer;
  $("priv-btn").textContent = priv().includes(c.id) ? "🔓" : "🔒";
  $("chat-av").innerHTML = u ? avatar(u) : '<div class="av global">🌐</div>';
  $("chat-sub").textContent = u
    ? (u.online ? "online" : u.lastSeen ? "last seen " + clock(u.lastSeen.toMillis()) : "offline")
    : Object.keys(state.users).length + " members";
  if (state.typers) $("chat-sub").textContent = "typing…";
}

function renderMessages(docs) {
  const box = $("msgs");
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const global = state.chat.id === "global";
  const uid = state.me.uid;
  let pin = null;
  state.msgs = {};
  box.innerHTML = docs.map((d) => {
    const m = d.data();
    state.msgs[d.id] = m;
    if ((m.deletedFor || []).includes(uid)) return "";
    if (m.pinned && !m.deleted) pin = { id: d.id, m };
    const mine = m.from === uid;
    const counts = {};
    Object.values(m.reactions || {}).forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
    const reacts = Object.entries(counts).map(([x, n]) => x + (n > 1 ? " " + n : "")).join(" ");
    const body = m.deleted
      ? '<span class="gone">🚫 This message was deleted</span>'
      : m.once ? onceBody(d.id, m, mine) : (m.image ? `<img class="pic" src="${m.image}" alt="">` : "")
        + (m.location ? `<a class="loc" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${m.location.lat}&mlon=${m.location.lng}#map=16/${m.location.lat}/${m.location.lng}">📍 Shared location · tap to open</a>` : "")
        + (m.text ? `<span>${esc(m.text)}</span>` : "");
    return `<div class="msg ${mine ? "out" : "in"}" data-id="${d.id}">
      ${global && !mine ? `<b class="who">${esc(m.name)}</b>` : ""}
      ${m.pinned && !m.deleted ? '<i class="pinmark">📌</i>' : ""}
      ${m.reply && !m.deleted ? `<div class="quote"><b>${esc(m.reply.name)}</b>${esc(m.reply.text)}</div>` : ""}
      ${body}
      <small>${m.edited ? "edited · " : ""}${m.createdAt ? clock(m.createdAt.toMillis()) : ""}</small>
      ${reacts ? `<em class="reacts">${reacts}</em>` : ""}</div>`;
  }).join("");
  applySearch();
  if (near) box.scrollTop = box.scrollHeight;
  const bar = $("pinbar");
  bar.hidden = !pin;
  if (pin) {
    bar.dataset.id = pin.id;
    bar.textContent = "📌 " + (pin.m.text || (pin.m.image ? "Photo" : "Location"));
  }
}

const send = (extra) => addDoc(collection(db, "chats", state.chat.id, "messages"), {
  from: state.me.uid, name: state.me.displayName || state.me.email, createdAt: serverTimestamp(), ...extra
});

$("composer").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = $("text").value.trim();
  if (!text || !state.chat) return;
  $("text").value = "";
  await send({ text, ...(state.reply ? { reply: state.reply } : {}) });
  clearReply();
});

$("attach").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (file && state.chat) {
    const once = state.once;
    state.once = false;
    $("once-btn").classList.remove("on");
    await send({ image: await toDataUrl(file, 800), ...(once ? { once: true } : {}) });
  }
});

$("back").addEventListener("click", closeChat);

$("st-cancel").addEventListener("click", () => { $("modal").hidden = true; });

$("st-post").addEventListener("click", async () => {
  const text = $("st-text").value.trim();
  const file = $("st-img").files[0];
  if (!text && !file) return;
  const button = $("st-post");
  button.disabled = true;
  try {
    await addDoc(collection(db, "statuses"), {
      uid: state.me.uid, text,
      image: file ? await toDataUrl(file, 900) : "",
      color: colors[Math.floor(Math.random() * colors.length)],
      createdAt: serverTimestamp()
    });
    $("st-text").value = "";
    $("st-img").value = "";
    $("modal").hidden = true;
  } finally {
    button.disabled = false;
  }
});

let timer;
let advance = () => {};

function closeViewer() {
  clearTimeout(timer);
  $("viewer").hidden = true;
}

function openViewer(uid) {
  const items = state.statuses.filter((s) => s.uid === uid);
  if (!items.length) return;
  let i = 0;
  const show = () => {
    clearTimeout(timer);
    if (i >= items.length) return closeViewer();
    const s = items[i];
    const u = state.users[uid];
    $("v-user").innerHTML = `${avatar(u)}<div><b>${esc(u ? u.name : "")}</b><small>${clock(statusTime(s))}</small></div>`;
    $("v-body").style.background = s.image ? "#000" : s.color;
    $("v-body").innerHTML = (s.image ? `<img src="${s.image}" alt="">` : "") + (s.text ? `<p>${esc(s.text)}</p>` : "");
    $("v-bars").innerHTML = items.map((_, k) => `<i class="${k < i ? "done" : k === i ? "now" : ""}"></i>`).join("");
    $("v-del").hidden = uid !== state.me.uid;
    $("v-seen").hidden = uid !== state.me.uid;
    if (uid === state.me.uid) {
      const seen = s.viewers || [];
      $("v-seen").textContent = "👁 " + seen.length;
      $("v-seen").onclick = () => {
        clearTimeout(timer);
        $("seen-list").innerHTML = seen.map((id) => `<div class="row">${avatar(state.users[id])}<div class="meta"><b>${esc((state.users[id] || {}).name || "Someone")}</b></div></div>`).join("") || '<p class="empty-note">No views yet</p>';
        $("seen-modal").hidden = false;
      };
    } else if (!(s.viewers || []).includes(state.me.uid)) {
      updateDoc(doc(db, "statuses", s.id), { viewers: arrayUnion(state.me.uid) }).catch(() => {});
    }
    $("v-del").onclick = async () => { await deleteDoc(doc(db, "statuses", s.id)); closeViewer(); };
    timer = setTimeout(advance, 5000);
  };
  advance = () => { i++; show(); };
  $("viewer").hidden = false;
  show();
}

$("v-body").addEventListener("click", () => advance());
$("v-close").addEventListener("click", closeViewer);

const themes = {
  blush: ["Blush", "#f06292", "#ffd3e4"],
  lavender: ["Lavender", "#9575cd", "#e0d2fa"],
  peach: ["Peach", "#ff8a65", "#ffd9c9"],
  mint: ["Mint", "#4db6a5", "#c9efe8"],
  berry: ["Berry", "#c2185b", "#f7c1d9"],
  sky: ["Sky", "#64b5f6", "#cfe8fc"]
};

function setTheme(key) {
  document.documentElement.dataset.theme = key;
  localStorage.setItem("theme", key);
  document.querySelectorAll("#swatches button").forEach((b) => b.classList.toggle("on", b.dataset.t === key));
}

$("swatches").innerHTML = Object.entries(themes).map(([key, [name, a, b]]) =>
  `<button data-t="${key}" style="--a:${a};--b:${b}"><i></i>${name}</button>`).join("");
$("swatches").addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (b) setTheme(b.dataset.t);
});
setTheme(localStorage.getItem("theme") || "blush");
$("theme-btn").addEventListener("click", () => { $("theme-modal").hidden = false; });
document.querySelectorAll(".modal").forEach((m) => m.addEventListener("click", (event) => { if (event.target === m) m.hidden = true; }));

const emojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
let menuId = null;
const hideMenu = () => { $("menu").hidden = true; };

$("msgs").addEventListener("click", (event) => {
  event.stopPropagation();
  const el = event.target.closest(".msg");
  if (!el || event.target.closest("a")) return hideMenu();
  const oc = event.target.closest("[data-once]");
  if (oc) return viewOnce(oc.dataset.once);
  const m = state.msgs[el.dataset.id];
  if (!m || m.deleted) return hideMenu();
  menuId = el.dataset.id;
  const mine = m.from === state.me.uid;
  $("menu").innerHTML = `<div class="emojis">${emojis.map((x) => `<button data-react="${x}">${x}</button>`).join("")}</div>
    <button data-act="reply">Reply</button>
    ${m.text ? '<button data-act="copy">Copy</button>' : ""}
    ${mine && m.text ? '<button data-act="edit">Edit</button>' : ""}
    <button data-act="pin">${m.pinned ? "Unpin" : "Pin"}</button>
    <button data-act="me">Delete for me</button>
    ${mine ? '<button data-act="all">Delete for everyone</button>' : ""}`;
  $("menu").hidden = false;
  const r = el.getBoundingClientRect();
  const menu = $("menu");
  menu.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - menu.offsetHeight - 8)) + "px";
  menu.style.left = Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8)) + "px";
});

document.addEventListener("click", hideMenu);

$("menu").addEventListener("click", (event) => {
  event.stopPropagation();
  const b = event.target.closest("button");
  if (!b || !state.chat) return;
  const ref = doc(db, "chats", state.chat.id, "messages", menuId);
  const m = state.msgs[menuId];
  const uid = state.me.uid;
  hideMenu();
  if (b.dataset.react) {
    const same = (m.reactions || {})[uid] === b.dataset.react;
    return updateDoc(ref, { ["reactions." + uid]: same ? deleteField() : b.dataset.react });
  }
  const act = b.dataset.act;
  if (act === "copy") navigator.clipboard.writeText(m.text);
  if (act === "reply") { state.reply = { name: m.name || "", text: m.text || (m.image ? "📷 Photo" : "📍 Location") }; showReply(); $("text").focus(); }
  if (act === "edit") { const t = prompt("Edit message", m.text); if (t && t.trim() && t.trim() !== m.text) updateDoc(ref, { text: t.trim(), edited: true }); }
  if (act === "pin") updateDoc(ref, { pinned: !m.pinned });
  if (act === "me") updateDoc(ref, { deletedFor: arrayUnion(uid) });
  if (act === "all") updateDoc(ref, { deleted: true, text: "", image: "", location: deleteField(), pinned: false });
});

$("pinbar").addEventListener("click", () => {
  const el = document.querySelector(`[data-id="${$("pinbar").dataset.id}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
});

$("loc-btn").addEventListener("click", () => {
  if (!state.chat) return;
  navigator.geolocation.getCurrentPosition(
    (p) => send({ location: { lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) } }),
    () => alert("Allow location access to share your location.")
  );
});

function showQR(url, title) {
  $("qr-title").textContent = title;
  $("qr-box").innerHTML = "";
  new QRCode($("qr-box"), { text: url, width: 220, height: 220 });
  $("qr-link").textContent = url;
  $("qr-modal").hidden = false;
}

const inviteLink = (target) => location.origin + location.pathname + "?chat=" + target;
$("qr-btn").addEventListener("click", () => showQR(inviteLink("global"), "Join Global Chat"));
$("qr-close").addEventListener("click", () => { $("qr-modal").hidden = true; });
$("qr-copy").addEventListener("click", () => navigator.clipboard.writeText($("qr-link").textContent));
$("list").addEventListener("click", (event) => {
  if (event.target.id === "p-qr") showQR(inviteLink(state.me.uid), "Scan to chat with me");
});

function renderCalls() {
  const list = [...state.calls].sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : Date.now()) - (a.createdAt ? a.createdAt.toMillis() : Date.now()));
  $("list").innerHTML = list.length ? list.map((c) => {
    const out = c.caller === state.me.uid;
    const pid = out ? c.callee : c.caller;
    const u = state.users[pid] || {};
    const answered = c.status === "accepted" || c.status === "ended";
    const label = answered ? "Answered" : out ? "No answer" : c.status === "declined" ? "Declined" : "Missed";
    const when = c.createdAt ? clock(c.createdAt.toMillis()) : "";
    return row(`data-callback="${pid}" data-type="${c.type}"`, avatar(u), u.name || "Unknown", `${out ? "↗" : "↙"} ${c.type === "video" ? "Video" : "Voice"} · ${label} · ${when}`);
  }).join("") : '<p class="empty-note">Your call history will appear here.</p>';
}

$("list").addEventListener("click", (event) => {
  const cb = event.target.closest("[data-callback]");
  if (cb) startCall(cb.dataset.type, cb.dataset.callback);
});

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let call = null;
let incoming = null;

function showIncoming(id, d) {
  incoming = { id, d };
  const u = state.users[d.caller] || {};
  $("in-av").innerHTML = avatar(u);
  $("in-name").textContent = u.name || "Someone";
  $("in-type").textContent = "Incoming " + (d.type === "video" ? "video" : "voice") + " call…";
  $("incoming").hidden = false;
}

function hideIncoming() {
  incoming = null;
  $("incoming").hidden = true;
}

function setupPeer(id, stream, type, peerId) {
  const pc = new RTCPeerConnection(ICE);
  const remote = new MediaStream();
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  pc.ontrack = (e) => {
    e.streams[0].getTracks().forEach((t) => remote.addTrack(t));
    $("remote").srcObject = remote;
  };
  pc.onicecandidate = (e) => e.candidate && addDoc(collection(db, "calls", id, "candidates"), { from: state.me.uid, c: JSON.stringify(e.candidate) });
  const stop = onSnapshot(collection(db, "calls", id, "candidates"), (snap) => snap.docChanges().forEach((ch) => {
    const d = ch.doc.data();
    if (ch.type === "added" && d.from !== state.me.uid) pc.addIceCandidate(JSON.parse(d.c)).catch(() => {});
  }));
  call = { id, pc, stream, stop, connected: false };
  const u = state.users[peerId] || {};
  $("local").srcObject = stream;
  $("call").className = "callui" + (type === "audio" ? " audio" : "");
  $("call-av").innerHTML = avatar(u);
  $("call-name").textContent = u.name || "";
  $("c-mic").classList.remove("off");
  $("c-cam").classList.remove("off");
  $("call").hidden = false;
}

function watchCall(id) {
  const pc = call.pc;
  call.watch = onSnapshot(doc(db, "calls", id), async (snap) => {
    const d = snap.data();
    if (!d || !call || call.id !== id) return;
    if (d.answer && pc.signalingState === "have-local-offer") await pc.setRemoteDescription(d.answer);
    if (d.status === "accepted") { call.connected = true; $("call-status").textContent = "Connected"; }
    if (["ended", "missed", "declined"].includes(d.status)) endLocal(d.status === "declined" ? "Call declined" : "");
  });
}

function endLocal(note) {
  if (!call) return;
  const c = call;
  call = null;
  clearTimeout(c.timeout);
  c.stop();
  if (c.watch) c.watch();
  c.stream.getTracks().forEach((t) => t.stop());
  c.pc.close();
  $("remote").srcObject = null;
  $("local").srcObject = null;
  $("call").hidden = true;
  if (note) alert(note);
}

async function hangup() {
  const c = call;
  if (!c) return;
  await updateDoc(doc(db, "calls", c.id), { status: c.connected ? "ended" : "missed" }).catch(() => {});
  endLocal();
}

const getMedia = (type) => navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
const mediaError = () => alert("Allow microphone and camera access to make calls.");

async function startCall(type, peer = state.chat && state.chat.peer) {
  if (!peer || call) return;
  let stream;
  try { stream = await getMedia(type); } catch { return mediaError(); }
  const ref = doc(collection(db, "calls"));
  setupPeer(ref.id, stream, type, peer);
  const pc = call.pc;
  $("call-status").textContent = "Calling…";
  await pc.setLocalDescription(await pc.createOffer());
  await setDoc(ref, {
    caller: state.me.uid, callee: peer, participants: [state.me.uid, peer], type, status: "ringing",
    createdAt: serverTimestamp(), offer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
  });
  watchCall(ref.id);
  call.timeout = setTimeout(() => { if (call && !call.connected) hangup(); }, 45000);
}

async function acceptCall(id, d) {
  let stream;
  try { stream = await getMedia(d.type); } catch { updateDoc(doc(db, "calls", id), { status: "declined" }); return mediaError(); }
  setupPeer(id, stream, d.type, d.caller);
  const pc = call.pc;
  $("call-status").textContent = "Connecting…";
  await pc.setRemoteDescription(d.offer);
  await pc.setLocalDescription(await pc.createAnswer());
  await updateDoc(doc(db, "calls", id), { answer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, status: "accepted" });
  watchCall(id);
}

$("call-audio").addEventListener("click", () => startCall("audio"));
$("call-video").addEventListener("click", () => startCall("video"));
$("c-end").addEventListener("click", hangup);
$("in-no").addEventListener("click", () => { updateDoc(doc(db, "calls", incoming.id), { status: "declined" }); hideIncoming(); });
$("in-yes").addEventListener("click", () => { const { id, d } = incoming; hideIncoming(); acceptCall(id, d); });

function toggleTrack(kind, button) {
  const track = call && (kind === "audio" ? call.stream.getAudioTracks() : call.stream.getVideoTracks())[0];
  if (!track) return;
  track.enabled = !track.enabled;
  button.classList.toggle("off", !track.enabled);
}

$("c-mic").addEventListener("click", (e) => toggleTrack("audio", e.currentTarget));
$("c-cam").addEventListener("click", (e) => toggleTrack("video", e.currentTarget));
// ---------- v2 extras: app lock, private chats, search, like, view-once ----------
function getPin() { return localStorage.getItem("pin"); }
function priv() { try { return JSON.parse(localStorage.getItem("priv") || "[]"); } catch { return []; } }

function askPin(title, cancelable) {
  return new Promise((resolve) => {
    const input = $("lock-pin");
    $("lock-title").textContent = title;
    $("lock-cancel").hidden = !cancelable;
    $("lock-err").textContent = "";
    input.value = "";
    $("lock").hidden = false;
    input.focus();
    const done = (ok) => { $("lock").hidden = true; $("lock-form").onsubmit = null; $("lock-cancel").onclick = null; resolve(ok); };
    $("lock-form").onsubmit = (e) => {
      e.preventDefault();
      if (btoa(input.value) === getPin()) done(true);
      else { $("lock-err").textContent = "Wrong PIN, try again"; input.value = ""; }
    };
    $("lock-cancel").onclick = () => done(false);
  });
}

async function setPin() {
  if (getPin() && !(await askPin("Enter your current PIN", true))) return;
  const p = prompt("Choose a PIN (4 or more digits)");
  if (p && /^\d{4,}$/.test(p)) { localStorage.setItem("pin", btoa(p)); renderProfile(); }
  else if (p) alert("PIN must be 4 or more digits.");
}

async function removePin() {
  if (!(await askPin("Enter PIN to remove lock", true))) return;
  localStorage.removeItem("pin");
  localStorage.removeItem("priv");
  renderProfile();
}

async function togglePriv() {
  if (state.showPriv) { state.showPriv = false; return renderChats(); }
  if (!getPin()) return alert("Set an app lock PIN in Settings first.");
  if (await askPin("Enter PIN to open private chats", true)) { state.showPriv = true; renderChats(); }
}

$("priv-btn").addEventListener("click", () => {
  if (!state.chat || !state.chat.peer) return;
  if (!getPin()) return alert("Set an app lock PIN in Settings first.");
  const id = state.chat.id;
  const l = priv();
  localStorage.setItem("priv", JSON.stringify(l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  refreshHeader();
  if (state.tab === "chats") renderChats();
});

function applySearch() {
  const q = $("csearch-in").value.trim().toLowerCase();
  document.querySelectorAll("#msgs .msg").forEach((el) => { el.style.display = !q || el.textContent.toLowerCase().includes(q) ? "" : "none"; });
}
$("csearch-btn").addEventListener("click", () => {
  $("csearch").hidden = !$("csearch").hidden;
  if ($("csearch").hidden) { $("csearch-in").value = ""; applySearch(); } else $("csearch-in").focus();
});
$("csearch-in").addEventListener("input", applySearch);

$("msgs").addEventListener("dblclick", (event) => {
  const el = event.target.closest(".msg");
  const m = el && state.msgs[el.dataset.id];
  if (!m || m.deleted) return;
  hideMenu();
  updateDoc(doc(db, "chats", state.chat.id, "messages", el.dataset.id), { ["reactions." + state.me.uid]: "❤️" });
});

$("once-btn").addEventListener("click", () => { state.once = !state.once; $("once-btn").classList.toggle("on", state.once); });

function onceBody(id, m, mine) {
  if (!m.image) return '<span class="gone">📷 Photo opened</span>';
  return mine ? '<span class="gone">📷 View-once photo · not opened yet</span>' : `<button class="once" data-once="${id}">📷 Tap to view once</button>`;
}

function viewOnce(id) {
  const m = state.msgs[id];
  if (!m || !m.image) return;
  clearTimeout(timer);
  $("v-user").innerHTML = "<b>View once photo</b>";
  $("v-bars").innerHTML = "";
  $("v-del").hidden = true;
  $("v-seen").hidden = true;
  $("v-body").style.background = "#000";
  $("v-body").innerHTML = `<img src="${m.image}" alt="">`;
  advance = closeViewer;
  $("viewer").hidden = false;
  updateDoc(doc(db, "chats", state.chat.id, "messages", id), { viewedBy: arrayUnion(state.me.uid), image: "" });
}

// ---------- v3 extras: reply, edit, typing, emoji tray, dark mode ----------
function showReply() {
  $("rb-name").textContent = state.reply.name;
  $("rb-text").textContent = state.reply.text;
  $("replybar").hidden = false;
}
function clearReply() { state.reply = null; $("replybar").hidden = true; }
$("rb-x").addEventListener("click", clearReply);

function watchTyping(id) {
  state.typers = 0;
  state.unTyping = onSnapshot(doc(db, "chats", id), (s) => {
    const t = (s.data() || {}).typing || {};
    state.typers = Object.entries(t).filter(([u, ms]) => u !== state.me.uid && Date.now() - ms < 4000).length;
    refreshHeader();
    clearTimeout(state.tt);
    if (state.typers) state.tt = setTimeout(() => { state.typers = 0; refreshHeader(); }, 4000);
  }, () => {});
}
$("text").addEventListener("input", () => {
  if (!state.chat) return;
  const n = Date.now();
  if (n - (state.lastTyping || 0) < 2000) return;
  state.lastTyping = n;
  setDoc(doc(db, "chats", state.chat.id), { typing: { [state.me.uid]: n } }, { merge: true }).catch(() => {});
});

$("emo").innerHTML = "😀😂🥰😍😘🥹😭😎🤗🤭😴🙄😡🥳🤩😇💖💕✨🔥🌸🦋🎀🍓☕🎉👏🙌💪🙏👍👋🌈".match(/\p{Extended_Pictographic}\uFE0F?/gu).map((e) => `<button type="button">${e}</button>`).join("");
$("emo-btn").addEventListener("click", () => { $("emo").hidden = !$("emo").hidden; });
$("emo").addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  $("text").value += e.target.textContent;
  $("text").focus();
});

function setMode(dark) {
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  localStorage.setItem("mode", dark ? "dark" : "light");
  $("mode-btn").textContent = dark ? "☀️" : "🌙";
}
setMode(localStorage.getItem("mode") === "dark");
$("mode-btn").addEventListener("click", () => setMode(document.documentElement.dataset.mode !== "dark"));
