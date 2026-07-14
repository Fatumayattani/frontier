# ⚔️ Frontier

**Subreddits are territories. Crossposting is conquest.**

A Devvit Web game where enrolled subreddits hold territory on a shared world map.
To besiege a rival, crosspost their... no wait — crosspost *your* anchor post into
their subreddit. If the crosspost earns enough real engagement (score + comments)
within the capture window, the territory flips to your banner.

## How it works

1. A moderator installs the app and uses the subreddit menu action
   **"Raise Frontier Anchor"** — this creates the territory's anchor post and
   enrolls the subreddit on the map.
2. Players crosspost their sub's anchor into a rival enrolled subreddit to start
   a **siege** (respect the target sub's rules — enrollment is opt-in by design).
3. Every 5 minutes, the siege engine polls each anchor's crossposts via
   `getDuplicatesForPost({ crosspostsOnly: true })`, opens capture windows for
   new sieges, refreshes engagement counts, and resolves expired windows.
4. Thresholds met before the window closes → **early capture**. Window expires
   below thresholds → siege repelled, defender's defense count grows.

## Stack

- `@devvit/web` 0.13.x — server (Redis, Reddit API, scheduler) + client context
- Phaser 3 — the living political map (hex spiral layout, contested-territory
  pulse, event feed, drag-to-pan)
- esbuild — server bundled to CJS (required by Devvit runtime), client to IIFE

## Develop

```bash
npm install
npm run check   # typecheck both server and client projects
npm run build   # bundle server (dist/) + client (public/main.js)
npm run dev     # devvit playtest (requires `devvit login` first)
```

## Deploy

```bash
devvit login
devvit upload
devvit playtest <your-test-subreddit>
```

## Tuning

Capture thresholds live in `src/shared/types.ts` (`DEFAULT_CONFIG`) and can be
overridden at runtime via the `world:config` Redis key:
`{"scoreThreshold": 10, "commentThreshold": 5, "windowMs": 86400000}`

## Anti-abuse notes

- Only enrolled subreddits are territories — you cannot drag an unwilling
  community into the game; their mods must install and raise an anchor.
- Capture requires *engagement*, not the crosspost's mere existence — one
  person spamming crossposts flips nothing.
- Crossposts into non-enrolled subs are ignored by the engine.
