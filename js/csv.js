// =========================================================
// Small, dependency-free CSV reader/writer.
// Handles quoted fields, embedded commas, embedded quotes ("")
// and embedded newlines - the common CSV edge cases.
// =========================================================

/** Parse CSV text into { headers: string[], rows: object[] } */
export function parseCSV(text) {
  if (!text || !text.trim()) return { headers: [], rows: [] };

  const records = [];
  let field = "";
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field); field = "";
    } else if (c === "\n") {
      record.push(field); field = "";
      records.push(record); record = [];
    } else if (c === "\r") {
      // skip, \n (or end) handles the line break
    } else {
      field += c;
    }
  }
  // flush trailing field/record (file may or may not end with \n)
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter(r => !(r.length === 1 && r[0] === ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map(h => h.trim());
  const rows = nonEmpty.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ""; });
    return obj;
  });
  return { headers, rows };
}

function escapeField(value) {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Serialize { headers, rows } (array of plain objects) back to CSV text. */
export function stringifyCSV(headers, rows) {
  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => escapeField(row[h])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
