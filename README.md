# Travel Engineers: travel blog

A static travel blog built with Astro and hosted for free on GitHub Pages. You can post from a phone through Pages CMS.

- **Stories** are Markdown files in `src/content/posts/`.
- **Photos** go in `src/assets/uploads/`. The cover, gallery and inline photos are resized and converted to AVIF or WebP when the site is built, so upload the original phone photos.
- **Route map**: posts with `lat`/`lng`, plus the stops in `src/data/route.yml`, joined in date order. The map uses OpenStreetMap tiles by default, which need no key. CARTO's tiles now require a free key: request one at https://carto.com/basemaps/apikey and set `map.cartoApiKey` in `src/site.config.ts`.
- **Email signup** (Buttondown), **comments** (Giscus) and **RSS** (`/rss.xml`).

## One-time setup (about 20 minutes)

### 1. Create the GitHub repo

Name the repo **`nhjw92.github.io`**. The site is then served at `https://nhjw92.github.io` with no sub-path. With any other repo name you would also have to set `base` in `astro.config.mjs`.

```bash
cd Blog
git init -b main
git add .
git commit -m "Initial blog"
git remote add origin https://github.com/NHJW92/nhjw92.github.io.git
git push -u origin main
```

Then, on GitHub, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Every push to `main` now rebuilds and deploys the site in 1–2 minutes. Watch progress under the **Actions** tab.

### 2. Set your details

Edit `src/site.config.ts`:

- `url`: `https://nhjw92.github.io`
- `title`, `tagline`, `author`

Also rewrite the About page in `src/pages/about.astro`.

### 3. Phone editing with Pages CMS

1. Go to https://app.pagescms.org and sign in with GitHub.
2. Install the Pages CMS GitHub app on your blog repo.
3. Open the repo. **Stories** appears, configured by `.pages.yml`.
4. Save it to your phone's home screen. It's a web app.

Every save is a commit, so the site redeploys automatically.

**Coordinates:** in Google Maps, long-press a spot. The coordinates appear at the top (e.g. `-8.4964, 119.8877`). The first number is the latitude and the second the longitude.

**iPhone photos:** Safari converts HEIC to JPEG when it uploads from the photo picker. If a file still arrives as `.heic`, set the camera to *Settings → Camera → Formats → Most Compatible*.

### 4. Email subscribers (Buttondown)

1. Create an account at https://buttondown.com and put your username in `buttondownUsername` in `src/site.config.ts`. The signup form then appears on every page.
2. To send each new post automatically, add an RSS automation that points at `https://nhjw92.github.io/rss.xml`. Check Buttondown's current pricing first. Some sources list RSS-to-email as a paid add-on. If it isn't on the free tier, you can send a short email by hand after each post. Another option is follow.it, which turns an RSS feed into emails for free.

### 5. Comments (Giscus)

1. In the repo, open **Settings → General → Features** and enable **Discussions**.
2. Install the giscus app: https://github.com/apps/giscus
3. On https://giscus.app, enter your repo. Choose the mapping **pathname** and the category **Announcements**.
4. Copy `data-repo`, `data-repo-id`, `data-category` and `data-category-id` into the `giscus` block of `src/site.config.ts`.

Note: Giscus requires readers to sign in with GitHub to comment. If family members won't, swap `src/components/Comments.astro` for another provider. Cusdis and Hyvor Talk allow anonymous comments. Nothing else needs to change.

### 6. Remove the samples

Delete the three `sample-*` posts in `src/content/posts/` and the `sample-*.jpg` files in `src/assets/uploads/`, either through Pages CMS or with git.

## Languages and AI translation

The site exists in three languages: Dutch at `/`, English at `/en/` and German at `/de/`. A switcher in the header moves between them.

- **Interface text** (menus, labels, the About page) lives in `src/i18n/ui.ts`, one block per language.
- **Posts** are written once. Set the **Language** field (`lang: nl` or `lang: en`) to the language you wrote in. On every deploy, `scripts/translate.mjs` asks Claude to translate new or changed posts into the other two languages and saves them in `src/content/translations/<lang>/`. A post is only translated again when its text changes.
- **Route stop notes** are translated the same way, into `src/data/route-translations.json`.
- Until a translation exists, the post is shown in its original language with a short note.

### Turning on AI translation

1. Create an API key at https://console.anthropic.com (Settings → API keys) and add some credit. Translating a post costs a few cents at most.
2. In the GitHub repo, open **Settings → Secrets and variables → Actions → New repository secret**. Name it `ANTHROPIC_API_KEY` and paste the key as the value.
3. Push anything, or re-run the latest **Deploy to GitHub Pages** workflow.

Without the secret, the site builds normally and nothing is translated. To use a different model, add a repository *variable* `TRANSLATE_MODEL` under the same Settings page.

Translations are committed by `github-actions[bot]`, so run `git pull` before you edit locally. You can correct a translation by hand. Your edit stays until the original post changes, at which point the post is translated again.

## Buy us a coffee

A donation box appears on the homepage, on each post and on the About page. Readers pick €3, €5 or €10, or type their own amount, then choose how to pay. Each option only shows when it's set in `src/site.config.ts` → `donate`:

- `bunqme`: your bunq.me name. This is the **iDEAL | Wero** option; readers can also use Bancontact or a card there. The link never expires. Receiving iDEAL payments on a personal bunq account is free; card payments cost 2.5%.
- `paypalme`: your PayPal.Me name. The easiest option for readers outside the Netherlands.
- `lightning`: a Lightning address (currently `facialmoney929@walletofsatoshi.com`). The site converts the chosen euro amount to sats at the current price and shows a QR invoice for exactly that amount. If that doesn't work, it shows the address and the reader picks the amount in their wallet.

Tikkie and Revolut.me aren't suitable. Tikkie links expire after two weeks, and Revolut.me only accepts cards and Revolut Pay, so it doesn't offer iDEAL.

## Local development

```bash
npm install
npm run dev      # http://localhost:4321 (drafts are visible here)
npm run build    # production build into dist/
```

## Writing a post by hand

Create `src/content/posts/2026-12-10-my-post.md`:

```markdown
---
title: Kawah Ijen at 2am
date: 2026-12-10
location: Banyuwangi, East Java
lat: -8.0583
lng: 114.2420
summary: One sentence for the homepage and emails.
cover: /uploads/ijen-cover.jpg
coverAlt: Blue flames in the crater
gallery:
  - image: /uploads/ijen-1.jpg
    caption: Sulphur miners on the way down
draft: false
---

The story, in Markdown. Inline photos: ![Alt text](/uploads/ijen-2.jpg)
```

Put the image files in `src/assets/uploads/`. A missing image fails the build with a clear error, so a broken image never goes live silently.

## Custom domain later

Buy the domain, then add it under **Settings → Pages → Custom domain** and set the `url` in `site.config.ts`. GitHub shows the DNS records to create.

## Comments and feedback

Story comments and the feedback page (bugs and ideas, with votes) use a small
Cloudflare Worker in `comments-worker/` with a free D1 database. Nobody needs an
account to comment: they type any name. New comments wait for your approval.

### One-time setup (about 10 minutes)

You need [Node.js](https://nodejs.org) (LTS) and a free Cloudflare account. In a terminal:

```
cd comments-worker
npx wrangler login
npx wrangler d1 create blog-comments
```

Copy the `database_id` it prints into `comments-worker/wrangler.toml` (or let Wrangler add it when it asks). Then:

```
npx wrangler secret put ADMIN_PASSWORD
npx wrangler deploy
```

`deploy` prints the Worker's address, e.g. `https://travel-engineers-comments.<you>.workers.dev`.
Paste it into `src/site.config.ts` → `comments.endpoint`, commit and push. The comment
section, the feedback page and its footer link appear once that's set.

### Daily use

- Approve, delete and mark feedback as done at `<worker address>/admin` (user `admin`, your password).
- Optional phone notifications: set `NTFY_TOPIC` in `wrangler.toml` to a long, secret name,
  subscribe to it in the [ntfy](https://ntfy.sh) app, and run `npx wrangler deploy` again.
- To publish comments without approval, set `AUTO_APPROVE = "true"` and deploy again.

## Donors and fun statistics

- **Donors** (thank-you page): Pages CMS → *Donors*. Add a name and the date; the newest is shown on top.
  Only add people who are happy to be named.
- **Fun statistics** ("Thank you, Bali, for…"): Pages CMS → *Fun statistics*. Update the numbers, or switch
  on one of the prepared counters with *Show on the site*.
- The statistics page works out the island from each story's or stop's coordinates. Fill in *Island or region*
  to override it. Time per place is counted from each story's date, so use the day you arrived.
