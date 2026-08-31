// =========================================================
// Women's calendar note type
// - single instance ("womencalendarlist.csv"), created
//   automatically, no naming (like To-Do/Wish List/Research).
// - columns: category, info1, info2
//     category "cycle":     info1 = start date, info2 = end date
//     category "sex":       info1 = date, info2 = protected status
//                            ("yes" | "no" | "not applicable")
//     category "ovulation": info1 = date, info2 = "" (blank)
// - month-grid calendar view with prev/next arrows. Tapping a day
//   opens a modal to log an entry for that date.
// - "cycle" logging has special merge behaviour: if the most
//   recent cycle entry's end date is the day before the tapped
//   date, that entry's end date is extended to the tapped date
//   (treating it as the same ongoing period); otherwise a brand
//   new cycle entry is started with start = end = the tapped date.
// - rendering: a day within any cycle's [start, end] range gets a
//   pink circle; an exact ovulation date gets a blue circle
//   instead (ovulation takes visual priority over a cycle circle
//   on the same day, since it's the more specific event); a sex
//   entry overlays a small heart outline - red/green/blue for
//   unprotected/protected/not-applicable - regardless of what
//   circle (if any) is underneath.
// =========================================================
import { readTable, writeTable, todayISO } from "../store.js";

const FILE = "womencalendarlist.csv";
const HEADERS = ["category", "info1", "info2"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayISO(dt);
}

export const womenCalendarType = {
  id: "womencalendar",
  label: "Women's Calendar",
  groupLabel: "Women's calendar",
  singleton: true,
  showInCreateMenu: false,
  printable: false,

  async ensure(store) {
    return await store.ensureSingletonNote("womencalendar", "Women's Calendar", FILE, HEADERS);
  },

  subtitleFor() {
    return null;
  },

  async mount({ subheader, body, footer, setTitle }, record, ctx) {
    setTitle("Women's Calendar");

    const table = await readTable(FILE, HEADERS);
    const rows = table.rows.map(r => ({ ...r }));

    async function persist() {
      await writeTable(FILE, HEADERS, rows);
    }

    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth(); // 0-indexed

    // ---- month nav (subheader) ----
    const nav = document.createElement("div");
    nav.className = "date-nav";
    const prevBtn = document.createElement("button");
    prevBtn.className = "date-nav-btn";
    prevBtn.textContent = "\u2039";
    prevBtn.setAttribute("aria-label", "Previous month");
    const monthLabel = document.createElement("div");
    monthLabel.className = "calendar-month-label";
    const nextBtn = document.createElement("button");
    nextBtn.className = "date-nav-btn";
    nextBtn.textContent = "\u203a";
    nextBtn.setAttribute("aria-label", "Next month");
    nav.appendChild(prevBtn);
    nav.appendChild(monthLabel);
    nav.appendChild(nextBtn);
    subheader.appendChild(nav);

    // ---- grid (body) ----
    const weekdayRow = document.createElement("div");
    weekdayRow.className = "calendar-grid calendar-weekday-row";
    WEEKDAYS.forEach(w => {
      const cell = document.createElement("div");
      cell.className = "calendar-weekday";
      cell.textContent = w;
      weekdayRow.appendChild(cell);
    });
    body.appendChild(weekdayRow);

    const grid = document.createElement("div");
    grid.className = "calendar-grid";
    body.appendChild(grid);

    // ---- legend (footer) ----
    const legend = document.createElement("div");
    legend.className = "calendar-legend";
    legend.innerHTML = `
      <div class="calendar-legend-item"><span class="calendar-legend-swatch calendar-legend-cycle"></span>Cycle</div>
      <div class="calendar-legend-item"><span class="calendar-legend-swatch calendar-legend-ovulation"></span>Ovulation</div>
      <div class="calendar-legend-item"><span class="calendar-legend-heart heart-unprotected">\u2665</span>Sex — unprotected</div>
      <div class="calendar-legend-item"><span class="calendar-legend-heart heart-protected">\u2665</span>Sex — protected</div>
      <div class="calendar-legend-item"><span class="calendar-legend-heart heart-na">\u2665</span>Sex — not applicable</div>
    `;
    footer.appendChild(legend);

    function isCycleDay(iso) {
      return rows.some(r => r.category === "cycle" && r.info1 <= iso && r.info2 >= iso);
    }
    function isOvulationDay(iso) {
      return rows.some(r => r.category === "ovulation" && r.info1 === iso);
    }
    function sexStatusFor(iso) {
      const entries = rows.filter(r => r.category === "sex" && r.info1 === iso);
      return entries.length ? entries[entries.length - 1].info2 : null;
    }

    function render() {
      monthLabel.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });

      grid.innerHTML = "";
      const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

      for (let i = 0; i < firstWeekday; i++) {
        const blank = document.createElement("div");
        blank.className = "calendar-day calendar-day-empty";
        grid.appendChild(blank);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const iso = todayISO(new Date(viewYear, viewMonth, d));
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "calendar-day";
        cell.setAttribute("aria-label", iso);

        const circle = document.createElement("span");
        circle.className = "calendar-day-circle";
        if (isOvulationDay(iso)) circle.classList.add("circle-ovulation");
        else if (isCycleDay(iso)) circle.classList.add("circle-cycle");
        circle.textContent = String(d);
        cell.appendChild(circle);

        const sexStatus = sexStatusFor(iso);
        if (sexStatus) {
          const heart = document.createElement("span");
          heart.className = "calendar-heart";
          if (sexStatus === "yes") heart.classList.add("heart-protected");
          else if (sexStatus === "no") heart.classList.add("heart-unprotected");
          else heart.classList.add("heart-na");
          heart.textContent = "\u2665";
          cell.appendChild(heart);
        }

        cell.addEventListener("click", () => openDayModal(iso));
        grid.appendChild(cell);
      }
    }

    prevBtn.addEventListener("click", () => {
      viewMonth -= 1;
      if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
      render();
    });
    nextBtn.addEventListener("click", () => {
      viewMonth += 1;
      if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
      render();
    });

    async function openDayModal(iso) {
      await ctx.customModal((card, close) => {
        const title = document.createElement("div");
        title.className = "modal-title";
        title.textContent = new Date(iso).toLocaleDateString(undefined, {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        });
        card.appendChild(title);

        const modalBody = document.createElement("div");
        modalBody.className = "modal-body";
        card.appendChild(modalBody);

        const catLabel = document.createElement("label");
        catLabel.textContent = "Category";
        const catSelect = document.createElement("select");
        [["cycle", "Cycle"], ["sex", "Sex"], ["ovulation", "Ovulation"]].forEach(([value, text]) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = text;
          catSelect.appendChild(opt);
        });
        modalBody.appendChild(catLabel);
        modalBody.appendChild(catSelect);

        const protectedWrap = document.createElement("div");
        protectedWrap.className = "reading-item-status";
        protectedWrap.style.marginTop = "12px";
        const radioName = "protected-status";
        [["yes", "Protected"], ["no", "Unprotected"], ["not applicable", "Not applicable"]].forEach(([value, text], idx) => {
          const label = document.createElement("label");
          label.className = "reading-status-option";
          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = radioName;
          radio.value = value;
          if (idx === 2) radio.checked = true; // default "not applicable"
          label.appendChild(radio);
          label.appendChild(document.createTextNode(" " + text));
          protectedWrap.appendChild(label);
        });
        modalBody.appendChild(protectedWrap);

        function updateProtectedVisibility() {
          protectedWrap.classList.toggle("hidden", catSelect.value !== "sex");
        }
        catSelect.addEventListener("change", updateProtectedVisibility);
        updateProtectedVisibility();

        const actions = document.createElement("div");
        actions.className = "modal-actions";

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn-neutral";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => close(null));

        const saveBtn = document.createElement("button");
        saveBtn.className = "btn-primary";
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", async () => {
          const category = catSelect.value;

          if (category === "sex") {
            const checked = protectedWrap.querySelector('input[name="protected-status"]:checked');
            const status = checked ? checked.value : "not applicable";
            rows.push({ category: "sex", info1: iso, info2: status });
          } else if (category === "ovulation") {
            rows.push({ category: "ovulation", info1: iso, info2: "" });
          } else if (category === "cycle") {
            const cycleRows = rows.filter(r => r.category === "cycle");
            let last = null;
            cycleRows.forEach(r => { if (!last || r.info2 > last.info2) last = r; });
            const yesterday = addDays(iso, -1);
            if (last && last.info2 === yesterday) {
              last.info2 = iso;
            } else {
              rows.push({ category: "cycle", info1: iso, info2: iso });
            }
          }

          await persist();
          render();
          ctx.toast("Saved");
          close(true);
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        card.appendChild(actions);
      });
    }

    render();

    return {
      async save() {
        await persist();
        ctx.toast("Calendar saved");
      },
    };
  },
};
