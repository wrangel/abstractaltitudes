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
