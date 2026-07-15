/** Frontier v2 — world store (single installation: the capital's Redis) */
import { redis } from '@devvit/web/server';
import { DEFAULT_CONFIG, Territory, WorldConfig, WorldEvent } from '../shared/types';

const K = {
  territories: 'world:territories',
  events: 'world:events',
  config: 'world:config',
  worldPost: 'world:post',
  capital: 'world:capital',
} as const;

const MAX_EVENTS = 40;

export async function getTerritories(): Promise<Territory[]> {
  const all = await redis.hGetAll(K.territories);
  return Object.values(all ?? {}).map((v) => JSON.parse(v) as Territory);
}

export async function putTerritory(t: Territory): Promise<void> {
  await redis.hSet(K.territories, { [t.subreddit]: JSON.stringify(t) });
}

export async function removeTerritory(subreddit: string): Promise<void> {
  await redis.hDel(K.territories, [subreddit]);
}

export async function pushEvent(e: WorldEvent): Promise<void> {
  const raw = await redis.get(K.events);
  const events: WorldEvent[] = raw ? JSON.parse(raw) : [];
  events.unshift(e);
  await redis.set(K.events, JSON.stringify(events.slice(0, MAX_EVENTS)));
}

export async function getEvents(): Promise<WorldEvent[]> {
  const raw = await redis.get(K.events);
  return raw ? (JSON.parse(raw) as WorldEvent[]) : [];
}

export async function getConfig(): Promise<WorldConfig> {
  const raw = await redis.get(K.config);
  return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
}

export async function setWorldPost(postId: string, capital: string): Promise<void> {
  await redis.set(K.worldPost, postId);
  await redis.set(K.capital, capital);
}

export async function getWorldPost(): Promise<{ postId?: string; capital?: string }> {
  const [postId, capital] = await Promise.all([redis.get(K.worldPost), redis.get(K.capital)]);
  return { postId: postId ?? undefined, capital: capital ?? undefined };
}
