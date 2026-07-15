/** Frontier v2 — world engine: one duplicates poll rules the entire map */
import { reddit } from '@devvit/web/server';
import { computePower, Territory } from '../shared/types';
import {
  getConfig,
  getTerritories,
  getWorldPost,
  pushEvent,
  putTerritory,
  removeTerritory,
} from './store';

export async function worldTick(): Promise<void> {
  const { postId, capital } = await getWorldPost();
  if (!postId || !capital) return;

  const config = await getConfig();
  const now = Date.now();
  const existing = new Map((await getTerritories()).map((t) => [t.subreddit, t]));
  const seen = new Set<string>();

  const worldPost = await reddit.getPostById(postId as `t3_${string}`);
  const capitalPower = computePower(
    worldPost.score,
    worldPost.numberOfComments,
    now - worldPost.createdAt.getTime(),
    config
  );
  upsert(existing, seen, {
    subreddit: capital,
    crosspostId: postId,
    power: capitalPower,
    now,
  });

  let duplicates: Awaited<ReturnType<ReturnType<typeof reddit.getDuplicatesForPost>['all']>> = [];
  try {
    duplicates = await reddit
      .getDuplicatesForPost({ postId: postId as `t3_${string}`, crosspostsOnly: true, limit: 100 })
      .all();
  } catch {
    duplicates = [];
  }

  const bySub = new Map<string, { id: string; power: number; created: number }>();
  for (const d of duplicates) {
    const sub = d.subredditName.toLowerCase();
    if (sub === capital) continue;
    const power = computePower(d.score, d.numberOfComments, now - d.createdAt.getTime(), config);
    const prev = bySub.get(sub);
    if (!prev || power > prev.power) {
      bySub.set(sub, { id: d.id, power, created: d.createdAt.getTime() });
    }
  }
  for (const [sub, best] of bySub) {
    upsert(existing, seen, { subreddit: sub, crosspostId: best.id, power: best.power, now });
  }

  for (const t of existing.values()) {
    if (!seen.has(t.subreddit)) {
      await removeTerritory(t.subreddit);
      await pushEvent({
        at: now,
        kind: 'dissolved',
        detail: 'r/' + t.subreddit + ' has faded from the Frontier',
      });
      existing.delete(t.subreddit);
    }
  }

  const all = [...existing.values()];
  for (const t of all) {
    if (now - t.foundedAt < config.graceHours * 3600_000 && t.owner === t.subreddit) {
      t.status = 'held';
      await putTerritory(t);
      continue;
    }
    const strongestRival = all
      .filter((o) => o.subreddit !== t.subreddit && o.owner !== t.subreddit)
      .sort((a, b) => b.power - a.power)[0];

    let next = t.owner;
    let status: Territory['status'] = t.owner === t.subreddit ? 'held' : 'occupied';

    if (strongestRival && strongestRival.power >= t.power * config.captureRatio) {
      next = strongestRival.owner;
    } else if (t.owner !== t.subreddit) {
      const occupierForce = all.find((o) => o.subreddit === t.owner)?.power ?? 0;
      if (t.power * config.captureRatio >= occupierForce) next = t.subreddit;
    }

    if (strongestRival && next === t.subreddit && strongestRival.power >= t.power * config.captureRatio * 0.6) {
      status = 'contested';
    }

    if (next !== t.owner) {
      const liberated = next === t.subreddit;
      await pushEvent({
        at: now,
        kind: liberated ? 'liberated' : 'conquered',
        detail: liberated
          ? 'r/' + t.subreddit + ' has rallied and thrown off r/' + t.owner
          : 'r/' + next + ' has overwhelmed r/' + t.subreddit,
      });
      t.owner = next;
      t.lastFlipAt = now;
      status = liberated ? 'held' : 'occupied';
    }
    t.status = status;
    await putTerritory(t);
  }
}

function upsert(
  existing: Map<string, Territory>,
  seen: Set<string>,
  d: { subreddit: string; crosspostId: string; power: number; now: number }
): void {
  seen.add(d.subreddit);
  const t = existing.get(d.subreddit);
  if (t) {
    t.power = d.power;
    t.crosspostId = d.crosspostId;
    existing.set(d.subreddit, t);
  } else {
    const fresh: Territory = {
      subreddit: d.subreddit,
      owner: d.subreddit,
      status: 'held',
      crosspostId: d.crosspostId,
      power: d.power,
      foundedAt: d.now,
      lastFlipAt: d.now,
    };
    existing.set(d.subreddit, fresh);
    void pushEvent({
      at: d.now,
      kind: 'founded',
      detail: 'r/' + d.subreddit + ' has raised its banner on the Frontier',
    });
  }
}
