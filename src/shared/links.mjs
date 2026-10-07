// src/shared/links.mjs
//
// The two places a visitor can reach the person behind the site. Shared so the
// React gallery footer and the prerendered static pages (/places/, /license/)
// cannot drift apart — the address previously existed as a literal in Grid.jsx
// and again as CONTACT_EMAIL in licensePage.mjs.
//
// No Node built-ins here: this is imported by the frontend bundle as well as
// the prerender scripts.

/** Aliased address, so the real mailbox is not published. */
export const CONTACT_EMAIL = "contact@abstractaltitudes.anonaddy.com";

/** mailto: with a subject, so enquiries arrive pre-labelled. */
export function mailtoUrl(subject) {
  return subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`;
}

/** Tip jar. Licensing enquiries go to the email above, not here. */
export const SUPPORT_URL = "https://buymeacoffee.com/wrangel";
export const SUPPORT_LABEL = "Buy me a coffee";

/**
 * Other things I have built. Shown in the gallery footer and mirrored into the
 * Person `sameAs` in index.html, which is what ties the projects to the same
 * entity in a search engine's graph — keep the two lists in step.
 *
 * These point at the repositories because that is where the projects live; a
 * hosted app would be a better link, so swap the href if one gets deployed.
 */
export const PROJECTS = [
  {
    href: "https://github.com/wrangel/krankenkasse",
    label: "Krankenkasse",
    note: "which Swiss health-insurance deductible is cheapest, from the BAG data",
  },
  {
    href: "https://github.com/wrangel/smoothexif",
    label: "smoothexif",
    note: "makes photo filenames, EXIF and Finder dates agree",
  },
];
