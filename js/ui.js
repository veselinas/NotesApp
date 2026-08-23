// =========================================================
// Generic UI helpers: modal dialogs, toast, and rendering the
// grouped note list on the main menu.
// =========================================================

const modalRoot = document.getElementById("modal-root");

/**
 * Generic modal primitive: you get a blank card and a close(value)
 * function, and build whatever you need into it. showConfirm /
 * showPrompt / showCreateNoteMenu below are all thin wrappers over
 * this; note-type modules needing something richer (e.g. the
 * recipe editor) can call this directly via ctx.customModal.
 */
export function openModal(buildContent) {
  return new Promise((resolve) => {
    modalRoot.innerHTML = "";
    modalRoot.classList.remove("hidden");

    const card = document.createElement("div");
    card.className = "modal-card";
    modalRoot.appendChild(card);

    function close(value) {
      modalRoot.classList.add("hidden");
      modalRoot.innerHTML = "";
      modalRoot.removeEventListener("click", onBackdropClick);
      resolve(value);
    }
    function onBackdropClick(e) {
      if (e.target === modalRoot) close(null);
    }
    modalRoot.addEventListener("click", onBackdropClick);

    buildContent(card, close);
  });
}

/** Simple OK/Cancel confirmation dialog. Resolves to true/false. */
export function showConfirm(title, message, { confirmLabel = "Confirm", danger = true } = {}) {
  return openModal((card, close) => {
    const h = document.createElement("div");
    h.className = "modal-title";
    h.textContent = title;
    const p = document.createElement("div");
    p.className = "modal-body";
    p.textContent = message;

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-neutral";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => close(false));
    const okBtn = document.createElement("button");
    okBtn.className = danger ? "btn-danger" : "btn-primary";
    okBtn.textContent = confirmLabel;
    okBtn.addEventListener("click", () => close(true));

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(actions);
  });
}

/**
 * Small form dialog. `fields` is an array of
 * { name, label, type: 'text'|'textarea', value?, placeholder?, options? }
 * `options` (for type 'text') renders as a <datalist> for autocomplete
 * without restricting free text entry.
 * Resolves to an object of { [name]: value } or null if cancelled.
 */
export function showPrompt({ title, fields, confirmLabel = "Save" }) {
  return openModal((card, close) => {
    const h = document.createElement("div");
    h.className = "modal-title";
    h.textContent = title;
    card.appendChild(h);

    const body = document.createElement("div");
    body.className = "modal-body";
    card.appendChild(body);

    const inputs = {};
    fields.forEach((f, idx) => {
      const label = document.createElement("label");
      label.textContent = f.label;
      body.appendChild(label);

      let el;
      if (f.type === "textarea") {
        el = document.createElement("textarea");
      } else {
        el = document.createElement("input");
        el.type = "text";
        if (f.options && f.options.length) {
          const listId = `prompt-dl-${idx}`;
          const dl = document.createElement("datalist");
          dl.id = listId;
          f.options.forEach(opt => {
            const o = document.createElement("option");
            o.value = opt;
            dl.appendChild(o);
          });
          body.appendChild(dl);
          el.setAttribute("list", listId);
        }
      }
      if (f.placeholder) el.placeholder = f.placeholder;
      if (f.value) el.value = f.value;
      body.appendChild(el);
      inputs[f.name] = el;
    });

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-neutral";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => close(null));
    const okBtn = document.createElement("button");
    okBtn.className = "btn-primary";
    okBtn.textContent = confirmLabel;
    okBtn.addEventListener("click", () => {
      const values = {};
      Object.entries(inputs).forEach(([name, el]) => (values[name] = el.value));
      close(values);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    card.appendChild(actions);

    const firstInput = Object.values(inputs)[0];
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  });
}

/** Note-type picker for the "+" button. Resolves to a type id or null. */
export function showCreateNoteMenu(creatableTypes) {
  return openModal((card, close) => {
    const h = document.createElement("div");
    h.className = "modal-title";
    h.textContent = "New note";
    card.appendChild(h);

    const body = document.createElement("div");
    body.className = "modal-body";
    body.textContent = "Choose a note type.";
    card.appendChild(body);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    actions.style.flexDirection = "column";
    creatableTypes.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "btn-primary";
      btn.textContent = t.label;
      btn.addEventListener("click", () => close(t.id));
      actions.appendChild(btn);
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-neutral";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => close(null));
    actions.appendChild(cancelBtn);
    card.appendChild(actions);
  });
}

let toastTimer = null;
export function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

/**
 * Render the main menu note list, grouped by note type.
 * `groups` is an array of { type, records: [...] }.
 * `handlers` = { onOpen(record), onDelete(record) }
 */
export function renderNoteGroups(container, groups, handlers) {
  container.innerHTML = "";
  groups.forEach(({ type, records }) => {
    if (records.length === 0) return;
    const groupEl = document.createElement("div");
    groupEl.className = "note-group";

    const label = document.createElement("div");
    label.className = "note-group-label";
    label.textContent = type.groupLabel;
    groupEl.appendChild(label);

    const listEl = document.createElement("div");
    listEl.className = "note-card-list";

    records.forEach(record => {
      const row = document.createElement("div");
      row.className = "note-row";

      const openBtn = document.createElement("button");
      openBtn.className = "note-row-open";
      openBtn.addEventListener("click", () => handlers.onOpen(record));

      const nameEl = document.createElement("span");
      nameEl.textContent = type.singleton ? type.label : record.name;
      openBtn.appendChild(nameEl);
      row.appendChild(openBtn);

      if (!type.singleton) {
        const delBtn = document.createElement("button");
        delBtn.className = "note-row-delete";
        delBtn.textContent = "\u2212";
        delBtn.setAttribute("aria-label", "Delete note");
        delBtn.addEventListener("click", () => handlers.onDelete(record));
        row.appendChild(delBtn);
      }

      listEl.appendChild(row);
    });

    groupEl.appendChild(listEl);
    container.appendChild(groupEl);
  });
}
