// =========================================================
// Recipe book note type
// - single instance ("recipebook.csv"), created automatically.
// - one row per recipe. Ingredients and steps are NOT separate
//   rows (CSV here is one row per recipe, wide-format) - they're
//   numbered "slot" columns: ingredient 1/quantity 1 ... ingredient
//   N/quantity N, and step 1 ... step N.
// - "valid ingredients" / "valid steps" hold a comma-separated list
//   of which slot numbers are currently in use for that recipe
//   (e.g. "1,2,4" if slot 3 was deleted) - deleting a slot just
//   drops it from that list rather than shifting columns, but the
//   editor always *displays* steps renumbered 1..k in slot order,
//   so deleting step 3 visually turns step 4 into step 3.
// - starts with 20 slots' worth of columns; if a recipe ever needs
//   more, new columns are appended to every row automatically.
// - columns: category, recipe, ingredient 1, quantity 1, ...,
//   ingredient N, quantity N, step 1, ..., step N,
//   valid ingredients, valid steps, valid
// =========================================================
import { readTable, writeTable } from "../store.js";

const FILE = "recipebook.csv";
const BASE_CAPACITY = 20;

function buildHeaders(capacity) {
  const headers = ["category", "recipe"];
  for (let n = 1; n <= capacity; n++) headers.push(`ingredient ${n}`, `quantity ${n}`);
  for (let n = 1; n <= capacity; n++) headers.push(`step ${n}`);
  headers.push("valid ingredients", "valid steps", "valid");
  return headers;
}

function capacityFromHeaders(headers) {
  let max = BASE_CAPACITY;
  headers.forEach(h => {
    const m = /^ingredient (\d+)$/.exec(h) || /^step (\d+)$/.exec(h);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max;
}

function parseSlots(str) {
  return (str || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0);
}

function stringifySlots(arr) {
  return arr.slice().sort((a, b) => a - b).join(",");
}

export const recipeType = {
  id: "recipe",
  label: "Recipe Book",
  groupLabel: "Recipe book",
  singleton: true,
  showInCreateMenu: false,
  printable: false, // may get a dedicated print layout later

  async ensure(store) {
    return await store.ensureSingletonNote("recipe", "Recipe Book", FILE, buildHeaders(BASE_CAPACITY));
  },

  subtitleFor() {
    return null;
  },

  async mount({ body, setTitle }, record, ctx) {
    setTitle("Recipe Book");

    const table = await readTable(FILE, buildHeaders(BASE_CAPACITY));
    const rows = table.rows.map(r => ({ ...r }));
    let headers = table.headers.slice();
    let capacity = capacityFromHeaders(headers);

    function ensureCapacity(needed) {
      if (needed <= capacity) return;
      capacity = needed;
      headers = buildHeaders(capacity);
    }

    async function persist() {
      await writeTable(FILE, headers, rows);
    }

    function isValid(r) {
      return r.valid !== "false";
    }

    // ---------------- main list (collapsible categories) ----------------
    const collapsed = new Set();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "icon-btn icon-btn-accent";
    addBtn.style.marginBottom = "14px";
    addBtn.textContent = "+";
    addBtn.setAttribute("aria-label", "Add recipe");
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
        empty.textContent = "No recipes yet.";
        listWrap.appendChild(empty);
      }

      categories.forEach(cat => {
        const section = document.createElement("div");
        section.className = "recipe-category";

        const header = document.createElement("button");
        header.type = "button";
        header.className = "recipe-category-header";
        header.textContent = (collapsed.has(cat) ? "\u25b8 " : "\u25be ") + cat;
        header.addEventListener("click", () => {
          if (collapsed.has(cat)) collapsed.delete(cat);
          else collapsed.add(cat);
          render();
        });
        section.appendChild(header);

        if (!collapsed.has(cat)) {
          const items = document.createElement("div");
          items.className = "recipe-category-items";
          active.filter(r => r.category === cat).forEach(r => {
            const row = document.createElement("div");
            row.className = "research-item-row";

            const bullet = document.createElement("span");
            bullet.className = "research-bullet";

            const name = document.createElement("div");
            name.className = "research-topic";
            name.textContent = r.recipe;
            name.addEventListener("click", () => openRecipeEditor(r, false));

            row.appendChild(bullet);
            row.appendChild(name);
            items.appendChild(row);
          });
          section.appendChild(items);
        }

        listWrap.appendChild(section);
      });
    }

    // ---------------- recipe editor modal ----------------
    async function openRecipeEditor(existingRow, isNew) {
      const source = isNew
        ? { category: "", recipe: "", "valid ingredients": "", "valid steps": "", valid: "true" }
        : existingRow;

      let category = source.category || "";
      let recipeName = source.recipe || "";
      const ingredientSlots = parseSlots(source["valid ingredients"]);
      const stepSlots = parseSlots(source["valid steps"]);
      const ingredientData = {};
      ingredientSlots.forEach(s => {
        ingredientData[s] = { name: source[`ingredient ${s}`] || "", qty: source[`quantity ${s}`] || "" };
      });
      const stepData = {};
      stepSlots.forEach(s => { stepData[s] = source[`step ${s}`] || ""; });

      const existingCategories = [...new Set(rows.filter(isValid).map(r => r.category))];

      await ctx.customModal((card, close) => {
        const title = document.createElement("div");
        title.className = "modal-title";
        title.textContent = isNew ? "New recipe" : "Edit recipe";
        card.appendChild(title);

        const modalBody = document.createElement("div");
        modalBody.className = "modal-body";
        card.appendChild(modalBody);

        // -- category / recipe name --
        const catLabel = document.createElement("label");
        catLabel.textContent = "Category";
        const catInput = document.createElement("input");
        catInput.type = "text";
        catInput.value = category;
        catInput.placeholder = "New or existing category";
        if (existingCategories.length) {
          const dl = document.createElement("datalist");
          dl.id = "recipe-category-options";
          existingCategories.forEach(c => {
            const o = document.createElement("option");
            o.value = c;
            dl.appendChild(o);
          });
          modalBody.appendChild(dl);
          catInput.setAttribute("list", "recipe-category-options");
        }
        catInput.addEventListener("input", () => { category = catInput.value; });

        const nameLabel = document.createElement("label");
        nameLabel.textContent = "Recipe name";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = recipeName;
        nameInput.placeholder = "Recipe name";
        nameInput.addEventListener("input", () => { recipeName = nameInput.value; });

        modalBody.appendChild(catLabel);
        modalBody.appendChild(catInput);
        modalBody.appendChild(nameLabel);
        modalBody.appendChild(nameInput);

        // -- ingredients --
        const ingTitle = document.createElement("div");
        ingTitle.className = "recipe-modal-section-title";
        ingTitle.textContent = "Ingredients";
        modalBody.appendChild(ingTitle);

        const ingList = document.createElement("div");
        modalBody.appendChild(ingList);

        function renderIngredients() {
          ingList.innerHTML = "";
          ingredientSlots.forEach(s => {
            const row = document.createElement("div");
            row.className = "recipe-ingredient-row";

            const nameEl = document.createElement("input");
            nameEl.type = "text";
            nameEl.placeholder = "Ingredient";
            nameEl.value = ingredientData[s].name;
            nameEl.addEventListener("input", () => { ingredientData[s].name = nameEl.value; });

            const qtyEl = document.createElement("input");
            qtyEl.type = "text";
            qtyEl.placeholder = "Qty";
            qtyEl.className = "recipe-qty-input";
            qtyEl.value = ingredientData[s].qty;
            qtyEl.addEventListener("input", () => { ingredientData[s].qty = qtyEl.value; });

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "item-remove";
            removeBtn.textContent = "\u2212";
            removeBtn.setAttribute("aria-label", "Remove ingredient");
            removeBtn.addEventListener("click", () => {
              const idx = ingredientSlots.indexOf(s);
              if (idx > -1) ingredientSlots.splice(idx, 1);
              delete ingredientData[s];
              renderIngredients();
            });

            row.appendChild(nameEl);
            row.appendChild(qtyEl);
            row.appendChild(removeBtn);
            ingList.appendChild(row);
          });
        }
        renderIngredients();

        const addIngBtn = document.createElement("button");
        addIngBtn.type = "button";
        addIngBtn.className = "recipe-add-row-btn";
        addIngBtn.textContent = "+ Add ingredient";
        addIngBtn.addEventListener("click", () => {
          const nextSlot = ingredientSlots.length ? Math.max(...ingredientSlots) + 1 : 1;
          ingredientSlots.push(nextSlot);
          ingredientData[nextSlot] = { name: "", qty: "" };
          renderIngredients();
        });
        modalBody.appendChild(addIngBtn);

        // -- steps --
        const stepTitle = document.createElement("div");
        stepTitle.className = "recipe-modal-section-title";
        stepTitle.textContent = "Steps";
        modalBody.appendChild(stepTitle);

        const stepList = document.createElement("div");
        modalBody.appendChild(stepList);

        function renderSteps() {
          stepList.innerHTML = "";
          // display order follows slot order but is renumbered 1..k
          stepSlots.forEach((s, i) => {
            const row = document.createElement("div");
            row.className = "recipe-step-row";

            const num = document.createElement("div");
            num.className = "recipe-step-num";
            num.textContent = String(i + 1);

            const textEl = document.createElement("textarea");
            textEl.className = "recipe-step-input";
            textEl.placeholder = `Step ${i + 1}`;
            textEl.value = stepData[s];
            textEl.addEventListener("input", () => { stepData[s] = textEl.value; });

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "item-remove";
            removeBtn.textContent = "\u2212";
            removeBtn.setAttribute("aria-label", "Remove step");
            removeBtn.addEventListener("click", () => {
              const idx = stepSlots.indexOf(s);
              if (idx > -1) stepSlots.splice(idx, 1);
              delete stepData[s];
              renderSteps(); // remaining steps renumber automatically
            });

            row.appendChild(num);
            row.appendChild(textEl);
            row.appendChild(removeBtn);
            stepList.appendChild(row);
          });
        }
        renderSteps();

        const addStepBtn = document.createElement("button");
        addStepBtn.type = "button";
        addStepBtn.className = "recipe-add-row-btn";
        addStepBtn.textContent = "+ Add step";
        addStepBtn.addEventListener("click", () => {
          const nextSlot = stepSlots.length ? Math.max(...stepSlots) + 1 : 1;
          stepSlots.push(nextSlot);
          stepData[nextSlot] = "";
          renderSteps();
        });
        modalBody.appendChild(addStepBtn);

        // -- footer buttons --
        const actions = document.createElement("div");
        actions.className = "modal-actions";

        const saveBtn = document.createElement("button");
        saveBtn.className = "btn-primary";
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", async () => {
          const trimmedCategory = category.trim();
          const trimmedName = recipeName.trim();
          if (!trimmedCategory || !trimmedName) return;

          const maxSlotNeeded = Math.max(0, ...ingredientSlots, ...stepSlots);
          ensureCapacity(maxSlotNeeded);

          const newRow = {
            category: trimmedCategory,
            recipe: trimmedName,
            "valid ingredients": stringifySlots(ingredientSlots),
            "valid steps": stringifySlots(stepSlots),
            valid: "true",
          };
          ingredientSlots.forEach(s => {
            newRow[`ingredient ${s}`] = ingredientData[s].name;
            newRow[`quantity ${s}`] = ingredientData[s].qty;
          });
          stepSlots.forEach(s => { newRow[`step ${s}`] = stepData[s]; });

          if (isNew) {
            rows.push(newRow);
          } else {
            const idx = rows.indexOf(existingRow);
            if (idx > -1) rows[idx] = newRow;
          }

          await persist();
          render();
          ctx.toast(isNew ? "Recipe added" : "Recipe saved");
          close(true);
        });
        actions.appendChild(saveBtn);

        if (isNew) {
          const cancelBtn = document.createElement("button");
          cancelBtn.className = "btn-neutral";
          cancelBtn.textContent = "Cancel";
          cancelBtn.addEventListener("click", () => close(null));
          actions.appendChild(cancelBtn);
        } else {
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "btn-danger";
          deleteBtn.textContent = "Delete";
          deleteBtn.addEventListener("click", async () => {
            existingRow.valid = "false";
            await persist();
            render();
            ctx.toast("Recipe deleted");
            close(true);
          });
          actions.appendChild(deleteBtn);
        }

        card.appendChild(actions);
      });
    }

    addBtn.addEventListener("click", () => openRecipeEditor(null, true));

    render();

    return {
      async save() {
        await persist();
        ctx.toast("Recipe book saved");
      },
    };
  },
};
