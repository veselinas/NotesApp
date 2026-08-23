// =========================================================
// Packing list note type
// - multiple named instances, like Grocery, but user-named
//   instead of date-named: one CSV per list,
//   "packinglist_<name>.csv"
// - columns: category, item, status (yes | no | deleted)
//   note this type uses a 3-state status column instead of the
//   checked/valid pair Grocery uses - "deleted" doubles as the
//   soft-delete flag, so there's no separate valid column here.
// - adding an item prompts for category (existing or new, via
//   datalist) and item name, same interaction as Research.
// - display: checkbox list grouped by category (checked = "yes").
// =========================================================
import { readTable, writeTable, todayISO } from "../store.js";

const HEADERS = ["category", "item", "status"];

function slugForFilename(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

export const packingType = {
  id: "packing",
  label: "Packing",
  groupLabel: "Packing lists",
  singleton: false,
  showInCreateMenu: true,

  /** Called from the "+" menu. Prompts for a name, then creates the list. */
  async createInstance(store, ctx) {
    const result = await ctx.prompt({
      title: "New packing list",
      fields: [{ name: "name", label: "Name", type: "text", placeholder: "e.g. Italy trip" }],
    });
    if (result === null) return null;
    const name = (result.name || "").trim() || `Packing List ${todayISO()}`;

    let file = `packinglist_${slugForFilename(name)}.csv`;
    const existing = await store.listNoteRecords();
    let n = 2;
    while (existing.some(r => r.file === file)) {
      file = `packinglist_${slugForFilename(name)}-${n}.csv`;
      n++;
    }
    await writeTable(file, HEADERS, []);
    return await store.createNoteRecord({ type: "packing", name, file });
  },

  subtitleFor(record) {
    return record.name;
  },

  async mount({ body, setTitle }, record, ctx) {
    setTitle(`Packing — ${record.name}`);

    const table = await readTable(record.file, HEADERS);
    const rows = table.rows.map(r => ({ ...r }));

    function isValid(r) { return r.status !== "deleted"; }
    function isChecked(r) { return r.status === "yes"; }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "icon-btn icon-btn-accent";
    addBtn.style.marginBottom = "14px";
    addBtn.textContent = "+";
    addBtn.setAttribute("aria-label", "Add item");
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

        const list = document.createElement("div");
        list.className = "item-list";

        active.filter(r => r.category === cat).forEach(r => {
          const row = document.createElement("div");
          row.className = "item-row";

          const checked = isChecked(r);
          const check = document.createElement("button");
          check.type = "button";
          check.className = "item-check" + (checked ? " checked" : "");
          check.setAttribute("aria-label", "Toggle packed");
          check.textContent = "\u2713";
          check.addEventListener("click", () => {
            r.status = checked ? "no" : "yes";
            render();
          });

          const itemLabel = document.createElement("div");
          itemLabel.className = "item-label" + (checked ? " checked" : "");
          itemLabel.textContent = r.item;

          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "item-remove";
          remove.setAttribute("aria-label", "Delete item");
          remove.textContent = "\u2212";
          remove.addEventListener("click", () => {
            r.status = "deleted";
            render();
          });

          row.appendChild(check);
          row.appendChild(itemLabel);
          row.appendChild(remove);
          list.appendChild(row);
        });

        listWrap.appendChild(list);
      });
    }

    addBtn.addEventListener("click", async () => {
      const existingCategories = [...new Set(rows.filter(isValid).map(r => r.category))];
      const result = await ctx.prompt({
        title: "Add item",
        fields: [
          { name: "category", label: "Category", type: "text", options: existingCategories, placeholder: "New or existing category" },
          { name: "item", label: "Item", type: "text", placeholder: "What are you packing?" },
        ],
        confirmLabel: "Add",
      });
      if (result === null) return;
      const category = (result.category || "").trim();
      const item = (result.item || "").trim();
      if (!category || !item) return;
      rows.push({ category, item, status: "no" });
      render();
    });

    render();

    return {
      async save() {
        await writeTable(record.file, HEADERS, rows);
        ctx.toast("Packing list saved");
      },
    };
  },
};
