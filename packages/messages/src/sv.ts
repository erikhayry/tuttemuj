/**
 * Swedish messages: the one language v1 ships, and the source of truth for the keys.
 *
 * Every piece of UI text lives here and is looked up by id (`buttons.who-lived-here.label`). The API
 * never sends UI text, only ids and data (docs/v1-plan.md), so the app turns ids into words with
 * `message()`. `{name}` marks a value filled in at run time.
 *
 * To add a message: add it here, then add the same key (empty) to fi.ts and en.ts. TypeScript
 * refuses to build until all three have it.
 */
export const sv = {
  "app.title": "Tuttemuj",
  "app.tagline": "Vad hände här? Nykarlebys historia där du går.",

  // The 10 buttons (ids match ButtonId in packages/schema).
  "buttons.who-lived-here.label": "Vem bodde här?",
  "buttons.what-happened-here.label": "Vad hände här?",
  "buttons.stories-from-here.label": "Berätta en historia härifrån",
  "buttons.old-images-from-here.label": "Visa gamla bilder härifrån",
  "buttons.old-maps.label": "Visa på gamla kartor",
  "buttons.what-was-here.label": "Vad fanns här förr?",
  "buttons.who-worked-here.label": "Vem arbetade här?",
  "buttons.why-the-name.label": "Varför heter det så?",
  "buttons.on-this-day.label": "Hände på dagens datum",
  "buttons.nearby.label": "Vad finns i närheten?",

  // Asking for the user's position.
  "location.explain":
    "Tuttemuj berättar vad som hänt på platsen där du står. Din position används för att hitta platser i närheten.",
  "location.allow": "Använd min plats",
  "location.denied.title": "Vi får inte din plats",
  "location.denied.help":
    "Tillåt plats för den här sidan i webbläsarens inställningar och försök igen.",
  "location.unavailable": "Din plats kunde inte hittas just nu.",
  "location.retry": "Försök igen",

  // States of the screen.
  "status.loading": "Letar…",
  "status.error": "Något gick fel. Försök igen om en stund.",
  "status.nothing-here":
    "Vi har inget att berätta härifrån än. Gå närmare centrum eller försök på en annan plats.",
  "results.empty": "Inga träffar här.",
  "nav.back": "Tillbaka",

  // Links to the original site. Every answer shows one.
  "source.read-more": "Läs mer på nykarlebyvyer.nu",
  "source.from": "Från {title}",
  "image.alt": "Gammal bild från {place}",

  // Numbers and years.
  "distance.metres": "{distance} m",
  "year.single": "{year}",
  "year.circa": "ca {year}",
  "years.range": "{start}–{end}",
  "years.from": "från {start}",
  "years.until": "till {end}",

  // How a person is tied to a place (PersonPlaceRelationKind in packages/schema).
  "relation.lived": "bodde här",
  "relation.owned": "ägde",
  "relation.built": "byggde",
  "relation.ran": "drev",
  "relation.worked": "arbetade här",
  "relation.born": "föddes här",
  "relation.died": "dog här",

  // Language chooser (only Swedish is offered in v1).
  "lang.sv": "Svenska",
  "lang.fi": "Suomi",
  "lang.en": "English",
} as const;

/** Every message id. Taken from this file, so a new message needs no second list. */
export type MessageKey = keyof typeof sv;
