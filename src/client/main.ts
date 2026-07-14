/** Frontier — Phaser client: the living map */
import Phaser from 'phaser';
import type { Territory, WorldState } from '../shared/types';

const COLORS = [0xe4572e, 0x29a19c, 0xa8763e, 0x6b4faa, 0x3d7dca, 0xc94277, 0x7a9e43, 0xd4a017];
const NEUTRAL = 0x3a3a44;
const HEX_R = 52;

function ownerColor(owner: string, owners: string[]): number {
  const i = owners.indexOf(owner);
  return i === -1 ? NEUTRAL : COLORS[i % COLORS.length];
}

/** Spiral hex layout: territory n gets ring position n. */
function hexPosition(index: number, cx: number, cy: number): { x: number; y: number } {
  if (index === 0) return { x: cx, y: cy };
  let ring = 1;
  let count = 1;
  while (count + ring * 6 <= index) {
    count += ring * 6;
    ring++;
  }
  const posInRing = index - count;
  const side = Math.floor(posInRing / ring);
  const step = posInRing % ring;
  const angles = [0, 60, 120, 180, 240, 300].map((d) => (d * Math.PI) / 180);
  const dx = HEX_R * 1.8;
  const start = {
    x: cx + Math.cos(angles[side]) * dx * ring,
    y: cy + Math.sin(angles[side]) * dx * ring,
  };
  const next = angles[(side + 2) % 6];
  return {
    x: start.x + Math.cos(next) * dx * step,
    y: start.y + Math.sin(next) * dx * step,
  };
}

function hexPoints(): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push([HEX_R * Math.cos(a), HEX_R * Math.sin(a)]);
  }
  return pts;
}

class FrontierScene extends Phaser.Scene {
  private state?: WorldState;
  private mapLayer!: Phaser.GameObjects.Container;
  private feedText!: Phaser.GameObjects.Text;
  private lastOwners = new Map<string, string>();

  constructor() {
    super('frontier');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#17171d');
    this.mapLayer = this.add.container(0, 0);
    this.add
      .text(this.scale.width / 2, 26, 'THE FRONTIER', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#e8e3d3',
        letterSpacing: 6,
      })
      .setOrigin(0.5);
    this.feedText = this.add
      .text(16, this.scale.height - 18, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#b8b2a0',
        wordWrap: { width: this.scale.width - 32 },
      })
      .setOrigin(0, 1);

    // Drag to pan
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        this.mapLayer.x += p.velocity.x / 8;
        this.mapLayer.y += p.velocity.y / 8;
      }
    });

    void this.refresh();
    this.time.addEvent({ delay: 15_000, loop: true, callback: () => void this.refresh() });
    this.showOnboarding();
  }

  private showOnboarding(): void {
    const w = this.scale.width;
    const panel = this.add.container(0, 0).setDepth(100);
    const bg = this.add
      .rectangle(w / 2, 128, Math.min(w - 40, 560), 176, 0x0d0d11, 0.94)
      .setStrokeStyle(2, 0xf5e9c8, 0.4);
    const text = this.add
      .text(
        w / 2,
        110,
        'Subreddits are territories. Crossposting is conquest.\n\n' +
          'Crosspost this post into a rival enrolled subreddit to besiege them.\n' +
          'Upvotes and comments on the crosspost decide who holds the land.',
        {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#e8e3d3',
          align: 'center',
          wordWrap: { width: Math.min(w - 80, 520) },
        }
      )
      .setOrigin(0.5);
    const dismiss = this.add
      .text(w / 2, 184, '[ tap to enter the Frontier ]', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffd27f',
      })
      .setOrigin(0.5);
    panel.add([bg, text, dismiss]);
    this.tweens.add({ targets: dismiss, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });
    bg.setInteractive().on('pointerdown', () =>
      this.tweens.add({
        targets: panel,
        alpha: 0,
        duration: 250,
        onComplete: () => panel.destroy(),
      })
    );
  }

  private async refresh(): Promise<void> {
    try {
      const res = await fetch('/api/state');
      this.state = (await res.json()) as WorldState;
      this.render();
    } catch {
      this.feedText.setText('⚠ could not reach the front lines — retrying…');
    }
  }

  private render(): void {
    if (!this.state) return;
    this.mapLayer.removeAll(true);
    const { territories, attempts, events, viewerSubreddit } = this.state;
    const owners = [...new Set(territories.map((t) => t.owner))].sort();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const contested = new Set(attempts.map((a) => a.defender));

    territories.forEach((t: Territory, i: number) => {
      const { x, y } = hexPosition(i, cx, cy);
      const color = ownerColor(t.owner, owners);
      const hex = this.add.polygon(x, y, hexPoints(), color, 0.92);
      hex.setStrokeStyle(
        t.owner === viewerSubreddit ? 4 : 2,
        t.owner === viewerSubreddit ? 0xf5e9c8 : 0x0d0d11
      );
      this.mapLayer.add(hex);

      // Conquest moment: flash, shake, banner slam
      const prev = this.lastOwners.get(t.subreddit);
      if (prev && prev !== t.owner) {
        const flash = this.add.circle(x, y, HEX_R * 1.6, 0xf5e9c8, 0.9);
        this.mapLayer.add(flash);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scale: 2.2,
          duration: 900,
          onComplete: () => flash.destroy(),
        });
        this.cameras.main.shake(220, 0.004);
        hex.setScale(0.4);
        this.tweens.add({ targets: hex, scale: 1, duration: 500, ease: 'Back.easeOut' });
      }
      this.lastOwners.set(t.subreddit, t.owner);

      if (contested.has(t.subreddit)) {
        this.tweens.add({
          targets: hex,
          alpha: { from: 0.92, to: 0.45 },
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
        const flame = this.add.text(x, y - HEX_R + 8, '⚔️', { fontSize: '18px' }).setOrigin(0.5);
        this.mapLayer.add(flame);
      }

      const label = this.add
        .text(x, y, 'r/' + t.subreddit, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#f3efe2',
          align: 'center',
        })
        .setOrigin(0.5);
      this.mapLayer.add(label);

      if (t.owner !== t.subreddit) {
        const banner = this.add
          .text(x, y + 16, '⚑ r/' + t.owner, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ffd27f',
          })
          .setOrigin(0.5);
        this.mapLayer.add(banner);
      }
    });

    const latest = events.slice(0, 3).map((e) => '› ' + e.detail);
    this.feedText.setText(
      latest.join('\n') || '› The Frontier is quiet. Crosspost an anchor to begin a siege.'
    );
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#17171d',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [FrontierScene],
});
