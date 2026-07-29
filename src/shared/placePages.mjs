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
import { escapeHtml, photoUrl } from "./photoMeta.mjs";
import { sizedImageUrl, thumbnailSrcSet } from "./imageUrl.mjs";

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
 * Shared page chrome. Styling is inlined rather than pulled from the app's
 * hashed CSS bundle: these pages have no build-time knowledge of asset
 * filenames, and a hub page is a handful of rules.
 */
function layout({ title, description, canonical, jsonLd, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${e(title)}</title>
    <link rel="canonical" href="${e(canonical)}" />
    <meta name="description" content="${e(description)}" />
    <meta name="theme-color" content="#000000" />
    <link rel="icon" href="/favicon-white.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${e(title)}" />
    <meta property="og:description" content="${e(description)}" />
    <meta property="og:url" content="${e(canonical)}" />
    <meta property="og:image" content="https://abstractaltitudes.com/og-image.jpg" />
    <script type="application/ld+json">
${jsonLd.replace(/</g, "\\u003c")}
    </script>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 2rem 1.25rem 4rem;
        background: #000; color: #fff;
        font-family: "Inter Variable", Inter, system-ui, -apple-system,
          "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-weight: 300; line-height: 1.6;
      }
      .wrap { max-width: 1100px; margin: 0 auto; }
      nav { font-size: .85rem; opacity: .65; margin-bottom: 2rem; }
      nav a { color: inherit; }
      h1 { font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 400; margin: 0 0 .5rem; }
      h2 { font-size: 1.1rem; font-weight: 400; margin: 2.5rem 0 1rem; opacity: .85; }
      p.lede { opacity: .7; margin: 0 0 2rem; max-width: 60ch; }
      a { color: #4da6ff; text-decoration: none; }
      a:hover { text-decoration: underline; }
      ul.grid {
        list-style: none; padding: 0; margin: 0;
        display: grid; gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      }
      ul.grid img {
        width: 100%; aspect-ratio: 3 / 2; object-fit: cover;
        border-radius: .4rem; display: block; background: #111;
      }
      ul.grid a { color: inherit; display: block; }
      ul.grid span { display: block; font-size: .85rem; opacity: .7; margin-top: .5rem; }
      ul.links { list-style: none; padding: 0; margin: 0; }
      ul.links li { margin: .4rem 0; }
      footer { margin-top: 4rem; font-size: .85rem; opacity: .55; }
    </style>
  </head>
  <body>
    <div class="wrap">
${body}
      <footer><a href="/">← Back to Abstract Altitudes</a></footer>
    </div>
  </body>
</html>
`;
}

/**
 * Renders a thumbnail grid linking into the SPA's photo pages, capped at
 * MAX_PHOTOS_PER_GRID with a note when it truncates.
 */
function photoGrid(items, origin) {
  const shown = items.slice(0, MAX_PHOTOS_PER_GRID);
  const hidden = items.length - shown.length;
  const note = hidden
    ? `\n      <p class="lede">Showing the ${shown.length} most recent of ${items.length}.</p>`
    : "";

  const cells = shown
    .map(
      (item) => `        <li>
          <a href="${e(photoUrl(item, origin))}">
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

function breadcrumbJsonLd(trail, origin) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: trail.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: `${origin}${crumb.path}`,
      })),
    },
    null,
    2,
  );
}

function breadcrumbHtml(trail) {
  return `      <nav>${trail
    .map((crumb, i) =>
      i === trail.length - 1
        ? e(crumb.name)
        : `<a href="${e(crumb.path)}">${e(crumb.name)}</a> ›`,
    )
    .join(" ")}</nav>`;
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

  const countries = [...byCountry.entries()]
    .map(([country, list]) => ({ country, list, slug: slugify(country) }))
    .filter((entry) => entry.slug && entry.list.length >= MIN_PHOTOS_PER_PAGE)
    .sort((a, b) => b.list.length - a.list.length);

  if (countries.length === 0) return [];

  // ---- /places/ ----------------------------------------------------------
  const indexTrail = [
    { name: "Abstract Altitudes", path: "/" },
    { name: "Places", path: "/places/" },
  ];
  pages.push({
    path: "places",
    html: layout({
      title: "Aerial Photography by Location | Abstract Altitudes",
      description: `Browse drone photography by country — ${countries
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
      </ul>`,
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
        description: `${list.length} drone photographs and 360° panoramas captured across ${country}.`,
        canonical: `${origin}/places/${slug}/`,
        jsonLd: breadcrumbJsonLd(countryTrail, origin),
        body: `${breadcrumbHtml(countryTrail)}
      <h1>Aerial photography of ${e(country)}</h1>
      <p class="lede">${list.length} drone photograph${list.length === 1 ? "" : "s"} and 360° panoramas captured across ${e(country)}.</p>
${regionLinks}
      <h2>Photographs</h2>
${photoGrid(countryGridOrder(list, bigRegions), origin)}`,
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
          description: `${rList.length} drone photographs and 360° panoramas captured in ${region}, ${country}.`,
          canonical: `${origin}/places/${slug}/${rSlug}/`,
          jsonLd: breadcrumbJsonLd(regionTrail, origin),
          body: `${breadcrumbHtml(regionTrail)}
      <h1>Aerial photography of ${e(region)}</h1>
      <p class="lede">${rList.length} drone photograph${rList.length === 1 ? "" : "s"} and 360° panoramas captured in ${e(region)}, ${e(country)}.</p>
${photoGrid(rList, origin)}`,
        }),
      });
    }
  }

  return pages;
}
