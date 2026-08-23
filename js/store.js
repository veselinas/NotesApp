// =========================================================
// Data layer
// - keeps a "notes_index.csv" that lists every note instance
//   (id, type, name, file, created, valid) - this drives the
//   main menu list.
// - provides generic CSV table read/write for note-type modules
//   to build on, with a small in-memory cache so re-opening a
//   note within the same session doesn't re-download it.
// =========================================================
import { downloadText, uploadText } from "./graph.js";
import { parseCSV, stringifyCSV } from "./csv.js";

const INDEX_FILE = "notes_index.csv";
const INDEX_HEADERS = ["id", "type", "name", "file", "created", "valid"];

const cache = new Map(); // filename -> { headers, rows }

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function todayISO(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Read a CSV table by filename. Missing file -> empty table (not persisted). */
export async function readTable(filename, defaultHeaders = []) {
  if (cache.has(filename)) return cache.get(filename);
  const text = await downloadText(filename);
  const table = text === null ? { headers: defaultHeaders, rows: [] } : parseCSV(text);
  if (table.headers.length === 0) table.headers = defaultHeaders;
  cache.set(filename, table);
  return table;
}

/** Write a CSV table (creates or overwrites) and refresh the cache. */
export async function writeTable(filename, headers, rows) {
  const text = stringifyCSV(headers, rows);
  await uploadText(filename, text);
  const table = { headers, rows };
  cache.set(filename, table);
  return table;
}

export function invalidateCache(filename) {
  cache.delete(filename);
}

// ---------------- Notes index ----------------

async function loadIndexRaw() {
  return await readTable(INDEX_FILE, INDEX_HEADERS);
}

async function persistIndex(rows) {
  await writeTable(INDEX_FILE, INDEX_HEADERS, rows);
}

/** All active (valid) note records, in the order they were created. */
export async function listNoteRecords() {
  const { rows } = await loadIndexRaw();
  return rows.filter(r => r.valid !== "false");
}

export async function getNoteRecordByType(type) {
  const records = await listNoteRecords();
  return records.find(r => r.type === type) || null;
}

export async function getNoteRecordById(id) {
  const records = await listNoteRecords();
  return records.find(r => r.id === id) || null;
}

/** Create and persist a new note index entry. Returns the new record. */
export async function createNoteRecord({ type, name, file }) {
  const { rows } = await loadIndexRaw();
  const record = {
    id: uid(),
    type,
    name,
    file,
    created: todayISO(),
    valid: "true",
  };
  rows.push(record);
  await persistIndex(rows);
  return record;
}

/**
 * Ensure exactly one note of a singleton type exists (e.g. To-Do,
 * Wish List, Research). Creates it with a fresh empty CSV the
 * first time it's needed.
 */
export async function ensureSingletonNote(type, name, filename, defaultHeaders) {
  const existing = await getNoteRecordByType(type);
  if (existing) return existing;
  await writeTable(filename, defaultHeaders, []);
  return await createNoteRecord({ type, name, file: filename });
}

/** Soft-delete a note: hide it from the menu, keep its CSV file untouched. */
export async function deleteNoteRecord(id) {
  const { rows } = await loadIndexRaw();
  const row = rows.find(r => r.id === id);
  if (row) row.valid = "false";
  await persistIndex(rows);
}
