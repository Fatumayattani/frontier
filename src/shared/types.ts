/** Frontier — shared types between server and Phaser client */

export type TerritoryStatus = 'held' | 'contested' | 'neutral';

export type Territory = {
  /** Subreddit name without r/ prefix; unique territory key */
  subreddit: string;
  /** Subreddit currently ruling this territory (may differ from `subreddit` after capture) */
  owner: string;
  status: TerritoryStatus;
  /** Anchor game post ID (t3_...) living in this subreddit */
  anchorPostId: string;
  /** Epoch ms of last ownership change */
  capturedAt: number;
  /** Consecutive successful defenses — feeds cosmetics later */
  defenses: number;
};

export type CaptureAttempt = {
  /** Crosspost ID (t3_...) — doubles as attempt ID */
  crosspostId: string;
  /** Attacking subreddit (where the original anchor lives) */
  attacker: string;
  /** Defending subreddit (where the crosspost landed) */
  defender: string;
  /** Epoch ms when the attempt window closes */
  windowEndsAt: number;
  /** Latest observed crosspost score */
  score: number;
  /** Latest observed comment count */
  comments: number;
};

export type WorldEvent = {
  at: number;
  kind: 'capture' | 'siege_started' | 'siege_failed' | 'territory_joined';
  attacker?: string;
  defender?: string;
  detail: string;
};

export type WorldState = {
  territories: Territory[];
  attempts: CaptureAttempt[];
  events: WorldEvent[];
  /** The subreddit the viewer is looking from (for "your empire" highlighting) */
  viewerSubreddit: string;
  config: CaptureConfig;
};

export type CaptureConfig = {
  /** Score a crosspost must reach within the window to flip the territory */
  scoreThreshold: number;
  /** Comment count a crosspost must reach within the window */
  commentThreshold: number;
  /** Capture window duration in ms */
  windowMs: number;
};

export const DEFAULT_CONFIG: CaptureConfig = {
  scoreThreshold: 1,
  commentThreshold: 1,
  windowMs: 10 * 60 * 1000, // 10 min for testing
};
