/** Frontier v2 — server entry */
import { context, reddit, createServer, getServerPort } from '@devvit/web/server';
import { WorldState } from '../shared/types';
import { getConfig, getEvents, getTerritories, getWorldPost, setWorldPost } from './store';
import { worldTick } from './world';

function json(res: import('http').ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  try {
    if (path === '/api/state') {
      const [territories, events, config, world] = await Promise.all([
        getTerritories(),
        getEvents(),
        getConfig(),
        getWorldPost(),
      ]);
      territories.sort((a, b) => a.foundedAt - b.foundedAt);
      const state: WorldState = {
        territories,
        events,
        capital: world.capital ?? '',
        viewerSubreddit: (context.subredditName ?? '').toLowerCase(),
        config,
      };
      return json(res, 200, state);
    }

    if (path === '/internal/cron/world-tick') {
      await worldTick();
      return json(res, 200, { ok: true });
    }

    if (path === '/internal/menu/found-world') {
      const { subredditName } = context;
      if (!subredditName) throw new Error('subredditName missing from context');
      const existing = await getWorldPost();
      if (existing.postId) {
        return json(res, 200, {
          showToast: 'The world already exists (' + existing.postId + '). One world per Frontier.',
        });
      }
      const post = await reddit.submitCustomPost({
        subredditName,
        title: '⚔️ THE FRONTIER — crosspost this to your subreddit to claim your territory',
        entry: 'default',
        userGeneratedContent: {
          text: 'Subreddits are territories. Crossposting is conquest. Engagement is power.',
        },
      });
      await setWorldPost(post.id, subredditName.toLowerCase());
      await worldTick();
      return json(res, 200, {
        showToast: 'The world is founded. r/' + subredditName + ' is the capital.',
      });
    }

    if (path === '/internal/triggers/app-install') {
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'no route: ' + path });
  } catch (err) {
    return json(res, 500, { error: err instanceof Error ? err.message : 'unknown' });
  }
});

server.listen(getServerPort());
