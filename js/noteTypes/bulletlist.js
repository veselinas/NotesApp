// =========================================================
// Bullet list note type
// - multiple named instances, like Packing:
//   "bulletlist_<name>.csv"
// - columns: category, bullet, valid (true | false)
// - adding an item prompts for category (existing or new, via
//   datalist) and bullet text, same interaction as Packing/Research.
// - display: grouped by category like Packing, but each row is a
//   plain bullet (no checkbox/complete state) with a minus to
//   delete (valid=false).
// =========================================================
import { readTable, writeTable, todayISO } from "../store.js";

const HEADERS = ["category", "bullet", "valid"];

function slugForFilename(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

export const bulletlistType = {
  id: "bulletlist",
  label: "Bullet List",
  groupLabel: "Bullet lists",
  singleton: false,
  showInCreateMenu: true,

  /** Called from the "+" menu. Prompts for a name, then creates the list. */
  async createInstance(store, ctx) {
    const result = await ctx.prompt({
      title: "New bullet list",
      fields: [{ name: "name", label: "Name", type: "text", placeholder: "e.g. Meeting notes" }],
    });
    if (result === null) return null;
    const name = (result.name || "").trim() || `Bullet List ${todayISO()}`;

    let file = `bulletlist_${slugForFilename(name)}.csv`;
    const existing = await store.listNoteRecords();
    let n = 2;
    while (existing.some(r => r.file === file)) {
      file = `bulletlist_${slugForFilename(name)}-${n}.csv`;
      n++;
    }
    await writeTable(file, HEADERS, []);
    return await store.createNoteRecord({ type: "bulletlist", name, file });
  },

  subtitleFor(record) {
    return record.name;
  },

  async mount({ body, setTitle }, record, ctx) {
    setTitle(`Bullets — ${record.name}`);

    const table = await readTable(record.file, HEADERS);
    const rows = table.rows.map(r => ({ ...r }));

    function isValid(r) { return r.valid !== "false"; }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "icon-btn icon-btn-accent";
    addBtn.style.marginBottom = "14px";
    addBtn.textContent = "+";
    addBtn.setAttribute("aria-label", "Add bullet");
    body.appendChild(addBtn);

    const listWrap = document.createElement("div");
    body.appendChild(listWrap);

    function render() {
      listWrap.innerHTML = "";
      const active = rows.filter(isValid);
      const categories = [...new Set(active.map(r => r.category))].sort((a, b) => a.localeCompare(b));

      if (categories.length === 0) {
        const empty = document.createElement("p");
        empty.className = "note-row-sub";
        empty.textContent = "No items yet.";
        listWrap.appendChild(empty);
      }

      categories.forEach(cat => {
        const label = document.createElement("div");
        label.className = "section-label";
        label.textContent = cat;
        listWrap.appendChild(label);

        active.filter(r => r.category === cat).forEach(r => {
          const row = document.createElement("div");
          row.className = "research-item-row";

          const bullet = document.createElement("span");
          bullet.className = "research-bullet";

          const text = document.createElement("div");
          text.className = "research-topic";
          text.textContent = r.bullet;

          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "item-remove";
          remove.setAttribute("aria-label", "Delete bullet");
          remove.textContent = "\u2212";
          remove.addEventListener("click", () => {
            r.valid = "false";
            render();
          });

          row.appendChild(bullet);
          row.appendChild(text);
          row.appendChild(remove);
          listWrap.appendChild(row);
        });
      });
    }

    addBtn.addEventListener("click", async () => {
      const existingCategories = [...new Set(rows.filter(isValid).map(r => r.category))];
      const result = await ctx.prompt({
        title: "Add bullet",
        fields: [
          { name: "category", label: "Category", type: "text", options: existingCategories, placeholder: "New or existing category" },
          { name: "bullet", label: "Bullet", type: "text", placeholder: "What do you want to note?" },
        ],
        confirmLabel: "Add",
      });
      if (result === null) return;
      const category = (result.category || "").trim();
      const bulletText = (result.bullet || "").trim();
      if (!category || !bulletText) return;
      rows.push({ category, bullet: bulletText, valid: "true" });
      render();
    });

    render();

    return {
      async save() {
        await writeTable(record.file, HEADERS, rows);
        ctx.toast("Bullet list saved");
      },
    };
  },
};
