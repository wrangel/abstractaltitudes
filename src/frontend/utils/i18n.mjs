// src/frontend/utils/i18n.jsx
//
// Minimal message lookup for the few strings a visitor only sees when
// something is wrong. Not a general i18n layer — the site itself is English,
// but these messages tell people how to change a device setting, so they are
// worth showing in the language their device is set to.
//
// Apple's own localised names are used for Lockdown Mode, because that is the
// wording the visitor will actually see in Settings:
//   de "Blockierungsmodus" · fr "Mode Isolement" · it "Modalità di isolamento"

const MESSAGES = {
  en: {
    webglTitle: "360° view unavailable",
    webglBody:
      "This panorama needs WebGL, which your browser has turned off. On iPhone and iPad that is almost always Lockdown Mode.",
    webglFix: "Settings → Privacy & Security → Lockdown Mode",
    webglSafari:
      "In Safari you can keep Lockdown Mode on and allow just this site: tap “aA” in the address bar and turn it off for this website. Other browsers have no per-site option.",
  },
  de: {
    webglTitle: "360°-Ansicht nicht verfügbar",
    webglBody:
      "Diese Panorama-Ansicht benötigt WebGL, das Ihr Browser deaktiviert hat. Auf iPhone und iPad ist fast immer der Blockierungsmodus die Ursache.",
    webglFix: "Einstellungen → Datenschutz & Sicherheit → Blockierungsmodus",
    webglSafari:
      "In Safari können Sie den Blockierungsmodus aktiviert lassen und nur diese Website erlauben: Tippen Sie in der Adressleiste auf „aA“ und deaktivieren Sie ihn für diese Website. Andere Browser bieten keine Ausnahme pro Website.",
  },
  fr: {
    webglTitle: "Vue 360° indisponible",
    webglBody:
      "Cette vue panoramique nécessite WebGL, que votre navigateur a désactivé. Sur iPhone et iPad, il s’agit presque toujours du mode Isolement.",
    webglFix: "Réglages → Confidentialité et sécurité → Mode Isolement",
    webglSafari:
      "Dans Safari, vous pouvez laisser le mode Isolement activé et autoriser uniquement ce site : touchez « aA » dans la barre d’adresse et désactivez-le pour ce site. Les autres navigateurs n’offrent pas d’exception par site.",
  },
  it: {
    webglTitle: "Vista a 360° non disponibile",
    webglBody:
      "Questa vista panoramica richiede WebGL, che il browser ha disattivato. Su iPhone e iPad la causa è quasi sempre la Modalità di isolamento.",
    webglFix: "Impostazioni → Privacy e sicurezza → Modalità di isolamento",
    webglSafari:
      "In Safari puoi lasciare attiva la Modalità di isolamento e consentire solo questo sito: tocca “aA” nella barra degli indirizzi e disattivala per questo sito. Gli altri browser non offrono un’eccezione per sito.",
  },
};

/** The visitor's language preferences, most-preferred first. */
function deviceLanguages() {
  if (typeof navigator === "undefined") return [];
  return [...(navigator.languages || []), navigator.language].filter(Boolean);
}

/**
 * Best available language for this visitor.
 *
 * navigator.languages reflects the device's language preferences, so a German
 * iPad reports "de-CH"/"de-DE" and gets German. Falls back to English for
 * anything not translated rather than showing a half-translated screen.
 *
 * @param {string[]} [tags] - Language tags to consider; defaults to the
 *   device's. Passed explicitly by tests, since globalThis.navigator is
 *   read-only in Node.
 * @returns {string} A key of MESSAGES.
 */
export function resolveLanguage(tags = deviceLanguages()) {
  for (const tag of tags) {
    const base = String(tag || "")
      .toLowerCase()
      .split("-")[0];
    if (MESSAGES[base]) return base;
  }
  return "en";
}

/**
 * Looks up a message in the visitor's language.
 *
 * @param {string} key - Message key.
 * @param {string} [lang] - Override, mainly for tests.
 * @returns {string} Localised string, or the English one.
 */
export function t(key, lang = resolveLanguage()) {
  return MESSAGES[lang]?.[key] ?? MESSAGES.en[key] ?? "";
}

export const SUPPORTED_LANGUAGES = Object.keys(MESSAGES);
