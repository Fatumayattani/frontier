/** Frontier v2 — shared types: one world post, engagement warfare */

export type TerritoryStatus = 'held' | 'contested' | 'occupied';

export type Territory = {
  subreddit: string;
  owner: string;
  status: TerritoryStatus;
  crosspostId: string;
  power: number;
  foundedAt: number;
  lastFlipAt: number;
};

export type WorldEvent = {
  at: number;
  kind: 'founded' | 'conquered' | 'liberated' | 'dissolved';
  detail: string;
};

export type WorldState = {
  territories: Territory[];
  events: WorldEvent[];
  capital: string;
  viewerSubreddit: string;
  config: WorldConfig;
};

export type WorldConfig = {
  captureRatio: number;
  halfLifeHours: number;
  commentWeight: number;
  graceHours: number;
};

export const DEFAULT_CONFIG: WorldConfig = {
  captureRatio: 2,
  halfLifeHours: 72,
  commentWeight: 2,
  graceHours: 12,
};

export function computePower(
  score: number,
  comments: number,
  ageMs: number,
  config: WorldConfig
): number {
  const base = Math.max(0, score) + config.commentWeight * Math.max(0, comments) + 1;
  const decay = Math.pow(0.5, ageMs / (config.halfLifeHours * 3600_000));
  return Math.round(base * decay * 10) / 10;
}
