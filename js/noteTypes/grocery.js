// =========================================================
// Grocery list note type
// - one CSV per list instance: grocerylist_<date>.csv
//   columns: item, checked, valid
// - shared inventory across all grocery lists: grocery_inventory.csv
//   first column = item name; other columns are left untouched.
// =========================================================
import { readTable, writeTable, todayISO } from "../store.js";
import { buildChecklistUI } from "./checklistShared.js";

const INVENTORY_FILE = "grocery_inventory.csv";
const LIST_HEADERS = ["item", "checked", "valid"];

export const groceryType = {
  id: "grocery",
  label: "Grocery",
  groupLabel: "Grocery lists",
  singleton: false,
  showInCreateMenu: true,

  /** Called from the "+" menu. Creates a new dated grocery list. */
  async createInstance(store, ctx) {
    const date = todayISO();
    let name = date;
    let file = `grocerylist_${date}.csv`;
    // avoid clobbering an existing same-day list
    const existing = await store.listNoteRecords();
    let n = 2;
    while (existing.some(r => r.file === file)) {
      name = `${date} (${n})`;
      file = `grocerylist_${date}-${n}.csv`;
      n++;
    }
    await writeTable(file, LIST_HEADERS, []);
    return await store.createNoteRecord({ type: "grocery", name, file });
  },

  subtitleFor(record) {
    return record.name;
  },

  async mount({ subheader, body, footer, setTitle }, record, ctx) {
    setTitle(`Grocery — ${record.name}`);

    const [inventory, list] = await Promise.all([
      readTable(INVENTORY_FILE, ["item"]),
      readTable(record.file, LIST_HEADERS),
    ]);

    const rows = list.rows.map(r => ({ ...r }));
    const inventoryCol = inventory.headers[0] || "item";

    async function addToInventoryIfNew(itemName) {
      const already = inventory.rows.some(
        r => (r[inventoryCol] || "").trim().toLowerCase() === itemName.toLowerCase()
      );
      if (!already) {
        const blank = {};
        inventory.headers.forEach(h => (blank[h] = ""));
        blank[inventoryCol] = itemName;
        inventory.rows.push(blank);
        await writeTable(INVENTORY_FILE, inventory.headers, inventory.rows);
      }
    }

    const ui = buildChecklistUI({
      body,
      rows,
      getLabel: r => r.item,
      onAdd: async (text) => {
        rows.push({ item: text, checked: "false", valid: "true" });
        await addToInventoryIfNew(text);
      },
      showSuggestions: true,
      suggestions: () => inventory.rows.map(r => r[inventoryCol]).filter(Boolean),
    });

    return {
      async save() {
        await writeTable(record.file, LIST_HEADERS, rows);
        ctx.toast("Grocery list saved");
      },
      print() {
        return {
          title: `Grocery — ${record.name}`,
          subtitle: record.name,
          sections: [
            {
              items: rows
                .filter(r => r.valid !== "false")
                .map(r => ({ text: r.item, checked: r.checked === "true" })),
            },
          ],
        };
      },
    };
  },
};
