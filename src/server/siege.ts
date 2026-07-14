/** Frontier — siege engine: detect crossposts, run capture windows, flip territories */
import { reddit } from '@devvit/web/server';
import { CaptureAttempt, Territory } from '../shared/types';
import {
  attemptExists,
  getAttempts,
  getConfig,
  getTerritories,
  getTerritory,
  pushEvent,
  putAttempt,
  putTerritory,
  removeAttempt,
} from './store';

/**
 * Poll every enrolled territory's anchor post for new crossposts.
 * A crosspost of sub A's anchor landing in enrolled sub B = A besieging B.
 */
export async function detectSieges(): Promise<void> {
  const territories = await getTerritories();
  const enrolled = new Set(territories.map((t) => t.subreddit.toLowerCase()));
  const config = await getConfig();

  for (const territory of territories) {
    if (!territory.anchorPostId) continue;
    let duplicates;
    try {
      duplicates = await reddit
        .getDuplicatesForPost({
          postId: territory.anchorPostId as `t3_${string}`,
          crosspostsOnly: true,
          limit: 100,
        })
        .all();
    } catch {
      continue; // anchor deleted or listing unavailable; skip this cycle
    }

    for (const dupe of duplicates) {
      const target = dupe.subredditName.toLowerCase();
      const attacker = territory.subreddit.toLowerCase();

      // Only enrolled subs are territories; a crosspost into your own land is not a siege.
      if (!enrolled.has(target) || target === attacker) continue;
      if (await attemptExists(dupe.id)) {
        await refreshAttempt(dupe.id, dupe.score, dupe.numberOfComments);
        continue;
      }

      const defender = await getTerritory(target);
      if (!defender) continue;
      // Can't besiege land you already rule.
      if (defender.owner === attacker) continue;

      const attempt: CaptureAttempt = {
        crosspostId: dupe.id,
        attacker,
        defender: target,
        windowEndsAt: Date.now() + config.windowMs,
        score: dupe.score,
        comments: dupe.numberOfComments,
      };
      await putAttempt(attempt);
      defender.status = 'contested';
      await putTerritory(defender);
      await pushEvent({
        at: Date.now(),
        kind: 'siege_started',
        attacker,
        defender: target,
        detail: `r/${attacker} marches on r/${target}`,
      });
    }
  }
}

async function refreshAttempt(crosspostId: string, score: number, comments: number): Promise<void> {
  const attempts = await getAttempts();
  const attempt = attempts.find((a) => a.crosspostId === crosspostId);
  if (!attempt) return;
  attempt.score = score;
  attempt.comments = comments;
  await putAttempt(attempt);
}

/** Resolve attempts whose windows have closed: flip or fail. */
export async function resolveSieges(): Promise<void> {
  const [attempts, config] = await Promise.all([getAttempts(), getConfig()]);
  const now = Date.now();

  for (const attempt of attempts) {
    const succeeded =
      attempt.score >= config.scoreThreshold && attempt.comments >= config.commentThreshold;

    // Early capture: thresholds met before the window closes.
    if (!succeeded && now < attempt.windowEndsAt) continue;

    const territory = await getTerritory(attempt.defender);
    await removeAttempt(attempt.crosspostId);
    if (!territory) continue;

    if (succeeded) {
      territory.owner = attempt.attacker;
      territory.status = 'held';
      territory.capturedAt = now;
      territory.defenses = 0;
      await putTerritory(territory);
      await pushEvent({
        at: now,
        kind: 'capture',
        attacker: attempt.attacker,
        defender: attempt.defender,
        detail: `r/${attempt.attacker} has conquered r/${attempt.defender}!`,
      });
    } else {
      territory.status = 'held';
      territory.defenses += 1;
      await putTerritory(territory);
      await pushEvent({
        at: now,
        kind: 'siege_failed',
        attacker: attempt.attacker,
        defender: attempt.defender,
        detail: `r/${attempt.defender} repelled r/${attempt.attacker}'s siege`,
      });
    }
  }
}

/** Register a subreddit as a territory when its anchor post is created. */
export async function enrollTerritory(subreddit: string, anchorPostId: string): Promise<Territory> {
  const key = subreddit.toLowerCase();
  const existing = await getTerritory(key);
  if (existing) {
    existing.anchorPostId = anchorPostId; // refreshed anchor
    await putTerritory(existing);
    return existing;
  }
  const territory: Territory = {
    subreddit: key,
    owner: key,
    status: 'held',
    anchorPostId,
    capturedAt: Date.now(),
    defenses: 0,
  };
  await putTerritory(territory);
  await pushEvent({
    at: Date.now(),
    kind: 'territory_joined',
    detail: `r/${key} has entered the Frontier`,
  });
  return territory;
}
