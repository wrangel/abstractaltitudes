// src/shared/photoMeta.mjs
//
// Builds the per-photo <head> block that replaces the seo:start/seo:end
// region of index.html, plus the sitemap. Kept free of Node built-ins so the
// Express server could reuse it verbatim if runtime injection is ever added
// alongside the build-time prerender.

import { describeItem, formatPlace } from "./describeItem.mjs";

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

/**
 * Serialises an object for a <script type="application/ld+json"> body.
 *
 * Escapes "<" so a value containing "</script>" cannot break out of the tag.
 *
 * @param {Object} data - JSON-LD payload.
 * @returns {string} Safe JSON text.
 */
function toJsonLd(data) {
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}

/**
 * Canonical page URL for a photo. Trailing slash is deliberate: the prerender
 * writes build/photo/<slug>/index.html, and nginx 301-redirects the
 * slashless form to it. Emitting the post-redirect URL everywhere avoids
 * making every crawl pay for a redirect hop.
 *
 * @param {Object} item - Item with a slug.
 * @param {string} origin - Site origin, no trailing slash.
 * @returns {string} Absolute URL.
 */
export function photoUrl(item, origin) {
  return `${origin}/photo/${item.slug}/`;
}

/**
 * Page title for a photo. Leads with the place, because that is what people
 * actually search for; the brand goes last where it can be truncated safely.
 *
 * @param {Object} item - Portfolio item.
 * @returns {string} Title text (unescaped).
 */
export function photoTitle(item) {
  const place = formatPlace(item);
  if (!place) return "Abstract Altitudes - Aerial Photography";
  const lead =
    item?.viewer === "pano" ? "360° Aerial Panorama" : "Aerial Photograph";
  return `${lead} of ${place} | Abstract Altitudes`;
}

/**
 * Meta description for a photo: what it is, where, how high, and when.
 *
 * @param {Object} item - Portfolio item.
 * @returns {string} Description text (unescaped).
 */
export function photoDescription(item) {
  const base = describeItem(item);
  const captured = item?.dateTime ? new Date(item.dateTime) : null;
  if (!captured || Number.isNaN(captured.getTime())) return `${base}.`;

  const when = captured.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
  });
  return `${base}. Captured ${when} by drone.`;
}

/**
 * Google-friendly ImageObject for the photo.
 *
 * @param {Object} item - Portfolio item.
 * @param {string} origin - Site origin, no trailing slash.
 * @returns {Object} JSON-LD object.
 */
function photoJsonLd(item, origin) {
  const place = formatPlace(item);

  const data = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: photoTitle(item),
    description: photoDescription(item),
    contentUrl: item.thumbnailUrl,
    thumbnailUrl: item.thumbnailUrl,
    url: photoUrl(item, origin),
    creditText: "Abstract Altitudes",
    creator: { "@id": `${origin}/#person` },
    copyrightNotice: "Abstract Altitudes",
  };

  if (item.dateTime) data.dateCreated = new Date(item.dateTime).toISOString();

  if (place) {
    data.contentLocation = {
      "@type": "Place",
      name: place,
      address: {
        "@type": "PostalAddress",
        ...(item.location ? { addressLocality: item.location } : {}),
        ...(item.region ? { addressRegion: item.region } : {}),
        ...(item.country ? { addressCountry: item.country } : {}),
      },
    };
    if (
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude)
    ) {
      data.contentLocation.geo = {
        "@type": "GeoCoordinates",
        latitude: item.latitude,
        longitude: item.longitude,
      };
    }
  }

  return data;
}

/**
 * Builds the full replacement block for one photo page.
 *
 * @param {Object} item - Portfolio item (needs slug, thumbnailUrl, places).
 * @param {string} origin - Site origin, no trailing slash.
 * @returns {string} HTML to substitute between the seo markers.
 */
export function buildPhotoSeoBlock(item, origin) {
  const title = photoTitle(item);
  const description = photoDescription(item);
  const url = photoUrl(item, origin);
  const image = item.thumbnailUrl || `${origin}/logo512.png`;
  const alt = describeItem(item);

  const e = escapeHtml;

  return `<title>${e(title)}</title>
    <link rel="canonical" href="${e(url)}" />
    <meta name="description" content="${e(description)}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Abstract Altitudes" />
    <meta property="og:title" content="${e(title)}" />
    <meta property="og:description" content="${e(description)}" />
    <meta property="og:url" content="${e(url)}" />
    <meta property="og:image" content="${e(image)}" />
    <meta property="og:image:alt" content="${e(alt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${e(title)}" />
    <meta name="twitter:description" content="${e(description)}" />
    <meta name="twitter:image" content="${e(image)}" />
    <meta name="twitter:image:alt" content="${e(alt)}" />

    <script type="application/ld+json">
${toJsonLd(photoJsonLd(item, origin))}
    </script>`;
}

/**
 * Builds sitemap.xml covering the gallery root plus every photo page.
 *
 * Includes the image extension namespace: for a photography portfolio,
 * Google Images is the realistic discovery channel, and it needs the
 * <image:image> entries to associate a photo with its page.
 *
 * @param {Array<Object>} items - Items with slugs.
 * @param {string} origin - Site origin, no trailing slash.
 * @returns {string} XML document.
 */
export function buildSitemap(items, origin) {
  const e = escapeHtml;

  const entries = items
    .filter((item) => item.slug)
    .map((item) => {
      const lastmod = item.dateTime
        ? `\n    <lastmod>${new Date(item.dateTime).toISOString()}</lastmod>`
        : "";
      const image = item.thumbnailUrl
        ? `\n    <image:image>
      <image:loc>${e(item.thumbnailUrl)}</image:loc>
      <image:title>${e(photoTitle(item))}</image:title>
      <image:caption>${e(describeItem(item))}</image:caption>
    </image:image>`
        : "";
      return `  <url>
    <loc>${e(photoUrl(item, origin))}</loc>${lastmod}
    <changefreq>yearly</changefreq>
    <priority>0.7</priority>${image}
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
      xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
      xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <url>
    <loc>${origin}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${entries}
</urlset>
`;
}
