<p align="center">
  <img src="static/icon-512-v3.png" alt="Repdraft logo" width="96" height="96" />
</p>

<h1 align="center">Repdraft</h1>

<p align="center">
  <strong>LOG. SET. CONQUER.</strong><br />
  Gym workout log, exercise catalog, and workout builder - built for the phone in your hand at the gym.
</p>

<p align="center">
  <a href="https://repdraft-zeta.vercel.app">Live app</a>
  ·
  <a href="#features">Features</a>
  ·
  <a href="#quick-start">Quick start</a>
  ·
  <a href="#stack">Stack</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.17.8-0B0F14?style=flat-square" />
  <img alt="SvelteKit" src="https://img.shields.io/badge/SvelteKit-5-FF3E00?style=flat-square&logo=svelte&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-ready-111111?style=flat-square" />
  <img alt="Offline first" src="https://img.shields.io/badge/offline-first-111111?style=flat-square" />
</p>

---

**Repdraft** is a mobile-first **gym workout tracker**: browse an **exercise catalog with GIFs**, build **workout plans**, log **sets (weight × reps)** during a live session, and keep **personal records** - online with Supabase or fully offline in the browser / PWA.

> North star: make the sacred loop faster - open → pick plan → train → log set → finish - not pile on features. Stays snappy on weak phones.

## Features

| | |
| --- | --- |
| **Exercise catalog** | Search, body-part filters, muscle targets, technique GIFs |
| **Exercise cards** | Instructions, media, add-to-plan in one tap |
| **Workout builder** | Compose and reorder plans for real gym sessions |
| **Live training** | Active workout UI optimized for one-handed set logging |
| **Personal records** | Track PRs and history without leaving the loop |
| **Account sync** | Optional Supabase auth + cloud sync; local-first without keys |
| **Community technique** | Upload video → GIF clips for form reference |
| **Articles & SEO** | Guides, sitemap, robots, Open Graph for discoverability |
| **Native shells** | Capacitor iOS / Android (Mode B) for store builds |

## Quick start

```bash
npm install
cp .env.example .env   # Supabase keys are optional
npm run dev
```

Without `.env`, plans, sessions, and records stay in **`localStorage`**. With Supabase configured, the same UI syncs across devices.

```env
PUBLIC_SITE_URL=https://repdraft-zeta.vercel.app
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

On production, set the same variables and add your site URL to Supabase Auth (**Site URL** / **Redirect URLs**). Keep SQL migrations and service-role keys **out of this public repo**.

## Stack

| Layer | Choice |
| --- | --- |
| UI | [SvelteKit](https://svelte.dev/) + TypeScript |
| Styles | Tailwind CSS 4 |
| Backend | [Supabase](https://supabase.com/) (optional auth & sync) |
| Delivery | PWA · Capacitor (iOS / Android) |
| Hosting | Vercel (canonical: [repdraft-zeta.vercel.app](https://repdraft-zeta.vercel.app)) |

Architecture and coding rules for contributors: **[AGENTS.md](./AGENTS.md)**.

## Project map

```text
src/
  lib/domain/     # pure workout / catalog logic
  lib/storage/    # local + Supabase repos
  lib/stores/     # cross-page state
  routes/         # catalog, builder, live, workouts, auth, articles…
static/           # exercise media, PWA icons, catalog data
```

## Media license

Exercise thumbnails and GIFs © [Gym visual](https://gymvisual.com/). See [NOTICE.md](./NOTICE.md). Do not reuse media outside Repdraft without Gym Visual’s permission.

## Links

- **App:** https://repdraft-zeta.vercel.app  
- **Product goal:** [GOAL.md](./GOAL.md)  
- **Privacy / Terms:** `/privacy` · `/terms` (in the running app)

---

<p align="center"><sub>Built for the gym floor - not the feature backlog.</sub></p>
