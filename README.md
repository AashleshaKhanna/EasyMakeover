# EasyMakeover 💄

> The perfect look for every moment.

EasyMakeover is a one-page web app that curates a complete look — **makeup/grooming, jewellery, clothing, and hairstyle** — based on four quick inputs:

1. **Occasion** (wedding, interview, brunch, party, festival, beach…)
2. **Weather** (manual or auto-detected via your location)
3. **Who the look is for** — feminine · androgynous · masculine
4. **Style preference** — simple · comfy · stylish · fancy

A tag-based recommendation engine filters by presentation and scores a curated dataset across all four categories to pick a coherent set. Hit **Re-roll** for a fresh variation that still fits the brief, or **Surprise me** to randomize everything. Each look also gets a **visual preview** — a styled SVG silhouette rendered from your selections, with an AI-generated photo from Pollinations.ai fading in on top when it's ready.

---

## Run it locally

There is **no build step**. The whole app is HTML + a couple of JS files.

- Double-click `index.html`, **or**
- Serve the folder with any static server. Examples:
  ```bash
  # Python (built-in)
  python -m http.server 4173
  # Node
  npx serve .
  ```
  Then visit `http://localhost:4173`.

> Serving via a local server (rather than opening `file://…`) is recommended — geolocation and the AI image fetch are more reliable that way.

---

## Deploy it online — for free

Because the app is just static files (`index.html` + `data.js` + `app.js` + `styles.css`), **any static host works**. Easiest options, in order of "least friction":

### Option 1 — Netlify Drop (no account needed for a test link)

1. Open [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the entire `cursor_hackathon_ttw` folder onto the page
3. You get a public URL like `https://abc-easymakeover.netlify.app` in seconds
4. Sign in afterwards if you want to claim the site, set a custom subdomain, or keep it live permanently

### Option 2 — Vercel (drag & drop, also free)

1. Sign in at [vercel.com](https://vercel.com) (GitHub login works)
2. Click **Add New → Project → Import** and choose **"Upload"**
3. Drop the folder, accept the defaults, deploy
4. Get a `*.vercel.app` URL with HTTPS

### Option 3 — Cloudflare Pages (drag & drop)

1. Sign in at [pages.cloudflare.com](https://pages.cloudflare.com)
2. **Create a project → Direct upload**
3. Drag the folder, name it `easymakeover`, deploy
4. Get a `*.pages.dev` URL

### Option 4 — GitHub Pages (if you use git)

1. Push the folder to a public GitHub repo
2. **Settings → Pages → Build from branch → main → /(root)**
3. Visit `https://<your-user>.github.io/<repo-name>/`

> **Tip:** every option above gives free HTTPS, which is required for the "Use my location" weather button to work in modern browsers. Hosting on a real domain (not `file://`) also unlocks the most reliable behavior for the AI image preview.

---

## What's inside

| File | Purpose |
| --- | --- |
| `index.html` | App shell. Loads React, Tailwind (Play CDN), Babel standalone, and the app scripts. |
| `data.js` | Curated dataset — occasions, weather buckets, style preferences, and ~14 tagged items per category. |
| `app.js` | Recommendation engine + React UI (no JSX build step — Babel transpiles in the browser). |
| `styles.css` | Small custom touches on top of Tailwind (animations, scrollbar, selection color). |

---

## How the recommendation works

Every item in the dataset is tagged with:

- `occasions: []` — events it fits
- `weather:   []` — weather buckets it suits (or `"any"`)
- `styles:    []` — vibes it matches

For each category we score every item:

```
+5 if the occasion matches
+3 if the weather matches  (or +1 for "any")
+4 if the style matches
-2 if neither occasion nor style match
```

The top-scoring item wins. "Re-roll" rotates through the **top tier** (items within 2 points of the best) so you get variety without going off-brief.

---

## Live weather

We use [Open-Meteo](https://open-meteo.com/) — a **keyless, free** weather API — so the app works out of the box with zero setup. The current temperature, humidity, and WMO weather code are bucketed into one of our four user-facing categories.

---

## Features

- 💄 Curated look across 4 categories (makeup/grooming, jewellery, clothing, hairstyle)
- ♀ ⚪ ♂ Inclusive presentation picker — feminine, androgynous, masculine — with a dataset of masculine grooming + tailored, kurta, sherwani, tuxedo, etc. items
- 🖼️ **Visual look preview** — a locally-rendered styled SVG silhouette that adapts to your picks (outfit shape, hair, jewellery accents, weather, palette), plus an AI-generated fashion photo from [Pollinations.ai](https://pollinations.ai) that fades in on top when ready
- 🌦️ Live weather via geolocation + [Open-Meteo](https://open-meteo.com) (keyless API)
- 🎲 "Surprise me" — randomize all inputs
- 🔁 Re-roll for fresh variations that still fit the brief
- 💾 Save looks to your lookbook (localStorage)
- 📤 Copy a look summary to the clipboard
- 📱 Mobile-friendly, responsive layout

---

## Roadmap

- AI-personalized recommendations (skin tone, body type)
- Image previews / virtual try-on
- Shoppable affiliate links
- Cultural & regional outfit packs
- Community lookbook sharing
