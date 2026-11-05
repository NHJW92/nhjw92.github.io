import type { TravelMode } from '../lib/travel';

export const LANGS = ['nl', 'en', 'de'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'nl';

export const LOCALES: Record<Lang, string> = { nl: 'nl-NL', en: 'en-GB', de: 'de-DE' };
export const LANG_NAMES: Record<Lang, string> = { nl: 'Nederlands', en: 'English', de: 'Deutsch' };

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}

/** Prefix a site path ("/map/") for a language. Dutch lives at the root. */
export function localize(path: string, lang: Lang) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return lang === DEFAULT_LANG ? p : `/${lang}${p}`;
}

/** Split "/en/map/" into { lang: 'en', path: '/map/' }. */
export function splitPath(pathname: string): { lang: Lang; path: string } {
  const m = pathname.match(/^\/(en|de|nl)(\/.*|$)/);
  if (m && isLang(m[1])) return { lang: m[1], path: m[2] || '/' };
  return { lang: DEFAULT_LANG, path: pathname || '/' };
}

export function formatDate(d: Date, lang: Lang) {
  return d.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric' });
}

type Strings = {
  tagline: string;
  description: string;
  nav: { stories: string; route: string; about: string };
  language: string;
  skip: string;
  edition: string;
  colophon: string;
  home: {
    currentlyIn: (place: string) => string; journal: string; empty: string; routeTitle: string; fullMap: string; earlier: string;
    coverStory: string; readStory: string; byline: string;
    welcome: string; explore: string; storiesHint: string; routeHint: string; aboutHint: string;
    stats: { stops: string; stories: string; km: string };
  };
  /** "Flight from Abu Dhabi" */
  leg: (mode: string, from: string) => string;
  post: {
    whereTitle: string; previous: string; next: string; draft: string; photos: string; readingTime: (min: number) => string;
    machineTranslated: (from: string) => string;
    notYetTranslated: (from: string) => string;
  };
  map: { title: string; description: string; stopsSoFar: (n: number) => string; stop: string; needsJs: string };
  legend: { overland: string; boat: string; flight: string; story: string; stop: string };
  travel: Record<TravelMode, string>;
  subscribe: { title: string; text: string; button: string; emailLabel: string; rssPrefix: string; rssLink: string };
  comments: string;
  donate: { title: string; text: string; amountLabel: string; other: string; idealSub: string; lightningTitle: (eur: string, sats: string) => string; lightningOpen: string; lightningCopy: string; lightningCopied: string; lightningLoading: string; lightningFallback: string; close: string; note: string };
  gallery: { label: string; viewer: string; close: string; prev: string; next: string };
  about: { title: string; heading: string; paragraphs: string[] };
  notFound: { title: string; heading: string; text: string; back: string };
  rssItem: (place: string) => string;
  /** Language names as written in this language, for "translated from …". */
  langNames: Record<Lang, string>;
};

export const ui: Record<Lang, Strings> = {
  nl: {
    tagline: 'Babet en Niels onderweg: verhalen, foto’s en een langzaam groeiende lijn door de archipel.',
    description: 'Babet en Niels reizen door Indonesië: verhalen, foto’s en de route tot nu toe.',
    nav: { stories: 'Verhalen', route: 'Route', about: 'Over ons' },
    language: 'Taal',
    skip: 'Naar de inhoud',
    edition: 'Indonesië',
    colophon: 'Een reisdagboek van Babet en Niels, onderweg geschreven in Indonesië.',
    leg: (mode, from) => `${mode} vanaf ${from}`,
    home: {
      coverStory: 'Nieuwste verhaal',
      welcome: 'Wij zijn Babet en Niels. Reis met ons mee door Indonesië: ontdek onze verhalen, bekijk de foto’s en volg onze route van plek naar plek.',
      explore: 'Ontdek onze reis',
      storiesHint: 'Verhalen en foto’s onderweg',
      routeHint: 'Volg onze reis op de kaart',
      aboutHint: 'Maak kennis met Babet en Niels',
      readStory: 'Lees het verhaal',
      byline: 'Door Babet en Niels',
      stats: { stops: 'stops', stories: 'verhalen', km: 'km gereisd' },
      currentlyIn: (p) => `Nu in ${p}`,
      journal: 'Reisdagboek',
      empty: 'Het eerste verhaal komt eraan.',
      routeTitle: 'De route tot nu toe',
      fullMap: 'Hele kaart →',
      earlier: 'Eerdere verhalen',
    },
    post: {
      whereTitle: 'Waar dit was',
      previous: '← Vorige',
      next: 'Volgende →',
      draft: 'Concept',
      photos: 'Foto’s',
      readingTime: (m) => `${m} min lezen`,
      machineTranslated: (from) => `Automatisch vertaald uit het ${from}.`,
      notYetTranslated: (from) => `Dit verhaal is nog niet vertaald en staat hier in het ${from}.`,
    },
    map: {
      title: 'De route',
      description: 'Elke stop van de reis, op volgorde.',
      stopsSoFar: (n) => `${n} ${n === 1 ? 'stop' : 'stops'} tot nu toe`,
      stop: 'Stop',
      needsJs: 'Voor de kaart is JavaScript nodig.',
    },
    legend: { overland: 'Over land', boat: 'Boot', flight: 'Vlucht', story: 'Verhaal', stop: 'Stop' },
    travel: { start: 'Start', train: 'Trein', bus: 'Bus', car: 'Auto', scooter: 'Scooter', boat: 'Boot', flight: 'Vlucht', walk: 'Te voet' },
    subscribe: {
      title: 'Volg ons',
      text: 'Krijg een mail als er een nieuw verhaal online staat. Geen spam, altijd af te melden.',
      button: 'Aanmelden',
      emailLabel: 'E-mailadres',
      rssPrefix: 'Liever een feedreader?',
      rssLink: 'Volg via RSS',
    },
    donate: {
      title: 'De skere travel engineers',
      text: 'Trakteer ons op een lekker bakje koffie!',
      amountLabel: 'Bedrag',
      other: 'Ander bedrag',
      idealSub: 'via bunq.me · ook Bancontact of kaart',
      lightningTitle: (eur, sats) => `${eur} ≈ ${sats} sats`,
      lightningOpen: 'Open in wallet',
      lightningCopy: 'Kopieer',
      lightningCopied: 'Gekopieerd',
      lightningLoading: 'Lightning-factuur maken…',
      lightningFallback: 'Scan of kopieer ons Lightning-adres en kies het bedrag in je wallet.',
      close: 'Sluiten',
      note: 'Je gaat naar een beveiligde betaalpagina en kiest daar of controleert het bedrag.',
    },
    comments: 'Reacties',
    gallery: { label: 'Fotogalerij', viewer: 'Fotoviewer', close: 'Sluiten', prev: 'Vorige foto', next: 'Volgende foto' },
    about: {
      title: 'Over ons',
      heading: 'Hoi, wij zijn Babet en Niels.',
      paragraphs: [
        'Dit is ons dagboek van een reis door Indonesië. We plaatsen onderweg verhalen en foto’s, meestal vanaf een telefoon in een café met wisselende wifi.',
        'We vertrokken uit Ruurlo, namen de trein naar Schiphol en vlogen via Abu Dhabi naar Bali. Volg de <a href="{route}">route</a> om te zien waar we tot nu toe zijn geweest.',
      ],
    },
    notFound: { title: 'Niet gevonden', heading: 'Verdwaald ergens in de archipel.', text: 'Deze pagina bestaat niet.', back: 'Terug naar de verhalen' },
    rssItem: (p) => `Nieuw verhaal uit ${p}`,
    langNames: { nl: 'Nederlands', en: 'Engels', de: 'Duits' },
  },
  en: {
    tagline: 'Babet and Niels on the road: notes, photos and a slowly growing line across the archipelago.',
    description: 'Babet and Niels travel through Indonesia: stories, photos and the route so far.',
    nav: { stories: 'Stories', route: 'Route', about: 'About' },
    language: 'Language',
    skip: 'Skip to content',
    edition: 'Indonesia',
    colophon: 'A travel journal by Babet and Niels, written on the road through Indonesia.',
    leg: (mode, from) => `${mode} from ${from}`,
    home: {
      coverStory: 'Latest story',
      welcome: 'We’re Babet and Niels. Join us as we travel through Indonesia: read our stories, browse the photos and follow our route from place to place.',
      explore: 'Explore our journey',
      storiesHint: 'Stories and photos from the road',
      routeHint: 'Follow our journey on the map',
      aboutHint: 'Meet Babet and Niels',
      readStory: 'Read the story',
      byline: 'By Babet and Niels',
      stats: { stops: 'stops', stories: 'stories', km: 'km travelled' },
      currentlyIn: (p) => `Currently in ${p}`,
      journal: 'Travel journal',
      empty: 'The first story is on its way.',
      routeTitle: 'The route so far',
      fullMap: 'Full map →',
      earlier: 'Earlier stories',
    },
    post: {
      whereTitle: 'Where this was',
      previous: '← Previous',
      next: 'Next →',
      draft: 'Draft',
      photos: 'Photos',
      readingTime: (m) => `${m} min read`,
      machineTranslated: (from) => `Automatically translated from ${from}.`,
      notYetTranslated: (from) => `This story hasn’t been translated yet, so it’s shown in ${from}.`,
    },
    map: {
      title: 'The route',
      description: 'Every stop on the trip, in order.',
      stopsSoFar: (n) => `${n} ${n === 1 ? 'stop' : 'stops'} so far`,
      stop: 'Stop',
      needsJs: 'The map needs JavaScript.',
    },
    legend: { overland: 'Overland', boat: 'Boat', flight: 'Flight', story: 'Story', stop: 'Stop' },
    travel: { start: 'Start', train: 'Train', bus: 'Bus', car: 'Car', scooter: 'Scooter', boat: 'Boat', flight: 'Flight', walk: 'On foot' },
    subscribe: {
      title: 'Follow along',
      text: 'Get an email when a new story goes up. No spam, unsubscribe any time.',
      button: 'Subscribe',
      emailLabel: 'Email address',
      rssPrefix: 'Prefer a feed reader?',
      rssLink: 'Subscribe via RSS',
    },
    donate: {
      title: 'The broke travel engineers',
      text: 'Treat us to a lovely cup of coffee!',
      amountLabel: 'Amount',
      other: 'Other amount',
      idealSub: 'via bunq.me · also Bancontact or card',
      lightningTitle: (eur, sats) => `${eur} ≈ ${sats} sats`,
      lightningOpen: 'Open in wallet',
      lightningCopy: 'Copy',
      lightningCopied: 'Copied',
      lightningLoading: 'Creating Lightning invoice…',
      lightningFallback: 'Scan or copy our Lightning address and choose the amount in your wallet.',
      close: 'Close',
      note: 'You’ll go to a secure payment page where you can choose or check the amount.',
    },
    comments: 'Comments',
    gallery: { label: 'Photo gallery', viewer: 'Photo viewer', close: 'Close', prev: 'Previous photo', next: 'Next photo' },
    about: {
      title: 'About',
      heading: 'Hi, we’re Babet and Niels.',
      paragraphs: [
        'This is our journal from a trip through Indonesia. We post stories and photos as we go, usually from a phone and a café with questionable Wi-Fi.',
        'We set off from Ruurlo, took the train to Schiphol and flew via Abu Dhabi to Bali. Follow the <a href="{route}">route</a> to see where we’ve been so far.',
      ],
    },
    notFound: { title: 'Not found', heading: 'Lost somewhere in the archipelago.', text: 'This page doesn’t exist.', back: 'Back to the stories' },
    rssItem: (p) => `New story from ${p}`,
    langNames: { nl: 'Dutch', en: 'English', de: 'German' },
  },
  de: {
    tagline: 'Babet und Niels unterwegs: Geschichten, Fotos und eine langsam wachsende Linie durch den Archipel.',
    description: 'Babet und Niels reisen durch Indonesien: Geschichten, Fotos und die bisherige Route.',
    nav: { stories: 'Geschichten', route: 'Route', about: 'Über uns' },
    language: 'Sprache',
    skip: 'Zum Inhalt',
    edition: 'Indonesien',
    colophon: 'Ein Reisetagebuch von Babet und Niels, unterwegs durch Indonesien geschrieben.',
    leg: (mode, from) => `${mode} ab ${from}`,
    home: {
      coverStory: 'Neueste Geschichte',
      welcome: 'Wir sind Babet und Niels. Begleitet uns durch Indonesien: Lest unsere Geschichten, entdeckt die Fotos und folgt unserer Route von Ort zu Ort.',
      explore: 'Entdeckt unsere Reise',
      storiesHint: 'Geschichten und Fotos von unterwegs',
      routeHint: 'Verfolgt unsere Reise auf der Karte',
      aboutHint: 'Lernt Babet und Niels kennen',
      readStory: 'Geschichte lesen',
      byline: 'Von Babet und Niels',
      stats: { stops: 'Halte', stories: 'Geschichten', km: 'km gereist' },
      currentlyIn: (p) => `Gerade in ${p}`,
      journal: 'Reisetagebuch',
      empty: 'Die erste Geschichte ist unterwegs.',
      routeTitle: 'Die bisherige Route',
      fullMap: 'Ganze Karte →',
      earlier: 'Frühere Geschichten',
    },
    post: {
      whereTitle: 'Wo das war',
      previous: '← Zurück',
      next: 'Weiter →',
      draft: 'Entwurf',
      photos: 'Fotos',
      readingTime: (m) => `${m} Min. Lesezeit`,
      machineTranslated: (from) => `Automatisch aus dem ${from}en übersetzt.`,
      notYetTranslated: (from) => `Diese Geschichte ist noch nicht übersetzt und wird auf ${from} angezeigt.`,
    },
    map: {
      title: 'Die Route',
      description: 'Jeder Halt der Reise, der Reihe nach.',
      stopsSoFar: (n) => `${n} ${n === 1 ? 'Halt' : 'Halte'} bisher`,
      stop: 'Halt',
      needsJs: 'Für die Karte wird JavaScript benötigt.',
    },
    legend: { overland: 'Über Land', boat: 'Boot', flight: 'Flug', story: 'Geschichte', stop: 'Halt' },
    travel: { start: 'Start', train: 'Zug', bus: 'Bus', car: 'Auto', scooter: 'Roller', boat: 'Boot', flight: 'Flug', walk: 'Zu Fuß' },
    subscribe: {
      title: 'Folgt uns',
      text: 'Bekommt eine E-Mail, sobald eine neue Geschichte online ist. Kein Spam, jederzeit abbestellbar.',
      button: 'Abonnieren',
      emailLabel: 'E-Mail-Adresse',
      rssPrefix: 'Lieber einen Feedreader?',
      rssLink: 'Per RSS folgen',
    },
    donate: {
      title: 'Die klammen Travel Engineers',
      text: 'Spendiert uns eine leckere Tasse Kaffee!',
      amountLabel: 'Betrag',
      other: 'Anderer Betrag',
      idealSub: 'über bunq.me · auch Bancontact oder Karte',
      lightningTitle: (eur, sats) => `${eur} ≈ ${sats} Sats`,
      lightningOpen: 'In Wallet öffnen',
      lightningCopy: 'Kopieren',
      lightningCopied: 'Kopiert',
      lightningLoading: 'Lightning-Rechnung wird erstellt…',
      lightningFallback: 'Scannt oder kopiert unsere Lightning-Adresse und wählt den Betrag in eurer Wallet.',
      close: 'Schließen',
      note: 'Ihr landet auf einer sicheren Zahlungsseite und wählt oder prüft dort den Betrag.',
    },
    comments: 'Kommentare',
    gallery: { label: 'Fotogalerie', viewer: 'Fotoansicht', close: 'Schließen', prev: 'Vorheriges Foto', next: 'Nächstes Foto' },
    about: {
      title: 'Über uns',
      heading: 'Hallo, wir sind Babet und Niels.',
      paragraphs: [
        'Das ist unser Tagebuch von einer Reise durch Indonesien. Unterwegs veröffentlichen wir Geschichten und Fotos, meistens vom Handy aus einem Café mit wackeligem WLAN.',
        'Los ging es in Ruurlo, mit dem Zug nach Schiphol und dann über Abu Dhabi nach Bali. Auf der <a href="{route}">Route</a> seht ihr, wo wir bisher waren.',
      ],
    },
    notFound: { title: 'Nicht gefunden', heading: 'Irgendwo im Archipel verlaufen.', text: 'Diese Seite gibt es nicht.', back: 'Zurück zu den Geschichten' },
    rssItem: (p) => `Neue Geschichte aus ${p}`,
    langNames: { nl: 'Niederländisch', en: 'Englisch', de: 'Deutsch' },
  },
};

export const t = (lang: Lang) => ui[lang];
