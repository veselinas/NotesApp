// =========================================================
// Reading list note type
// - single instance ("readinglist.csv"), created automatically.
// - columns: book, status, rating, year read, notes, valid
//   status is one of: "to read" | "started" | "read" | "not finished"
//   rating is 0-5 (0 = unrated)
//   year read is 0 by default, filled in via a prompt when status
//   is set to "read"
// - each book is a small expandable section: title + star rating
//   always visible, status radios always visible, notes hidden
//   until expanded. Rating, status, and delete all save immediately
//   (matching how the stars/radios are described); notes save via
//   their own button in the expanded section.
// =========================================================
import { readTable, writeTable } from "../store.js";

const FILE = "readinglist.csv";
const HEADERS = ["book", "status", "rating", "year read", "notes", "valid"];
const STATUS_OPTIONS = ["to read", "started", "read", "not finished"];

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "r-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

export const readingType = {
  id: "reading",
  label: "Reading",
  groupLabel: "Reading list",
  singleton: true,
  showInCreateMenu: false,
  printable: false, // may get a dedicated print layout later

  async ensure(store) {
    return await store.ensureSingletonNote("reading", "Reading", FILE, HEADERS);
  },

  subtitleFor() {
    return null;
  },

  async mount({ body, setTitle }, record, ctx) {
    setTitle("Reading");

    const table = await readTable(FILE, HEADERS);
    // _uid is a client-side-only field for DOM/radio grouping and
    // expand-state tracking; writeTable ignores any object key that
    // isn't in HEADERS, so it never ends up in the CSV.
    const rows = table.rows.map(r => ({ ...r, _uid: uid() }));
    const expanded = new Set();

    function isValid(r) {
      return r.valid !== "false";
    }

    async function persist() {
      await writeTable(FILE, HEADERS, rows);
    }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "icon-btn icon-btn-accent";
    addBtn.style.marginBottom = "14px";
    addBtn.textContent = "+";
    addBtn.setAttribute("aria-label", "Add book");
    body.appendChild(addBtn);

    const listWrap = document.createElement("div");
    body.appendChild(listWrap);

    async function openYearPrompt(existingYear) {
      const currentYear = String(new Date().getFullYear());
      const result = await ctx.prompt({
        title: "Year read",
        fields: [
          {
            name: "year",
            label: "Year",
            type: "text",
            value: existingYear && existingYear !== "0" ? existingYear : currentYear,
          },
        ],
        confirmLabel: "Save",
      });
      return result; // null if cancelled
    }

    function renderStars(container, r) {
      container.innerHTML = "";
      const rating = Number(r.rating || 0);
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement("button");
        star.type = "button";
        star.className = "star" + (i <= rating ? " filled" : "");
        star.textContent = "\u2605";
        star.setAttribute("aria-label", `Rate ${i} star${i === 1 ? "" : "s"}`);
        star.addEventListener("click", async () => {
          r.rating = String(i);
          await persist();
          render();
        });
        container.appendChild(star);
      }
    }

    function render() {
      listWrap.innerHTML = "";
      const active = rows.filter(isValid);

      if (active.length === 0) {
        const empty = document.createElement("p");
        empty.className = "note-row-sub";
        empty.textContent = "No books yet.";
        listWrap.appendChild(empty);
      }

      active.forEach(r => {
        const card = document.createElement("div");
        card.className = "reading-item";

        // ---- header: title + stars ----
        const header = document.createElement("div");
        header.className = "reading-item-header";

        const titleBtn = document.createElement("button");
        titleBtn.type = "button";
        titleBtn.className = "reading-item-title";
        titleBtn.textContent = (expanded.has(r._uid) ? "\u25be " : "\u25b8 ") + r.book;
        titleBtn.addEventListener("click", () => {
          if (expanded.has(r._uid)) expanded.delete(r._uid);
          else expanded.add(r._uid);
          render();
        });

        const stars = document.createElement("div");
        stars.className = "reading-stars";
        renderStars(stars, r);

        header.appendChild(titleBtn);
        header.appendChild(stars);
        card.appendChild(header);

        // ---- status radios ----
        const statusRow = document.createElement("div");
        statusRow.className = "reading-item-status";
        STATUS_OPTIONS.forEach(opt => {
          const label = document.createElement("label");
          label.className = "reading-status-option";
          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = `status-${r._uid}`;
          radio.checked = r.status === opt;
          radio.addEventListener("change", async () => {
            if (opt === "read") {
              const result = await openYearPrompt(r["year read"]);
              if (result === null) { render(); return; } // cancelled, revert
              r.status = "read";
              r["year read"] = (result.year || "").trim() || String(new Date().getFullYear());
            } else {
              r.status = opt;
            }
            await persist();
            render();
          });
          label.appendChild(radio);
          label.appendChild(document.createTextNode(" " + opt));
          statusRow.appendChild(label);
        });
        card.appendChild(statusRow);

        // ---- expanded notes section ----
        if (expanded.has(r._uid)) {
          const expandWrap = document.createElement("div");
          expandWrap.className = "reading-item-expand";

          const textarea = document.createElement("textarea");
          textarea.className = "reading-notes-textarea";
          textarea.value = r.notes || "";
          textarea.placeholder = "Notes";
          expandWrap.appendChild(textarea);

          const footer = document.createElement("div");
          footer.className = "reading-item-footer";

          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "btn-danger reading-footer-btn";
          deleteBtn.textContent = "Delete";
          deleteBtn.addEventListener("click", async () => {
            r.valid = "false";
            await persist();
            render();
            ctx.toast("Book deleted");
          });

          const saveBtn = document.createElement("button");
          saveBtn.type = "button";
          saveBtn.className = "btn-primary reading-footer-btn";
          saveBtn.textContent = "Save";
          saveBtn.addEventListener("click", async () => {
            r.notes = textarea.value;
            await persist();
            ctx.toast("Notes saved");
          });

          footer.appendChild(deleteBtn);
          footer.appendChild(saveBtn);
          expandWrap.appendChild(footer);
          card.appendChild(expandWrap);
        }

        listWrap.appendChild(card);
      });
    }

    addBtn.addEventListener("click", async () => {
      const result = await ctx.prompt({
        title: "Add book",
        fields: [{ name: "book", label: "Title", type: "text", placeholder: "Book title" }],
        confirmLabel: "Add",
      });
      if (result === null) return;
      const title = (result.book || "").trim();
      if (!title) return;
      rows.push({
        book: title,
        status: "to read",
        rating: "0",
        "year read": "0",
        notes: "",
        valid: "true",
        _uid: uid(),
      });
      await persist();
      render();
    });

    render();

    return {
      async save() {
        await persist();
        ctx.toast("Reading list saved");
      },
    };
  },
};
