// src/shared/staticPage.mjs
//
// Chrome shared by the standalone prerendered pages (/places/ hubs, /license/).
// These deliberately do NOT boot the SPA: React replaces the contents of #root
// on mount, so anything rendered there would vanish and take the crawlable
// content with it. Keeping them plain also makes them near-instant for someone
// arriving cold from a search result.

import { escapeHtml } from "./escape.mjs";

const e = escapeHtml;

/**
 * Shared page chrome. Styling is inlined rather than pulled from the app's
 * hashed CSS bundle: these pages have no build-time knowledge of asset
 * filenames, and a hub page is a handful of rules.
 */
export function layout({ title, description, canonical, jsonLd, body }) {
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

export function breadcrumbJsonLd(trail, origin) {
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

export function breadcrumbHtml(trail) {
  return `      <nav>${trail
    .map((crumb, i) =>
      i === trail.length - 1
        ? e(crumb.name)
        : `<a href="${e(crumb.path)}">${e(crumb.name)}</a> ›`,
    )
    .join(" ")}</nav>`;
}
