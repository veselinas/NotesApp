// =========================================================
// Generic print support.
//
// Any note type can opt in to printing by returning a print()
// function alongside save() from mount() - see grocery.js,
// todo.js, research.js, packing.js, braindump.js, bulletlist.js,
// and checklist.js for examples. print() returns a small,
// generic "print doc" describing the content, independent of
// each note type's own on-screen DOM:
//
//   {
//     title: string,
//     subtitle?: string,          // e.g. a date, shown under the title
//     sections: [
//       {
//         heading?: string,        // e.g. a category name
//         text?: string,           // free text (e.g. Brain Dump)
//         items?: [
//           {
//             text: string,
//             bullet?: true,        // plain bullet, no checkbox
//             checked?: boolean,    // single checkbox
//             checked2?: boolean,   // a second checkbox (e.g. Packing's
//                                   // "packed after travel" column) -
//                                   // only include this key at all when
//                                   // the item actually has a second box
//           }
//         ]
//       }
//     ]
//   }
//
// This file turns that shape into HTML and hands off to the
// browser's native print dialog - it doesn't know or care what
// note type produced it, so the same renderer serves all of them.
// =========================================================

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str === null || str === undefined ? "" : String(str);
  return div.innerHTML;
}

function renderPrintHTML(doc) {
  let html = `<h1 class="print-title">${escapeHTML(doc.title)}</h1>`;
  if (doc.subtitle) {
    html += `<div class="print-subtitle">${escapeHTML(doc.subtitle)}</div>`;
  }

  (doc.sections || []).forEach(section => {
    html += `<div class="print-section">`;
    if (section.heading) {
      html += `<div class="print-section-heading">${escapeHTML(section.heading)}</div>`;
    }
    if (section.text !== undefined) {
      html += `<div class="print-text">${escapeHTML(section.text)}</div>`;
    }
    if (section.items && section.items.length) {
      html += `<ul class="print-items">`;
      section.items.forEach(item => {
        let marker;
        if (item.bullet) {
          marker = `<span class="print-marker">&bull;</span>`;
        } else {
          const box1 = item.checked ? "\u2611" : "\u2610";
          marker = `<span class="print-marker">${box1}</span>`;
          if (item.checked2 !== undefined) {
            const box2 = item.checked2 ? "\u2611" : "\u2610";
            marker += `<span class="print-marker">${box2}</span>`;
          }
        }
        html += `<li class="print-item">${marker}<span class="print-item-text">${escapeHTML(item.text)}</span></li>`;
      });
      html += `</ul>`;
    }
    html += `</div>`;
  });

  return html;
}

/** Populate the hidden #print-area with a note's content and open the browser print dialog. */
export function triggerPrint(doc) {
  let printArea = document.getElementById("print-area");
  if (!printArea) {
    printArea = document.createElement("div");
    printArea.id = "print-area";
    document.body.appendChild(printArea);
  }
  printArea.innerHTML = renderPrintHTML(doc);
  window.print();
}
