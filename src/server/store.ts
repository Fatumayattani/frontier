/** Frontier — Redis-backed world store (global scope: one shared world across all installs) */
import { redis } from '@devvit/web/server';
import {
  CaptureAttempt,
  CaptureConfig,
  DEFAULT_CONFIG,
  Territory,
  WorldEvent,
} from '../shared/types';

/** One world, shared by every subreddit installation. */
const g = redis.global;

const K = {
  territories: 'world:territories', // hash: subreddit -> Territory JSON
  attempts: 'world:attempts', // hash: crosspostId -> CaptureAttempt JSON
  events: 'world:events', // JSON array (bounded), stored as a single key
  config: 'world:config',
} as const;

const MAX_EVENTS = 40;

export async function getTerritories(): Promise<Territory[]> {
  const all = await g.hGetAll(K.territories);
  return Object.values(all ?? {}).map((v) => JSON.parse(v) as Territory);
}

export async function getTerritory(subreddit: string): Promise<Territory | undefined> {
  const raw = await g.hGet(K.territories, subreddit.toLowerCase());
  return raw ? (JSON.parse(raw) as Territory) : undefined;
}

export async function putTerritory(t: Territory): Promise<void> {
  await g.hSet(K.territories, { [t.subreddit.toLowerCase()]: JSON.stringify(t) });
}

export async function getAttempts(): Promise<CaptureAttempt[]> {
  const all = await g.hGetAll(K.attempts);
  return Object.values(all ?? {}).map((v) => JSON.parse(v) as CaptureAttempt);
}

export async function putAttempt(a: CaptureAttempt): Promise<void> {
  await g.hSet(K.attempts, { [a.crosspostId]: JSON.stringify(a) });
}

export async function removeAttempt(crosspostId: string): Promise<void> {
  await g.hDel(K.attempts, [crosspostId]);
}

export async function attemptExists(crosspostId: string): Promise<boolean> {
  return (await g.hGet(K.attempts, crosspostId)) !== undefined;
}

export async function pushEvent(e: WorldEvent): Promise<void> {
  const raw = await g.get(K.events);
  const events: WorldEvent[] = raw ? JSON.parse(raw) : [];
  events.unshift(e);
  await g.set(K.events, JSON.stringify(events.slice(0, MAX_EVENTS)));
}

export async function getEvents(): Promise<WorldEvent[]> {
  const raw = await g.get(K.events);
  return raw ? (JSON.parse(raw) as WorldEvent[]) : [];
}

export async function getConfig(): Promise<CaptureConfig> {
  const raw = await g.get(K.config);
  return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
}
