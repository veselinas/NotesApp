// =========================================================
// Checklist note type
// - multiple named instances, like Packing: one CSV per list,
//   "checklist_<name>.csv"
// - columns: category, item, status (yes | no | deleted)
// - a plain single-checkbox categorized list - this is the
//   general-purpose version of what Packing looked like before
//   Packing grew its second (post-travel) checkbox; kept around
//   as its own type for anything that just needs one checkbox
//   per item, grouped by category.
// - adding a category via "+" then adding items inline per
//   category, same interaction as Packing/Bullet List.
// =========================================================
import { readTable, writeTable, todayISO } from "../store.js";

const HEADERS = ["category", "item", "status"];

function slugForFilename(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

export const checklistType = {
  id: "checklist",
  label: "Checklist",
  groupLabel: "Checklists",
  singleton: false,
  showInCreateMenu: true,

  /** Called from the "+" menu. Prompts for a name, then creates the list. */
  async createInstance(store, ctx) {
    const result = await ctx.prompt({
      title: "New checklist",
      fields: [{ name: "name", label: "Name", type: "text", placeholder: "e.g. Move-out tasks" }],
    });
    if (result === null) return null;
    const name = (result.name || "").trim() || `Checklist ${todayISO()}`;

    let file = `checklist_${slugForFilename(name)}.csv`;
    const existing = await store.listNoteRecords();
    let n = 2;
    while (existing.some(r => r.file === file)) {
      file = `checklist_${slugForFilename(name)}-${n}.csv`;
      n++;
    }
    await writeTable(file, HEADERS, []);
    return await store.createNoteRecord({ type: "checklist", name, file });
  },

  subtitleFor(record) {
    return record.name;
  },

  async mount({ body, setTitle }, record, ctx) {
    setTitle(`Checklist — ${record.name}`);

    const table = await readTable(record.file, HEADERS);
    const rows = table.rows.map(r => ({ ...r }));

    function isValid(r) { return r.status !== "deleted"; }
    function isChecked(r) { return r.status === "yes"; }

    // categories added via the "+" button that don't have any items
    // yet - tracked separately since a category only really exists
    // in the CSV once at least one item row uses it.
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

        const list = document.createElement("div");
        list.className = "item-list";

        active.filter(r => r.category === cat).forEach(r => {
          const row = document.createElement("div");
          row.className = "item-row";

          const checked = isChecked(r);
          const check = document.createElement("button");
          check.type = "button";
          check.className = "item-check" + (checked ? " checked" : "");
          check.setAttribute("aria-label", "Toggle complete");
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

        // inline "add item" row for this category
        const addRow = document.createElement("div");
        addRow.className = "add-row";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Add item";
        const addItemBtn = document.createElement("button");
        addItemBtn.type = "button";
        addItemBtn.textContent = "Add";
        addRow.appendChild(input);
        addRow.appendChild(addItemBtn);
        listWrap.appendChild(addRow);

        function submitAdd() {
          const value = input.value.trim();
          if (!value) return;
          rows.push({ category: cat, item: value, status: "no" });
          extraCategories.delete(cat);
          render();
        }
        addItemBtn.addEventListener("click", submitAdd);
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
        ctx.toast("Checklist saved");
      },
    };
  },
};
