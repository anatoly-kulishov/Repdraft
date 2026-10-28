<p align="center">
  <img src="static/icon-512-v3.png" alt="Repdraft logo" width="96" height="96" />
</p>

<h1 align="center">Repdraft</h1>

<p align="center">
  <strong>LOG. SET. CONQUER.</strong><br />
  Gym workout log for the phone in your hand at the rack.
</p>

<p align="center">
  <a href="https://www.repdraft.xyz">Live (web)</a>
  ·
  <a href="#quick-start">Quick start</a>
  ·
  <a href="#stack">Stack</a>
</p>

<p align="center">
  <a href="https://www.repdraft.xyz"><img alt="Live" src="https://img.shields.io/badge/live-repdraft.xyz-0B0F14?style=flat-square" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.23.4-0B0F14?style=flat-square" />
  <img alt="Expo" src="https://img.shields.io/badge/Expo-RN-000020?style=flat-square&logo=expo&logoColor=white" />
  <img alt="SvelteKit" src="https://img.shields.io/badge/SvelteKit-5-FF3E00?style=flat-square&logo=svelte&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Offline first" src="https://img.shields.io/badge/offline-first-111111?style=flat-square" />
</p>

---

**Repdraft** logs strength workouts: pick a plan, log weight × reps, finish, see the result.

We are in a **native-first rewrite**. The gym client is **React Native (Expo)** in [`mobile/`](./mobile/). **SvelteKit web/PWA** stays for browser, SEO, technique, and backup/migration. Shared rules live in [`src/lib/domain`](./src/lib/domain).

> **IMPROVE THE EXPERIENCE. NOT THE FEATURE COUNT.**  
> Metric: phone → completed set. Stay fast on weak phones. Details: [`.cursor/product/native-rewrite-plan.md`](./.cursor/product/native-rewrite-plan.md).

```text
Open → Pick workout → Preview → Start → Set → Weight × reps → Next → Finish → Saved
```

---

## Clients

| Client | Path | Role |
| --- | --- | --- |
| **Mobile** | `mobile/` (Expo Router) | Primary gym loop |
| **Web / PWA** | repo root (SvelteKit) | Browser, SEO, media, export/import |

No Capacitor/Cordova shell. Watch UI (later) is a separate native surface, not a shrunk phone screen. Strategy: [`.cursor/product/native-rewrite-plan.md`](./.cursor/product/native-rewrite-plan.md).

---

## Quick start

```bash
git clone https://github.com/anatoly-kulishov/Repdraft.git
cd Repdraft
npm install
cp .env.example .env          # Supabase optional

npm run mobile                # Expo (from repo root)
npm run dev                   # web / PWA
npm run dev:all               # web + Expo together (Ctrl+C stops both)
# first time mobile: cd mobile && npm install
```

Without env keys, plans/sessions/records stay on device (AsyncStorage / localStorage). With Supabase, the same domain can sync.

```env
PUBLIC_SITE_URL=https://www.repdraft.xyz
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

Mobile env: see [`mobile/.env.example`](./mobile/.env.example) (`EXPO_PUBLIC_*`).  
On production, set Auth **Site URL** / **Redirect URLs**. Keep SQL and service-role keys out of this public repo.

### Checks

```bash
npm run check          # web (svelte-check)
npm run check:mobile   # RN (tsc)
```

---

## Stack

| Layer | Choice |
| --- | --- |
| Phone | React Native + Expo Router (`mobile/`) |
| Web | SvelteKit 5 + TypeScript + Tailwind 4 |
| Domain | Pure TS `src/lib/domain` (shared) |
| Backend | Supabase (optional auth & sync) |
| Web host | Vercel - [www.repdraft.xyz](https://www.repdraft.xyz) |

Agent context: [`.cursor/INDEX.md`](./.cursor/INDEX.md) (entry: [`AGENTS.md`](./AGENTS.md)).

---

## Project map

```text
mobile/              # Expo sacred-loop client
src/lib/domain/      # shared workout / session / records logic
src/lib/storage/     # web local + Supabase
src/routes/          # SvelteKit pages
static/              # catalog media, PWA icons, index JSON
data/                # full catalog source (build scripts)
scripts/             # catalog translate/build, icons, RAG sync
```

---

## FAQ

**Do I need Supabase?**  
No. Local-first works for web and Expo.

**Which client should I develop against?**  
Prefer `mobile/` for the gym loop. Touch web when changing shared domain, SEO, or migration.

**Can I self-host the web app?**  
Yes. Deploy SvelteKit; point env at your Supabase project or stay local-only.

**Where is production web?**  
https://www.repdraft.xyz

---

## Media license

Exercise thumbnails and GIFs © [Gym visual](https://gymvisual.com/). See [`NOTICE.md`](./NOTICE.md). Do not reuse that media outside Repdraft without Gym visual permission.

---

## Links

- **Web app:** https://www.repdraft.xyz  
- **Rewrite / north star:** [`.cursor/product/native-rewrite-plan.md`](./.cursor/product/native-rewrite-plan.md)  
- **Privacy / Terms:** `/privacy` · `/terms` (in the running app)

---

<p align="center"><sub>Built for the gym floor - not the feature backlog.</sub></p>
