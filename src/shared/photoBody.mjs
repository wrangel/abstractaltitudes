// src/shared/photoBody.mjs
//
// Visible content for each prerendered photo page, written into #root.
//
// Until 2026-11 a photo page's body was only "You need to enable JavaScript
// to run this app." The title and description lived in <head>, but the page
// itself had no photo, no text and no links — and once Google ran the
// JavaScript, every photo page rendered the same gallery with one photo open
// on top. To Google that was 119 near-identical pages: Search Console listed
// 41 as "crawled – currently not indexed" and 21 as duplicates of another
// page.
//
// Now each page carries its own photo, heading, description, facts, links to
// its place pages and to neighbouring photos. src/index.jsx uses createRoot
// (not hydrateRoot), so React simply replaces all of this when the app starts:
// visitors with JavaScript see no difference, while crawlers, link previews
// and visitors without JavaScript get a real page.

import { escapeHtml } from "./escape.mjs";
import { describeItem, formatPlace } from "./describeItem.mjs";
import { sizedImageUrl, thumbnailSrcSet } from "./imageUrl.mjs";
import { photoTitle, photoDescription, photoPath } from "./photoMeta.mjs";
import { slugify } from "./slug.mjs";

const e = escapeHtml;

/** Page title without the brand suffix — the heading, not the tab label. */
export function photoHeading(item) {
  return photoTitle(item).replace(/\s*\|\s*Abstract Altitudes$/, "");
}

/**
 * Place pages this photo belongs to that actually exist. buildPlacePages only
 * writes a country or region page from MIN_PHOTOS_PER_PAGE photos up, so
 * linking by name alone would produce dead links for small places.
 *
 * @param {Object} item - Portfolio item.
 * @param {Set<string>} existingPaths - "/places/<country>/" style paths written.
 * @returns {Array<{name: string, path: string}>} Country first, then region.
 */
export function placeLinks(item, existingPaths) {
  const links = [];
  const country = slugify(item?.country ?? "");
  if (!country) return links;
  const countryPath = `/places/${country}/`;
  if (existingPaths.has(countryPath)) links.push({ name: item.country, path: countryPath });
  const region = slugify(item?.region ?? "");
  const regionPath = `/places/${country}/${region}/`;
  if (region && existingPaths.has(regionPath)) links.push({ name: item.region, path: regionPath });
  return links;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

/**
 * When the photo was taken, in the camera's local time. The slug ends in it
 * ("…-hd-20240726-155734"); item.dateTime holds the same moment in UTC, which
 * reads two hours off for a Swiss summer photo and can even fall on the
 * previous day for a late-evening one. The time is also what tells apart
 * frames of one scene shot minutes apart — five from one hover over Trégastel
 * would otherwise carry identical text.
 */
export function captureMoment(item) {
  const m = item?.slug?.match(/-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\d{2}$/);
  if (m) {
    const [, y, mo, d, h, mi] = m;
    const month = MONTHS[Number(mo) - 1];
    if (month) return `${Number(d)} ${month} ${y}, ${h}:${mi}`;
  }
  const d = item?.dateTime ? new Date(item.dateTime) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";
}

/**
 * The HTML that goes inside <div id="root"> of one photo page.
 *
 * @param {Object} item - Portfolio item (slug, thumbnailUrl, place fields).
 * @param {Object} ctx
 * @param {Array<{name: string, path: string}>} [ctx.places] - From placeLinks.
 * @param {Object} [ctx.previous] - Neighbouring item in gallery order.
 * @param {Object} [ctx.next] - Neighbouring item in gallery order.
 * @returns {string} HTML, all values escaped, all links host-relative.
 */
export function buildPhotoBody(item, { places = [], previous, next } = {}) {
  const heading = photoHeading(item);
  const place = formatPlace(item);
  const date = captureMoment(item);
  const altitude =
    typeof item?.altitude === "number" && Number.isFinite(item.altitude)
      ? `${item.altitude.toFixed(0)} m above sea level`
      : "";
  const kind = item?.viewer === "pano" ? "360° aerial panorama" : "Aerial drone photograph";

  const crumbs = [{ name: "Abstract Altitudes", path: "/" }, { name: "Places", path: "/places/" }, ...places]
    .map((c) => `<a href="${e(c.path)}">${e(c.name)}</a>`)
    .join(" › ");

  const facts = [
    place && ["Place", places.length
      ? `${e(place)} (${places.map((p) => `<a href="${e(p.path)}">more from ${e(p.name)}</a>`).join(", ")})`
      : e(place)],
    date && ["Captured", e(date)],
    altitude && ["Altitude", e(altitude)],
    ["Type", e(kind)],
  ].filter(Boolean)
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");

  const neighbour = (other, rel, arrow) =>
    other?.slug
      ? `<a rel="${rel}" href="${e(photoPath(other))}">${arrow === "←" ? "← " : ""}${e(photoHeading(other))}${arrow === "→" ? " →" : ""}</a>`
      : "";
  const pager = [neighbour(previous, "prev", "←"), neighbour(next, "next", "→")].filter(Boolean).join(" · ");

  // Inline styles: this markup exists only until React mounts (or for good
  // without JavaScript), and it must not depend on the app's hashed CSS.
  return `<main class="prerendered-photo" style="max-width:960px;margin:0 auto;padding:1.5rem 1rem;line-height:1.5">
<nav aria-label="Breadcrumb" style="font-size:.9rem;opacity:.75">${crumbs}</nav>
<h1 style="font-size:1.6rem;font-weight:500;margin:.75rem 0">${e(heading)}</h1>
<figure style="margin:0">
<img src="${e(sizedImageUrl(item.thumbnailUrl, 960))}" srcset="${e(thumbnailSrcSet(item.thumbnailUrl))}" sizes="(max-width: 960px) 100vw, 960px" alt="${e(describeItem(item))}" decoding="async" style="width:100%;height:auto;border-radius:.4rem">
<figcaption style="margin-top:.5rem">${e(photoDescription(item))}</figcaption>
</figure>
<dl style="display:grid;grid-template-columns:max-content 1fr;gap:.25rem 1rem;margin:1.25rem 0">${facts}</dl>
<p>The full-resolution, zoomable ${item?.viewer === "pano" ? "panorama" : "image"} opens on this page with JavaScript enabled. © Abstract Altitudes — see <a href="/license/">licensing</a> for use and prints.</p>
${pager ? `<nav aria-label="More photos" style="margin-top:1rem">${pager}</nav>` : ""}
</main>`;
}
