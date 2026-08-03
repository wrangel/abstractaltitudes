// src/shared/licensePage.mjs
//
// Builds /license/ — the page every photo's structured data points at via
// `license` and `acquireLicensePage`.
//
// Google Search Console flags both as missing otherwise, and together they are
// what earns the "Licensable" badge in Google Images: a visible marker plus a
// "Get this image" link straight to these terms. For a portfolio that licenses
// its work, that turns image search into an enquiry channel.
//
// Terms are all-rights-reserved with enquiries by email — a deliberate choice,
// not a default. Changing the stance means editing this page AND the
// `license`/`acquireLicensePage` values in photoMeta.mjs together.

import { layout, breadcrumbJsonLd, breadcrumbHtml } from "./staticPage.mjs";

export const CONTACT_EMAIL = "contact@abstractaltitudes.anonaddy.com";

/** Absolute URL of the licence page — used by the ImageObject JSON-LD. */
export function licenseUrl(origin) {
  return `${origin}/license/`;
}

/**
 * @param {string} origin - Site origin, no trailing slash.
 * @returns {{path: string, html: string}} Page to write under build/.
 */
export function buildLicensePage(origin) {
  const trail = [
    { name: "Abstract Altitudes", path: "/" },
    { name: "Licensing", path: "/license/" },
  ];

  return {
    path: "license",
    html: layout({
      title: "Image Licensing | Abstract Altitudes",
      description:
        "Licensing terms for the aerial photography on Abstract Altitudes. All images are copyright protected; prints and commercial licences are available on request.",
      canonical: licenseUrl(origin),
      jsonLd: breadcrumbJsonLd(trail, origin),
      body: `${breadcrumbHtml(trail)}
      <h1>Image licensing</h1>
      <p class="lede">Every photograph and 360° panorama on this site is an original work, created and owned by Abstract Altitudes.</p>

      <h2>Copyright</h2>
      <p>All images are protected by copyright. They may not be copied, reproduced, republished, redistributed, modified, or used to train machine-learning models without prior written permission.</p>
      <p>Viewing the images in your browser is of course fine. Saving, reposting, or using them — personally or commercially — is not, unless you have asked first.</p>

      <h2>Licensing and prints</h2>
      <p>Licences are available for editorial, commercial and personal use, and prints can be arranged. Tell me which image you have in mind, where it would appear, and for how long, and you will get a straight answer on availability and price.</p>
      <p><a href="mailto:${CONTACT_EMAIL}?subject=Image%20licensing%20enquiry">${CONTACT_EMAIL}</a></p>

      <h2>Attribution</h2>
      <p>Where a licence is granted, please credit <strong>Abstract Altitudes</strong> and, where the medium allows, link back to <a href="/">abstractaltitudes.com</a>.</p>

      <p class="lede">This page describes the terms in plain language; it is not a contract. The specific licence agreed in writing for a given image takes precedence.</p>`,
    }),
  };
}
