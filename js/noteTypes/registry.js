// =========================================================
// Note type registry.
//
// To add a new note type: build a module with the same shape as
// the ones below (id, label, groupLabel, singleton,
// showInCreateMenu, optional ensure/createInstance, subtitleFor,
// async mount(elements, record, ctx)) and add it to NOTE_TYPES.
// Nothing else in the app needs to change.
// =========================================================
import { groceryType } from "./grocery.js";
import { todoType } from "./todo.js";
import { wishlistType } from "./wishlist.js";
import { researchType } from "./research.js";
import { readingType } from "./reading.js";
import { recipeType } from "./recipe.js";
import { packingType } from "./packing.js";

export const NOTE_TYPES = [groceryType, todoType, wishlistType, researchType, readingType, recipeType, packingType];

export function getNoteType(id) {
  return NOTE_TYPES.find(t => t.id === id) || null;
}

export function getCreatableTypes() {
  return NOTE_TYPES.filter(t => t.showInCreateMenu);
}

export function getSingletonTypes() {
  return NOTE_TYPES.filter(t => t.singleton);
}
