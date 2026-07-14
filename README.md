![Frontier Wars](assets/frontier-icon.png)

# Frontier Wars

  **Subreddits are territories. Crossposting is conquest.**

  [App Listing](https://developers.reddit.com/apps/frontier-wars) · [Live Demo](https://www.reddit.com/r/frontier_wars_dev) · [Built for Reddit's Games with a Hook Hackathon](https://redditgameswithahook.devpost.com)

  ![Devvit](https://img.shields.io/badge/Devvit_Web-0.13-orange) ![Phaser](https://img.shields.io/badge/Phaser-3-2ea44f) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
</div>

---

## The game

Reddit communities already go to war. Console subs feud, sports subs trash talk, and in 2024 two Warhammer subreddits staged an improvised subscriber war with rallying memes across a dozen communities. Frontier Wars is the tool that war was missing.

Every enrolled subreddit holds territory on a shared, living map. To take a rival's land, your community crossposts your anchor post into their subreddit. If the crosspost earns real engagement before the capture window closes, their territory flips to your banner. Go quiet, and someone takes yours.

The map never sleeps. That is the hook.

## How a siege works

1. A moderator installs the app and runs **Raise Frontier Anchor** from the subreddit menu. The anchor post is the territory. Enrollment is opt-in by design: no community can be dragged into the game.
2. Any player crossposts their sub's anchor into a rival enrolled subreddit. The siege begins.
3. Every five minutes the siege engine polls each anchor's crossposts through `getDuplicatesForPost({ crosspostsOnly: true })`, opens capture windows for new sieges, and refreshes engagement counts.
4. Hit the score and comment thresholds before the window closes and the territory flips early. Fall short and the defense holds, hardening the defender's record.

Capture requires engagement, not the crosspost's existence. One person spamming crossposts flips nothing.

## Architecture

```
src/
  shared/types.ts    Territory, CaptureAttempt, WorldState, tunable config
  server/store.ts    Redis world state: territories, attempts, event log
  server/siege.ts    Detection, window resolution, enrollment
  server/index.ts    Routes: /api/state, cron tick, menu action, triggers
  client/main.ts     Phaser map: hex spiral, contested pulse, event feed
```

| Layer | Choice | Why |
|---|---|---|
| Runtime | Devvit Web `@devvit/web` 0.13 | Redis, Reddit API, scheduler, hosting in one platform |
| Rendering | Phaser 3 | Living political map: capture animation, contested pulse, pan |
| Bundling | esbuild | Server to CJS as the Devvit runtime requires, client to IIFE |
| State | Devvit Redis | Territories and sieges survive restarts, no external infra |

## Develop

```bash
npm install
npm run check     # typecheck server and client projects
npm run build     # bundle both
devvit playtest <your-test-subreddit>
```

Capture thresholds live in `src/shared/types.ts` under `DEFAULT_CONFIG` and can be overridden at runtime through the `world:config` Redis key. Shrink `windowMs` for local testing.

## Design notes

- **Opt-in territories.** Only subreddits whose mods raise an anchor are on the map. Crossposts into unenrolled subs are ignored.
- **Engagement gates capture.** Thresholds on score and comments make a siege a community effort, not a spam vector.
- **The game spreads by being played.** Every siege plants the game in front of a new community. Distribution is the mechanic.