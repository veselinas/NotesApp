// =========================================================
// App entry point: wires together auth, the note-type registry,
// the data store, and the two screens (note list / note view).
// =========================================================
import { initAuth, signIn, signOut, getActiveAccount } from "./auth.js";
import * as store from "./store.js";
import { NOTE_TYPES, getNoteType, getCreatableTypes, getSingletonTypes } from "./noteTypes/registry.js";
import { showConfirm, showPrompt, showCreateNoteMenu, showToast, showErrorBanner, renderNoteGroups, openModal } from "./ui.js";
import { triggerPrint } from "./print.js";

// ---------------- DOM references ----------------
const btnSignin = document.getElementById("btn-signin");
const authName = document.getElementById("auth-name");
const btnAddNote = document.getElementById("btn-add-note");
const noteListView = document.getElementById("note-list-view");
const noteGroupsEl = document.getElementById("note-groups");
const emptyStateEl = document.getElementById("empty-state");

const noteView = document.getElementById("note-view");
const btnBack = document.getElementById("btn-back");
const btnPrint = document.getElementById("btn-print");
const btnSave = document.getElementById("btn-save");
const noteViewTitle = document.getElementById("note-view-title");
const noteViewSubheader = document.getElementById("note-view-subheader");
const noteViewBody = document.getElementById("note-view-body");
const noteViewFooter = document.getElementById("note-view-footer");

let currentMount = null; // { save } returned by the active note type's mount()
let signedIn = false;

// ctx object handed to every note type's mount()
const ctx = {
  confirm: (title, message) => showConfirm(title, message),
  prompt: (config) => showPrompt(config),
  toast: (message) => showToast(message),
  customModal: (buildFn) => openModal(buildFn),
};

// ---------------- Screen switching ----------------
function showListScreen() {
  noteView.classList.add("hidden");
  noteListView.classList.remove("hidden");
  document.getElementById("menu-header").classList.remove("hidden");
  currentMount = null;
}

function showNoteScreen() {
  noteListView.classList.add("hidden");
  document.getElementById("menu-header").classList.add("hidden");
  noteView.classList.remove("hidden");
  noteViewSubheader.innerHTML = "";
  noteViewBody.innerHTML = "";
  noteViewFooter.innerHTML = "";
}

// ---------------- Auth UI ----------------
async function refreshAuthUI() {
  const account = getActiveAccount();
  signedIn = !!account;
  if (account) {
    btnSignin.classList.add("hidden");
    authName.classList.remove("hidden");
    authName.innerHTML = `<span class="dot"></span>${account.username || account.name || "Signed in"}`;
    authName.title = "Signed in — tap to sign out";
    authName.style.cursor = "pointer";
    authName.onclick = async () => {
      const ok = await showConfirm("Sign out?", "You'll need to sign in again to load or save notes.", { confirmLabel: "Sign out" });
      if (ok) signOut();
    };
  } else {
    btnSignin.classList.remove("hidden");
    authName.classList.add("hidden");
  }
}

btnSignin.addEventListener("click", () => signIn());

// ---------------- Main menu ----------------
async function loadMainMenu() {
  if (!signedIn) {
    noteGroupsEl.innerHTML = "";
    emptyStateEl.classList.remove("hidden");
    return;
  }
  emptyStateEl.classList.add("hidden");

  // make sure every singleton note type (To-Do, Wish List, Research...)
  // exists before we render the list.
  for (const type of getSingletonTypes()) {
    await type.ensure(store);
  }

  const records = await store.listNoteRecords();
  const groups = NOTE_TYPES.map(type => ({
    type,
    records: records.filter(r => r.type === type.id),
  }));
  renderNoteGroups(noteGroupsEl, groups, {
    onOpen: openNote,
    onDelete: deleteNote,
  });
}

async function deleteNote(record) {
  const type = getNoteType(record.type);
  const ok = await showConfirm(
    "Delete this note?",
    `"${record.name}" will be removed from your notebook. This can't be undone from the app.`,
    { confirmLabel: "Delete" }
  );
  if (!ok) return;
  await store.deleteNoteRecord(record.id);
  showToast("Note deleted");
  loadMainMenu();
}

btnAddNote.addEventListener("click", async () => {
  if (!signedIn) {
    showToast("Sign in first to add notes");
    return;
  }
  const creatable = getCreatableTypes();
  if (creatable.length === 0) return;
  let typeId = creatable[0].id;
  if (creatable.length > 1) {
    typeId = await showCreateNoteMenu(creatable);
    if (!typeId) return;
  }
  const type = getNoteType(typeId);
  const record = await type.createInstance(store, ctx);
  if (!record) return; // user cancelled (e.g. closed the name prompt)
  showToast("Note created");
  await loadMainMenu();
  openNote(record);
});

// ---------------- Note view ----------------
async function openNote(record) {
  const type = getNoteType(record.type);
  showNoteScreen();
  noteViewTitle.textContent = record.name || type.label;

  const elements = {
    subheader: noteViewSubheader,
    body: noteViewBody,
    footer: noteViewFooter,
    setTitle: (t) => { noteViewTitle.textContent = t; },
  };

  // print is opt-in per note type (anything without `printable: false`
  // is printable by default) - see js/print.js for the shared renderer.
  btnPrint.classList.toggle("hidden", type.printable === false);

  try {
    currentMount = await type.mount(elements, record, ctx);
  } catch (err) {
    console.error(err);
    showToast("Couldn't load this note");
    showListScreen();
  }
}

btnBack.addEventListener("click", () => {
  showListScreen();
  loadMainMenu();
});

btnSave.addEventListener("click", async () => {
  if (!currentMount || !currentMount.save) return;
  try {
    await currentMount.save();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check your connection");
  }
});

btnPrint.addEventListener("click", () => {
  if (!currentMount || !currentMount.print) return;
  try {
    const doc = currentMount.print();
    triggerPrint(doc);
  } catch (err) {
    console.error(err);
    showToast("Couldn't prepare this note for printing");
  }
});

// ---------------- Boot ----------------
async function boot() {
  showListScreen();
  await initAuth();
  await refreshAuthUI();
  if (getActiveAccount()) {
    try {
      await getMe(); // warms a token / surfaces auth problems early
    } catch (err) {
      console.warn("Profile check failed", err);
    }
  }
  await loadMainMenu();
}

boot();
