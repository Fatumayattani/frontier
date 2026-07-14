/** Frontier — server entry */
import { context, reddit, createServer, getServerPort } from '@devvit/web/server';
import { WorldState } from '../shared/types';
import { getAttempts, getConfig, getEvents, getTerritories } from './store';
import { detectSieges, enrollTerritory, resolveSieges } from './siege';

async function readBody(req: import('http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function json(res: import('http').ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function createAnchorPost(): Promise<string> {
  const { subredditName } = context;
  if (!subredditName) throw new Error('subredditName missing from context');
  const post = await reddit.submitCustomPost({
    subredditName,
    title: `⚔️ The Frontier — r/${subredditName} holds this land`,
    entry: 'default',
    userGeneratedContent: {
      text: 'A territory of the Frontier. Crosspost this into a rival subreddit to besiege them.',
    },
  });
  await enrollTerritory(subredditName, post.id);
  return post.id;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  try {
    // ── Client API ────────────────────────────────────────────────
    if (path === '/api/state') {
      const [territories, attempts, events, config] = await Promise.all([
        getTerritories(),
        getAttempts(),
        getEvents(),
        getConfig(),
      ]);
      const state: WorldState = {
        territories,
        attempts,
        events,
        viewerSubreddit: (context.subredditName ?? '').toLowerCase(),
        config,
      };
      return json(res, 200, state);
    }

    // ── Cron: the siege engine heartbeat ─────────────────────────
    if (path === '/internal/cron/siege-tick') {
      await detectSieges();
      await resolveSieges();
      return json(res, 200, { ok: true });
    }

    // ── Menu: mod creates/refreshes the anchor post ──────────────
    if (path === '/internal/menu/create-anchor') {
      const postId = await createAnchorPost();
      return json(res, 200, {
        showToast: `Frontier anchor raised (${postId}). This subreddit is now a territory.`,
      });
    }

    // ── Trigger: auto-enroll on install ──────────────────────────
    if (path === '/internal/triggers/app-install') {
      await readBody(req); // consume payload
      // Enrollment happens when the mod raises the anchor via the menu;
      // install alone shouldn't force a game post into a community.
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: `no route: ${path}` });
  } catch (err) {
    return json(res, 500, { error: err instanceof Error ? err.message : 'unknown' });
  }
});

server.listen(getServerPort());
