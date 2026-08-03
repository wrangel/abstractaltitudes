// src/shared/placePages.mjs
//
// Builds the /places/ hub pages: an index of countries, one page per country,
// and one per region that has enough photos to be worth a page of its own.
//
// These are standalone static documents — they deliberately do NOT boot the
// SPA. The React app replaces the contents of #root on mount, so any markup
// rendered there would vanish the moment the bundle ran, taking the crawlable
// content with it. Keeping them plain also makes them near-instant for a
// visitor arriving cold from a search result, and every thumbnail links into
// /photo/<slug>/, which is a real SPA page.

import { slugify } from "./slug.mjs";
import { describeItem } from "./describeItem.mjs";
import { photoPath } from "./photoMeta.mjs";
import { escapeHtml } from "./escape.mjs";
import { sizedImageUrl, thumbnailSrcSet } from "./imageUrl.mjs";
import { layout, breadcrumbHtml, breadcrumbJsonLd } from "./staticPage.mjs";

// Below this, a hub page is thinner than the pages it links to, which is the
// classic doorway-page smell. Such places still appear on their country page.
export const MIN_PHOTOS_PER_PAGE = 3;

// Upper bound on thumbnails in one grid. Thumbnails are ~1600px webp at a few
// hundred KB each, so an uncapped country grid gets heavy fast as the
// collection grows. Truncation costs nothing in crawl coverage: every photo
// URL is in sitemap.xml regardless, and the region pages below carry the full
// listing. If a single region ever exceeds this, paginate rather than raising it.
export const MAX_PHOTOS_PER_GRID = 48;

const e = escapeHtml;

/** Groups items by a key function, preserving insertion order. */
function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

/**
 * Renders a thumbnail grid linking into the SPA's photo pages, capped at
 * MAX_PHOTOS_PER_GRID with a note when it truncates.
 */
function photoGrid(items) {
  const shown = items.slice(0, MAX_PHOTOS_PER_GRID);
  const hidden = items.length - shown.length;
  const note = hidden
    ? `\n      <p class="lede">Showing the ${shown.length} most recent of ${items.length}.</p>`
    : "";

  const cells = shown
    .map(
      (item) => `        <li>
          <a href="${e(photoPath(item))}">
            <img src="${e(sizedImageUrl(item.thumbnailUrl, 480))}" srcset="${e(thumbnailSrcSet(item.thumbnailUrl))}" sizes="(max-width: 600px) 100vw, 300px" alt="${e(describeItem(item))}" loading="lazy" decoding="async" width="480" height="320" />
            <span>${e(describeItem(item))}</span>
          </a>
        </li>`,
    )
    .join("\n");
  return `${note}\n      <ul class="grid">\n${cells}\n      </ul>`;
}

/**
 * Orders a country's photos for its (capped) grid.
 *
 * Photos whose region did not earn its own page come first, because the
 * country page is the only hub that links them — everything else is reachable
 * via a region page. The remainder fills out the grid so the page still shows
 * a representative spread rather than only the leftovers.
 *
 * @param {Array<Object>} list - All photos in the country.
 * @param {Array<{region: string}>} bigRegions - Regions that got their own page.
 * @returns {Array<Object>} Reordered photos.
 */
function countryGridOrder(list, bigRegions) {
  const covered = new Set(bigRegions.map((r) => r.region));
  return [
    ...list.filter((item) => !covered.has(item.region)),
    ...list.filter((item) => covered.has(item.region)),
  ];
}

/** Joins names as "a, b and c". */
function listNames(names) {
  if (names.length <= 1) return e(names[0] ?? "");
  return `${names.slice(0, -1).map(e).join(", ")} and ${e(names[names.length - 1])}`;
}

/**
 * Description for a hub page, aimed at the 120-160 character window search
 * engines display. Naming the largest regions keeps each country's text
 * genuinely distinct rather than a template with one word swapped.
 */
function placeDescription(count, where, regions) {
  const noun = count === 1 ? "photograph" : "photographs";
  let text = `Browse ${count} aerial drone ${noun} and 360° panoramas captured across ${where}.`;
  const named = regions.slice(0, 3);
  if (named.length) {
    text += ` Includes ${named.slice(0, -1).join(", ")}${named.length > 1 ? " and " : ""}${named[named.length - 1]}.`;
  }
  if (text.length < 120) {
    text += " Shot from above, in high resolution.";
  }
  return text;
}

/**
 * Plans every /places/ page for a set of items.
 *
 * @param {Array<Object>} items - Items with slug, thumbnailUrl and places.
 * @param {string} origin - Site origin, no trailing slash.
 * @returns {Array<{path: string, html: string}>} Pages to write; path is the
 *   directory under build/, e.g. "places/switzerland".
 */
export function buildPlacePages(items, origin) {
  const withCountry = items.filter((item) => item.country && item.slug);
  if (withCountry.length === 0) return [];

  const byCountry = groupBy(withCountry, (item) => item.country);
  const pages = [];

  const allCountries = [...byCountry.entries()]
    .map(([country, list]) => ({ country, list, slug: slugify(country) }))
    .filter((entry) => entry.slug)
    .sort((a, b) => b.list.length - a.list.length);

  const countries = allCountries.filter(
    (entry) => entry.list.length >= MIN_PHOTOS_PER_PAGE,
  );

  if (countries.length === 0) return [];

  // Countries too small for a page of their own. Their photos would otherwise
  // have no internal link at all — the country page that would have carried
  // them does not exist — so the index lists them directly. Keeps the
  // no-thin-pages rule without stranding photos.
  const strays = allCountries
    .filter((entry) => entry.list.length < MIN_PHOTOS_PER_PAGE)
    .flatMap((entry) => entry.list);

  // ---- /places/ ----------------------------------------------------------
  const indexTrail = [
    { name: "Abstract Altitudes", path: "/" },
    { name: "Places", path: "/places/" },
  ];
  pages.push({
    path: "places",
    html: layout({
      title: "Aerial Photography by Location | Abstract Altitudes",
      description: `Browse drone photography by country — ${allCountries
        .map((c) => c.country)
        .join(", ")}.`,
      canonical: `${origin}/places/`,
      jsonLd: breadcrumbJsonLd(indexTrail, origin),
      body: `${breadcrumbHtml(indexTrail)}
      <h1>Aerial photography by location</h1>
      <p class="lede">Every drone photograph and 360° panorama on this site, grouped by where it was captured.</p>
      <ul class="links">
${countries
  .map(
    (c) =>
      `        <li><a href="/places/${e(c.slug)}/">${e(c.country)}</a> — ${c.list.length} photo${c.list.length === 1 ? "" : "s"}</li>`,
  )
  .join("\n")}
      </ul>
${
  strays.length
    ? `      <h2>Elsewhere</h2>
      <p class="lede">Single visits to ${listNames([
        ...new Set(strays.map((s) => s.country)),
      ])} — not enough for a page each, but here they are.</p>
${photoGrid(strays)}`
    : ""
}`,
    }),
  });

  // ---- /places/<country>/ and /places/<country>/<region>/ ----------------
  for (const { country, list, slug } of countries) {
    const countryTrail = [
      { name: "Abstract Altitudes", path: "/" },
      { name: "Places", path: "/places/" },
      { name: country, path: `/places/${slug}/` },
    ];

    const byRegion = groupBy(list, (item) => item.region);
    const bigRegions = [...byRegion.entries()]
      .map(([region, rList]) => ({ region, rList, rSlug: slugify(region) }))
      .filter((r) => r.rSlug && r.rList.length >= MIN_PHOTOS_PER_PAGE)
      .sort((a, b) => b.rList.length - a.rList.length);

    const regionLinks = bigRegions.length
      ? `      <h2>Regions</h2>
      <ul class="links">
${bigRegions
  .map(
    (r) =>
      `        <li><a href="/places/${e(slug)}/${e(r.rSlug)}/">${e(r.region)}</a> — ${r.rList.length} photo${r.rList.length === 1 ? "" : "s"}</li>`,
  )
  .join("\n")}
      </ul>`
      : "";

    pages.push({
      path: `places/${slug}`,
      html: layout({
        title: `Aerial Photography of ${country} | Abstract Altitudes`,
        description: placeDescription(list.length, country, bigRegions.map((r) => r.region)),
        canonical: `${origin}/places/${slug}/`,
        jsonLd: breadcrumbJsonLd(countryTrail, origin),
        body: `${breadcrumbHtml(countryTrail)}
      <h1>Aerial photography of ${e(country)}</h1>
      <p class="lede">${list.length} drone photograph${list.length === 1 ? "" : "s"} and 360° panoramas captured across ${e(country)}.</p>
${regionLinks}
      <h2>Photographs</h2>
${photoGrid(countryGridOrder(list, bigRegions))}`,
      }),
    });

    for (const { region, rList, rSlug } of bigRegions) {
      const regionTrail = [...countryTrail, {
        name: region,
        path: `/places/${slug}/${rSlug}/`,
      }];
      pages.push({
        path: `places/${slug}/${rSlug}`,
        html: layout({
          title: `Aerial Photography of ${region}, ${country} | Abstract Altitudes`,
          description: placeDescription(rList.length, `${region}, ${country}`, []),
          canonical: `${origin}/places/${slug}/${rSlug}/`,
          jsonLd: breadcrumbJsonLd(regionTrail, origin),
          body: `${breadcrumbHtml(regionTrail)}
      <h1>Aerial photography of ${e(region)}</h1>
      <p class="lede">${rList.length} drone photograph${rList.length === 1 ? "" : "s"} and 360° panoramas captured in ${e(region)}, ${e(country)}.</p>
${photoGrid(rList)}`,
        }),
      });
    }
  }

  return pages;
}
