// =========================================================
// Brain dump note type
// - multiple named instances, named like Packing:
//   "braindumplist_<name>.csv"
// - format is deliberately as simple as this app's CSV convention
//   allows: one column ("text"), at most one row, holding the
//   whole free-text block (including its paragraph breaks) as a
//   single CSV field. The CSV reader/writer already round-trips
//   embedded newlines fine since it quotes fields that need it.
// - no structure beyond that - just a big text box with a save
//   button, no per-line items, no checkboxes, no categories.
// =========================================================
import { readTable, writeTable, todayISO } from "../store.js";

const HEADERS = ["text"];

function slugForFilename(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

export const braindumpType = {
  id: "braindump",
  label: "Brain Dump",
  groupLabel: "Brain dumps",
  singleton: false,
  showInCreateMenu: true,

  /** Called from the "+" menu. Prompts for a name, then creates the list. */
  async createInstance(store, ctx) {
    const result = await ctx.prompt({
      title: "New brain dump",
      fields: [{ name: "name", label: "Name", type: "text", placeholder: "e.g. Random ideas" }],
    });
    if (result === null) return null;
    const name = (result.name || "").trim() || `Brain Dump ${todayISO()}`;

    let file = `braindumplist_${slugForFilename(name)}.csv`;
    const existing = await store.listNoteRecords();
    let n = 2;
    while (existing.some(r => r.file === file)) {
      file = `braindumplist_${slugForFilename(name)}-${n}.csv`;
      n++;
    }
    await writeTable(file, HEADERS, []);
    return await store.createNoteRecord({ type: "braindump", name, file });
  },

  subtitleFor(record) {
    return record.name;
  },

  async mount({ body, footer, setTitle }, record, ctx) {
    setTitle(`Brain Dump — ${record.name}`);

    const table = await readTable(record.file, HEADERS);
    const initialText = (table.rows[0] && table.rows[0].text) || "";

    const textarea = document.createElement("textarea");
    textarea.className = "braindump-textarea";
    textarea.placeholder = "Write whatever's on your mind...";
    textarea.value = initialText;
    body.appendChild(textarea);

    return {
      async save() {
        const text = textarea.value;
        await writeTable(record.file, HEADERS, text ? [{ text }] : []);
        ctx.toast("Brain dump saved");
      },
    };
  },
};
