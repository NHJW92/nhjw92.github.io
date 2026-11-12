// Central site settings. Edit these values; everything else reads from here.
export const SITE = {
  title: 'Travel Engineers',
  tagline: 'Babet and Niels on the road: notes, photos and a slowly growing line across the archipelago.',
  description: 'Babet and Niels travel through Indonesia: stories, photos and the route so far.',
  author: 'Babet & Niels',
  // Must match where the site is served. For a repo named <username>.github.io:
  url: 'https://nhjw92.github.io',
  lang: 'en',
  // Shared landing-page background, independent of story order and language.
  landingCover: '/uploads/indonesia-landing.jpg',

  // Map tiles. Leave cartoApiKey empty to use the standard OpenStreetMap tiles (no key
  // needed). For CARTO's softer "Voyager" style, request a free key at
  // https://carto.com/basemaps/apikey and paste it here.
  map: {
    cartoApiKey: '',
  },

  // "Buy us a coffee": readers choose an amount and pay with iDEAL, PayPal or Lightning.
  // Fill in what you use; each option only appears when it's set, and the whole box
  // stays hidden while all three are empty.
  //   bunqme:    your bunq.me name (bunq.me/<name>). This is the iDEAL | Wero option
  //              (readers can also use Bancontact or a card there).
  //   paypalme:  your PayPal.Me name (paypal.me/<name>)
  //   lightning: your Lightning address, e.g. 'babetniels@walletofsatoshi.com'
  donate: {
    bunqme: 'TravelEngineers',
    paypalme: 'TravelEngineers',
    lightning: 'facialmoney929@walletofsatoshi.com',
    amounts: [3, 5, 10], // euro suggestions; readers can also type their own
  },

  // Email subscriptions via Buttondown (https://buttondown.com).
  // Put your Buttondown username here to show the signup form; leave '' to hide it.
  buttondownUsername: 'TravelEngineers',

  // Comments: a small Cloudflare Worker in comments-worker/ (see "Comments" in the README).
  // Paste the Worker's URL here, e.g. 'https://travel-engineers-comments.<you>.workers.dev'.
  // Leave '' to hide the comment section.
  comments: {
    endpoint: 'https://travel-engineers-comments.n-h-j-willemsen.workers.dev',
  },
} as const;
