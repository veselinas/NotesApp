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

    // categories added via the "+" button that don't have any
    // bullets yet - tracked separately since a category only really
    // exists in the CSV once at least one bullet row uses it.
    const extraCategories = new Set();

    const addCategoryBtn = document.createElement("button");
    addCategoryBtn.type = "button";
    addCategoryBtn.className = "icon-btn icon-btn-accent";
    addCategoryBtn.style.marginBottom = "14px";
    addCategoryBtn.textContent = "+";
    addCategoryBtn.setAttribute("aria-label", "Add category");
    body.appendChild(addCategoryBtn);

    const listWrap = document.createElement("div");
    body.appendChild(listWrap);

    function render() {
      listWrap.innerHTML = "";
      const active = rows.filter(isValid);
      const categories = [...new Set([...active.map(r => r.category), ...extraCategories])].sort((a, b) =>
        a.localeCompare(b)
      );

      if (categories.length === 0) {
        const empty = document.createElement("p");
        empty.className = "note-row-sub";
        empty.textContent = "No categories yet — tap + to add one.";
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

        // inline "add bullet" row for this category
        const addRow = document.createElement("div");
        addRow.className = "add-row";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Add bullet";
        const addBulletBtn = document.createElement("button");
        addBulletBtn.type = "button";
        addBulletBtn.textContent = "Add";
        addRow.appendChild(input);
        addRow.appendChild(addBulletBtn);
        listWrap.appendChild(addRow);

        function submitAdd() {
          const value = input.value.trim();
          if (!value) return;
          rows.push({ category: cat, bullet: value, valid: "true" });
          extraCategories.delete(cat);
          render();
        }
        addBulletBtn.addEventListener("click", submitAdd);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); submitAdd(); }
        });
      });
    }

    addCategoryBtn.addEventListener("click", async () => {
      const existingCategories = [...new Set([...rows.filter(isValid).map(r => r.category), ...extraCategories])];
      const result = await ctx.prompt({
        title: "Add category",
        fields: [
          { name: "category", label: "Category", type: "text", options: existingCategories, placeholder: "New or existing category" },
        ],
        confirmLabel: "Add",
      });
      if (result === null) return;
      const category = (result.category || "").trim();
      if (!category) return;
      extraCategories.add(category);
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
