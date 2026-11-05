// Central site settings. Edit these values; everything else reads from here.
export const SITE = {
  title: 'Travel Engineers',
  tagline: 'Babet and Niels on the road: notes, photos and a slowly growing line across the archipelago.',
  description: 'Babet and Niels travel through Indonesia: stories, photos and the route so far.',
  author: 'Babet & Niels',
  // Must match where the site is served. For a repo named <username>.github.io:
  url: 'https://nhjw92.github.io',
  lang: 'en',

  // Map tiles. Leave cartoApiKey empty to use the standard OpenStreetMap tiles (no key
  // needed). For CARTO's softer "Voyager" style, request a free key at
  // https://carto.com/basemaps/apikey and paste it here.
  map: {
    cartoApiKey: '',
  },

  // Email subscriptions via Buttondown (https://buttondown.com).
  // Put your Buttondown username here to show the signup form; leave '' to hide it.
  buttondownUsername: '',

  // Comments via Giscus (https://giscus.app). Fill all four values from giscus.app
  // to enable comments; leave repo as '' to hide them.
  giscus: {
    repo: '', // 'NHJW92/nhjw92.github.io' once Discussions are enabled
    repoId: '',
    category: 'Announcements',
    categoryId: '',
  },
} as const;
