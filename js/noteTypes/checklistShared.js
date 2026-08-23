// =========================================================
// Shared checklist widget: checkbox + label + remove button,
// plus an "add new item" row. Used by the grocery list and by
// each block (shopping / wishes) of the wish list.
//
// `rows` is the caller's live array of row objects; this widget
// mutates rows in place (toggle checked, mark invalid on remove,
// push new rows via onAdd) and re-renders itself after each change.
// The caller is responsible for persisting `rows` on Save.
// =========================================================

let datalistCounter = 0;

export function buildChecklistUI({
  body,
  rows,
  filter = () => true,
  getLabel,
  onAdd,
  showSuggestions = false,
  suggestions = () => [],
  addPlaceholder = "Add item",
}) {
  const wrap = document.createElement("div");
  const list = document.createElement("div");
  list.className = "item-list";
  wrap.appendChild(list);

  const addRow = document.createElement("div");
  addRow.className = "add-row";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = addPlaceholder;

  let datalistEl = null;
  if (showSuggestions) {
    const listId = `dl-${++datalistCounter}`;
    datalistEl = document.createElement("datalist");
    datalistEl.id = listId;
    input.setAttribute("list", listId);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add";

  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  wrap.appendChild(addRow);
  if (datalistEl) wrap.appendChild(datalistEl);

  function isValid(r) {
    return r.valid !== "false";
  }

  function render() {
    list.innerHTML = "";
    if (datalistEl) {
      datalistEl.innerHTML = "";
      suggestions().forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        datalistEl.appendChild(opt);
      });
    }
    rows.filter(r => isValid(r) && filter(r)).forEach(r => {
      const row = document.createElement("div");
      row.className = "item-row";

      const checked = r.checked === "true";
      const check = document.createElement("button");
      check.type = "button";
      check.className = "item-check" + (checked ? " checked" : "");
      check.setAttribute("aria-label", "Toggle complete");
      check.textContent = "\u2713";
      check.addEventListener("click", () => {
        r.checked = checked ? "false" : "true";
        render();
      });

      const label = document.createElement("div");
      label.className = "item-label" + (checked ? " checked" : "");
      label.textContent = getLabel(r);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "item-remove";
      remove.setAttribute("aria-label", "Delete item");
      remove.textContent = "\u2212";
      remove.addEventListener("click", () => {
        r.valid = "false";
        render();
      });

      row.appendChild(check);
      row.appendChild(label);
      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  async function submitAdd() {
    const value = input.value.trim();
    if (!value) return;
    await onAdd(value);
    input.value = "";
    render();
  }

  addBtn.addEventListener("click", submitAdd);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submitAdd(); }
  });

  render();
  body.appendChild(wrap);
  return { rerender: render };
}
