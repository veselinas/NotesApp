// =========================================================
// Research list note type
// - single instance ("researchlist.csv"), created automatically.
// - columns: category, topic, notes, valid
// - bulleted list grouped by category; add/remove items; double
//   click a topic to open its notes in a small editor.
// =========================================================
import { readTable, writeTable } from "../store.js";

const FILE = "researchlist.csv";
const HEADERS = ["category", "topic", "notes", "valid"];

export const researchType = {
  id: "research",
  label: "Research",
  groupLabel: "Research",
  singleton: true,
  showInCreateMenu: false,

  async ensure(store) {
    return await store.ensureSingletonNote("research", "Research", FILE, HEADERS);
  },

  subtitleFor() {
    return null;
  },

  async mount({ body, footer, setTitle }, record, ctx) {
    setTitle("Research");

    const table = await readTable(FILE, HEADERS);
    const rows = table.rows.map(r => ({ ...r }));

    const listWrap = document.createElement("div");
    body.appendChild(listWrap);

    function isValid(r) { return r.valid !== "false"; }

    function render() {
      listWrap.innerHTML = "";
      const active = rows.filter(isValid);
      const categories = [...new Set(active.map(r => r.category))].sort((a, b) =>
        a.localeCompare(b)
      );

      if (categories.length === 0) {
        const empty = document.createElement("p");
        empty.className = "note-row-sub";
        empty.textContent = "No research topics yet.";
        listWrap.appendChild(empty);
      }

      categories.forEach(cat => {
        const section = document.createElement("div");
        section.className = "research-category";
        const title = document.createElement("div");
        title.className = "research-category-title";
        title.textContent = cat;
        section.appendChild(title);

        active.filter(r => r.category === cat).forEach(r => {
          const row = document.createElement("div");
          row.className = "research-item-row";

          const bullet = document.createElement("span");
          bullet.className = "research-bullet";

          const topic = document.createElement("div");
          topic.className = "research-topic";
          topic.textContent = r.topic;
          if (r.notes && r.notes.trim()) {
            const dot = document.createElement("span");
            dot.className = "has-notes-dot";
            dot.title = "Has notes";
            topic.appendChild(dot);
          }
          topic.addEventListener("dblclick", () => openNotesEditor(r));

          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "item-remove";
          remove.setAttribute("aria-label", "Delete topic");
          remove.textContent = "\u2212";
          remove.addEventListener("click", () => {
            r.valid = "false";
            render();
          });

          row.appendChild(bullet);
          row.appendChild(topic);
          row.appendChild(remove);
          section.appendChild(row);
        });

        listWrap.appendChild(section);
      });
    }

    async function openNotesEditor(r) {
      const result = await ctx.prompt({
        title: r.topic,
        fields: [
          { name: "notes", label: "Notes", type: "textarea", value: r.notes || "" },
        ],
        confirmLabel: "Save",
      });
      if (result === null) return;
      r.notes = result.notes;
      // Notes are saved immediately, independent of the header Save
      // button, per the note's own "save" action in its editor.
      await writeTable(FILE, HEADERS, rows);
      render();
      ctx.toast("Notes saved");
    }

    async function openAddItem() {
      const existingCategories = [...new Set(rows.filter(isValid).map(r => r.category))];
      const result = await ctx.prompt({
        title: "Add research topic",
        fields: [
          { name: "category", label: "Category", type: "text", options: existingCategories, placeholder: "New or existing category" },
          { name: "topic", label: "Topic", type: "text", placeholder: "What are you researching?" },
        ],
        confirmLabel: "Add",
      });
      if (result === null) return;
      const category = (result.category || "").trim();
      const topic = (result.topic || "").trim();
      if (!category || !topic) return;
      rows.push({ category, topic, notes: "", valid: "true" });
      render();
    }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "icon-btn icon-btn-accent";
    addBtn.style.marginBottom = "14px";
    addBtn.textContent = "+";
    addBtn.setAttribute("aria-label", "Add research topic");
    addBtn.addEventListener("click", openAddItem);
    body.insertBefore(addBtn, listWrap);

    render();

    return {
      async save() {
        await writeTable(FILE, HEADERS, rows);
        ctx.toast("Research list saved");
      },
    };
  },
};
