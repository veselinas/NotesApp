// =========================================================
// Microsoft Graph file access (OneDrive)
// All app data lives in one folder in the signed-in user's
// OneDrive: /APP_FOLDER/*.csv
// =========================================================
import { getAccessToken } from "./auth.js";
import { APP_FOLDER } from "./config.js";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

async function authHeaders(extra = {}) {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, ...extra };
}

function itemPath(filename) {
  // Graph "path addressing": /me/drive/root:/NotesApp/file.csv:
  return `${GRAPH_ROOT}/me/drive/root:/${encodeURIComponent(APP_FOLDER)}/${encodeURIComponent(filename)}:`;
}

/**
 * Download a text file from the app folder.
 * Returns the file's text content, or null if the file does not
 * exist yet (so callers can create it with sensible defaults).
 */
export async function downloadText(filename) {
  const headers = await authHeaders();
  const res = await fetch(`${itemPath(filename)}/content`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to read ${filename}: ${res.status} ${await res.text()}`);
  return await res.text();
}

/**
 * Upload (create or overwrite) a text file in the app folder.
 * Graph's "simple upload" path-addressing endpoint creates any
 * missing parent folders automatically, so the app folder does not
 * need to be created separately ahead of time.
 */
export async function uploadText(filename, text) {
  const headers = await authHeaders({ "Content-Type": "text/csv" });
  const res = await fetch(`${itemPath(filename)}/content`, {
    method: "PUT",
    headers,
    body: text,
  });
  if (!res.ok) throw new Error(`Failed to save ${filename}: ${res.status} ${await res.text()}`);
  return await res.json();
}

/** Basic profile info for display in the header ("signed in as ..."). */
export async function getMe() {
  const headers = await authHeaders();
  const res = await fetch(`${GRAPH_ROOT}/me`, { headers });
  if (!res.ok) throw new Error(`Failed to read profile: ${res.status}`);
  return await res.json();
}
