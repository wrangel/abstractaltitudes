// src/shared/escape.mjs
//
// Lives alone so the page builders can share it without forming an import
// cycle: photoMeta needs licensePage for the licence URL, licensePage needs
// staticPage for the layout, and staticPage needs escaping. Routing that last
// dependency back through photoMeta closed the loop — it happened to work
// because function declarations hoist, but would break the moment one became
// a const arrow.

/**
 * Escapes text for interpolation into an HTML attribute or text node.
 *
 * @param {*} value - Any value; null/undefined become "".
 * @returns {string} Escaped string.
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
