// =========================================================
// Wish list / shopping list note type
// - single instance ("wishlist.csv"), created automatically.
// - one CSV, two sections distinguished by a "section" column:
//   columns: section (shopping|wish), item, checked, valid
// - split screen: shopping on top, wishes below, each
//   independently scrollable, same checkbox/remove UI as
//   groceries but with no inventory suggestions.
// =========================================================
import { readTable, writeTable } from "../store.js";
import { buildChecklistUI } from "./checklistShared.js";

const FILE = "wishlist.csv";
const HEADERS = ["section", "item", "checked", "valid"];

export const wishlistType = {
  id: "wishlist",
  label: "Wish List",
  groupLabel: "Wish list",
  singleton: true,
  showInCreateMenu: false,
  printable: false,

  async ensure(store) {
    return await store.ensureSingletonNote("wishlist", "Wish List", FILE, HEADERS);
  },

  subtitleFor() {
    return null;
  },

  async mount({ body, setTitle }, record, ctx) {
    setTitle("Wish List");

    const table = await readTable(FILE, HEADERS);
    const rows = table.rows.map(r => ({ ...r }));

    const splitView = document.createElement("div");
    splitView.className = "split-view";

    const shoppingBlock = document.createElement("div");
    shoppingBlock.className = "split-block";
    const shoppingLabel = document.createElement("div");
    shoppingLabel.className = "section-label";
    shoppingLabel.textContent = "Shopping";
    const shoppingScroll = document.createElement("div");
    shoppingScroll.className = "split-block-scroll";
    shoppingBlock.appendChild(shoppingLabel);
    shoppingBlock.appendChild(shoppingScroll);

    const divider = document.createElement("div");
    divider.className = "split-divider";

    const wishBlock = document.createElement("div");
    wishBlock.className = "split-block";
    const wishLabel = document.createElement("div");
    wishLabel.className = "section-label";
    wishLabel.textContent = "Wishes";
    const wishScroll = document.createElement("div");
    wishScroll.className = "split-block-scroll";
    wishBlock.appendChild(wishLabel);
    wishBlock.appendChild(wishScroll);

    splitView.appendChild(shoppingBlock);
    splitView.appendChild(divider);
    splitView.appendChild(wishBlock);
    body.appendChild(splitView);

    buildChecklistUI({
      body: shoppingScroll,
      rows,
      filter: r => r.section === "shopping",
      getLabel: r => r.item,
      addPlaceholder: "Add to shopping list",
      onAdd: async (text) => {
        rows.push({ section: "shopping", item: text, checked: "false", valid: "true" });
      },
    });

    buildChecklistUI({
      body: wishScroll,
      rows,
      filter: r => r.section === "wish",
      getLabel: r => r.item,
      addPlaceholder: "Add a wish",
      onAdd: async (text) => {
        rows.push({ section: "wish", item: text, checked: "false", valid: "true" });
      },
    });

    return {
      async save() {
        await writeTable(FILE, HEADERS, rows);
        ctx.toast("Wish list saved");
      },
    };
  },
};
