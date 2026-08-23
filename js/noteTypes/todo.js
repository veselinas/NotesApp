// =========================================================
// To-do list note type
// - single instance ("todolist.csv"), created automatically,
//   not offered in the "+" create menu.
// - columns: date, task, status (outstanding | completed | crossed)
// - note view shows one day at a time, with prev/next arrows
//   and a calendar picker.
// - "good night" button (deliberately low-contrast) carries
//   every outstanding task from the viewed day forward to the
//   next day, only after an explicit confirmation.
//
// Possible future extension (kept in mind, not built yet):
// additional columns such as `priority`, `notes`, `due-time`
// could be appended to HEADERS without breaking existing rows,
// since parseCSV/stringifyCSV are header-driven.
// =========================================================
import { readTable, writeTable, todayISO } from "../store.js";

const FILE = "todolist.csv";
const HEADERS = ["date", "task", "status"];

function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayISO(dt);
}

function formatDisplay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const todoType = {
  id: "todo",
  label: "To-Do",
  groupLabel: "To-do",
  singleton: true,
  showInCreateMenu: false,

  async ensure(store) {
    return await store.ensureSingletonNote("todo", "To-Do", FILE, HEADERS);
  },

  subtitleFor() {
    return null;
  },

  async mount({ subheader, body, footer, setTitle }, record, ctx) {
    setTitle("To-Do");

    const table = await readTable(FILE, HEADERS);
    const rows = table.rows.map(r => ({ ...r }));
    let viewDate = todayISO();

    // ---- date nav (subheader) ----
    const nav = document.createElement("div");
    nav.className = "date-nav";
    const prevBtn = document.createElement("button");
    prevBtn.className = "date-nav-btn";
    prevBtn.textContent = "\u2039";
    prevBtn.setAttribute("aria-label", "Previous day");
    const dateLabel = document.createElement("button");
    dateLabel.className = "date-nav-label";
    const nextBtn = document.createElement("button");
    nextBtn.className = "date-nav-btn";
    nextBtn.textContent = "\u203a";
    nextBtn.setAttribute("aria-label", "Next day");

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.style.position = "absolute";
    dateInput.style.opacity = "0";
    dateInput.style.pointerEvents = "none";
    dateInput.style.width = "1px";
    dateInput.style.height = "1px";

    nav.appendChild(prevBtn);
    nav.appendChild(dateLabel);
    nav.appendChild(nextBtn);
    nav.appendChild(dateInput);
    subheader.appendChild(nav);

    // ---- task list (body) ----
    const list = document.createElement("div");
    list.className = "item-list";
    body.appendChild(list);

    const addRow = document.createElement("div");
    addRow.className = "add-row";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Add a task";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Add";
    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    body.appendChild(addRow);

    // ---- good night button (footer) ----
    const goodnightBtn = document.createElement("button");
    goodnightBtn.type = "button";
    goodnightBtn.className = "goodnight-btn";
    goodnightBtn.textContent = "good night";
    footer.appendChild(goodnightBtn);

    function tasksFor(date) {
      return rows.filter(r => r.date === date && r.status !== "crossed");
    }

    function render() {
      dateLabel.textContent = formatDisplay(viewDate);
      dateInput.value = viewDate;
      list.innerHTML = "";
      tasksFor(viewDate).forEach(r => {
        const row = document.createElement("div");
        row.className = "item-row";

        const completed = r.status === "completed";
        const check = document.createElement("button");
        check.type = "button";
        check.className = "item-check" + (completed ? " checked" : "");
        check.setAttribute("aria-label", "Toggle complete");
        check.textContent = "\u2713";
        check.addEventListener("click", () => {
          r.status = completed ? "outstanding" : "completed";
          render();
        });

        const label = document.createElement("div");
        label.className = "item-label" + (completed ? " checked" : "");
        label.textContent = r.task;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "item-remove";
        remove.setAttribute("aria-label", "Cross task");
        remove.textContent = "\u2212";
        remove.addEventListener("click", () => {
          r.status = "crossed";
          render();
        });

        row.appendChild(check);
        row.appendChild(label);
        row.appendChild(remove);
        list.appendChild(row);
      });
    }

    prevBtn.addEventListener("click", () => { viewDate = addDays(viewDate, -1); render(); });
    nextBtn.addEventListener("click", () => { viewDate = addDays(viewDate, 1); render(); });
    dateLabel.addEventListener("click", () => {
      if (dateInput.showPicker) dateInput.showPicker(); else dateInput.click();
    });
    dateInput.addEventListener("change", () => {
      if (dateInput.value) { viewDate = dateInput.value; render(); }
    });

    async function submitAdd() {
      const value = input.value.trim();
      if (!value) return;
      rows.push({ date: viewDate, task: value, status: "outstanding" });
      input.value = "";
      render();
    }
    addBtn.addEventListener("click", submitAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submitAdd(); }
    });

    goodnightBtn.addEventListener("click", async () => {
      const outstanding = tasksFor(viewDate).filter(r => r.status === "outstanding");
      const nextDate = addDays(viewDate, 1);
      if (outstanding.length === 0) {
        ctx.toast("Nothing outstanding to carry forward");
        return;
      }
      const ok = await ctx.confirm(
        "Carry tasks forward?",
        `Move ${outstanding.length} unfinished task${outstanding.length === 1 ? "" : "s"} from ${formatDisplay(viewDate)} to ${formatDisplay(nextDate)}?`
      );
      if (!ok) return;
      outstanding.forEach(r => {
        rows.push({ date: nextDate, task: r.task, status: "outstanding" });
      });
      await writeTable(FILE, HEADERS, rows);
      viewDate = nextDate;
      render();
      ctx.toast("Tasks carried forward");
    });

    render();

    return {
      async save() {
        await writeTable(FILE, HEADERS, rows);
        ctx.toast("To-do list saved");
      },
    };
  },
};
