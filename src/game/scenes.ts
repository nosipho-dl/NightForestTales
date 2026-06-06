/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Phaser from 'phaser';
import { generateGameTextures } from './textures';

// Define the event bridge to React
const updateReactState = (newState: Partial<any>) => {
  if (window.gameState) {
    window.gameState = { ...window.gameState, ...newState };
    if ((window as any).onGameStateChange) {
      (window as any).onGameStateChange(window.gameState);
    }
  }
};

const attachEnemyGlow = (scene: Phaser.Scene, enemy: Phaser.Physics.Arcade.Sprite) => {
  const size = (enemy.body ? enemy.body.width : 32) || 32;
  const radius = (size * 1.3) / 2;
  const glow = scene.add.graphics();
  glow.fillStyle(0xFF3A3A, 0.25);
  glow.fillCircle(0, 0, radius);
  glow.setDepth(enemy.depth - 0.1); // depth below enemy sprite
  enemy.setData('glow', glow);

  enemy.on('destroy', () => {
    if (glow && glow.active) {
      glow.destroy();
    }
  });
  return glow;
};

class EyePair extends Phaser.GameObjects.Graphics {
  blinkTimer: Phaser.Time.TimerEvent | null = null;
  isFadingOut = false;

  constructor(scene: Phaser.Scene) {
    super(scene);
    scene.add.existing(this);
    this.setDepth(1.4);
    this.respawn();
    this.startBlinkTimer();
  }

  respawn() {
    let rx = 0;
    let ry = 0;
    const player = (this.scene as any).player;
    const px = player ? player.x : 150;
    const py = player ? player.y : 1280;

    for (let attempts = 0; attempts < 50; attempts++) {
      rx = Phaser.Math.Between(50, 2510);
      ry = Phaser.Math.Between(50, 2510);

      if (Phaser.Math.Distance.Between(rx, ry, px, py) > 300) {
        break;
      }
    }

    this.setPosition(rx, ry);
    this.alpha = 0.6;
    this.isFadingOut = false;

    this.clear();
    this.fillStyle(0xFF3A3A, 1.0);
    this.fillEllipse(-5, 0, 4, 6);
    this.fillEllipse(5, 0, 4, 6);
  }

  startBlinkTimer() {
    this.blinkTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(2000, 6000),
      callback: () => {
        if (!this.active || this.isFadingOut) return;
        this.scene.tweens.add({
          targets: this,
          alpha: 0,
          duration: 150,
          yoyo: true,
          repeat: 0,
          onComplete: () => {
            if (this.active && !this.isFadingOut) {
              this.alpha = 0.6;
            }
          }
        });
        this.startBlinkTimer();
      }
    });
  }

  retreat() {
    if (this.isFadingOut) return;
    this.isFadingOut = true;
    if (this.blinkTimer) {
      this.blinkTimer.destroy();
    }

    if (window.gameAudio && typeof window.gameAudio.playEyeDisappear === 'function') {
      window.gameAudio.playEyeDisappear();
    }

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        if (this.active) {
          this.respawn();
          this.startBlinkTimer();
        }
      }
    });
  }

  destroy(fromScene?: boolean) {
    if (this.blinkTimer) {
      this.blinkTimer.destroy();
    }
    super.destroy(fromScene);
  }
}

// 1. BOOT SCENE
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Generate all procedurally compiled canvas textures synchronously
    generateGameTextures(this.game);
    
    const anims = this.anims;
    // Configure Regular Player Jama Animations
    if (!anims.exists('jama-idle')) {
      anims.create({
        key: 'jama-idle',
        frames: [
          { key: 'jama', frame: '0' },
          { key: 'jama', frame: '1' }
        ],
        frameRate: 4,
        repeat: -1,
      });
    }
    if (!anims.exists('jama-run')) {
      anims.create({
        key: 'jama-run',
        frames: [
          { key: 'jama', frame: '2' },
          { key: 'jama', frame: '3' },
          { key: 'jama', frame: '4' },
          { key: 'jama', frame: '5' }
        ],
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!anims.exists('jama-attack')) {
      anims.create({
        key: 'jama-attack',
        frames: [
          { key: 'jama', frame: '6' },
          { key: 'jama', frame: '7' }
        ],
        frameRate: 15,
        repeat: 0,
      });
    }

    // Configure Upgraded Light Player Jama Animations
    if (!anims.exists('jama-light-idle')) {
      anims.create({
        key: 'jama-light-idle',
        frames: [
          { key: 'jama-light', frame: '0' },
          { key: 'jama-light', frame: '1' }
        ],
        frameRate: 4,
        repeat: -1,
      });
    }
    if (!anims.exists('jama-light-run')) {
      anims.create({
        key: 'jama-light-run',
        frames: [
          { key: 'jama-light', frame: '2' },
          { key: 'jama-light', frame: '3' },
          { key: 'jama-light', frame: '4' },
          { key: 'jama-light', frame: '5' }
        ],
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!anims.exists('jama-light-attack')) {
      anims.create({
        key: 'jama-light-attack',
        frames: [
          { key: 'jama-light', frame: '6' },
          { key: 'jama-light', frame: '7' }
        ],
        frameRate: 15,
        repeat: 0,
      });
    }

    this.scene.start('MainMenuScene');
  }
}

// 2. MAIN MENU SCENE
export class MainMenuScene extends Phaser.Scene {
  starsGraphics!: Phaser.GameObjects.Graphics;
  acaciaGraphics!: Phaser.GameObjects.Graphics;
  stars: { x: number; y: number; alpha: number; speed: number; dir: number }[] = [];

  constructor() {
    super('MainMenuScene');
  }

  create() {
    updateReactState({ activeScene: 'MainMenu' });
    if (window.gameAudio) {
      window.gameAudio.setMusicTheme('menu');
    }

    // Process a twinkling dense starfield procedurally
    this.starsGraphics = this.add.graphics();
    for (let i = 0; i < 220; i++) {
      this.stars.push({
        x: Math.random() * 1280,
        y: Math.random() * 550,
        alpha: Math.random(),
        speed: 0.01 + Math.random() * 0.02,
        dir: Math.random() > 0.5 ? 1 : -1,
      });
    }

    // Draw full moon in top-right
    const moonGraphics = this.add.graphics();
    // Halo
    moonGraphics.fillStyle(0xffeec2, 0.15);
    moonGraphics.fillCircle(1120, 110, 65);
    moonGraphics.fillStyle(0xffeec2, 0.3);
    moonGraphics.fillCircle(1120, 110, 50);
    // Real Moon circle
    moonGraphics.fillStyle(0xfffff0, 1.0);
    moonGraphics.fillCircle(1120, 110, 38);
    // Soft craters
    moonGraphics.fillStyle(0xe6dfc3, 0.9);
    moonGraphics.fillCircle(1105, 100, 7);
    moonGraphics.fillCircle(1135, 120, 5);
    moonGraphics.fillCircle(1115, 125, 4);

    // Draw silhouettes of thatched round huts (rondavels) at the bottom
    const terrain = this.add.graphics();
    terrain.fillStyle(0x040409, 1.0); // very dark
    terrain.fillRect(0, 620, 1280, 100);

    // Draw silhouettes of huts (simple half circles + trapezoid thatch roof)
    const drawHutSilhouette = (x: number, scale: number) => {
      terrain.fillStyle(0x020205, 1.0);
      // walls
      terrain.fillRect(x - 25 * scale, 580, 50 * scale, 50);
      // thatch roof
      terrain.beginPath();
      terrain.moveTo(x - 35 * scale, 580);
      terrain.lineTo(x, 520);
      terrain.lineTo(x + 35 * scale, 580);
      terrain.closePath();
      terrain.fill();
    };

    drawHutSilhouette(200, 1.2);
    drawHutSilhouette(320, 0.9);
    drawHutSilhouette(880, 1.1);
    drawHutSilhouette(1020, 1.3);

    // Draw acacia tree silhouettes
    this.acaciaGraphics = this.add.graphics();
    this.acaciaGraphics.fillStyle(0x020205, 0.95);
    // Draw tree on left
    const drawAcacia = (tx: number, ty: number, th: number) => {
      this.acaciaGraphics.fillRect(tx - 6, ty - th, 12, th); // trunk
      // draw flat layered canopy
      this.acaciaGraphics.fillEllipse(tx, ty - th, 70, 16);
      this.acaciaGraphics.fillEllipse(tx - 25, ty - th - 12, 45, 10);
      this.acaciaGraphics.fillEllipse(tx + 25, ty - th - 10, 40, 10);
    };
    drawAcacia(110, 630, 150);
    drawAcacia(1220, 630, 180);

    // Subtle drift smoke particle simulation from a rondavel
    const smokeParticles = this.add.particles(320, 520, 'part-violet', {
      alpha: { start: 0.25, end: 0 },
      scale: { start: 0.6, end: 1.8 },
      speedY: -25,
      speedX: { min: -6, max: 12 },
      frequency: 240,
      lifespan: 3600,
    });
    smokeParticles.setDepth(1);
  }

  update() {
    // Handle twinkling stars animation in menu
    this.starsGraphics.clear();
    this.stars.forEach((star) => {
      star.alpha += star.speed * star.dir;
      if (star.alpha >= 0.95) {
        star.alpha = 0.95;
        star.dir = -1;
      } else if (star.alpha <= 0.15) {
        star.alpha = 0.15;
        star.dir = 1;
      }
      this.starsGraphics.fillStyle(0xffffff, star.alpha);
      this.starsGraphics.fillPoint(star.x, star.y, 2);
    });
  }
}

// 3. DIFFICULTY SCENE
export class DifficultyScene extends Phaser.Scene {
  constructor() {
    super('DifficultyScene');
  }

  create() {
    updateReactState({ activeScene: 'Difficulty' });
  }
}

// 4. CUTSCENE SCENE 1 (THE ABDUCTION)
export class CutsceneScene1 extends Phaser.Scene {
  constructor() {
    super('CutsceneScene1');
  }

  create() {
    updateReactState({ activeScene: 'Cutscene' });
    // Moonlit village backdrop showing tin-roof house, hanging lanterns, and tied torches (Setting Image 1)
    this.add.image(640, 360, 'scene1-bg1');
  }
}

// 5. VILLAGE SCENE (THE CALLING)
export class VillageScene extends Phaser.Scene {
  jamaSprite!: Phaser.GameObjects.Sprite;
  orbSprite!: Phaser.GameObjects.Sprite;
  orbParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('VillageScene');
  }

  create() {
    updateReactState({ activeScene: 'Village' });
    if (window.gameAudio) {
      window.gameAudio.setMusicTheme('menu');
    }

    // Moonlit symmetric thatch-roof huts with dirt pathway leading back to rice paddies (Setting Image 2)
    this.add.image(640, 360, 'scene1-bg2');

    // Add cold glowing camp ash pit in center
    const ash = this.add.graphics();
    ash.fillStyle(0x1a1a24, 1.0);
    ash.fillEllipse(640, 480, 70, 35);
    ash.fillStyle(0x0c0c12, 1.0);
    ash.fillEllipse(640, 480, 55, 25);

    // Add Jama Kneeling on the left, head bowed (use a scale and rotate tween to signify grief)
    this.jamaSprite = this.add.sprite(450, 480, 'jama').setScale(1.4);
    this.jamaSprite.setAngle(-12); // tilted in posture of defeat

    // Sucking pulse animation for kneeling grief
    this.tweens.add({
      targets: this.jamaSprite,
      scaleX: 1.34,
      scaleY: 1.44,
      duration: 1800,
      yoyo: true,
      repeat: -1,
    });

    // Spawn Ancestral Guide Orb Onezwa far right and glide in (delay 2s) - scaled up enormously
    this.orbSprite = this.add.sprite(1400, 240, 'guide-orb').setScale(2.5).setAlpha(0);
    
    // Trail particles for Onezwa
    this.orbParticles = this.add.particles(0, 0, 'part-gold', {
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      speed: 15,
      frequency: 60,
      lifespan: 800,
      blendMode: 'ADD',
    });
    this.orbParticles.startFollow(this.orbSprite);
    this.orbParticles.stop(); // start when orb arrives

    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: this.orbSprite,
        x: 820,
        y: 350,
        alpha: 1,
        duration: 2500,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.orbParticles.start();
          // Gentle hovering wobble logic
          this.tweens.add({
            targets: this.orbSprite,
            y: 310,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        },
      });
    });

    // Track state bridge transitions
    this.events.on('shutdown', () => {
      if (this.orbParticles) this.orbParticles.destroy();
    });
  }
}

// 6. FOREST SCENE (LEVEL 2 - THE HUNT)
export class ForestScene extends Phaser.Scene {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  obstacles!: Phaser.Physics.Arcade.StaticGroup;
  relicsGroup!: Phaser.Physics.Arcade.StaticGroup;
  enemiesGroup!: Phaser.Physics.Arcade.Group;
  projectilesGroup!: Phaser.Physics.Arcade.Group;
  bloodParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  goldParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  
  // Thorny bushes hazard and stats tracking fields
  thornsGroup!: Phaser.Physics.Arcade.StaticGroup;
  herbsGroup!: Phaser.Physics.Arcade.StaticGroup;
  shrubsGroup!: Phaser.GameObjects.Group;
  playerOnThorn = false;
  playerHiding = false;
  lastThornDamageTime = 0;
  lastRegenTime = 0;
  startTime = 0;

  relicNearIndex: number | null = null;
  relicOverlappedList: Phaser.GameObjects.Sprite[] = [];
  
  isAttacking = false;
  isDashing = false;
  lastDashTime = 0;
  dashCooldown = 2000; // ms
  
  // HUD variables
  timerInterval: any = null;
  lastPosSyncTime = 0;
  lastPlayerMoveTime = 0;
  lastChimePlayTime = 0;

  // Atmospheric horror fields
  eyesGroup!: Phaser.GameObjects.Group;
  mistStrips: { rect: Phaser.GameObjects.Rectangle; speed: number }[] = [];
  remainsGroup!: Phaser.GameObjects.Group;
  shadowTimer: Phaser.Time.TimerEvent | null = null;
  howlShockwaveTimer: Phaser.Time.TimerEvent | null = null;

  // Lantern mechanics and overhauled combat / atmosphere state fields
  darknessOverlay!: Phaser.GameObjects.RenderTexture;
  lightMaskImage!: Phaser.GameObjects.Image;
  lightMaskBrush!: Phaser.GameObjects.Graphics;
  lightPoolGraphics!: Phaser.GameObjects.Graphics;
  jamaBlueOutline!: Phaser.GameObjects.Graphics;
  lanternWarningText!: Phaser.GameObjects.Text;
  
  flickerScheduleTimer: Phaser.Time.TimerEvent | null = null;
  fuelDrainTimer: Phaser.Time.TimerEvent | null = null;
  currentDrainRate = 0.3;

  gameplayStarted = false;
  isBlocking = false;
  blockStartTime = 0;
  lastBlockTime = 0;
  blockCooldown = 3000;
  isShieldBashing = false;
  lastBashTime = 0;
  lastStrikeTime = 0;
  lastHeartbeatTime = 0;
  vignetteHeartbeatPulseEndTime = 0;
  nextFlickerTime = 0;
  flickerEndTime = 0;
  isFlickering = false;
  shieldFlashState: 'gold' | 'blue' | null = null;
  spearGraphics!: Phaser.GameObjects.Graphics;
  shieldGraphics!: Phaser.GameObjects.Graphics;
  lanternPool!: Phaser.GameObjects.Graphics;

  constructor() {
    super('ForestScene');
  }

  create(data?: { loadFromSave?: boolean; playerX?: number; playerY?: number }) {
    updateReactState({ activeScene: 'ForestScene', isGameOver: false, gameCompleted: false });
    if (window.gameAudio) {
      window.gameAudio.setMusicTheme('forest');
    }
    
    // Playtime tracker start trigger
    this.startTime = this.time.now;
    this.playerOnThorn = false;

    // Create the Canvas 'light-mask' if it doesn't already exist
    if (!this.textures.exists('light-mask')) {
      const canvasTexture = this.textures.createCanvas('light-mask', 512, 512);
      const ctx = canvasTexture.context;
      const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); // Erases solid black
      grad.addColorStop(0.25, 'rgba(0,0,0,0.95)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.25)');
      grad.addColorStop(1.0, 'rgba(0,0,0,0)'); // Leaves black untouched
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
      canvasTexture.refresh();
    }

    this.lightMaskImage = this.add.image(0, 0, 'light-mask');
    this.lightMaskImage.setVisible(false);
    this.lightMaskImage.setBlendMode(Phaser.BlendModes.ERASE);

    this.darknessOverlay = this.add.renderTexture(0, 0, 1280, 720);
    this.darknessOverlay.setScrollFactor(0);
    this.darknessOverlay.setDepth(2.5); // ABOVE sprite layers, below UI

    this.spearGraphics = this.add.graphics();
    this.shieldGraphics = this.add.graphics();
    this.lanternPool = this.add.graphics();

    this.spearGraphics.disableInteractive();
    if (this.spearGraphics.input) this.spearGraphics.input.enabled = false;
    this.shieldGraphics.disableInteractive();
    if (this.shieldGraphics.input) this.shieldGraphics.input.enabled = false;
    this.lanternPool.disableInteractive();
    if (this.lanternPool.input) this.lanternPool.input.enabled = false;

    this.lanternPool.setDepth(1.9); // ABOVE ground, BELOW player sprite base depth
    this.spearGraphics.setDepth(2.1);
    this.shieldGraphics.setDepth(2.2);

    if (!data || !data.loadFromSave) {
      const { difficulty } = window.gameState;
      // Scaled Timers matching build prompt
      let gameTime = 300; // Warrior: 5 minutes default
      if (difficulty === 'EASY') gameTime = 480; // 8 minutes
      else if (difficulty === 'hard') gameTime = 180; // 3 minutes

      updateReactState({ 
        timer: gameTime, 
        initialTimer: gameTime, 
        health: 100, 
        relicsFound: [false, false, false, false, false], 
        artifactsCollected: [],
        lanternFuel: 100,
        strikeCooldownPct: 0,
        blockCooldownPct: 0,
        bashCooldownPct: 0,
        dashCooldownPct: 0
      });
    }

    // Set world size: 2560x2560 Grid
    this.physics.world.setBounds(0, 0, 2560, 2560);
    this.cameras.main.setBounds(0, 0, 2560, 2560);
    this.cameras.main.setBackgroundColor('#0A0F14');

    // Simple floating spirit forest dust particle emitter (Ambient particle spirits)
    this.add.particles(0, 0, 'part-gold', {
      x: { min: 0, max: 2560 },
      y: { min: 0, max: 2560 },
      quantity: 1,
      frequency: 600,
      lifespan: 4000,
      speedY: { min: -15, max: -5 },
      speedX: { min: -5, max: 5 },
      alpha: { start: 0.3, end: 0.15 },
      tint: 0x00FFA3,
      scale: { start: 0.35, end: 0.15 },
      blendMode: 'ADD'
    });

    // Beautiful dynamic falling leaves simulation (using tints #1A4A2E and #2D7A4F)
    this.add.particles(0, 0, 'part-gold', {
      x: { min: 0, max: 2560 },
      y: -50,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(0, -100, 2560, 50)
      },
      gravityY: 35,
      gravityX: -15,
      speedY: { min: 25, max: 55 },
      speedX: { min: -12, max: 18 },
      scale: { start: 0.35, end: 0.65 },
      alpha: { start: 0.4, end: 0.1 },
      tint: [0x1A4A2E, 0x2D7A4F],
      frequency: 70, // Spread nicely
      lifespan: 9000,
    });

    // 1. Procedural ground tiling (draw background tiles dynamically)
    // Darkened tiles by an additional 30%+ to prevent ground competing with character & props
    const groundGroup = this.add.group();
    for (let tx = 0; tx < 40; tx++) {
      for (let ty = 0; ty < 40; ty++) {
        const rand = Math.random();
        let tileFrame = '0'; // Mossy grass (grassland)
        if (rand > 0.95) tileFrame = '3'; // Ancient stone shrines
        else if (rand > 0.85) tileFrame = '2'; // Bioluminescent magic moss
        else if (rand > 0.68) tileFrame = '1'; // Gnarled mud/root (organic dirt terrain)

        const tile = this.add.image(tx * 64 + 32, ty * 64 + 32, 'forest-tileset', tileFrame);
        if (tileFrame === '0') {
          tile.setTint(0x07110A); // Subdued deeply
        } else if (tileFrame === '1') {
          tile.setTint(0x050E0A); // Subdued deeply
        } else if (tileFrame === '2') {
          tile.setTint(0x0F301F); // Darkened bio moss
        } else if (tileFrame === '3') {
          tile.setTint(0x0F301F); // Darkened shrine tile
        }
        groundGroup.add(tile);
      }
    }

    // Scatter ambient decorative props procedurally with colors #1A4A2E and #2D7A4F
    for (let i = 0; i < 280; i++) {
      const dx = Phaser.Math.Between(50, 2510);
      const dy = Phaser.Math.Between(50, 2510);

      // Avoid player spawn area (initial spawn at x = 150, y = 1280)
      if (Phaser.Math.Distance.Between(dx, dy, 150, 1280) < 220) {
        continue;
      }

      const propType = Phaser.Math.Between(0, 2); // 0: mushroom cluster, 1: root line, 2: leaf shapes
      const color = Phaser.Math.RND.pick([0x1A4A2E, 0x2D7A4F]);
      const alpha = Phaser.Math.FloatBetween(0.5, 0.7);

      const gr = this.add.graphics({ x: dx, y: dy });
      gr.setDepth(1.1); // below player (2) and obstacles (3)

      if (propType === 0) {
        // small dark mushroom clusters
        gr.fillStyle(color, alpha);
        // mushroom 1
        gr.fillRect(-2, -5, 4, 5);
        gr.fillCircle(0, -5, 4);
        // mushroom 2
        gr.fillRect(4, -3, 3, 3);
        gr.fillCircle(5.5, -3, 3);
      } else if (propType === 1) {
        // root line graphics
        gr.lineStyle(2, color, alpha);
        gr.beginPath();
        gr.moveTo(-15, Phaser.Math.Between(-3, 3));
        gr.lineTo(0, Phaser.Math.Between(-6, 6));
        gr.lineTo(15, Phaser.Math.Between(-3, 3));
        gr.strokePath();

        gr.beginPath();
        gr.moveTo(0, 0);
        gr.lineTo(4, 4);
        gr.lineTo(8, Phaser.Math.Between(4, 12));
        gr.strokePath();
      } else {
        // faint leaf shapes
        gr.fillStyle(color, alpha);
        const leavesCount = Phaser.Math.Between(2, 4);
        for (let j = 0; j < leavesCount; j++) {
          const lx = Phaser.Math.Between(-10, 10);
          const ly = Phaser.Math.Between(-10, 10);
          
          // Draw standard diamond leaf path
          gr.beginPath();
          gr.moveTo(lx, ly - 3);
          gr.lineTo(lx + 2.5, ly);
          gr.lineTo(lx, ly + 3);
          gr.lineTo(lx - 2.5, ly);
          gr.closePath();
          gr.fillPath();
        }
      }
    }

    // Initialize idle tracking variables
    this.lastPlayerMoveTime = this.time.now;
    this.lastChimePlayTime = this.time.now;

    // 2. Obstacles Group (Gnarled Ancient trees)
    this.obstacles = this.physics.add.staticGroup();
    // Breed 36 trees randomly (keep away from spawn x=150, y=1280, and relic positions)
    const relicCoords = [
      { x: 400, y: 500 },
      { x: 2200, y: 400 },
      { x: 1280, y: 2100 },
      { x: 2300, y: 2200 },
      { x: 1280, y: 1280 },
    ];

    for (let i = 0; i < 38; i++) {
      let tx = 300 + Math.random() * 2000;
      let ty = 200 + Math.random() * 2100;
      
      // Prevent spawning directly on player or relics
      let tooClose = Phaser.Math.Distance.Between(tx, ty, 150, 1280) < 250;
      relicCoords.forEach(relic => {
        if (Phaser.Math.Distance.Between(tx, ty, relic.x, relic.y) < 180) {
          tooClose = true;
        }
      });

      if (!tooClose) {
        const tree = this.obstacles.create(tx, ty, 'forest-tree');
        tree.setBodySize(50, 50); // smaller collider for walking under canopy
        tree.setTint(0x0B2114); // Recessive dark tree foliage/tint
        tree.refreshBody();
      }
    }

    // 3. Spawning player Jama
    const startX = (data && data.loadFromSave && typeof data.playerX === 'number') ? data.playerX : 150;
    const startY = (data && data.loadFromSave && typeof data.playerY === 'number') ? data.playerY : 1280;
    this.player = this.physics.add.sprite(startX, startY, 'jama');
    this.player.setCollideWorldBounds(true);
    this.player.setBodySize(32, 32);
    this.player.setDepth(2);
    this.player.play('jama-idle');
    this.player.setTint(0x00FFA3);

    // Create soft pulsing aura beneath player sprite (approximately 0.6x player display width -> radius 10)
    const aura = this.add.graphics();
    aura.fillStyle(0x00FFA3, 1.0);
    aura.fillCircle(0, 0, 10);
    aura.setDepth(1.9); // Renders below player sprite (depth 2)
    (this as any).playerAura = aura;

    this.tweens.add({
      targets: aura,
      alpha: { from: 0.18, to: 0.08 },
      scaleX: { from: 1.15, to: 0.9 },
      scaleY: { from: 1.15, to: 0.9 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Player collides with trees
    this.physics.add.collider(this.player, this.obstacles);

    // 4. Interactive Relics
    this.relicsGroup = this.physics.add.staticGroup();
    relicCoords.forEach((coord, index) => {
      const relic = this.relicsGroup.create(coord.x, coord.y, `relic-${index + 1}`) as Phaser.Physics.Arcade.Sprite;
      relic.setData('relicIdx', index);
      relic.setData('name', ['Drum of Ancestors', 'Bone Mask of Elders', 'Spear of Mbeki', 'Beaded Crown of Queens', 'Calabash of Spirits'][index]);
      
      // Apply correct tint based on rarity
      const isRare = (index === 3); // Beaded Crown of Queens as rare/special
      relic.setTint(isRare ? 0xD4A017 : 0x9B4DCA);

      // Pulse tween
      this.tweens.add({
        targets: relic,
        alpha: { from: 1.0, to: 0.75 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Floating glowing animation for the relics
      this.tweens.add({
        targets: relic,
        y: coord.y - 10,
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // Gold swirling particle rings behind relics
    this.goldParticles = this.add.particles(0, 0, 'part-gold', {
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.6, end: 0 },
      speed: 10,
      frequency: 200,
      lifespan: 1000,
      blendMode: 'ADD',
    });

    // 4b. Spawning Interactive Thorny Bushes (Environmental Hazard - Slows & Damages on contact)
    this.thornsGroup = this.physics.add.staticGroup();
    for (let i = 0; i < 15; i++) {
      let tx = 400 + Math.random() * 1900;
      let ty = 300 + Math.random() * 2000;
      
      let tooClose = Phaser.Math.Distance.Between(tx, ty, 150, 1280) < 250;
      relicCoords.forEach(relic => {
        if (Phaser.Math.Distance.Between(tx, ty, relic.x, relic.y) < 200) {
          tooClose = true;
        }
      });

      if (!tooClose) {
        const thorn = this.thornsGroup.create(tx, ty, 'thorn-bush');
        thorn.setBodySize(36, 36);
        thorn.setTint(0x0F2E1E); // Subdued static obstacle shadow
        thorn.refreshBody();
      }
    }

    // Overlap callback between player and thorny bushes hazard
    this.physics.add.overlap(this.player, this.thornsGroup, () => {
      this.playerOnThorn = true;
      if (this.time.now > (this.lastThornDamageTime || 0) + 1200) {
        this.lastThornDamageTime = this.time.now;
        // Minor damage deals 6 on contact
        this.damagePlayer(6);
        this.showFloatingText(this.player.x, this.player.y - 20, 'THORNS! -6HP', 0xff3333);
        if (window.gameAudio) {
          window.gameAudio.playSfx('hurt');
        }
      }
    });

    // 4c. Spawning Sutherlandia Healing Herbs (Gifts of the Forest)
    this.herbsGroup = this.physics.add.staticGroup();
    // Spawn 10 beautiful healing herbs at random places throughout the level
    for (let i = 0; i < 10; i++) {
      let hx = 250 + Math.random() * 2000;
      let hy = 200 + Math.random() * 2100;
      
      let tooClose = Phaser.Math.Distance.Between(hx, hy, 150, 1280) < 250;
      relicCoords.forEach(relic => {
        if (Phaser.Math.Distance.Between(hx, hy, relic.x, relic.y) < 150) {
          tooClose = true;
        }
      });

      if (!tooClose) {
        const herb = this.herbsGroup.create(hx, hy, 'sutherlandia-herb');
        herb.setTint(0x39E07A); // Bright organic glowing herb (props are brightest elements)
        // Let them pulse subtle scale tween
        this.tweens.add({
          targets: herb,
          scale: 1.25,
          duration: 1000 + Math.random() * 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    }

    // 4d. Spawning Lush Forest Shrubs top-down (depth overlay so player can navigate through & hide behind)
    this.shrubsGroup = this.add.group();
    for (let i = 0; i < 48; i++) {
      let sx = 200 + Math.random() * 2200;
      let sy = 200 + Math.random() * 2200;

      // Prevent spawning directly on player spawn position
      let tooClose = Phaser.Math.Distance.Between(sx, sy, 150, 1280) < 220;
      relicCoords.forEach(relic => {
        if (Phaser.Math.Distance.Between(sx, sy, relic.x, relic.y) < 130) {
          tooClose = true;
        }
      });

      if (!tooClose) {
        const shrub = this.add.sprite(sx, sy, 'forest-shrub');
        shrub.setTint(0x227845); // Rich mid-ground shrub canopy (brighter than background trees)
        shrub.setScale(1.2 + Math.random() * 0.45);
        shrub.setAngle(Math.random() * 360);
        shrub.setDepth(3); // Renders above the player (set to Depth 2) giving a real walk-under canopy/hide-behind effect!
        shrub.setAlpha(0.92); // Slightly translucent so Jama is subtly visible when underneath!
        this.shrubsGroup.add(shrub);
      }
    }

    // Overlap callback for gathering Sutherlandia healing herbs
    this.physics.add.overlap(this.player, this.herbsGroup, (playerObj, herbObj) => {
      const herb = herbObj as Phaser.Physics.Arcade.Sprite;
      if (herb.active) {
        herb.destroy();
        
        // Heal player
        const healedAmt = 25;
        const nextHp = Math.min(100, window.gameState.health + healedAmt);
        updateReactState({ health: nextHp });
        
        // Effects
        this.showFloatingText(herb.x, herb.y, `+${healedAmt} HP Sutherlandia`, 0x10b981);
        if (window.gameAudio) {
          window.gameAudio.playSfx('collect');
        }
        
        // Green healing splash particles
        const healParticles = this.add.particles(herb.x, herb.y, 'part-gold', {
          scale: { start: 0.6, end: 0 },
          alpha: { start: 1, end: 0 },
          speed: 40,
          lifespan: 600,
          maxParticles: 12,
        });
        this.time.delayedCall(800, () => {
          healParticles.destroy();
        });
      }
    });

    // 5. Enemies Group of 3 distinct types
    this.enemiesGroup = this.physics.add.group();
    this.projectilesGroup = this.physics.add.group();

    let enemySpecs = [
      // Guarding relic zones
      { type: 'crawler', x: 500, y: 450 },
      { type: 'crawler', x: 2100, y: 500 },
      { type: 'caller', x: 1380, y: 2000 },
      { type: 'caller', x: 2150, y: 2150 },
      { type: 'wraith', x: 1200, y: 1350 },
      { type: 'wraith', x: 1400, y: 1200 },
    ];

    // Distribute more random enemies
    for (let i = 0; i < 11; i++) {
      enemySpecs.push({ type: 'wraith', x: 400 + Math.random() * 1800, y: 300 + Math.random() * 1900 });
    }
    for (let i = 0; i < 5; i++) {
      enemySpecs.push({ type: 'crawler', x: 500 + Math.random() * 1600, y: 400 + Math.random() * 1600 });
    }
    for (let i = 0; i < 3; i++) {
      enemySpecs.push({ type: 'caller', x: 600 + Math.random() * 1400, y: 600 + Math.random() * 1400 });
    }

    const { difficulty } = window.gameState;
    const maxAllowedEnemies = difficulty === 'hard' ? 8 : (difficulty === 'Medium' ? 5 : 3);
    const validSpecs = enemySpecs.filter(spec => Phaser.Math.Distance.Between(spec.x, spec.y, 150, 1280) > 350);
    const activeSpecs = validSpecs.slice(0, maxAllowedEnemies);

    activeSpecs.forEach((spec, i) => {
      const enemy = this.enemiesGroup.create(spec.x, spec.y, spec.type) as Phaser.Physics.Arcade.Sprite;
        enemy.setData('type', spec.type);
        enemy.setData('id', i);
        enemy.setData('hp', spec.type === 'caller' ? 30 : (spec.type === 'crawler' ? 40 : 25));
        enemy.setData('state', 'patrol'); // patrol, alert, chase, charge, coolDown
        // Store waypoint triggers
        enemy.setData('patrolX', spec.x);
        enemy.setData('patrolY', spec.y);
        enemy.setData('patrolTimer', 0);
        enemy.setData('shootTimer', 0);
        enemy.setCollideWorldBounds(true);
        enemy.setBodySize(32, 32);
        enemy.setTint(0x8B1A1A); // Enemy base tint
        enemy.setDepth(1.5);

        // Call the unified glow creator
        attachEnemyGlow(this, enemy);
    });

    this.physics.add.collider(this.enemiesGroup, this.obstacles);
    this.physics.add.collider(this.enemiesGroup, this.enemiesGroup);

    // Blood spill emitter for hits
    this.bloodParticles = this.add.particles(0, 0, 'part-blood', {
      scale: { start: 0.6, end: 0 },
      speed: 100,
      lifespan: 500,
      frequency: -1,
      blendMode: 'ADD',
    });

    // Handle projectile impact on player, obstacles, or reflected hit on enemies
    this.physics.add.overlap(this.projectilesGroup, this.enemiesGroup, (projNode, enemyNode) => {
      const proj = projNode as Phaser.Physics.Arcade.Sprite;
      const enemy = enemyNode as Phaser.Physics.Arcade.Sprite;
      
      if (proj.getData('isReflected')) {
        proj.destroy();
        // Deal 1.5x damage back to enemy on parry reflect
        const damageAmount = Math.round(specScalerDamage(25) * 1.5);
        this.hitEnemy(enemy, damageAmount, proj.body ? proj.body.velocity.x * 0.05 : 0, proj.body ? proj.body.velocity.y * 0.05 : 0);
      }
    });

    this.physics.add.collider(this.projectilesGroup, this.obstacles, (proj) => {
      proj.destroy();
    });

    this.physics.add.overlap(this.player, this.projectilesGroup, (pl, projNode) => {
      const proj = projNode as Phaser.Physics.Arcade.Sprite;
      
      // Determine if blocking state is active to trigger reflection
      if (this.isBlocking) {
        const blockDuration = this.time.now - this.blockStartTime;
        if (blockDuration <= 600) {
          // Parry reflect!
          proj.setData('isReflected', true);
          proj.setTint(0xFFD700);
          
          if (proj.body) {
            proj.body.velocity.x *= -1.5;
            proj.body.velocity.y *= -1.5;
          }
          
          if (window.gameAudio) {
            window.gameAudio.playReflectSound();
          }
          
          this.shieldFlashState = 'gold';
          this.time.delayedCall(150, () => {
            if (this.shieldFlashState === 'gold') this.shieldFlashState = null;
          });
          
          // Display floating parry text
          const text = this.add.text(this.player.x, this.player.y - 42, "PARRIED!", {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
          });
          text.setOrigin(0.5);
          text.setDepth(3.0);
          this.tweens.add({
            targets: text,
            y: text.y - 25,
            alpha: 0,
            duration: 1200,
            onComplete: () => text.destroy()
          });
        } else {
          // Standard block absorbs 80% damage
          proj.destroy();
          this.damagePlayer(Math.round(specScalerDamage(25) * 0.20));
          
          this.shieldFlashState = 'blue';
          this.time.delayedCall(150, () => {
            if (this.shieldFlashState === 'blue') this.shieldFlashState = null;
          });
        }
      } else {
        proj.destroy();
        this.damagePlayer(specScalerDamage(25));
      }
    });

    // Support start gameplay trigger to pause/freeze during prologue intro overlays
    this.gameplayStarted = false;
    
    (window as any).startForestGameplay = () => {
      if (this.gameplayStarted) return;
      this.gameplayStarted = true;
      this.physics.resume();
      
      this.timerInterval = setInterval(() => {
        if (window.gameState.timer > 0 && !window.gameState.isGameOver && !window.gameState.gameCompleted && !window.gameState.isPaused) {
          const newTimer = window.gameState.timer - 1;
          updateReactState({ timer: newTimer });

          if (newTimer === 0) {
            this.triggerTimeFail();
          }
        }
      }, 1000);
    };

    const isSaveLoaded = (window as any).skipForestIntroOnce || localStorage.getItem('isSaveLoaded') === 'true';
    if (isSaveLoaded) {
      this.gameplayStarted = true;
      localStorage.removeItem('isSaveLoaded');
      (window as any).skipForestIntroOnce = true;
      
      this.timerInterval = setInterval(() => {
        if (window.gameState.timer > 0 && !window.gameState.isGameOver && !window.gameState.gameCompleted && !window.gameState.isPaused) {
          const newTimer = window.gameState.timer - 1;
          updateReactState({ timer: newTimer });

          if (newTimer === 0) {
            this.triggerTimeFail();
          }
        }
      }, 1000);
    } else {
      this.physics.pause();
      this.time.delayedCall(60, () => {
        if (typeof (window as any).showReactForestIntro === 'function') {
          (window as any).showReactForestIntro();
        }
      });
    }

    // Difficulty factor modifiers
    const difficultyScaler = () => {
      const { difficulty } = window.gameState;
      return difficulty === 'hard' ? 1.4 : (difficulty === 'Medium' ? 1.0 : 0.7);
    };

    const specScalerDamage = (base: number) => {
      return Math.round(base * difficultyScaler());
    };

    // React hooks to fire from custom window events (React D-pad clicks)
    (window as any).triggerPhaserAttack = () => {
      if (this.scene.isActive() && this.player && this.player.active) {
        this.triggerSpearAttack();
      }
    };

    (window as any).triggerPhaserDash = () => {
      if (this.scene.isActive() && this.player && this.player.active) {
        this.triggerDash();
      }
    };

    (window as any).triggerPhaserBash = () => {
      if (this.scene.isActive() && this.player && this.player.active) {
        this.triggerShieldBash();
      }
    };

    (window as any).triggerPhaserCollect = () => {
      if (this.scene.isActive() && this.player && this.player.active) {
        this.triggerCollect();
      }
    };

    // --- PROCEDURAL ATMOSPHERIC HORROR INITIALIZATIONS ---

    // EFFECT 3 — Fog creep:
    const fog = this.add.rectangle(1280, 1280, 2560, 2560, 0x050d08);
    fog.setDepth(1.4);
    fog.alpha = 0;
    this.tweens.add({
      targets: fog,
      alpha: 0.18,
      duration: 8000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // EFFECT 1 — Eyes in the darkness:
    this.eyesGroup = this.add.group();
    for (let i = 0; i < 10; i++) {
      const eyes = new EyePair(this);
      this.eyesGroup.add(eyes);
    }

    // EFFECT 2 — Shadow figures at the edge:
    const scheduleShadowFigure = () => {
      this.shadowTimer = this.time.delayedCall(Phaser.Math.Between(15000, 25000), () => {
        this.spawnShadowFigure();
        scheduleShadowFigure();
      });
    };
    scheduleShadowFigure();

    // EFFECT 4 — Distant howl visual response:
    const scheduleHowlShockwave = () => {
      this.howlShockwaveTimer = this.time.delayedCall(Phaser.Math.Between(20000, 40000), () => {
        this.triggerHowlShockwave();
        scheduleHowlShockwave();
      });
    };
    scheduleHowlShockwave();

    // EFFECT 5 — Ground mist wisps:
    this.mistStrips = [];
    const grCount = Phaser.Math.Between(5, 8);
    for (let i = 0; i < grCount; i++) {
      const rect = this.add.rectangle(0, 0, 300, 20, 0x0e2218, 0.25);
      rect.setDepth(1.35);
      const startX = Phaser.Math.Between(0, 2560);
      const startY = Phaser.Math.Between(0, 2560);
      rect.setPosition(startX, startY);
      const speed = Phaser.Math.FloatBetween(8, 15) * (Math.random() < 0.5 ? -1 : 1);
      this.mistStrips.push({ rect, speed });
    }

    // VISUAL — Dead animal remains:
    const numRemains = Phaser.Math.Between(4, 6);
    this.remainsGroup = this.add.group();
    for (let r = 0; r < numRemains; r++) {
      let rx = 0;
      let ry = 0;
      for (let attempts = 0; attempts < 50; attempts++) {
        rx = Phaser.Math.Between(100, 2460);
        ry = Phaser.Math.Between(100, 2460);
        if (Phaser.Math.Distance.Between(rx, ry, 150, 1280) < 300) {
          continue;
        }
        break;
      }

      const remainsGraphics = this.add.graphics({ x: rx, y: ry });
      remainsGraphics.setDepth(1.25);

      // Faint red stain beneath
      remainsGraphics.fillStyle(0x3d0000, 0.15);
      remainsGraphics.fillCircle(0, 0, 20);

      const propType = Phaser.Math.Between(0, 2);

      if (propType === 0) {
        // Dead bird
        const rRotation = Phaser.Math.FloatBetween(0, Math.PI * 2);
        remainsGraphics.setRotation(rRotation);

        remainsGraphics.fillStyle(0x3d2b1f, 0.8);
        remainsGraphics.beginPath();
        remainsGraphics.moveTo(-7.5, 5);
        remainsGraphics.lineTo(7.5, 5);
        remainsGraphics.lineTo(0, -5);
        remainsGraphics.closePath();
        remainsGraphics.fillPath();

        remainsGraphics.lineStyle(1.5, 0x2a1e15, 0.8);
        remainsGraphics.beginPath();
        remainsGraphics.moveTo(-3, 0);
        remainsGraphics.lineTo(-12, -4);
        remainsGraphics.moveTo(3, 0);
        remainsGraphics.lineTo(12, 4);
        remainsGraphics.strokePath();

        remainsGraphics.fillStyle(0x3d2b1f, 0.8);
        remainsGraphics.fillCircle(0, -8, 3);
      } else if (propType === 1) {
        // Dead small animal (rat/mongoose)
        const rotationAngle = Phaser.Math.DegToRad(Phaser.Math.Between(80, 100));
        remainsGraphics.setRotation(rotationAngle);

        remainsGraphics.fillStyle(0x2e2218, 0.8);
        remainsGraphics.fillEllipse(0, 0, 25, 10);

        remainsGraphics.lineStyle(1.5, 0x2a1e15, 0.8);
        remainsGraphics.beginPath();
        remainsGraphics.moveTo(-12.5, 0);
        remainsGraphics.lineTo(-16, -3);
        remainsGraphics.lineTo(-20, -1);
        remainsGraphics.strokePath();

        remainsGraphics.fillStyle(0x2e2218, 0.8);
        remainsGraphics.fillCircle(14, 0, 4);

        remainsGraphics.fillStyle(0x1a0f0a, 0.8);
        remainsGraphics.fillCircle(15, -1, 1.25);
      } else {
        // Scattered bones
        remainsGraphics.lineStyle(1.5, 0x4a4035, 0.6);
        const bonesCount = Phaser.Math.Between(3, 4);
        for (let b = 0; b < bonesCount; b++) {
          const bx = Phaser.Math.Between(-10, 10);
          const by = Phaser.Math.Between(-10, 10);
          const boneLenX = Phaser.Math.Between(5, 12) * (Math.random() < 0.5 ? -1 : 1);
          const boneLenY = Phaser.Math.Between(5, 12) * (Math.random() < 0.5 ? -1 : 1);

          remainsGraphics.beginPath();
          remainsGraphics.moveTo(bx, by);
          remainsGraphics.lineTo(bx + boneLenX, by + boneLenY);
          remainsGraphics.strokePath();

          remainsGraphics.strokeCircle(bx, by, 1.25);
          remainsGraphics.strokeCircle(bx + boneLenX, by + boneLenY, 1.25);
        }
      }
      this.remainsGroup.add(remainsGraphics);
    }

    // Clean shutdown listener
    this.events.on('shutdown', () => {
      clearInterval(this.timerInterval);
      if (this.shadowTimer) {
        this.shadowTimer.destroy();
      }
      if (this.howlShockwaveTimer) {
        this.howlShockwaveTimer.destroy();
      }
    });
  }

  spawnShadowFigure() {
    const cam = this.cameras.main;
    const viewWidth = cam.width;
    const viewHeight = cam.height;
    
    const leftX = cam.scrollX;
    const topY = cam.scrollY;
    
    const edge = Phaser.Math.Between(0, 3); // 0: Top, 1: Bottom, 2: Left, 3: Right
    let sx = 0;
    let sy = 0;
    const margin = 35;

    if (edge === 0) {
      sx = Phaser.Math.Between(leftX + 50, leftX + viewWidth - 50);
      sy = topY + margin;
    } else if (edge === 1) {
      sx = Phaser.Math.Between(leftX + 50, leftX + viewWidth - 50);
      sy = topY + viewHeight - margin;
    } else if (edge === 2) {
      sx = leftX + margin;
      sy = Phaser.Math.Between(topY + 50, topY + viewHeight - 50);
    } else {
      sx = leftX + viewWidth - margin;
      sy = Phaser.Math.Between(topY + 50, topY + viewHeight - 50);
    }

    const gr = this.add.graphics();
    gr.setDepth(1.45);

    const color = 0x1a0a0a;
    gr.fillStyle(color, 1.0);
    gr.lineStyle(2, color, 1.0);

    gr.fillCircle(0, -18, 5);
    gr.beginPath();
    gr.moveTo(0, -13);
    gr.lineTo(0, 2);
    gr.moveTo(-10, -8);
    gr.lineTo(10, -8);
    gr.moveTo(0, 2);
    gr.lineTo(-8, 18);
    gr.moveTo(0, 2);
    gr.lineTo(8, 18);
    gr.strokePath();

    gr.setPosition(sx, sy);
    gr.alpha = 0;

    this.tweens.add({
      targets: gr,
      alpha: 0.4,
      duration: 50,
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          if (gr.active) {
            this.tweens.add({
              targets: gr,
              alpha: 0,
              duration: 600,
              onComplete: () => {
                gr.destroy();
              }
            });
          }
        });
      }
    });
  }

  triggerHowlShockwave() {
    const cam = this.cameras.main;
    const viewWidth = cam.width;
    const viewHeight = cam.height;
    
    const minX = cam.scrollX;
    const maxX = cam.scrollX + viewWidth;
    const minY = cam.scrollY;
    const maxY = cam.scrollY + viewHeight;

    let hx = 0;
    let hy = 0;
    for (let attempts = 0; attempts < 50; attempts++) {
      hx = Phaser.Math.Between(100, 2460);
      hy = Phaser.Math.Between(100, 2460);
      if (hx < minX || hx > maxX || hy < minY || hy > maxY) {
        break;
      }
    }

    const shockwave = this.add.graphics();
    shockwave.setDepth(1.28);
    
    shockwave.lineStyle(3, 0x2D7A4F, 1.0);
    shockwave.strokeCircle(0, 0, 100);
    shockwave.setPosition(hx, hy);
    shockwave.setScale(0);
    shockwave.alpha = 0.3;

    this.tweens.add({
      targets: shockwave,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        shockwave.destroy();
      }
    });
  }

  update(time: number, delta: number) {
    if (window.gameState.isGameOver || window.gameState.gameCompleted) return;

    if (window.gameState.isPaused) {
      if (this.physics && this.physics.world && !this.physics.world.isPaused) {
        this.physics.pause();
        this.anims.pauseAll();
        this.tweens.pauseAll();
        if (this.player && this.player.active) {
          this.player.setVelocity(0, 0);
        }
        const enemies = this.enemiesGroup?.getChildren() as Phaser.Physics.Arcade.Sprite[];
        if (enemies) {
          enemies.forEach(e => {
            if (e.active) e.setVelocity(0, 0);
          });
        }
      }
      return;
    } else {
      if (this.physics && this.physics.world && this.physics.world.isPaused && this.gameplayStarted) {
        this.physics.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();
      }
    }

    if (!this.gameplayStarted) {
      if (this.player && this.player.active) {
        this.player.setVelocity(0, 0);
        this.player.play('jama-idle', true);
        this.player.setRotation(0);
      }
      // If we are paused, clear weapons so they don't drift
      if (this.spearGraphics) this.spearGraphics.clear();
      if (this.shieldGraphics) this.shieldGraphics.clear();
      return;
    }

    // Set blocking state based on gameInput block key hold or D-Pad action hold, but only if not dashing or bashing
    const wasBlocking = this.isBlocking;
    const isBlockHeld = !!(window.gameInput && window.gameInput.block);
    
    if (isBlockHeld && !this.isDashing && !this.isShieldBashing) {
      const now = this.time.now;
      const blockCooldownRemaining = Math.max(0, 3000 - (now - this.lastBlockTime));
      
      if (blockCooldownRemaining <= 0) {
        if (!wasBlocking) {
          this.isBlocking = true;
          this.blockStartTime = now;
        } else if (now - this.blockStartTime > 2500) {
          // Automatic shield block fatigue / reset after 2.5 seconds hold
          this.isBlocking = false;
          this.lastBlockTime = now;
        }
      } else {
        this.isBlocking = false;
      }
    } else {
      if (wasBlocking) {
        this.isBlocking = false;
        this.lastBlockTime = this.time.now;
      }
    }

    // Sync cooldowns back to React State!
    const strikeCooldownPct = Math.max(0, 800 - (time - this.lastStrikeTime)) / 800;
    const blockCooldownPct = Math.max(0, 3000 - (time - this.lastBlockTime)) / 3000;
    const bashCooldownPct = Math.max(0, 4000 - (time - this.lastBashTime)) / 4000;
    const dashCooldownPct = Math.max(0, 2200 - (time - this.lastDashTime)) / 2200;
    
    if (Math.floor(time) % 4 === 0) { // Throttled updates to prevent lag
      updateReactState({ 
        strikeCooldownPct, 
        blockCooldownPct, 
        bashCooldownPct, 
        dashCooldownPct 
      });
    }

    // --- HEARTBEAT RATE & PROXIMITY CALCULATOR ---
    let nearbyThreats = 0;
    this.enemiesGroup.getChildren().forEach((node) => {
      const enemy = node as Phaser.Physics.Arcade.Sprite;
      if (enemy && enemy.active) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (d < 400) {
          nearbyThreats++;
        }
      }
    });

    let beatInterval = 1800; // slow/calm rate
    if (nearbyThreats === 1) beatInterval = 1100;
    else if (nearbyThreats === 2) beatInterval = 700;
    else if (nearbyThreats >= 3) beatInterval = 400;

    if (time > this.lastHeartbeatTime + beatInterval) {
      this.lastHeartbeatTime = time;
      
      // Trigger lub-dub sound and visual pulses
      if (window.gameAudio && typeof window.gameAudio.playHeartbeatSound === 'function') {
        window.gameAudio.playHeartbeatSound();
      }
      this.triggerHeartbeatVisual(180, 45);
      
      this.vignetteHeartbeatPulseEndTime = time + 400;
      
      this.time.delayedCall(220, () => {
        if (this.player && this.player.active) {
          if (window.gameAudio && typeof window.gameAudio.playHeartbeatSound === 'function') {
            window.gameAudio.playHeartbeatSound();
          }
          this.triggerHeartbeatVisual(140, 35);
        }
      });
    }

    // Calculate lub-dub contractions for vignette scaling and alpha spiking
    let heartbeatAlphaCorrection = 0;
    let heartbeatScaleCorrection = 0;
    
    if (time < this.lastHeartbeatTime + 180) {
      const progress = (time - this.lastHeartbeatTime) / 180;
      const pulseFactor = Math.sin(progress * Math.PI);
      heartbeatAlphaCorrection = 0.07 * pulseFactor;
      heartbeatScaleCorrection = 15 * pulseFactor;
    } else if (time >= this.lastHeartbeatTime + 220 && time < this.lastHeartbeatTime + 360) {
      const progress = (time - (this.lastHeartbeatTime + 220)) / 140;
      const pulseFactor = Math.sin(progress * Math.PI);
      heartbeatAlphaCorrection = 0.04 * pulseFactor;
      heartbeatScaleCorrection = 8 * pulseFactor;
    }

    // --- LANTERN & VIGNETTE EFFECT RENDER ENGINE ---
    if (this.player && this.player.active) {
      this.darknessOverlay.clear();
      
      const finalAlpha = Math.min(0.97, 0.82 + heartbeatAlphaCorrection);
      this.darknessOverlay.fill(0x000000, finalAlpha);
      
      const screenX = this.player.x - this.cameras.main.scrollX;
      const screenY = this.player.y - this.cameras.main.scrollY;
      
      const fuel = window.gameState.lanternFuel ?? 100;
      const fuelFactor = Math.max(0.2, fuel / 100);
      
      // Breathing oscillations
      const isThreatened = (nearbyThreats > 0);
      const breathSpeed = isThreatened ? 0.015 : (fuel < 25 ? 0.009 : 0.004);
      const breathAmp = isThreatened ? 0.08 : (fuel < 25 ? 0.12 : 0.04);
      const breathScale = 1.0 + Math.sin(time * breathSpeed) * breathAmp;
      
      // Random flicker trigger (every 2-5 seconds)
      let flickerScaleReduction = 0;
      let flickerAlphaReduction = 0;
      if (time > this.nextFlickerTime) {
        this.nextFlickerTime = time + Phaser.Math.Between(2000, 5000);
        this.flickerEndTime = time + Phaser.Math.Between(150, 300);
        this.isFlickering = true;
      }
      if (time < this.flickerEndTime) {
        flickerScaleReduction = 0.15; // shinks radius slightly
        flickerAlphaReduction = 0.06;
      } else {
        this.isFlickering = false;
      }

      const finalScale = 0.75 * fuelFactor * breathScale * (1.0 - flickerScaleReduction) - (heartbeatScaleCorrection / 256);
      this.lightMaskImage.setScale(Math.max(0.1, finalScale));
      this.darknessOverlay.draw(this.lightMaskImage, screenX, screenY);
      
      // Redraw lantern light pool underlying props
      this.lanternPool.clear();
      const innerColor = 0xf5c842;
      const innerAlpha = Math.max(0, 0.12 - flickerAlphaReduction);
      const outerAlpha = Math.max(0, 0.04 - flickerAlphaReduction);
      
      this.lanternPool.fillStyle(innerColor, innerAlpha);
      this.lanternPool.fillCircle(this.player.x, this.player.y, 110 * finalScale);
      
      this.lanternPool.fillStyle(innerColor, outerAlpha);
      this.lanternPool.fillCircle(this.player.x, this.player.y, 200 * finalScale);
    }

    // Call weapon custom graphics draw
    this.drawWeapons();

    // --- HORROR ATMOSPHERIC UPDATE LOOPS ---

    // Eyes retreat checks
    if (this.player && this.player.active && this.eyesGroup) {
      this.eyesGroup.getChildren().forEach((eyesObj) => {
        const eyes = eyesObj as any;
        if (eyes && !eyes.isFadingOut) {
          const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, eyes.x, eyes.y);
          if (d < 150) {
            eyes.retreat();
          }
        }
      });
    }

    // Mist wisps drift and camera wrapping
    const cam = this.cameras.main;
    const viewWidth = cam.width;
    const leftBound = cam.scrollX - 200;
    const rightBound = cam.scrollX + viewWidth + 200;

    if (this.mistStrips && this.mistStrips.length > 0) {
      const dt = delta / 1000;
      this.mistStrips.forEach((wisp) => {
        const r = wisp.rect;
        r.x += wisp.speed * dt;

        if (wisp.speed > 0 && r.x > rightBound) {
          r.x = leftBound;
          r.y = Phaser.Math.Between(Math.max(0, cam.scrollY), Math.min(2560, cam.scrollY + cam.height));
        } else if (wisp.speed < 0 && r.x < leftBound) {
          r.x = rightBound;
          r.y = Phaser.Math.Between(Math.max(0, cam.scrollY), Math.min(2560, cam.scrollY + cam.height));
        }
      });
    }

    // Periodic player coordinate state tracking for Mini-Map display check (throttled for high frame rates)
    if (time > this.lastPosSyncTime + 120) {
      this.lastPosSyncTime = time;
      if (this.player && this.player.active) {
        updateReactState({ playerX: Math.round(this.player.x), playerY: Math.round(this.player.y) });
      }
    }

    if (this.player && this.player.active && (this as any).playerAura) {
      (this as any).playerAura.setPosition(this.player.x, this.player.y);
    }

    // Forest Blessing: Natural beautiful 2D forest healing tick (+3 HP every 4 seconds) if not in immediate danger
    if (!this.playerOnThorn && window.gameState.health < 100) {
      if (!this.lastRegenTime) this.lastRegenTime = time;
      if (time > this.lastRegenTime + 4000) {
        this.lastRegenTime = time;
        const nextHp = Math.min(100, window.gameState.health + 3);
        updateReactState({ health: nextHp });
        this.showFloatingText(this.player.x, this.player.y - 35, '+3 HP Forest Blessing', 0x10b981);
      }
    } else if (this.playerOnThorn) {
      // standing on thorns halts passive healing tick and pushes timer forward
      this.lastRegenTime = time;
    }

    // 1. Process movement controls bounded to continuous window.gameInput values
    let vx = 0;
    let vy = 0;

    if (window.gameInput.up) vy = -1;
    else if (window.gameInput.down) vy = 1;

    if (window.gameInput.left) vx = -1;
    else if (window.gameInput.right) vx = 1;

    // Check Crouch state
    const isCrouching = !!(window.gameInput as any).crouch;
    this.playerHiding = false;

    if (isCrouching) {
      this.player.setScale(1.0, 0.65); // squash vertically to crawl
      // Calculate proximity to shrubs
      this.shrubsGroup.getChildren().forEach((shrubNode) => {
        const shrub = shrubNode as Phaser.GameObjects.Sprite;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, shrub.x, shrub.y);
        if (d < 52) {
          this.playerHiding = true;
        }
      });
      
      if (this.playerHiding) {
        this.player.setAlpha(0.35); // highly camouflaged inside bush
        // Emit beautiful natural leaf green/gold particles occasionally
        if (Math.random() < 0.04) {
          this.goldParticles.emitParticleAt(this.player.x + (Math.random() - 0.5) * 16, this.player.y + (Math.random() - 0.5) * 16);
        }
      } else {
        this.player.setAlpha(0.65); // crouched translucent
      }

      // Crouch Healing Tick (one-second intervals matching chosen difficulty tier rate)
      let lastCrouchHeal = this.player.getData('lastCrouchHealTime') || 0;
      if (time > lastCrouchHeal + 1000) {
        this.player.setData('lastCrouchHealTime', time);
        if (window.gameState.health < 100) {
          const { difficulty } = window.gameState;
          const healRate = difficulty === 'hard' ? 1 : (difficulty === 'Medium' ? 3 : 5);
          const nextHp = Math.min(100, window.gameState.health + healRate);
          updateReactState({ health: nextHp });
          this.showFloatingText(this.player.x, this.player.y - 35, `+${healRate} HP Spirit Mend`, 0x10b981);
        }
      }
    } else {
      this.player.setScale(1.0, 1.0);
      this.player.setAlpha(1.0);
    }

    // Normalize diagonal velocity vector
    let speed = this.isDashing ? 420 : (isCrouching ? 75 : 160);
    if (this.playerOnThorn) {
      speed = isCrouching ? 45 : 70; // majorly slowed down!
    }
    this.playerOnThorn = false; // reset for overlap detection in the current frame

    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    this.player.setVelocity(vx * speed, vy * speed);

    // Dynamic animations and flipping based on movement
    if (vx !== 0 || vy !== 0) {
      const angle = Math.atan2(vy, vx);
      this.player.setData('facingAngle', angle);

      if (vx < 0) {
        this.player.setFlipX(true);
      } else if (vx > 0) {
        this.player.setFlipX(false);
      }

      // Lean slightly into movement
      this.player.setRotation(vx * 0.12);

      if (!this.isAttacking) {
        this.player.play('jama-run', true);
      }

      this.lastPlayerMoveTime = time;
    } else {
      if (!this.isAttacking) {
        this.player.play('jama-idle', true);
        this.player.setRotation(0);
      }

      // Spirit chimes/whispers when player is idle for more than 5 seconds
      if (time - this.lastPlayerMoveTime > 5000) {
        if (time - this.lastChimePlayTime > 3000) {
          this.lastChimePlayTime = time;
          if (Math.random() < 0.25) {
            if (window.gameAudio && typeof window.gameAudio.playSpiritChime === 'function') {
              window.gameAudio.playSpiritChime();
            }
          }
        }
      }
    }

    // Direct Attack Trigger check
    if (window.gameInput.attack) {
      window.gameInput.attack = false;
      this.triggerSpearAttack();
    }

    // Direct Dash click
    if (window.gameInput.dash) {
      window.gameInput.dash = false;
      this.triggerDash();
    }

    // Direct Collect click
    if (window.gameInput.collect) {
      window.gameInput.collect = false;
      this.triggerCollect();
    }

    // 2. Scan relic overlap to enable collect trigger
    let nearIndex: number | null = null;
    let playerCoord = new Phaser.Math.Vector2(this.player.x, this.player.y);
    
    this.relicsGroup.getChildren().forEach((rNode) => {
      const r = rNode as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(playerCoord.x, playerCoord.y, r.x, r.y);
      if (dist < 80) {
        nearIndex = r.getData('relicIdx');
        // Emit sparkling gold particle
        this.goldParticles.emitParticleAt(r.x, r.y);
      }
    });

    if (nearIndex !== this.relicNearIndex) {
      this.relicNearIndex = nearIndex;
      updateReactState({ relicNearIndex: nearIndex });
    }

    // 3. Process enemy finite state machines (FSM) roams and chase
    const enemies = this.enemiesGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const { difficulty } = window.gameState;
    const speedMult = difficulty === 'hard' ? 1.35 : (difficulty === 'Medium' ? 1.0 : 0.7);

    // Keep map populated with active enemies based on selected difficulty limits
    const currentEnemyCount = enemies.filter(e => e.active).length;
    const maxAllowedEnemies = difficulty === 'hard' ? 8 : (difficulty === 'Medium' ? 5 : 3);
    if (currentEnemyCount < maxAllowedEnemies && Math.random() < 0.015) {
      this.spawnEdgeWraith();
    }

    enemies.forEach((enemy) => {
      // Sync static red under-glow with enemy sprite position
      const glow = enemy.getData('glow') as Phaser.GameObjects.Graphics;
      if (glow && enemy.active) {
        glow.setPosition(enemy.x, enemy.y);
      }

      const type = enemy.getData('type');
      const st = enemy.getData('state');
      const dist = Phaser.Math.Distance.Between(playerCoord.x, playerCoord.y, enemy.x, enemy.y);

      // SOUND 2 — Enemy grunt language
      if (dist < 300) {
        let lastGrunt = enemy.getData('lastGruntTime') || 0;
        let gruntInt = enemy.getData('gruntInterval') || 0;
        if (!gruntInt) {
          gruntInt = Phaser.Math.Between(3000, 5000);
          enemy.setData('gruntInterval', gruntInt);
        }
        if (time > lastGrunt + gruntInt) {
          enemy.setData('lastGruntTime', time);
          enemy.setData('gruntInterval', Phaser.Math.Between(3000, 5000));
          
          let nearbyEnemiesCount = 0;
          enemies.forEach((otherEnemy) => {
            if (otherEnemy && otherEnemy.active) {
              const otherDist = Phaser.Math.Distance.Between(playerCoord.x, playerCoord.y, otherEnemy.x, otherEnemy.y);
              if (otherDist < 300) {
                nearbyEnemiesCount++;
              }
            }
          });
          const gruntingVal = nearbyEnemiesCount > 0 ? Math.min(0.08, 0.20 / nearbyEnemiesCount) : 0.08;

          if (window.gameAudio && typeof window.gameAudio.playEnemyGrunt === 'function') {
            const id = enemy.getData('id') || 0;
            window.gameAudio.playEnemyGrunt(id, gruntingVal);
          }
        }
      }
      
      let baseSpeed = type === 'crawler' ? 120 : (type === 'caller' ? 70 : 80);
      let attackRange = type === 'caller' ? 240 : 45;
      let detectRange = type === 'caller' ? 300 : 180;
      if (this.playerHiding) {
        detectRange = 38; // virtually undetectable in bushes unless on top of player
      }

      if (st === 'patrol') {
        // Slow walk towards patrol center
        const pX = enemy.getData('patrolX');
        const pY = enemy.getData('patrolY');
        const targetDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, pX, pY);

        if (targetDist > 160) {
          // head back
          const angle = Math.atan2(pY - enemy.y, pX - enemy.x);
          enemy.setVelocity(Math.cos(angle) * baseSpeed * 0.5 * speedMult, Math.sin(angle) * baseSpeed * 0.5 * speedMult);
        } else {
          // Wander small random steps
          let timer = enemy.getData('patrolTimer') || 0;
          if (time > timer) {
            const rx = (Math.random() - 0.5) * 80;
            const ry = (Math.random() - 0.5) * 80;
            enemy.setVelocity(rx, ry);
            enemy.setData('patrolTimer', time + 1200 + Math.random() * 1500);
          }
        }

        // Check alert trigger
        if (dist < detectRange) {
          enemy.setData('state', 'alert');
          enemy.setVelocity(0, 0);
          // Play visual flicker
          this.tweens.add({
            targets: enemy,
            scale: 1.25,
            duration: 150,
            yoyo: true,
          });
          if (window.gameAudio) {
            window.gameAudio.playSfx('hurt'); // small scream alert
          }
          this.time.delayedCall(400, () => {
            if (enemy.active) {
              enemy.setData('state', 'chase');
            }
          });
        }
      } else if (st === 'chase') {
        const angle = Math.atan2(playerCoord.y - enemy.y, playerCoord.x - enemy.x);
        enemy.setRotation(angle);

        // Callers keep range!
        if (type === 'caller' && dist < 160) {
          // Back off while casting
          enemy.setVelocity(Math.cos(angle) * -baseSpeed * speedMult, Math.sin(angle) * -baseSpeed * speedMult);
        } else {
          enemy.setVelocity(Math.cos(angle) * baseSpeed * 1.1 * speedMult, Math.sin(angle) * baseSpeed * 1.1 * speedMult);
        }

        // Handle attacks
        if (dist <= attackRange) {
          if (type === 'caller') {
            // Shoot projectile orb (cooldown)
            let sTimer = enemy.getData('shootTimer') || 0;
            if (time > sTimer) {
              this.fireCallerSkull(enemy);
              enemy.setData('shootTimer', time + 2500 - (difficulty === 'hard' ? 1000 : 0));
            }
          } else {
            // Melee damage strike
            enemy.setData('state', 'lunge');
            enemy.setVelocity(Math.cos(angle) * baseSpeed * 2.2, Math.sin(angle) * baseSpeed * 2.2);
            
            // Melee attack lunge timer
            this.time.delayedCall(220, () => {
              if (enemy.active) {
                const freshDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                if (freshDist < 50) {
                  const dmg = type === 'crawler' ? 20 : 12;
                  this.damagePlayer(dmg);
                }
                enemy.setData('state', 'patrol');
              }
            });
          }
        }

        // Drop out of chase if player runs too far away or is crouching in bushes
        if (dist > detectRange * 1.6 || (this.playerHiding && dist > 85)) {
          enemy.setData('state', 'patrol');
        }
      }
    });
  }

  triggerSpearAttack() {
    if (this.isAttacking) return;
    const now = this.time.now;
    if (now - this.lastStrikeTime < 800) return; // Attack cooldown boundary
    this.isAttacking = true;
    this.lastStrikeTime = now;

    if (window.gameAudio) {
      window.gameAudio.playSfx('attack');
    }

    // Forward spear lunge slide tween using analytical facing angle
    const originalRotation = this.player.getData('facingAngle') ?? 0;
    const lungeX = Math.cos(originalRotation) * 40;
    const lungeY = Math.sin(originalRotation) * 40;

    // Play attack spritesheet frame flow
    this.player.play('jama-attack', true);
    
    // Rotate character fully in line with attack angle momentarily
    this.player.setRotation(originalRotation);

    this.tweens.add({
      targets: this.player,
      x: this.player.x + lungeX,
      y: this.player.y + lungeY,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.isAttacking = false;
        if (this.player && this.player.active) {
          this.player.setRotation(0);
        }
      },
    });

    // Check hit radius across coordinates
    const reach = 72;
    const damage = 20;

    this.enemiesGroup.getChildren().forEach((node) => {
      const enemy = node as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < reach) {
        // Confirm hitting within wide forward sector angle
        const angleToEnemy = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
        const diff = Phaser.Math.Angle.ShortestBetween(originalRotation, angleToEnemy);

        if (Math.abs(diff) < 1.3) { // ~75 degrees forward field
          this.hitEnemy(enemy, damage, lungeX, lungeY);
        }
      }
    });
  }

  triggerDash() {
    const now = this.time.now;
    this.dashCooldown = 2200; // 2.2s as specified
    if (now - this.lastDashTime < this.dashCooldown) return;
    this.lastDashTime = now;
    this.isDashing = true;

    if (window.gameAudio) {
      window.gameAudio.playSfx('dash');
    }

    // Ghost copy particle blur
    this.tweens.add({
      targets: this.player,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 1,
    });

    // 3 translucent ghost copies at 40ms, 80ms, 120ms
    [40, 80, 120].forEach((delay) => {
      this.time.delayedCall(delay, () => {
        if (this.player && this.player.active) {
          const ghost = this.add.sprite(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name);
          ghost.setFlipX(this.player.flipX);
          ghost.setAlpha(0.35);
          ghost.setDepth(1.85);
          ghost.setRotation(this.player.rotation);
          ghost.setTint(0x00FFA3);
          this.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 250,
            onComplete: () => ghost.destroy()
          });
        }
      });
    });

    this.time.delayedCall(220, () => { // 220ms duration as requested
      this.isDashing = false;
    });

    // Fire dash event to React to draw cooling overlay
    updateReactState({ lastDashTime: now, dashCooldown: this.dashCooldown });
  }

  triggerCollect() {
    if (this.relicNearIndex === null) return;
    const index = this.relicNearIndex;

    // Locate the matching node
    let matchedRelic: Phaser.Physics.Arcade.Sprite | null = null;
    this.relicsGroup.getChildren().forEach((rNode) => {
      const r = rNode as Phaser.Physics.Arcade.Sprite;
      if (r.getData('relicIdx') === index) {
        matchedRelic = r;
      }
    });

    if (matchedRelic) {
      if (window.gameAudio) {
        window.gameAudio.playSfx('collect');
      }

      const rName = (matchedRelic as Phaser.Physics.Arcade.Sprite).getData('name');
      
      // Relic pickup golden splash particles
      for (let i = 0; i < 20; i++) {
        this.goldParticles.emitParticleAt((matchedRelic as Phaser.Physics.Arcade.Sprite).x, (matchedRelic as Phaser.Physics.Arcade.Sprite).y);
      }

      // Hide and destroy physical nodes
      (matchedRelic as Phaser.Physics.Arcade.Sprite).destroy();

      // Update state arrays
      const collected = [...window.gameState.artifactsCollected, rName];
      const found = [...window.gameState.relicsFound];
      found[index] = true;
      updateReactState({ relicsFound: found, artifactsCollected: collected });

      // Track statistical artifacts collected
      if ((window as any).incrementArtifactsCollected) {
        (window as any).incrementArtifactsCollected(1);
      }

      // Clean indicators
      this.relicNearIndex = null;
      updateReactState({ relicNearIndex: null });

      // Level 2 victory check
      if (collected.length === 5) {
        this.triggerLevel2Complete();
      }
    }
  }

  hitEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number, pushX: number, pushY: number) {
    if (window.gameAudio) {
      window.gameAudio.playSfx('hit');
    }

    // Spawn splashes
    this.bloodParticles.emitParticleAt(enemy.x, enemy.y, 10);

    // Minor force push
    enemy.x += pushX * 0.5;
    enemy.y += pushY * 0.5;

    // Subtract HP
    let hp = enemy.getData('hp') - damage;
    enemy.setData('hp', hp);

    this.tweens.add({
      targets: enemy,
      tint: 0xff0000,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        if (enemy.active) {
          enemy.setTint(0x8B1A1A);
        }
      },
    });

    if (hp <= 0) {
      // Destroy enemy node
      if (window.gameAudio) {
        window.gameAudio.playSfx('collapse');
      }

      // Death wisps column
      this.add.particles(enemy.x, enemy.y, 'part-violet', {
        scale: { start: 1.0, end: 0 },
        speedY: -60,
        speedX: { min: -15, max: 15 },
        lifespan: 800,
        maxParticles: 15,
      });

      enemy.destroy();

      // Track stats enemies defeated
      if ((window as any).incrementEnemiesDefeated) {
        (window as any).incrementEnemiesDefeated(1);
      }

      updateReactState({ score: window.gameState.score + 100 });
    }
  }

  damagePlayer(amount: number) {
    if (window.gameState.isGameOver || window.gameState.gameCompleted) return;

    // Dash 150ms invincibility iframe check
    if (this.isDashing && (this.time.now - this.lastDashTime < 150)) {
      return;
    }

    if (window.gameAudio) {
      window.gameAudio.playSfx('hurt');
    }

    // Screen Shake effect
    this.cameras.main.shake(200, 0.015);

    // Direct blood burst particles
    this.bloodParticles.emitParticleAt(this.player.x, this.player.y, 8);

    // Apply flash red to player sprite
    this.tweens.add({
      targets: this.player,
      tint: 0xff0000,
      duration: 150,
      yoyo: true,
      onComplete: () => {
        this.player.clearTint();
      },
    });

    const nextHp = Math.max(0, window.gameState.health - amount);
    updateReactState({ health: nextHp });

    if (nextHp <= 0) {
      this.triggerPlayerDeath();
    }
  }

  fireCallerSkull(caller: Phaser.Physics.Arcade.Sprite) {
    if (!caller.active) return;
    const proj = this.physics.add.sprite(caller.x, caller.y, 'projectile');
    this.projectilesGroup.add(proj);

    const angle = Math.atan2(this.player.y - caller.y, this.player.x - caller.x);
    proj.setVelocity(Math.cos(angle) * 190, Math.sin(angle) * 190);
    
    // Auto terminate stray skulls after 2.5 seconds
    this.time.delayedCall(2500, () => {
      if (proj.active) proj.destroy();
    });
  }

  spawnEdgeWraith() {
    // Spawns a wraith randomly from the borders on Shadow difficulty
    const side = Math.floor(Math.random() * 4);
    let wx = 0;
    let wy = 0;
    if (side === 0) { wx = Math.random() * 2560; wy = 30; } // Top
    else if (side === 1) { wx = Math.random() * 2560; wy = 2530; } // Bottom
    else if (side === 2) { wx = 30; wy = Math.random() * 2560; } // Left
    else { wx = 2530; wy = Math.random() * 2560; } // Right

    // Check player spacing
    if (Phaser.Math.Distance.Between(wx, wy, this.player.x, this.player.y) > 300) {
      const wraith = this.enemiesGroup.create(wx, wy, 'wraith') as Phaser.Physics.Arcade.Sprite;
      wraith.setData('type', 'wraith');
      wraith.setData('hp', 25);
      wraith.setData('state', 'chase'); // aggressively hunt
      wraith.setCollideWorldBounds(true);
      wraith.setBodySize(32, 32);
      wraith.setTint(0x8B1A1A); // base enemy tint
      wraith.setDepth(1.5);

      // Call the unified glow creator
      attachEnemyGlow(this, wraith);
    }
  }

  triggerPlayerDeath() {
    updateReactState({ isGameOver: true });
    this.player.setVelocity(0, 0);
    this.player.setAngle(90); // collapse flat

    this.time.delayedCall(1200, () => {
      this.shutdownForestScene();
      this.scene.start('GameOverScene');
    });
  }

  triggerTimeFail() {
    updateReactState({ isGameOver: true });
    this.shutdownForestScene();
    this.scene.start('GameOverScene');
  }

  triggerLevel2Complete() {
    updateReactState({ gameCompleted: true });
    this.player.setVelocity(0, 0);
    
    // Giant magical circular gold animation under player
    const rings = this.add.graphics();
    rings.setDepth(1);
    this.tweens.addCounter({
      from: 0,
      to: 360,
      duration: 1500,
      onUpdate: (tweenValue) => {
        rings.clear();
        rings.lineStyle(4, 0xffd700, 0.85);
        rings.strokeCircle(this.player.x, this.player.y, 45 + Math.sin(tweenValue.getValue() * 0.1) * 6);
        rings.lineStyle(2, 0xffaa00, 0.5);
        rings.strokeCircle(this.player.x, this.player.y, 65);
      },
    });

    this.cameras.main.shake(1200, 0.012);

    this.time.delayedCall(2000, () => {
      this.shutdownForestScene();
      this.scene.start('PassagewayScene');
    });
  }

  showFloatingText(x: number, y: number, textString: string, color: number) {
    const fText = this.add.text(x, y, textString, {
      fontFamily: 'Courier',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 3,
    });
    fText.setDepth(10);
    this.tweens.add({
      targets: fText,
      y: y - 45,
      alpha: 0,
      duration: 1000,
      onComplete: () => fText.destroy(),
    });
  }

  triggerShieldBash() {
    if (this.isBlocking) return;
    const now = this.time.now;
    if (now - this.lastBashTime < 4000) return;
    this.lastBashTime = now;
    this.isShieldBashing = true;

    if (window.gameAudio) {
      window.gameAudio.playShieldBashSound();
    }

    // Lunge forward 45px over 120ms
    const originalRotation = this.player.getData('facingAngle') ?? 0;
    const lungeX = Math.cos(originalRotation) * 45;
    const lungeY = Math.sin(originalRotation) * 45;

    // React speed / state update
    updateReactState({ lastBashTime: now, bashCooldown: 4000 });

    this.tweens.add({
      targets: this.player,
      x: this.player.x + lungeX,
      y: this.player.y + lungeY,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.isShieldBashing = false;
      }
    });

    // Check hit radius
    const reach = 55;
    const damage = 15;

    this.enemiesGroup.getChildren().forEach((node) => {
      const enemy = node as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < reach) {
        const angleToEnemy = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
        const diff = Phaser.Math.Angle.ShortestBetween(originalRotation, angleToEnemy);
        if (Math.abs(diff) < 1.3) {
          // Double knockback (pushX, pushY scaled up)
          this.hitEnemy(enemy, damage, lungeX * 2.0, lungeY * 2.0);
        }
      }
    });
  }

  triggerHeartbeatVisual(duration: number, width: number) {
    if (!this.player || !this.player.active) return;
    
    const ring = this.add.graphics();
    ring.setDepth(1.82); // sits BELOW player but above others
    
    this.tweens.addCounter({
      from: 0,
      to: width,
      duration: duration,
      onUpdate: (tweenValue) => {
        if (!this.player || !this.player.active) {
          ring.destroy();
          return;
        }
        ring.clear();
        const currentRadius = tweenValue.getValue();
        const maxOpacity = 0.55;
        const currentAlpha = Math.max(0, maxOpacity * (1 - (currentRadius / width)));
        
        ring.lineStyle(1.8, 0xff2244, currentAlpha);
        ring.strokeCircle(this.player.x, this.player.y, currentRadius);
      },
      onComplete: () => {
        ring.destroy();
      }
    });
  }

  drawWeapons() {
    if (!this.player || !this.player.active) {
      if (this.spearGraphics) this.spearGraphics.clear();
      if (this.shieldGraphics) this.shieldGraphics.clear();
      return;
    }
    
    if (this.spearGraphics) this.spearGraphics.clear();
    if (this.shieldGraphics) this.shieldGraphics.clear();
    
    const isFlipped = this.player.flipX;
    const directionFactor = isFlipped ? -1 : 1;
    
    const isCrouching = !!(window.gameInput as any).crouch;
    
    if (isCrouching) {
      this.spearGraphics.setDepth(1.85);
      this.shieldGraphics.setDepth(1.86);
      
      this.spearGraphics.setPosition(this.player.x, this.player.y);
      this.spearGraphics.setRotation(0);
      this.spearGraphics.setScale(1, 1);
      
      this.spearGraphics.lineStyle(2.5, 0x8B5E3C, 1.0);
      
      if (directionFactor > 0) {
        this.spearGraphics.lineBetween(-15, 12, 18, 12);
        this.spearGraphics.fillStyle(0xC0C0C0, 1.0);
        this.spearGraphics.fillTriangle(18, 9, 18, 15, 23, 12);
      } else {
        this.spearGraphics.lineBetween(-18, 12, 15, 12);
        this.spearGraphics.fillStyle(0xC0C0C0, 1.0);
        this.spearGraphics.fillTriangle(-18, 9, -18, 15, -23, 12);
      }
      
      const shieldX = -6 * directionFactor;
      const shieldY = 14;
      
      this.shieldGraphics.setPosition(this.player.x + shieldX, this.player.y + shieldY);
      this.shieldGraphics.setRotation(0);
      this.shieldGraphics.setScale(1, 1);
      
      this.shieldGraphics.fillStyle(0x5C3D1E, 1.0);
      this.shieldGraphics.fillEllipse(0, 0, 12, 16);
      this.shieldGraphics.lineStyle(1.5, 0x8B6914, 1.0);
      this.shieldGraphics.strokeEllipse(0, 0, 12, 16);
      this.shieldGraphics.fillStyle(0x8B6914, 1.0);
      this.shieldGraphics.fillCircle(0, 0, 3);
      
    } else {
      const isWalking = (Math.abs(this.player.body.velocity.x) > 10 || Math.abs(this.player.body.velocity.y) > 10);
      const bobY = isWalking ? Math.sin(this.time.now * 0.012) * 2.5 : 0;
      
      if (this.isAttacking) {
        this.spearGraphics.setDepth(2.1);
        this.shieldGraphics.setDepth(1.85);

        this.spearGraphics.setPosition(0, 0); // draw absolutely
        this.spearGraphics.setRotation(0);
        this.spearGraphics.setScale(1, 1);
        
        const facingAngle = this.player.getData('facingAngle') ?? 0;
        const spearX = Math.cos(facingAngle) * 12;
        const spearY = Math.sin(facingAngle) * 12 + bobY;
        
        const startX = this.player.x + spearX - Math.cos(facingAngle) * 12;
        const startY = this.player.y + spearY - Math.sin(facingAngle) * 12;
        const endX = this.player.x + spearX + Math.cos(facingAngle) * 28;
        const endY = this.player.y + spearY + Math.sin(facingAngle) * 28;
        
        this.spearGraphics.lineStyle(3, 0x8B5E3C, 1.0);
        this.spearGraphics.lineBetween(startX, startY, endX, endY);
        
        const tipAngle = facingAngle;
        const tipLength = 6;
        const tX = endX + Math.cos(tipAngle) * tipLength;
        const tY = endY + Math.sin(tipAngle) * tipLength;
        
        const leftAngle = tipAngle + Math.PI * 5/6;
        const rightAngle = tipAngle - Math.PI * 5/6;
        const cornerWidth = 3;
        const lX = endX + Math.cos(leftAngle) * cornerWidth;
        const lY = endY + Math.sin(leftAngle) * cornerWidth;
        const rX = endX + Math.cos(rightAngle) * cornerWidth;
        const rY = endY + Math.sin(rightAngle) * cornerWidth;
        
        this.spearGraphics.fillStyle(0xC0C0C0, 1.0);
        this.spearGraphics.fillTriangle(lX, lY, rX, rY, tX, tY);
        
      } else {
        this.spearGraphics.setDepth(1.85);
        this.shieldGraphics.setDepth(2.1);
        
        const spearAngle = (15 * Math.PI / 180) * directionFactor;
        const handX = 12 * directionFactor;
        const handY = 4 + bobY;
        
        this.spearGraphics.setPosition(this.player.x + handX, this.player.y + handY);
        this.spearGraphics.setRotation(spearAngle);
        this.spearGraphics.setScale(1, 1);
        
        this.spearGraphics.lineStyle(2.5, 0x8B5E3C, 1.0);
        this.spearGraphics.lineBetween(0, -28, 0, 12);
        
        this.spearGraphics.fillStyle(0xC0C0C0, 1.0);
        this.spearGraphics.fillTriangle(-3, -28, 3, -28, 0, -34);
      }
      
      const sHandX = -12 * directionFactor;
      const sHandY = 4 + bobY;
      let shieldScale = 1.0;
      if (this.isBlocking) {
        shieldScale = 1.35;
      }
      
      const shieldTilt = -0.15 * directionFactor;
      
      this.shieldGraphics.setPosition(this.player.x + sHandX, this.player.y + sHandY);
      this.shieldGraphics.setScale(shieldScale, shieldScale);
      this.shieldGraphics.setRotation(shieldTilt);
      
      if (this.isBlocking) {
        this.shieldGraphics.fillStyle(0x4a9eff, 0.35);
        this.shieldGraphics.fillEllipse(0, 0, 20, 26);
      }
      
      this.shieldGraphics.fillStyle(0x5C3D1E, 1.0);
      this.shieldGraphics.fillEllipse(0, 0, 16, 22);
      
      let rimColor = 0x8B6914;
      if (this.shieldFlashState === 'gold') {
        rimColor = 0xFFD700;
      } else if (this.shieldFlashState === 'blue') {
        rimColor = 0x4a9eff;
      }
      
      this.shieldGraphics.lineStyle(2, rimColor, 1.0);
      this.shieldGraphics.strokeEllipse(0, 0, 16, 22);
      
      this.shieldGraphics.fillStyle(rimColor, 1.0);
      this.shieldGraphics.fillCircle(0, 0, 4);
      
      this.shieldGraphics.lineStyle(1.5, 0x3d2000, 0.6);
      this.shieldGraphics.lineBetween(-5, -5, 5, 5);
      this.shieldGraphics.lineBetween(-5, 5, 5, -5);
    }
  }

  shutdownForestScene() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.goldParticles) this.goldParticles.destroy();
    if (this.bloodParticles) this.bloodParticles.destroy();

    // Increment player stats playtime
    if (this.startTime) {
      const elapsedSecs = Math.floor((this.time.now - this.startTime) / 1000);
      if (elapsedSecs > 0 && (window as any).incrementPlaytime) {
        (window as any).incrementPlaytime(elapsedSecs);
      }
      this.startTime = 0;
    }
  }
}

export { PassagewayScene } from './passageway';

/*
export class OldPassagewayScene_Commented {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  guardsGroup!: Phaser.Physics.Arcade.Group;
  projectilesGroup!: Phaser.Physics.Arcade.Group;
  spearParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  impactParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  radialParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  obstacles!: Phaser.Physics.Arcade.StaticGroup;
  darknessOverlay!: Phaser.GameObjects.RenderTexture;
  lightMaskImage!: Phaser.GameObjects.Image;
  lanternPool!: Phaser.GameObjects.Graphics;
  
  spearGraphics!: Phaser.GameObjects.Graphics;
  shieldGraphics!: Phaser.GameObjects.Graphics;

  startTime = 0;
  isAttacking = false;
  isDashing = false;
  lastDashTime = 0;
  dashCooldown = 2200;
  
  isBlocking = false;
  blockStartTime = 0;
  lastBlockTime = 0;
  blockCooldown = 3000;
  isShieldBashing = false;
  lastBashTime = 0;
  lastStrikeTime = 0;
  shieldFlashState: 'gold' | 'blue' | null = null;

  // Narrative sequence variables
  gameplayStarted = false;
  narrativeTriggerPoint = 250;
  hasTriggeredNarrative = false;
  dialogueShadowForm!: Phaser.GameObjects.Graphics; // Nkanyamba shadow shadow
  
  // Corruption & Difficulty states
  corruption = 0;
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  fillRate = 100 / 150; // medium by default
  minionKilledCount = 0;
  totalMinionsToSpawn = 10;
  totalMinionsDefeated = 0;
  maxActiveSpirits = 3; // engagement cap
  
  activeChasingSpirits: Phaser.Physics.Arcade.Sprite[] = [];

  constructor() {
    super('PassagewayScene');
  }

  init(data?: any) {
    this.corruption = 0;
    this.minionKilledCount = 0;
    this.totalMinionsDefeated = 0;
    this.gameplayStarted = false;
    this.hasTriggeredNarrative = false;
    
    if (data) {
      if (data.health !== undefined) {
        window.gameState.health = data.health;
      } else {
        window.gameState.health = 100;
      }
      if (data.lanternFuel !== undefined) {
        window.gameState.lanternFuel = data.lanternFuel;
      } else {
        window.gameState.lanternFuel = 100;
      }
    } else {
      window.gameState.health = 100;
      window.gameState.lanternFuel = 100;
    }

    const rawDiff = (window.gameState.difficulty || 'Medium').toLowerCase();
    this.difficulty = (rawDiff === 'easy' || rawDiff === 'medium' || rawDiff === 'hard') ? rawDiff : 'medium';
    
    if (this.difficulty === 'easy') {
      this.fillRate = 100 / 240;
    } else if (this.difficulty === 'hard') {
      this.fillRate = 100 / 90;
    } else {
      this.fillRate = 100 / 150;
    }

    window.gameState.corruption = 0;
    updateReactState({ activeScene: 'PassagewayScene', corruption: 0, isGameOver: false, gameCompleted: false });
  }

  create() {
    updateReactState({ activeScene: 'PassagewayScene', isGameOver: false, gameCompleted: false, corruption: 0 });
    
    if (window.gameAudio) {
      window.gameAudio.setMusicTheme('boss');
      window.gameAudio.startBossDrone();
    }

    this.startTime = this.time.now;
    
    this.physics.world.setBounds(0, 0, 1800, 400);
    this.cameras.main.setBackgroundColor('#050306');
    this.cameras.main.setBounds(0, 0, 1800, 400);

    const ground = this.add.graphics();
    ground.setDepth(0.01);
    ground.fillStyle(0x0a0507, 1.0);
    ground.fillRect(0, 0, 1800, 400);

    for (let tx = 0; tx < 23; tx++) {
      for (let ty = 0; ty < 5; ty++) {
        if ((tx + ty) % 2 === 0) {
          ground.fillStyle(0x2a111a, 0.7);
          ground.fillRect(tx * 80 + 2, ty * 80 + 2, 76, 76);
        } else {
          ground.fillStyle(0x19080f, 0.5);
          ground.fillRect(tx * 80 + 2, ty * 80 + 2, 76, 76);
        }
      }
    }

    ground.lineStyle(1.5, 0x10050a, 0.8);
    for (let i = 0; i < 40; i++) {
      let cx = Phaser.Math.Between(50, 1750);
      let cy = Phaser.Math.Between(80, 350);
      ground.beginPath();
      ground.moveTo(cx, cy);
      for (let pt = 0; pt < 4; pt++) {
        cx += Phaser.Math.Between(-20, 20);
        cy += Phaser.Math.Between(-15, 15);
        ground.lineTo(cx, cy);
      }
      ground.strokePath();
    }

    ground.fillStyle(0x0f050a, 0.9);
    for (let i = 0; i < 20; i++) {
      let rx = Phaser.Math.Between(100, 1700);
      let ry = Phaser.Math.Between(120, 330);
      ground.fillCircle(rx, ry, Phaser.Math.Between(3, 8));
    }

    const walls = this.add.graphics();
    walls.setDepth(1.2);
    walls.fillStyle(0x0f050a, 1.0);
    walls.fillRect(0, 0, 1800, 80);
    walls.fillRect(0, 360, 1800, 40);

    for (let st = 0; st < 45; st++) {
      let stX = Phaser.Math.Between(10, 1790);
      let stWidth = Phaser.Math.Between(14, 40);
      let stHeight = Phaser.Math.Between(25, 60);
      walls.fillStyle(0x1a0710, 0.95);
      walls.beginPath();
      walls.moveTo(stX - stWidth / 2, 80);
      walls.lineTo(stX + stWidth / 2, 80);
      walls.lineTo(stX, 80 + stHeight);
      walls.closePath();
      walls.fillPath();
    }

    this.obstacles = this.physics.add.staticGroup();
    const topWallBlk = this.obstacles.create(900, 40, 'forest-tree');
    topWallBlk.setVisible(false);
    topWallBlk.setBodySize(1800, 80);
    topWallBlk.refreshBody();

    const bottomWallBlk = this.obstacles.create(900, 380, 'forest-tree');
    bottomWallBlk.setVisible(false);
    bottomWallBlk.setBodySize(1800, 40);
    bottomWallBlk.refreshBody();

    this.add.particles(900, 200, 'part-gold', {
      x: { min: 0, max: 1800 },
      y: { min: 80, max: 360 },
      scale: { start: 0.15, end: 0.5 },
      alpha: { start: 0.6, end: 0 },
      speedY: { min: -15, max: -5 },
      speedX: { min: -5, max: 5 },
      lifespan: 2500,
      frequency: 24,
      blendMode: 'ADD'
    });

    this.darknessOverlay = this.add.renderTexture(0, 0, 1800, 400);
    this.darknessOverlay.setDepth(1.1);
    this.darknessOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Create the Canvas 'light-mask' if it doesn't already exist
    if (!this.textures.exists('light-mask')) {
      const canvasTexture = this.textures.createCanvas('light-mask', 512, 512);
      if (canvasTexture) {
        const ctx = canvasTexture.context;
        const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.9)');
        grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
        canvasTexture.refresh();
      }
    }

    this.lightMaskImage = this.add.image(0, 0, 'light-mask');
    this.lightMaskImage.setVisible(false);

    this.lanternPool = this.add.graphics();
    this.lanternPool.setDepth(0.02);

    this.spearGraphics = this.add.graphics();
    this.spearGraphics.setDepth(2.1);

    this.shieldGraphics = this.add.graphics();
    this.shieldGraphics.setDepth(2.1);

    this.spearParticles = this.add.particles(0, 0, 'part-gold', {
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 300,
      speed: 120,
      blendMode: 'ADD',
      emitting: false,
    });
    this.spearParticles.setDepth(2);

    this.impactParticles = this.add.particles(0, 0, 'part-blood', {
      scale: { start: 0.7, end: 0.15 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 400,
      speed: { min: 40, max: 160 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.impactParticles.setDepth(2);

    this.radialParticles = this.add.particles(0, 0, 'part-blue', {
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 500,
      speed: 150,
      blendMode: 'ADD',
      emitting: false,
    });
    this.radialParticles.setDepth(2);

    this.player = this.physics.add.sprite(100, 200, 'jama-light');
    this.player.setCollideWorldBounds(true);
    this.player.setBodySize(36, 36);
    this.player.setDepth(2);
    this.player.play('jama-light-idle');
    this.player.setTint(0x00FFA3);

    const aura = this.add.graphics();
    aura.fillStyle(0x00FFA3, 1.0);
    aura.fillCircle(0, 0, 11);
    aura.setDepth(1.9);
    (this as any).playerAura = aura;

    this.tweens.add({
      targets: aura,
      alpha: { from: 0.18, to: 0.08 },
      scaleX: { from: 1.15, to: 0.9 },
      scaleY: { from: 1.15, to: 0.9 },
      duration: 1000,
      yoyo: true,
      repeat: -1
    });

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.physics.add.collider(this.player, this.obstacles);

    this.guardsGroup = this.physics.add.group();
    this.projectilesGroup = this.physics.add.group();

    this.physics.add.collider(this.guardsGroup, this.obstacles);
    this.physics.add.collider(this.guardsGroup, this.guardsGroup);

    this.physics.add.overlap(this.player, this.projectilesGroup, (pl, pNode) => {
      const proj = pNode as Phaser.Physics.Arcade.Sprite;
      if (!proj || !proj.active) return;
      if (proj.getData('friendly')) return;

      if (this.isBlocking) {
        const elapsed = this.time.now - this.blockStartTime;
        if (elapsed <= 180) {
          this.shieldFlashState = 'gold';
          this.radialParticles.emitParticleAt(proj.x, proj.y, 16);
          this.showFloatingText(this.player.x, this.player.y - 45, 'PARRY REFLECT!', 0xffd700);

          let minD = Infinity;
          let target: Phaser.Physics.Arcade.Sprite | null = null;
          this.guardsGroup.getChildren().forEach((g) => {
            const guard = g as Phaser.Physics.Arcade.Sprite;
            if (guard.active) {
              const d = Phaser.Math.Distance.Between(proj.x, proj.y, guard.x, guard.y);
              if (d < minD) {
                minD = d;
                target = guard;
              }
            }
          });

          if (target) {
            const angle = Math.atan2(target.y - proj.y, target.x - proj.x);
            proj.setVelocity(Math.cos(angle) * 380, Math.sin(angle) * 380);
            proj.setData('friendly', true);
            proj.setData('damageAmount', 40);
            proj.setTint(0xffd700);
            return;
          }
        } else {
          this.shieldFlashState = 'blue';
          this.showFloatingText(this.player.x, this.player.y - 45, 'BLOCKED!', 0x4a9eff);
          proj.destroy();
          this.damagePlayer(Math.round(15 * 0.22));
          return;
        }
      }

      proj.destroy();
      this.damagePlayer(12);
    });

    this.physics.add.overlap(this.projectilesGroup, this.guardsGroup, (projNode, enemyNode) => {
      const proj = projNode as Phaser.Physics.Arcade.Sprite;
      const enemy = enemyNode as Phaser.Physics.Arcade.Sprite;
      if (proj.getData('friendly')) {
        proj.destroy();
        const dmg = proj.getData('damageAmount') || 30;
        this.hitGuard(enemy, dmg, proj.body ? proj.body.velocity.x * 0.05 : 0, proj.body ? proj.body.velocity.y * 0.05 : 0);
      }
    });

    this.time.delayedCall(400, () => {
      this.tweens.add({
        targets: this.player,
        x: 220,
        y: 200,
        duration: 800,
        onUpdate: () => {
          this.player.play('jama-light-walk', true);
        },
        onComplete: () => {
          this.player.play('jama-light-idle', true);
          this.triggerNkanyambaEntranceSequence();
        }
      });
    });
  }

  triggerNkanyambaEntranceSequence() {
    this.hasTriggeredNarrative = true;
    this.cameras.main.shake(1200, 0.02);
    this.cameras.main.flash(600, 180, 0, 0);
    
    if (window.gameAudio) {
      window.gameAudio.playSfx('ambient');
    }

    this.dialogueShadowForm = this.add.graphics();
    this.dialogueShadowForm.setDepth(1.5);
    this.dialogueShadowForm.fillStyle(0x0d0005, 0.55);
    this.dialogueShadowForm.fillCircle(480, 190, 45);
    this.dialogueShadowForm.fillStyle(0xff0000, 1.0);
    this.dialogueShadowForm.fillCircle(465, 190, 6);
    this.dialogueShadowForm.fillCircle(495, 190, 6);

    this.time.delayedCall(500, () => {
      this.createSpeechBubble(this.dialogueShadowForm, "You have breached my outer walls, Jama. But you will never reach the Shrine. My spirits shall devour your soul!", 'nkanyamba', () => {
        this.createSpeechBubble(this.player, "Khwezi is near... I can feel her spirit. I will tear through every shadow you throw at me!", 'jama', () => {
          this.tweens.add({
            targets: this.dialogueShadowForm,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: 900,
            onComplete: () => {
              this.dialogueShadowForm.destroy();
              this.spawnMinionsWave();
              this.gameplayStarted = true;
            }
          });
        });
      });
    });
  }

  spawnMinionsWave() {
    const xs = [580, 700, 820, 950, 1080, 1200, 1315, 1420, 1530, 1640];
    const ys = [150, 280, 220, 160, 310, 190, 260, 140, 300, 220];
    
    let hpStat = 60;
    if (this.difficulty === 'easy') hpStat = 40;
    else if (this.difficulty === 'hard') hpStat = 80;

    for (let i = 0; i < 10; i++) {
      const gX = xs[i];
      const gY = ys[i];
      
      const guard = this.guardsGroup.create(gX, gY, 'wraith') as Phaser.Physics.Arcade.Sprite;
      guard.setTint(0x3a050d);
      guard.setData('hp', hpStat);
      guard.setData('maxHp', hpStat);
      guard.setCollideWorldBounds(true);
      guard.setDepth(1.5);
      
      attachEnemyGlow(this, guard);
    }

    this.showFloatingText(this.player.x, this.player.y - 45, "THE SHADOWS ENGAGE!", 0xff0044);
  }

  update(time: number, delta: number) {
    if (window.gameState.isGameOver || window.gameState.gameCompleted) return;

    if (!this.gameplayStarted) {
      if (this.player && this.player.active) {
        this.player.setVelocity(0, 0);
      }
      this.drawDarknessVignette(time);
      return;
    }

    if (window.gameState.isPaused) {
      if (this.physics && this.physics.world && !this.physics.world.isPaused) {
        this.physics.pause();
        this.anims.pauseAll();
        this.tweens.pauseAll();
        if (this.player) this.player.setVelocity(0, 0);
        this.guardsGroup.getChildren().forEach(node => {
          (node as any).setVelocity(0, 0);
        });
      }
      return;
    } else {
      if (this.physics && this.physics.world && this.physics.world.isPaused) {
        this.physics.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();
      }
    }

    this.corruption = Math.min(100, this.corruption + (delta / 1000) * this.fillRate);
    window.gameState.corruption = this.corruption;

    const wasBlocking = this.isBlocking;
    const isBlockHeld = !!(window.gameInput && window.gameInput.block);
    
    if (isBlockHeld && !this.isDashing && !this.isShieldBashing) {
      const now = this.time.now;
      const blockCooldownRemaining = Math.max(0, 3000 - (now - this.lastBlockTime));
      
      if (blockCooldownRemaining <= 0) {
        if (!wasBlocking) {
          this.isBlocking = true;
          this.blockStartTime = now;
        } else if (now - this.blockStartTime > 2500) {
          this.isBlocking = false;
          this.lastBlockTime = now;
        }
      } else {
        this.isBlocking = false;
      }
    } else {
      if (wasBlocking) {
        this.isBlocking = false;
        this.lastBlockTime = this.time.now;
      }
    }

    const strikeCooldownPct = Math.max(0, 800 - (time - this.lastStrikeTime)) / 800;
    const blockCooldownPct = Math.max(0, 3000 - (time - this.lastBlockTime)) / 3000;
    const bashCooldownPct = Math.max(0, 4000 - (time - this.lastBashTime)) / 4000;
    const dashCooldownPct = Math.max(0, 2200 - (time - this.lastDashTime)) / 2200;
    
    if (Math.floor(time) % 4 === 0) {
      updateReactState({ 
        strikeCooldownPct, 
        blockCooldownPct, 
        bashCooldownPct, 
        dashCooldownPct,
        corruption: this.corruption
      });
    }

    this.drawWeapons();
    this.handleMovementInputs(time);

    this.activeChasingSpirits = [];
    const playerC = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const guards = this.guardsGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];
    
    guards.sort((a, b) => {
      const dA = Phaser.Math.Distance.Between(playerC.x, playerC.y, a.x, a.y);
      const dB = Phaser.Math.Distance.Between(playerC.x, playerC.y, b.x, b.y);
      return dA - dB;
    });

    let corruptionActiveMod = (this.corruption >= 100);

    guards.forEach((g) => {
      if (!g.active) return;

      const glow = g.getData('glow') as Phaser.GameObjects.Graphics;
      if (glow) {
        glow.setPosition(g.x, g.y);
      }

      const gDist = Phaser.Math.Distance.Between(playerC.x, playerC.y, g.x, g.y);
      const angle = Math.atan2(playerC.y - g.y, playerC.x - g.x);

      let spd = corruptionActiveMod ? 115 * 1.3 : 115;
      let minionContactDamage = 5;
      if (this.difficulty === 'easy') minionContactDamage = 3;
      else if (this.difficulty === 'hard') minionContactDamage = 7;

      if (corruptionActiveMod) {
        minionContactDamage *= 2.0;
      }

      let shouldChase = false;
      if (gDist < 420) {
        if (this.activeChasingSpirits.length < this.maxActiveSpirits) {
          this.activeChasingSpirits.push(g);
          shouldChase = true;
        }
      }

      if (shouldChase) {
        g.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);

        if (gDist < 46) {
          let now = time;
          let lastDmg = g.getData('lastDamageTime') || 0;
          if (now > lastDmg + 900) {
            g.setData('lastDamageTime', now);
            let finalDmg = this.isBlocking ? 1 : minionContactDamage;
            this.damagePlayer(finalDmg);
            this.showFloatingText(this.player.x, this.player.y - 20, this.isBlocking ? "BLOCKED! -1HP" : `CORRUPT SPIRIT! -${finalDmg}HP`, 0xff3333);
          }
          g.setVelocity(Math.cos(angle) * -120, Math.sin(angle) * -120);
        }

        let lastShoot = g.getData('lastShootTime') || 0;
        let telegraphEnd = g.getData('telegraphEndTime') || 0;

        if (gDist >= 110 && gDist <= 380) {
          if (time > lastShoot + 4000) {
            g.setData('telegraphEndTime', time + 600);
            g.setData('lastShootTime', time);
            
            this.tweens.add({
              targets: g,
              alpha: 0.35,
              yoyo: true,
              duration: 100,
              repeat: 4
            });
          }
        }

        if (telegraphEnd > 0 && time > telegraphEnd) {
          g.setData('telegraphEndTime', 0);
          if (g.active) {
            const proj = this.physics.add.sprite(g.x, g.y, 'projectile');
            this.projectilesGroup.add(proj);
            const fireAngle = Math.atan2(playerC.y - g.y, playerC.x - g.x);
            const projSpd = corruptionActiveMod ? 190 * 1.3 : 190;
            proj.setVelocity(Math.cos(fireAngle) * projSpd, Math.sin(fireAngle) * projSpd);
          }
        }
      } else {
        g.setVelocity(g.body!.velocity.x * 0.9, g.body!.velocity.y * 0.9);
      }
    });

    this.drawDarknessVignette(time);
  }

  handleMovementInputs(time: number) {
    if (this.isDashing) return;

    let moveX = 0;
    let moveY = 0;

    if (window.gameInput) {
      if (window.gameInput.up) moveY = -1;
      if (window.gameInput.down) moveY = 1;
      if (window.gameInput.left) moveX = -1;
      if (window.gameInput.right) moveX = 1;
    }

    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }

    let defaultSpd = 160;
    if (this.isBlocking) defaultSpd = 70;

    this.player.setVelocity(moveX * defaultSpd, moveY * defaultSpd);

    if (moveX !== 0 || moveY !== 0) {
      this.player.play('jama-light-walk', true);
    } else {
      this.player.play('jama-light-idle', true);
    }

    if ((this as any).playerAura) {
      (this as any).playerAura.setPosition(this.player.x, this.player.y + 12);
    }

    const isStrikePressed = !!(window.gameInput && window.gameInput.attack);
    if (isStrikePressed && time > this.lastStrikeTime + 800) {
      this.triggerSpearStrike(time, moveX, moveY);
    }

    const isBashPressed = !!(window.gameInput && window.gameInput.bash);
    if (isBashPressed && time > this.lastBashTime + 4000) {
      this.triggerShieldBash(time, moveX, moveY);
    }

    const isDashPressed = !!(window.gameInput && window.gameInput.dash);
    if (isDashPressed && time > this.lastDashTime + 2200) {
      this.triggerShieldDash(time, moveX, moveY);
    }
  }

  triggerSpearStrike(time: number, moveX: number, moveY: number) {
    this.lastStrikeTime = time;
    this.isAttacking = true;

    if (window.gameAudio) window.gameAudio.playSfx('swipe');

    let lungeX = moveX;
    let lungeY = moveY;
    if (lungeX === 0 && lungeY === 0) {
      lungeX = 1.0;
    }

    const startX = this.player.x;
    const startY = this.player.y;

    this.tweens.add({
      targets: this.player,
      x: startX + lungeX * 24,
      y: startY + lungeY * 24,
      duration: 100,
      yoyo: true,
      onComplete: () => {
        this.isAttacking = false;
      }
    });

    const testPointX = startX + lungeX * 85;
    const testPointY = startY + lungeY * 85;

    this.spearParticles.emitParticleAt(testPointX, testPointY, 12);

    this.guardsGroup.getChildren().forEach((node) => {
      const guard = node as Phaser.Physics.Arcade.Sprite;
      if (guard.active) {
        const d = Phaser.Math.Distance.Between(testPointX, testPointY, guard.x, guard.y);
        if (d < 58) {
          const damageValue = 35;
          this.hitGuard(guard, damageValue, lungeX * 12, lungeY * 12);
        }
      }
    });
  }

  triggerShieldBash(time: number, moveX: number, moveY: number) {
    this.lastBashTime = time;
    this.isShieldBashing = true;

    if (window.gameAudio) window.gameAudio.playSfx('swipe');

    let bashX = moveX;
    let bashY = moveY;
    if (bashX === 0 && bashY === 0) bashX = 1.0;

    const originalX = this.player.x;
    const originalY = this.player.y;

    this.tweens.add({
      targets: this.player,
      x: originalX + bashX * 36,
      y: originalY + bashY * 36,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        this.isShieldBashing = false;
      }
    });

    const testX = originalX + bashX * 60;
    const testY = originalY + bashY * 60;

    this.radialParticles.emitParticleAt(testX, testY, 8);

    this.guardsGroup.getChildren().forEach((node) => {
      const guard = node as Phaser.Physics.Arcade.Sprite;
      if (guard.active) {
        const d = Phaser.Math.Distance.Between(testX, testY, guard.x, guard.y);
        if (d < 50) {
          this.hitGuard(guard, 25, bashX * 35, bashY * 35);
          this.showFloatingText(guard.x, guard.y - 20, "DUMB-BASHED!", 0x4a9eff);
        }
      }
    });
  }

  triggerShieldDash(time: number, moveX: number, moveY: number) {
    this.lastDashTime = time;
    this.isDashing = true;

    if (window.gameAudio) window.gameAudio.playSfx('chime');

    let dashX = moveX;
    let dashY = moveY;
    if (dashX === 0 && dashY === 0) dashX = 1.0;

    this.player.setVelocity(dashX * 420, dashY * 420);

    this.time.delayedCall(220, () => {
      this.isDashing = false;
      this.player.setVelocity(0, 0);
    });

    this.time.addEvent({
      delay: 24,
      repeat: 8,
      callback: () => {
        if (!this.isDashing) return;
        this.guardsGroup.getChildren().forEach((node) => {
          const enemy = node as Phaser.Physics.Arcade.Sprite;
          if (enemy.active) {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (d < 48) {
              const damage = 20;
              this.hitGuard(enemy, damage, dashX * 40, dashY * 40);
              this.showFloatingText(enemy.x, enemy.y - 20, "DASH HIT! -20HP", 0xff9900);
            }
          }
        });
      }
    });
  }

  hitGuard(guard: Phaser.Physics.Arcade.Sprite, damage: number, pushX: number, pushY: number) {
    if (window.gameAudio) window.gameAudio.playSfx('hit');

    this.impactParticles.emitParticleAt(guard.x, guard.y, 12);

    guard.x += pushX;
    guard.y += pushY;

    let hp = guard.getData('hp') - damage;
    guard.setData('hp', hp);

    this.tweens.add({
      targets: guard,
      tint: 0xff0000,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        if (guard.active) {
          guard.setTint(0x3a050d);
        }
      }
    });

    if (hp <= 0) {
      guard.disableBody(true, false);
      
      this.corruption = Math.max(0, this.corruption - 8);
      window.gameState.corruption = this.corruption;
      
      this.totalMinionsDefeated++;

      this.tweens.add({
        targets: guard,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        angle: 180,
        duration: 350,
        onComplete: () => {
          guard.destroy();
          this.checkVictoryCondition();
        }
      });

      if ((window as any).incrementEnemiesDefeated) {
        (window as any).incrementEnemiesDefeated(1);
      }
      updateReactState({ score: window.gameState.score + 150 });
    }
  }

  checkVictoryCondition() {
    if (this.totalMinionsDefeated >= 10) {
      this.gameplayStarted = false;
      this.player.setVelocity(0, 0);
      this.player.play('jama-light-idle', true);

      this.createSpeechBubble(this.player, "The seal of shadows has collapsed... The inner chamber lies just beyond this corridor. Hang on, Khwezi!", 'jama', () => {
        this.cameras.main.fadeOut(1800, 0, 0, 0);
        this.time.delayedCall(1900, () => {
          this.scene.start('ShrineScene', {
            health: window.gameState.health,
            lanternFuel: window.gameState.lanternFuel,
            score: window.gameState.score
          });
        });
      });
    }
  }

  damagePlayer(amount: number) {
    if (window.gameState.isGameOver || window.gameState.gameCompleted) return;

    if (this.isDashing && (this.time.now - this.lastDashTime < 150)) {
      return;
    }

    if (window.gameAudio) window.gameAudio.playSfx('hurt');

    this.cameras.main.shake(200, 0.018);
    this.impactParticles.emitParticleAt(this.player.x, this.player.y, 6);

    this.tweens.add({
      targets: this.player,
      tint: 0xff0000,
      duration: 150,
      yoyo: true,
      onComplete: () => { this.player.clearTint(); this.player.setTint(0x00FFA3); },
    });

    const { difficulty } = window.gameState;
    const finalAmt = Math.round(amount * (difficulty === 'hard' ? 1.35 : (difficulty === 'Medium' ? 1.0 : 0.72)));

    const nextHealth = Math.max(0, window.gameState.health - finalAmt);
    window.gameState.health = nextHealth;
    updateReactState({ health: nextHealth });

    if (nextHealth <= 0) {
      this.triggerGameOver();
    }
  }

  triggerGameOver() {
    this.gameplayStarted = false;
    this.player.setVelocity(0, 0);
    this.player.play('jama-light-idle');
    
    this.cameras.main.fadeOut(1500, 0, 0, 0);
    this.time.delayedCall(1600, () => {
      this.scene.start('GameOverScene');
    });
  }

  drawWeapons() {
    this.spearGraphics.clear();
    this.shieldGraphics.clear();

    if (!this.player || !this.player.active) return;

    const angle = this.isAttacking ? this.time.now * 0.05 : 0;
    const plX = this.player.x;
    const plY = this.player.y;

    this.spearGraphics.lineStyle(2, 0xffd700, 1.0);
    this.spearGraphics.save();
    this.spearGraphics.translateCanvas(plX + 16, plY - 4);
    this.spearGraphics.rotateCanvas(angle);
    this.spearGraphics.lineBetween(-15, 0, 25, 0);
    
    this.spearGraphics.fillStyle(0xffaa00, 1.0);
    this.spearGraphics.beginPath();
    this.spearGraphics.moveTo(25, -4);
    this.spearGraphics.lineTo(34, 0);
    this.spearGraphics.lineTo(25, 4);
    this.spearGraphics.closePath();
    this.spearGraphics.fillPath();
    this.spearGraphics.restore();

    this.shieldGraphics.save();
    this.shieldGraphics.translateCanvas(plX - 16, plY + 4);
    this.shieldGraphics.lineStyle(3, 0x4a9eff, 1.0);
    if (this.shieldFlashState === 'gold') {
      this.shieldGraphics.lineStyle(4, 0xffd700, 1.0);
      this.time.delayedCall(100, () => { this.shieldFlashState = null; });
    } else if (this.shieldFlashState === 'blue') {
      this.shieldGraphics.lineStyle(4, 0x00ffff, 1.0);
      this.time.delayedCall(100, () => { this.shieldFlashState = null; });
    }
    
    this.shieldGraphics.beginPath();
    this.shieldGraphics.arc(0, 0, 10, -Math.PI / 3, Math.PI / 3);
    this.shieldGraphics.strokePath();

    this.shieldGraphics.lineStyle(1.5, 0x3d2000, 0.6);
    this.shieldGraphics.lineBetween(-5, -5, 5, 5);
    this.shieldGraphics.lineBetween(-5, 5, 5, -5);
    this.shieldGraphics.restore();
  }

  drawDarknessVignette(time: number) {
    if (!this.player || !this.player.active) return;

    this.darknessOverlay.clear();
    this.darknessOverlay.fill(0x000000, 0.88);

    const screenX = this.player.x - this.cameras.main.scrollX;
    const screenY = this.player.y - this.cameras.main.scrollY;

    const fuel = window.gameState.lanternFuel ?? 100;
    const fuelFactor = Math.max(0.2, fuel / 100);
    const breathScale = 1.0 + Math.sin(time * 0.005) * 0.05;

    const finalScale = 0.72 * fuelFactor * breathScale;
    this.lightMaskImage.setScale(Math.max(0.1, finalScale));
    this.darknessOverlay.draw(this.lightMaskImage, screenX, screenY);

    this.lanternPool.clear();
    this.lanternPool.fillStyle(0xf5c842, 0.1);
    this.lanternPool.fillCircle(this.player.x, this.player.y, 110 * finalScale);
    this.lanternPool.fillStyle(0xf5c842, 0.04);
    this.lanternPool.fillCircle(this.player.x, this.player.y, 200 * finalScale);
  }

  showFloatingText(x: number, y: number, textString: string, color: number) {
    const fText = this.add.text(x, y, textString, {
      fontFamily: 'Courier',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 3,
    });
    fText.setDepth(3);
    this.tweens.add({
      targets: fText,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      onComplete: () => fText.destroy()
    });
  }

  createSpeechBubble(sourceObject: any, text: string, speakerName: 'jama' | 'nkanyamba', onCompleteCallback?: () => void) {
    if (!sourceObject || !sourceObject.active) return;

    const bubbleHeight = 65;
    const bubbleWidth = 240;
    const bubblePadding = 12;

    const bubbleContainer = this.add.container(sourceObject.x, sourceObject.y - 90);
    bubbleContainer.setDepth(3.0);

    const graphics = this.add.graphics();
    bubbleContainer.add(graphics);

    const isNkanyamba = (speakerName === 'nkanyamba');
    const bgColor = isNkanyamba ? 0x0d0005 : 0x000d05;
    const strokeColor = isNkanyamba ? 0xff0000 : 0x00ffa3;
    const plateColor = isNkanyamba ? '#ff0000' : '#00ffa3';
    const textColor = isNkanyamba ? '#ff4ffc' : '#00ffa3';
    const plateText = isNkanyamba ? "N K A N Y A M B A" : "J A M A";

    graphics.fillStyle(bgColor, 0.95);
    for (let g = 3; g > 0; g--) {
      graphics.lineStyle(g * 3, strokeColor, (isNkanyamba ? 0.08 : 0.07) / g);
      graphics.strokeRoundedRect(-bubbleWidth / 2, -bubbleHeight / 2, bubbleWidth, bubbleHeight, 14);
    }
    graphics.fillRoundedRect(-bubbleWidth / 2, -bubbleHeight / 2, bubbleWidth, bubbleHeight, 14);

    const nameText = this.add.text(-bubbleWidth / 2 + 15, -bubbleHeight / 2 - 12, plateText, {
      fontFamily: 'Courier',
      fontSize: '9px',
      fontStyle: 'bold',
      color: plateColor,
      backgroundColor: '#000000',
      padding: { x: 5, y: 1 }
    });
    bubbleContainer.add(nameText);

    const contentText = this.add.text(-bubbleWidth / 2 + bubblePadding, -bubbleHeight / 2 + bubblePadding, text, {
      fontFamily: 'Courier',
      fontSize: '11px',
      color: textColor,
      align: 'left',
      wordWrap: { width: bubbleWidth - bubblePadding * 2 }
    });
    bubbleContainer.add(contentText);

    const tip = this.add.text(bubbleWidth / 2 - 20, bubbleHeight / 2 - 14, "▶", {
      fontFamily: 'Courier',
      fontSize: '9px',
      color: plateColor,
    });
    bubbleContainer.add(tip);

    this.tweens.add({
      targets: tip,
      alpha: 0.2,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    let canProgress = false;
    const cooldownTimer = this.time.delayedCall(250, () => {
      canProgress = true;
    });

    const triggerTap = this.input.keyboard ? this.input.keyboard.on('keydown-SPACE', handleProgress) : null;
    const triggerPointer = this.input!.on('pointerdown', handleProgress);

    function handleProgress() {
      if (!canProgress) return;
      if (triggerTap) {
        triggerTap.removeListener('keydown-SPACE', handleProgress);
      }
      triggerPointer.removeListener('pointerdown', handleProgress);
      cooldownTimer.destroy();
      bubbleContainer.destroy();
      if (onCompleteCallback) onCompleteCallback();
    }

    const followTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (sourceObject && sourceObject.active && bubbleContainer && bubbleContainer.active) {
          bubbleContainer.setPosition(sourceObject.x, sourceObject.y - 90);
        } else {
          followTimer.destroy();
        }
      }
    });
  }
}
*/

// 7. SHRINE SCENE (LEVEL 3 - THE BOSS FIGHT)
export class ShrineScene extends Phaser.Scene {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  boss!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  khweziSprite!: Phaser.GameObjects.Sprite;
  obstacles!: Phaser.Physics.Arcade.StaticGroup;
  guardsGroup!: Phaser.Physics.Arcade.Group;
  projectilesGroup!: Phaser.Physics.Arcade.Group;
  spearParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  impactParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  radialParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  darknessOverlay!: Phaser.GameObjects.Graphics;
  lightMaskImage!: Phaser.GameObjects.Image;
  lanternPool!: Phaser.GameObjects.Graphics;
  
  // Dark pools hazard and stats tracking fields
  poolsGroup!: Phaser.Physics.Arcade.StaticGroup;
  herbsGroup!: Phaser.Physics.Arcade.StaticGroup;
  playerInPool = false;
  lastPoolDamageTime = 0;
  lastRegenTime = 0;
  startTime = 0;

  bossHealth = 600;
  maxBossHealth = 600;
  bossPhase = 1; // 1 or 2
  
  corruption = 0;
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  fillRate = 100 / 150;

  
  isAttacking = false;
  isDashing = false;
  lastDashTime = 0;
  dashCooldown = 2200; // 2.2 seconds as requested
  
  lastBossAttackTime = 0;
  bossTelegraphTick = 0;
  telegraphMark!: Phaser.GameObjects.Graphics;

  isBlocking = false;
  blockStartTime = 0;
  lastBlockTime = 0;
  blockCooldown = 3000;
  isShieldBashing = false;
  lastBashTime = 0;
  lastStrikeTime = 0;
  shieldFlashState: 'gold' | 'blue' | null = null;
  spearGraphics!: Phaser.GameObjects.Graphics;
  shieldGraphics!: Phaser.GameObjects.Graphics;

  // Nkanyamba Specific Logic Properties
  gameplayStarted = false;
  isTransitioningPhase = false;
  isLaughing = false;
  bossAuraColor = 0x0a0005;
  sparkEmitterActive = false;
  lastSparkTick = 0;
  bossTrailHistory: { x: number; y: number }[] = [];
  lastBossFootstepTime = 0;
  lastTrailRecordTime = 0;
  lastHazardPoolSpawnTime = 0;
  hazardTelegraphX = 0;
  hazardTelegraphY = 0;
  hazardTelegraphEnd = 0;
  nkanyambaGraphics!: Phaser.GameObjects.Graphics;

  // New Minion Wave and Combat Safety properties
  nextSpawnSideLeft = true;
  pendingReplacementSpawns = 0;
  lastGuardDamageTime = 0;

  constructor() {
    super('ShrineScene');
  }

  init(data?: any) {
    if (data) {
      if (data.health !== undefined) {
        window.gameState.health = data.health;
      }
      if (data.lanternFuel !== undefined) {
        window.gameState.lanternFuel = data.lanternFuel;
      }
      if (data.score !== undefined) {
        window.gameState.score = data.score;
      }
    }
    
    const rawDiff = (window.gameState.difficulty || 'Medium').toLowerCase();
    this.difficulty = (rawDiff === 'easy' || rawDiff === 'medium' || rawDiff === 'hard') ? rawDiff : 'medium';
    
    if (this.difficulty === 'easy') {
      this.fillRate = 100 / 240; // 4 minutes
    } else if (this.difficulty === 'hard') {
      this.fillRate = 100 / 90; // 90 seconds
    } else {
      this.fillRate = 100 / 150; // 2.5 minutes
    }

    updateReactState({ activeScene: 'ShrineScene', corruption: 0, isGameOver: false, gameCompleted: false });
  }

  create() {
    updateReactState({ activeScene: 'ShrineScene', isGameOver: false, gameCompleted: false, corruption: 0 });
    
    // Play substantive subsonic dread drone upon entering level
    if (window.gameAudio) {
      window.gameAudio.setMusicTheme('boss');
      window.gameAudio.startBossDrone();
    }

    // Playtime tracker start trigger
    this.startTime = this.time.now;
    this.playerInPool = false;

    this.bossHealth = 600;
    this.maxBossHealth = 600;
    this.bossPhase = 1;

    updateReactState({ bossHealth: 600, maxBossHealth: 600, bossPhase: 1, health: 100 });

    // Canvas size limits are 1280x720px exactly (Single static arena!)
    this.physics.world.setBounds(0, 0, 1280, 720);
    this.cameras.main.setBackgroundColor('#0d0a0a');

    // 1. PROCEDURAL CAVE RUINS GROUND GENERATOR
    const caveGround = this.add.graphics();
    caveGround.setDepth(0.01);

    // Base dark stone ground color
    caveGround.fillStyle(0x0d0a0a, 1.0);
    caveGround.fillRect(0, 0, 1280, 720);

    // Stone tile grid with every 3rd tile lighter #1c1612
    for (let tx = 0; tx < 16; tx++) {
      for (let ty = 0; ty < 9; ty++) {
        if ((tx + ty) % 3 === 0) {
          caveGround.fillStyle(0x1c1612, 1.0);
          caveGround.fillRect(tx * 80 + 2, ty * 80 + 2, 76, 76);
        }

        // Moss creeping into cracks: thin irregular lines #1a3a1a alpha 0.5 at tile edges
        caveGround.lineStyle(1.5, 0x1a3a1a, 0.5);
        caveGround.beginPath();
        let bx = tx * 80;
        let by = ty * 80;
        caveGround.moveTo(bx + Phaser.Math.Between(-3, 3), by + Phaser.Math.Between(-3, 3));
        caveGround.lineTo(bx + 80 + Phaser.Math.Between(-3, 3), by + Phaser.Math.Between(-3, 3));
        caveGround.lineTo(bx + 80 + Phaser.Math.Between(-3, 3), by + 80 + Phaser.Math.Between(-3, 3));
        caveGround.lineTo(bx + Phaser.Math.Between(-3, 3), by + 80 + Phaser.Math.Between(-3, 3));
        caveGround.closePath();
        caveGround.strokePath();
      }
    }

    // Cracked stone texture: irregular polygon cracks drawn using lines color #1a1410
    caveGround.lineStyle(2, 0x1a1410, 1.0);
    for (let i = 0; i < 30; i++) {
      let cx = Phaser.Math.Between(60, 1220);
      let cy = Phaser.Math.Between(130, 685);
      caveGround.beginPath();
      caveGround.moveTo(cx, cy);
      for (let pt = 0; pt < 4; pt++) {
        cx += Phaser.Math.Between(-24, 24);
        cy += Phaser.Math.Between(-20, 20);
        caveGround.lineTo(cx, cy);
      }
      caveGround.strokePath();
    }

    // Scattered rubble: small irregular polygon clusters color #2a2018 alpha 0.8
    caveGround.fillStyle(0x2a2018, 0.8);
    for (let r = 0; r < 15; r++) {
      let rx = Phaser.Math.Between(80, 1200);
      let ry = Phaser.Math.Between(150, 650);
      let size = Phaser.Math.Between(5, 11);
      caveGround.beginPath();
      caveGround.moveTo(rx + Phaser.Math.Between(-size, size), ry + Phaser.Math.Between(-size, size));
      for (let pIdx = 0; pIdx < 5; pIdx++) {
        let ang = (pIdx / 5) * Math.PI * 2;
        let rSize = size + Phaser.Math.Between(-3, 3);
        caveGround.lineTo(rx + Math.cos(ang) * rSize, ry + Math.sin(ang) * rSize);
      }
      caveGround.closePath();
      caveGround.fillPath();
    }

    // 2. SCATTERED BONES & SKELETONS DECORATIONS
    const skeletonsGraphics = this.add.graphics();
    skeletonsGraphics.setDepth(0.08);

    const drawSkeletonAt = (sx: number, sy: number) => {
      skeletonsGraphics.fillStyle(0xdedde2, 0.85);
      skeletonsGraphics.lineStyle(2.0, 0xdedde2, 0.85);

      // Skull: circle 4px radius
      skeletonsGraphics.fillCircle(sx, sy, 4);

      // Ribcage: 3 parallel curved lines
      for (let r = 0; r < 3; r++) {
        let ry = sy + 6 + r * 4;
        skeletonsGraphics.lineBetween(sx - 5, ry, sx, ry + 2);
        skeletonsGraphics.lineBetween(sx, ry + 2, sx + 5, ry);
      }

      // Limbs: disjointed lines
      skeletonsGraphics.lineBetween(sx - 3, sy + 18, sx - 9, sy + 25);
      skeletonsGraphics.lineBetween(sx + 3, sy + 18, sx + 8, sy + 23);
      skeletonsGraphics.lineBetween(sx - 4, sy + 10, sx - 11, sy + 7);

      // Disjointed bone fragment scattered nearby
      skeletonsGraphics.lineBetween(sx + 15, sy + 6, sx + 22, sy + 11);
    };

    const skeletonPlacements = [
      { x: 180, y: 190 },
      { x: 380, y: 460 },
      { x: 190, y: 620 },
      { x: 1080, y: 190 },
      { x: 920, y: 520 },
      { x: 1110, y: 390 },
      { x: 500, y: 280 }
    ];
    skeletonPlacements.forEach(coord => drawSkeletonAt(coord.x, coord.y));

    // 2b. Wall and top cave boundary rendering
    const caveWalls = this.add.graphics();
    caveWalls.setDepth(1.2); // sits above character layer for realism with stalactites!

    // Rough cave wall: color #0a0805
    caveWalls.fillStyle(0x0a0805, 1.0);
    caveWalls.fillRect(0, 0, 1280, 110);

    // Stalactite suggestion at top boundary: downward pointing triangles of varying sizes color #1a1410 alpha 0.9
    for (let st = 0; st < 32; st++) {
      let stX = Phaser.Math.Between(15, 1265);
      let stWidth = Phaser.Math.Between(16, 48);
      let stHeight = Phaser.Math.Between(35, 76);
      caveWalls.fillStyle(0x1a1410, 0.9);
      caveWalls.beginPath();
      caveWalls.moveTo(stX - stWidth / 2, 110);
      caveWalls.lineTo(stX + stWidth / 2, 110);
      caveWalls.lineTo(stX, 110 + stHeight);
      caveWalls.closePath();
      caveWalls.fillPath();
    }

    // Ancient carved markings on walls scratched in faint white #ffffff alpha 0.15
    caveWalls.lineStyle(1.5, 0xffffff, 0.15);
    // Left warrior mark
    caveWalls.beginPath();
    caveWalls.arc(200, 50, 6, 0, Math.PI * 2);
    caveWalls.strokePath();
    caveWalls.lineBetween(200, 56, 200, 75);
    caveWalls.lineBetween(200, 62, 185, 54);
    caveWalls.lineBetween(200, 62, 215, 54);
    caveWalls.lineBetween(200, 75, 190, 92);
    caveWalls.lineBetween(200, 75, 210, 92);

    // Right warrior mark
    caveWalls.beginPath();
    caveWalls.arc(1080, 50, 6, 0, Math.PI * 2);
    caveWalls.strokePath();
    caveWalls.lineBetween(1080, 56, 1080, 75);
    caveWalls.lineBetween(1080, 62, 1065, 54);
    caveWalls.lineBetween(1080, 62, 1095, 54);
    caveWalls.lineBetween(1080, 75, 1070, 92);
    caveWalls.lineBetween(1080, 75, 1090, 92);

    // Ancient circular spiral mark
    caveWalls.beginPath();
    for (let theta = 0; theta < Math.PI * 4; theta += 0.12) {
      let rSp = theta * 1.9;
      let sx = 640 + Math.cos(theta) * rSp;
      let sy = 40 + Math.sin(theta) * rSp;
      if (theta === 0) caveWalls.moveTo(sx, sy);
      else caveWalls.lineTo(sx, sy);
    }
    caveWalls.strokePath();

    // Solid wall colliders
    this.obstacles = this.physics.add.staticGroup();
    const wallWall = this.obstacles.create(640, 55, 'forest-tree'); // hidden blocker
    wallWall.setVisible(false);
    wallWall.setBodySize(1280, 110);
    wallWall.refreshBody();

    // 3. Spawning Khwezi (Bound on sacrificial altar top-center)
    this.add.rectangle(640, 105, 140, 30, 0x111115); // stone block
    this.khweziSprite = this.add.sprite(640, 105, 'khwezi').setScale(1.25);

    // Shimmering purple altar smoke rings
    this.add.particles(640, 110, 'part-violet', {
      scale: { start: 0.5, end: 1.2 },
      alpha: { start: 0.5, end: 0 },
      speedY: -25,
      speedX: { min: -10, max: 10 },
      lifespan: 1500,
      frequency: 250,
      blendMode: 'ADD',
    });

    // 4. Spawning Upgraded Spear Player
    this.player = this.physics.add.sprite(640, 580, 'jama-light');
    this.player.setCollideWorldBounds(true);
    this.player.setBodySize(36, 36);
    this.player.setDepth(2);
    this.player.play('jama-light-idle');
    this.player.setTint(0x00FFA3);

    // Create soft pulsing aura beneath player sprite in ShrineScene (radius 11 is approx 0.6x 36 width)
    const aura = this.add.graphics();
    aura.fillStyle(0x00FFA3, 1.0);
    aura.fillCircle(0, 0, 11);
    aura.setDepth(1.9); // Renders below player sprite (depth 2)
    (this as any).playerAura = aura;

    this.tweens.add({
      targets: aura,
      alpha: { from: 0.18, to: 0.08 },
      scaleX: { from: 1.15, to: 0.9 },
      scaleY: { from: 1.15, to: 0.9 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.physics.add.collider(this.player, this.obstacles);

    // Light spear magical electrical sparkle trail
    this.spearParticles = this.add.particles(0, 0, 'part-gold', {
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.7, end: 0 },
      speed: 25,
      frequency: 80,
      lifespan: 600,
      blendMode: 'ADD',
    });
    this.spearParticles.startFollow(this.player);

    // 5. Spawning Boss: Nkanyamba representor in code
    // He is significantly larger than regular enemies (scaled frame bounds and drawn meticulously)
    this.boss = this.physics.add.sprite(640, 330, 'boss') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    this.boss.setCollideWorldBounds(true);
    this.boss.setBodySize(80, 80);
    this.boss.setDepth(3);
    this.boss.setAlpha(0); // Invisible sprite texture, we draw him using custom Phaser Graphics!

    // Attach custom Nkanyamba rendering graphics object
    this.nkanyambaGraphics = this.add.graphics();
    this.nkanyambaGraphics.setDepth(3.1); // sits above background characters

    // 6. Spawn Elite guards
    this.guardsGroup = this.physics.add.group();
    this.projectilesGroup = this.physics.add.group();

    this.spawnGuard(300, 300);
    this.spawnGuard(980, 300);

    this.physics.add.collider(this.guardsGroup, this.obstacles);
    this.physics.add.collider(this.guardsGroup, this.guardsGroup);

    // Splatters groups
    this.impactParticles = this.add.particles(0, 0, 'part-blood', {
      scale: { start: 0.8, end: 0 },
      speed: 120,
      lifespan: 400,
      frequency: -1,
    });

    this.radialParticles = this.add.particles(0, 0, 'part-gold', {
      scale: { start: 1.2, end: 0 },
      speed: 160,
      lifespan: 600,
      frequency: -1,
      blendMode: 'ADD',
    });

    // Spiky shadow warning circle indicator
    this.telegraphMark = this.add.graphics();
    this.telegraphMark.setDepth(1);

    this.physics.add.overlap(this.player, this.projectilesGroup, (pl, pNode) => {
      const proj = pNode as Phaser.Physics.Arcade.Sprite;
      if (!proj || !proj.active) return;

      if (proj.getData('friendly')) return;

      if (this.isBlocking) {
        const elapsed = this.time.now - this.blockStartTime;
        if (elapsed <= 180) { // Parry-reflect
          this.shieldFlashState = 'gold';
          this.radialParticles.emitParticleAt(proj.x, proj.y, 16);
          this.showFloatingText(this.player.x, this.player.y - 45, 'PARRY REFLECT!', 0xffd700);

          let minD = Infinity;
          let target: Phaser.Physics.Arcade.Sprite | null = null;
          
          this.guardsGroup.getChildren().forEach((g) => {
            const guard = g as Phaser.Physics.Arcade.Sprite;
            if (guard.active) {
              const d = Phaser.Math.Distance.Between(proj.x, proj.y, guard.x, guard.y);
              if (d < minD) {
                minD = d;
                target = guard;
              }
            }
          });
          
          if (this.boss && this.boss.active) {
            const d = Phaser.Math.Distance.Between(proj.x, proj.y, this.boss.x, this.boss.y);
            if (d < minD) {
              minD = d;
              target = this.boss as any;
            }
          }

          if (target) {
            const angle = Math.atan2(target.y - proj.y, target.x - proj.x);
            proj.setVelocity(Math.cos(angle) * 380, Math.sin(angle) * 380);
            
            proj.setData('friendly', true);
            proj.setData('damageAmount', 50); // High-damage reflect
            proj.setTint(0xffd700);
            return;
          }
        } else { // Standard block
          this.shieldFlashState = 'blue';
          this.showFloatingText(this.player.x, this.player.y - 45, 'BLOCKED!', 0x4a9eff);
          proj.destroy();
          this.damagePlayer(Math.round(15 * 0.20)); // 20% fractional damage
          return;
        }
      }

      proj.destroy();
      this.damagePlayer(15); // Shadow projectile strike (reduced to 15 for balance)
    });

    // Handle friendly reflected projectiles hitting guards
    this.physics.add.overlap(this.projectilesGroup, this.guardsGroup, (projNode, enemyNode) => {
      const proj = projNode as Phaser.Physics.Arcade.Sprite;
      const enemy = enemyNode as Phaser.Physics.Arcade.Sprite;
      if (proj.getData('friendly')) {
        proj.destroy();
        const dmg = proj.getData('damageAmount') || 30;
        this.hitGuard(enemy, dmg, proj.body ? proj.body.velocity.x * 0.05 : 0, proj.body ? proj.body.velocity.y * 0.05 : 0);
      }
    });

    // Handle friendly reflected projectiles hitting boss
    this.physics.add.overlap(this.projectilesGroup, this.boss, (projNode, bNode) => {
      const proj = projNode as Phaser.Physics.Arcade.Sprite;
      if (proj.getData('friendly') && this.boss && this.boss.active) {
        proj.destroy();
        const dmg = proj.getData('damageAmount') || 30;
        this.damageBoss(dmg, proj.body ? proj.body.velocity.x * 0.05 : 0, proj.body ? proj.body.velocity.y * 0.05 : 0);
      }
    });

    // 6b. Spawning Interactive Dark Pools
    this.poolsGroup = this.physics.add.staticGroup();
    const poolCoordinates = [
      { x: 320, y: 240 },
      { x: 960, y: 240 },
      { x: 320, y: 480 },
      { x: 960, y: 480 }
    ];
    poolCoordinates.forEach(coord => {
      const pool = this.poolsGroup.create(coord.x, coord.y, 'dark-pool').setScale(1.2);
      pool.setBodySize(68, 68);
      pool.refreshBody();
    });

    // Overlap checks for the dark pools with the player
    this.physics.add.overlap(this.player, this.poolsGroup, () => {
      this.playerInPool = true;
    });

    // 6c. Spawning Sutherlandia Healing Herbs around the boss battle arena edges (3 herbs)
    this.herbsGroup = this.physics.add.staticGroup();
    const herbCorners = [
      { x: 120, y: 360 }, // far left
      { x: 220, y: 620 }, // bottom-left
      { x: 1060, y: 620 } // bottom-right
    ];
    herbCorners.forEach(coord => {
      const herb = this.herbsGroup.create(coord.x, coord.y, 'sutherlandia-herb');
      herb.setTint(0x39E07A); // Bio moss/prop accent (bright popping prop)
      this.tweens.add({
        targets: herb,
        scale: 1.25,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });

    // Overlap callback for gathering Sutherlandia healing herbs in Level 3
    this.physics.add.overlap(this.player, this.herbsGroup, (playerObj, herbObj) => {
      const herb = herbObj as Phaser.Physics.Arcade.Sprite;
      if (herb.active) {
        herb.destroy();
        
        // Heal player
        const healedAmt = 25;
        const nextHp = Math.min(100, window.gameState.health + healedAmt);
        updateReactState({ health: nextHp });
        
        // Effects
        this.showFloatingText(herb.x, herb.y, `+${healedAmt} HP Sutherlandia`, 0x10b981);
        if (window.gameAudio) {
          window.gameAudio.playSfx('collect');
        }
        
        // Green healing splash particles
        const healParticles = this.add.particles(herb.x, herb.y, 'part-gold', {
          scale: { start: 0.6, end: 0 },
          alpha: { start: 1, end: 0 },
          speed: 40,
          lifespan: 600,
          maxParticles: 12,
        });
        this.time.delayedCall(800, () => {
          healParticles.destroy();
        });
      }
    });

    this.spearGraphics = this.add.graphics();
    this.shieldGraphics = this.add.graphics();

    this.spearGraphics.disableInteractive();
    if (this.spearGraphics.input) this.spearGraphics.input.enabled = false;
    this.shieldGraphics.disableInteractive();
    if (this.shieldGraphics.input) this.shieldGraphics.input.enabled = false;

    this.spearGraphics.setDepth(2.1);
    this.shieldGraphics.setDepth(2.2);

    // Reactive hooks
    (window as any).triggerPhaserAttack = () => {
      if (this.scene.isActive() && this.player && this.player.active) {
        this.triggerLightAttack();
      }
    };
    (window as any).triggerPhaserDash = () => {
      if (this.scene.isActive() && this.player && this.player.active) {
        this.triggerDash();
      }
    };
    (window as any).triggerPhaserPower = () => {
      if (this.scene.isActive() && this.player && this.player.active) {
        this.triggerRadialPowerBurst();
      }
    };
    (window as any).triggerPhaserBash = () => {
      if (this.scene.isActive() && this.player && this.player.active) {
        this.triggerShieldBash();
      }
    };
    (window as any).triggerPhaserCollect = () => {
      // In shrine, no relics to collect, keep stubbed
    };

    // Trigger Comic speech bubbles cutscene on level entry
    this.time.delayedCall(120, () => {
      this.runCutsceneSequence();
    });
  }

  createSpeechBubble(sourceObject: Phaser.GameObjects.Sprite | Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, textString: string, speakerName: 'nkanyamba' | 'jama', onComplete: () => void) {
    const bubbleContainer = this.add.container(sourceObject.x, sourceObject.y - 100);
    bubbleContainer.setDepth(100); // Sit above absolutely everything else

    const graphics = this.add.graphics();
    bubbleContainer.add(graphics);

    // Padding & dimensions
    const bubbleWidth = 300;
    const bubbleHeight = 90;

    const isNkanyamba = (speakerName === 'nkanyamba');
    const bgColor = isNkanyamba ? 0x0d0005 : 0x000d05;
    const strokeColor = isNkanyamba ? 0xff0000 : 0x00ffa3;
    const plateColor = isNkanyamba ? '#ff0000' : '#00ffa3';
    const textColor = isNkanyamba ? '#ff4ffc' : '#00ffa3';
    const plateText = isNkanyamba ? "N K A N Y A M B A" : "J A M A";

    // 1. Draw soft outer glow shadow layers
    for (let g = 1; g <= 5; g++) {
      graphics.lineStyle(g * 3, strokeColor, (isNkanyamba ? 0.08 : 0.07) / g);
      graphics.strokeRoundedRect(-bubbleWidth / 2 - g * 1.5, -bubbleHeight - g * 1.5, bubbleWidth + g * 3, bubbleHeight + g * 3, 8);
    }

    // 2. Draw solid background rounded rect & sharp border
    graphics.fillStyle(bgColor, 1.0);
    graphics.lineStyle(2, strokeColor, 1.0);
    graphics.fillRoundedRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight, 8);
    graphics.strokeRoundedRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight, 8);

    // 3. Draw spiky tail pointing down to speaker body (20px gap)
    graphics.fillStyle(bgColor, 1.0);
    graphics.beginPath();
    graphics.moveTo(-10, 0);
    graphics.lineTo(10, 0);
    graphics.lineTo(0, 18);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, strokeColor, 1.0);
    graphics.beginPath();
    graphics.moveTo(-10, 0);
    graphics.lineTo(0, 18);
    graphics.lineTo(10, 0);
    graphics.strokePath();

    // Mask to erase line inside top of tail
    graphics.lineStyle(3.5, bgColor, 1.0);
    graphics.lineBetween(-8, -1, 8, -1);

    // 4. Draw thin boundary separator line below name plate
    graphics.lineStyle(1, strokeColor, 0.7);
    graphics.lineBetween(-bubbleWidth / 2 + 18, -bubbleHeight + 22, bubbleWidth / 2 - 18, -bubbleHeight + 22);

    // 5. Speaker Name Plate Accent inside bubble
    const namePlate = this.add.text(-bubbleWidth / 2 + 18, -bubbleHeight + 7, plateText, {
      fontFamily: '"Space Grotesk", "Courier New", monospace',
      fontSize: '11px',
      color: plateColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    });
    bubbleContainer.add(namePlate);

    // 6. Create the dialogue text (typewriter styled)
    const txt = this.add.text(-bubbleWidth / 2 + 18, -bubbleHeight + 28, "", {
      fontFamily: '"Space Grotesk", "Courier New", Courier, monospace',
      fontSize: '13px',
      color: textColor,
      wordWrap: { width: bubbleWidth - 36 },
      fontStyle: 'bold',
    });
    bubbleContainer.add(txt);

    // Sound alert on new text
    if (window.gameAudio) {
       window.gameAudio.playSfx('click');
    }

    // Typewriter effect (40ms per character as specified)
    let charIndex = 0;
    const timer = this.time.addEvent({
      delay: 40,
      repeat: textString.length - 1,
      callback: () => {
        charIndex++;
        if (txt && txt.active) {
          txt.setText(textString.substring(0, charIndex));
        }
        if (charIndex === textString.length) {
          // Wait 1200ms after text finishes typing, then fade out bubble over 300ms
          this.time.delayedCall(1200, () => {
             if (this.tweens) {
               this.tweens.add({
                 targets: bubbleContainer,
                 alpha: 0,
                 duration: 300,
                 onComplete: () => {
                    bubbleContainer.destroy();
                    onComplete();
                 }
               });
             } else {
               bubbleContainer.destroy();
               onComplete();
             }
          });
        }
      }
    });

    // Constantly follow source object position as they move or sway
    const followTimer = this.time.addEvent({
       delay: 16,
       loop: true,
       callback: () => {
          if (sourceObject && sourceObject.active && bubbleContainer && bubbleContainer.active) {
             bubbleContainer.setPosition(sourceObject.x, sourceObject.y - 90);
          } else {
             followTimer.destroy();
          }
       }
    });
  }

  runCutsceneSequence() {
     this.gameplayStarted = false; // Freeze everything!
     this.player.setVelocity(0, 0);
     this.boss.setVelocity(0, 0);

     // Smooth camera pan to show the altar & Nkanyamba center
     this.cameras.main.pan(640, 260, 1000, 'Quad.easeOut');

     this.time.delayedCall(1200, () => {
       // Step 1: Nkanyamba speaks
       this.createSpeechBubble(this.boss, "Foolish mortal! You dare enter my sanctuary?", 'nkanyamba', () => {
          // Step 2: Jama replies
          this.createSpeechBubble(this.player, "Release her, Nkanyamba! The flame ends here.", 'jama', () => {
             // Step 3: Nkanyamba counters
             this.isLaughing = true; // Trigger fast eyes pulsing
             // accompany with a deep echoing sound effect!
             if (window.gameAudio) {
                window.gameAudio.playSfx('ambient'); 
             }
             this.createSpeechBubble(this.boss, "The darkness cannot be snuffed out by a mere match!", 'nkanyamba', () => {
                this.isLaughing = false;
                
                // Camera pans back to reveal the fighting arena
                this.cameras.main.pan(640, 360, 800, 'Quad.easeInOut');

                this.time.delayedCall(905, () => {
                   if (window.gameAudio) {
                      window.gameAudio.playSfx('hurt'); 
                   }
                   this.showFloatingText(this.boss.x, this.boss.y - 30, "*MESSENGER LAUGHTER*", 0xbf4ffc);

                   // Start gameplay!
                   this.gameplayStarted = true;
                });
             });
          });
       });
     });
  }

  triggerPhase2Transition() {
    this.isTransitioningPhase = true;
    this.gameplayStarted = false; // Freeze gameplay!
    this.player.setVelocity(0, 0);
    this.boss.setVelocity(0, 0);
    
    // Stop all guards
    this.guardsGroup.getChildren().forEach(g => {
       const guard = g as Phaser.Physics.Arcade.Sprite;
       if (guard.active) guard.setVelocity(0, 0);
    });

    // Screen shakes: intensity 0.015 for 1500ms
    this.cameras.main.shake(1500, 0.015);

    // Phase transition audio begins
    if (window.gameAudio) {
      window.gameAudio.setBossPhase2();
    }

    // 100% HEALTH & LANTERN RESTORATION FOR THE PLAYER
    window.gameState.health = window.gameState.maxHealth;
    window.gameState.lanternFuel = 100;
    updateReactState({ health: window.gameState.maxHealth, lanternFuel: 100 });

    // Play restorative chime and splash health recovery floating text
    if (window.gameAudio) {
      window.gameAudio.playSfx('relic');
    }
    this.showFloatingText(this.player.x, this.player.y - 45, "HEALTH & LIGHT RESTORED!", 0x00FFA3);

    // Dynamic player light-pulse flash overlay effect
    const flashG = this.add.graphics();
    flashG.setDepth(99);
    flashG.fillStyle(0x00ffa3, 0.4);
    flashG.fillCircle(this.player.x, this.player.y, 160);
    this.tweens.add({
       targets: flashG,
       alpha: 0,
       duration: 800,
       onComplete: () => flashG.destroy()
    });

    // Visual aura shift: Deep red aura turns into electric violet-blue
    this.bossAuraColor = 0x8a2be2; // Electric violet-blue
    this.sparkEmitterActive = true;

    // Dialogue block dialogue over Nkanyamba's head
    this.createSpeechBubble(this.boss, "Witness the power of the Great Serpent!", 'nkanyamba', () => {
       // After speech finishes
       this.gameplayStarted = true;
       this.isTransitioningPhase = false;
       this.bossPhase = 2;
       updateReactState({ bossPhase: 2 });
       
       // Summon two booster guards for final challenge
       this.spawnGuard(250, 480);
       this.spawnGuard(1030, 480);
    });
  }

  drawNkanyamba(time: number) {
    if (!this.boss || !this.boss.active) {
      if (this.nkanyambaGraphics) this.nkanyambaGraphics.clear();
      return;
    }

    this.nkanyambaGraphics.clear();

    const bx = this.boss.x;
    const by = this.boss.y;

    // 1. Hover/Float Sway math
    const floatY = Math.sin(time * 0.003) * 8;

    // 2. Draw Faint Shadow Trail first if Phase 2
    if (this.bossPhase === 2 && this.bossTrailHistory) {
      this.bossTrailHistory.forEach((pt, idx) => {
        let alpha = 0.02 * (idx + 1); // fade out older ones
        // Draw path shadow silhouette
        this.nkanyambaGraphics.fillStyle(0x0a000d, alpha);
        this.nkanyambaGraphics.fillCircle(pt.x, pt.y + floatY - 33, 18);
        this.nkanyambaGraphics.lineStyle(4, 0x0a000d, alpha);
        this.nkanyambaGraphics.lineBetween(pt.x, pt.y + floatY - 15, pt.x, pt.y + floatY + 25);
      });
    }

    // 3. Draw outer shadow/aura beneath him
    let shadowPulse = 1.0 + 0.15 * Math.sin(time * 0.003);
    this.nkanyambaGraphics.fillStyle(0x000000, 0.65);
    this.nkanyambaGraphics.fillEllipse(bx, by + 75, 60 * shadowPulse, 18 * shadowPulse);

    // Body aura: deep shadow #0d010d vs electric violet-blue glow
    let auraColor = (this.bossPhase === 1) ? 0x0d010d : 0x8616e8;
    let auraAlpha = (this.bossPhase === 1) ? 0.45 : 0.4;
    
    this.nkanyambaGraphics.fillStyle(auraColor, auraAlpha);
    this.nkanyambaGraphics.fillCircle(bx, by + floatY + 5, 52); // Torso aura
    this.nkanyambaGraphics.fillCircle(bx, by + floatY - 33, 38); // Head aura

    // Helper to draw black limbs overlayed with flowing diagonal red/blue streaks
    const drawStreakLine = (x1: number, y1: number, x2: number, y2: number) => {
      // Draw background thick black line base (6px)
      this.nkanyambaGraphics.lineStyle(6, 0x010002, 1.0);
      this.nkanyambaGraphics.lineBetween(x1, y1, x2, y2);

      // Now overlay diagonal stripes alternating red and blue/violet
      let len = Phaser.Math.Distance.Between(x1, y1, x2, y2);
      if (len < 5) return;
      let steps = Math.floor(len / 8);
      let shiftOffset = (Math.floor(time / 250) * 2) % 8;
      
      for (let s = 0; s < steps; s++) {
        let frac = (s * 8 + shiftOffset) / len;
        if (frac > 1.0) continue;
        let px = x1 + (x2 - x1) * frac;
        let py = y1 + (y2 - y1) * frac;
        let color = (s % 2 === 0) ? 0xff002b : 0x671de0;
        
        this.nkanyambaGraphics.lineStyle(3, color, 0.85);
        this.nkanyambaGraphics.lineBetween(px - 3, py - 3, px + 3, py + 3);
      }
    };

    // 4. Draw Torso back-bones
    drawStreakLine(bx, by + floatY - 15, bx, by + floatY + 25);

    // 5. Draw Waving Obsidian Mantle (Spline visual)
    this.nkanyambaGraphics.lineStyle(3, 0x5a0d8c, 0.45);
    for (let side = -1; side <= 1; side += 2) {
      let capeSway = Math.sin(time * 0.003 + side) * 8;
      this.nkanyambaGraphics.beginPath();
      this.nkanyambaGraphics.moveTo(bx + side * 4, by + floatY - 15);
      this.nkanyambaGraphics.lineTo(bx + side * 24 + capeSway, by + floatY + 15);
      this.nkanyambaGraphics.lineTo(bx + side * 36 + capeSway * 1.5, by + floatY + 50);
      this.nkanyambaGraphics.strokePath();
    }

    // 6. Right Hand - Massive Shadow Spear
    let isCasting = time < this.bossTelegraphTick;
    let rHandX = bx + 32 + Math.sin(time * 0.003) * 3;
    let rHandY = by - 5 + floatY;

    if (isCasting) {
      rHandY -= 20; // raise arm on attack cast
    }

    // Spear shaft lines (thick jet black)
    this.nkanyambaGraphics.lineStyle(4, 0x050505, 1.0);
    this.nkanyambaGraphics.lineBetween(rHandX - 30, rHandY + 45, rHandX + 30, rHandY - 55);

    // Deep burning red spear tip point
    let tipX = rHandX + 30;
    let tipY = rHandY - 55;
    this.nkanyambaGraphics.lineStyle(7, 0xff003c, 0.85);
    this.nkanyambaGraphics.lineBetween(tipX, tipY, tipX + 8, tipY - 16);
    this.nkanyambaGraphics.lineStyle(2, 0xffffff, 1.0); // white core line
    this.nkanyambaGraphics.lineBetween(tipX, tipY, tipX + 8, tipY - 16);

    // Floating circular weapon energy spark stars around weapon tip
    let tipPulse = 4 + 2 * Math.sin(time * 0.01);
    this.nkanyambaGraphics.fillStyle(0xff003c, 0.35);
    this.nkanyambaGraphics.fillCircle(tipX + 4, tipY - 8, tipPulse);

    // Draw arm to right hand holding weapon
    drawStreakLine(bx, by + floatY - 15, rHandX, rHandY);

    // 7. Left Hand - Swirling Energy Portal
    let lHandX = bx - 32 + Math.sin(time * 0.003 + Math.PI) * 3;
    let lHandY = by - 5 + floatY;

    // Draw arm to left hand holding portal
    drawStreakLine(bx, by + floatY - 15, lHandX, lHandY);

    // Swirling portal graphics
    let rotSpeed = time * 0.005;
    this.nkanyambaGraphics.lineStyle(2.0, 0xff0055, 0.7);
    this.nkanyambaGraphics.strokeCircle(lHandX, lHandY, 14);
    this.nkanyambaGraphics.lineStyle(1.5, 0x8a2be2, 0.45);
    this.nkanyambaGraphics.strokeCircle(lHandX, lHandY, 20);

    // Dynamic glowing orbit dashes
    for (let d = 0; d < 4; d++) {
      let ang = rotSpeed + (d * Math.PI) / 2;
      this.nkanyambaGraphics.lineStyle(2, (d % 2 === 0 ? 0xff0055 : 0x00e1ff), 0.9);
      this.nkanyambaGraphics.lineBetween(
        lHandX + Math.cos(ang) * 9,
        lHandY + Math.sin(ang) * 9,
        lHandX + Math.cos(ang) * 14,
        lHandY + Math.sin(ang) * 14
      );
    }

    // 8. Legs drawing with active strides
    let isWalking = Math.abs(this.boss.body.velocity.x) > 5 || Math.abs(this.boss.body.velocity.y) > 5;
    let walkPhase = isWalking ? Math.sin(time * 0.008) * 12 : 0;

    // Left Leg
    let lKneeX = bx - 16 + walkPhase;
    let lFootX = bx - 22 + walkPhase * 1.3;
    drawStreakLine(bx, by + floatY + 25, lKneeX, by + floatY + 50);
    drawStreakLine(lKneeX, by + floatY + 50, lFootX, by + floatY + 75);

    // Right Leg
    let rKneeX = bx + 16 - walkPhase;
    let rFootX = bx + 22 - walkPhase * 1.3;
    drawStreakLine(bx, by + floatY + 25, rKneeX, by + floatY + 50);
    drawStreakLine(rKneeX, by + floatY + 50, rFootX, by + floatY + 75);

    // 9. Draw head circle (18px radius)
    const hx = bx;
    const hy = by + floatY - 33;
    this.nkanyambaGraphics.fillStyle(0x010002, 1.0);
    this.nkanyambaGraphics.fillCircle(hx, hy, 18);

    // 10. Draw Jagged Glowing Obsidian Crown Floating above head
    let cx = hx;
    let cy = hy - 11;
    this.nkanyambaGraphics.lineStyle(2, 0x8a2be2, 1.0);
    this.nkanyambaGraphics.fillStyle(0x010002, 1.0);
    this.nkanyambaGraphics.beginPath();
    this.nkanyambaGraphics.moveTo(cx - 15, cy + 2);
    this.nkanyambaGraphics.lineTo(cx - 10, cy - 8);
    this.nkanyambaGraphics.lineTo(cx - 4, cy);
    this.nkanyambaGraphics.lineTo(cx, cy - 14);
    this.nkanyambaGraphics.lineTo(cx + 4, cy);
    this.nkanyambaGraphics.lineTo(cx + 10, cy - 8);
    this.nkanyambaGraphics.lineTo(cx + 15, cy + 2);
    this.nkanyambaGraphics.closePath();
    this.nkanyambaGraphics.fillPath();
    this.nkanyambaGraphics.strokePath();

    // White crown-tip embers
    this.nkanyambaGraphics.fillStyle(0xffffff, 1.0);
    this.nkanyambaGraphics.fillCircle(cx - 10, cy - 8, 1.5);
    this.nkanyambaGraphics.fillCircle(cx, cy - 14, 2);
    this.nkanyambaGraphics.fillCircle(cx + 10, cy - 8, 1.5);

    // 11. Draw Custom Single Giant Vertical Red Slit Eye
    let eyePulse = 0.8 + 0.2 * Math.sin(time * 0.005);
    // Outer red glow aura
    this.nkanyambaGraphics.fillStyle(0xff003c, 0.25 * eyePulse);
    this.nkanyambaGraphics.fillCircle(hx, hy + 2, 12);
    this.nkanyambaGraphics.fillStyle(0xff003c, 0.5 * eyePulse);
    this.nkanyambaGraphics.fillCircle(hx, hy + 2, 6);
    // White/Neon-pink vertical slit pupil
    this.nkanyambaGraphics.fillStyle(0xffffff, 1.0);
    this.nkanyambaGraphics.fillEllipse(hx, hy + 2, 2.0, 5.5 * eyePulse);
  }

  update(time: number, delta: number) {
    if (window.gameState.isGameOver || window.gameState.gameCompleted) return;

    if (!this.gameplayStarted) {
      if (this.player && this.player.active) {
        this.player.setVelocity(0, 0);
        this.player.play('jama-light-idle', true);
      }
      if (this.boss && this.boss.active) {
        this.boss.setVelocity(0, 0);
      }
      const guards = this.guardsGroup?.getChildren() as Phaser.Physics.Arcade.Sprite[];
      if (guards) {
        guards.forEach(g => {
          if (g.active) g.setVelocity(0, 0);
        });
      }
      this.drawNkanyamba(time);
      return;
    }

    if (window.gameState.isPaused) {
      if (this.physics && this.physics.world && !this.physics.world.isPaused) {
        this.physics.pause();
        this.anims.pauseAll();
        this.tweens.pauseAll();
        if (this.player && this.player.active) {
          this.player.setVelocity(0, 0);
        }
        const guards = this.guardsGroup?.getChildren() as Phaser.Physics.Arcade.Sprite[];
        if (guards) {
          guards.forEach(g => {
            if (g.active) g.setVelocity(0, 0);
          });
        }
        if (this.boss && this.boss.active) {
          this.boss.setVelocity(0, 0);
        }
      }
      return;
    } else {
      if (this.physics && this.physics.world && this.physics.world.isPaused) {
        this.physics.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();
      }
    }

    // Set blocking state based on gameInput block key hold or D-Pad action hold, but only if not dashing or bashing
    const wasBlocking = this.isBlocking;
    const isBlockHeld = !!(window.gameInput && window.gameInput.block);
    
    if (isBlockHeld && !this.isDashing && !this.isShieldBashing) {
      const now = this.time.now;
      const blockCooldownRemaining = Math.max(0, 3000 - (now - this.lastBlockTime));
      
      if (blockCooldownRemaining <= 0) {
        if (!wasBlocking) {
          this.isBlocking = true;
          this.blockStartTime = now;
        } else if (now - this.blockStartTime > 2500) {
          // Automatic shield block fatigue / reset after 2.5 seconds hold
          this.isBlocking = false;
          this.lastBlockTime = now;
        }
      } else {
        this.isBlocking = false;
      }
    } else {
      if (wasBlocking) {
        this.isBlocking = false;
        this.lastBlockTime = this.time.now;
      }
    }

    // Sync cooldowns back to React State!
    const strikeCooldownPct = Math.max(0, 800 - (time - this.lastStrikeTime)) / 800;
    const blockCooldownPct = Math.max(0, 3000 - (time - this.lastBlockTime)) / 3000;
    const bashCooldownPct = Math.max(0, 4000 - (time - this.lastBashTime)) / 4000;
    const dashCooldownPct = Math.max(0, 2200 - (time - this.lastDashTime)) / 2200;
    
    if (Math.floor(time) % 4 === 0) { // Throttled updates to prevent lag
      updateReactState({ 
        strikeCooldownPct, 
        blockCooldownPct, 
        bashCooldownPct, 
        dashCooldownPct,
        corruption: this.corruption
      });
    }

    // Redraw spear and shield weapons
    this.drawWeapons();

    if (this.player && this.player.active && (this as any).playerAura) {
      (this as any).playerAura.setPosition(this.player.x, this.player.y);
    }

    // Forest Blessing inside Shrine: Natural healing (+3 HP every 4 seconds) if not standing on dark pools
    if (!this.playerInPool && window.gameState.health < 100) {
      if (!this.lastRegenTime) this.lastRegenTime = time;
      if (time > this.lastRegenTime + 4000) {
        this.lastRegenTime = time;
        const nextHp = Math.min(100, window.gameState.health + 3);
        updateReactState({ health: nextHp });
        this.showFloatingText(this.player.x, this.player.y - 35, '+3 HP Forest Blessing', 0x10b981);
      }
    } else if (this.playerInPool) {
      this.lastRegenTime = time;
    }

    // Process Dark Pool toxic fluid damage over time (8HP damage every 500ms)
    if (this.playerInPool) {
      if (time > (this.lastPoolDamageTime || 0) + 500) {
        this.lastPoolDamageTime = time;
        this.damagePlayer(8);
        this.showFloatingText(this.player.x, this.player.y - 20, 'CORRUPTION! -8HP', 0xbf4ffc);
      }
    }
    this.playerInPool = false; // Reset for overlap checks in the current frame

    const isCrouching = !!(window.gameInput as any).crouch;
    if (isCrouching) {
      this.player.setScale(1.0, 0.65);
      this.player.setAlpha(0.65);

      // Crouch Healing Tick inside Shrine level
      let lastCrouchHeal = this.player.getData('lastCrouchHealTime') || 0;
      if (time > lastCrouchHeal + 1000) {
        this.player.setData('lastCrouchHealTime', time);
        if (window.gameState.health < 100) {
          const { difficulty } = window.gameState;
          const healRate = difficulty === 'hard' ? 1 : (difficulty === 'Medium' ? 3 : 5);
          const nextHp = Math.min(100, window.gameState.health + healRate);
          updateReactState({ health: nextHp });
          this.showFloatingText(this.player.x, this.player.y - 35, `+${healRate} HP Spirit Mend`, 0x10b981);
        }
      }
    } else {
      this.player.setScale(1.0, 1.0);
      this.player.setAlpha(1.0);
    }

    // 1. Process player movement coordinates
    let vx = 0;
    let vy = 0;

    if (window.gameInput.up) vy = -1;
    else if (window.gameInput.down) vy = 1;

    if (window.gameInput.left) vx = -1;
    else if (window.gameInput.right) vx = 1;

    let speed = this.isDashing ? 450 : (isCrouching ? 75 : 180);
    if (this.isBlocking) {
      speed *= 0.40; // 40% speed penalty
    }

    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    this.player.setVelocity(vx * speed, vy * speed);

    // Dynamic animations and flipping based on movement
    if (vx !== 0 || vy !== 0) {
      const angle = Math.atan2(vy, vx);
      this.player.setData('facingAngle', angle);

      if (vx < 0) {
        this.player.setFlipX(true);
      } else if (vx > 0) {
        this.player.setFlipX(false);
      }

      // Lean slightly into movement
      this.player.setRotation(vx * 0.12);

      if (!this.isAttacking) {
        this.player.play('jama-light-run', true);
      }
    } else {
      if (!this.isAttacking) {
        this.player.play('jama-light-idle', true);
        this.player.setRotation(0);
      }
    }

    // Capture direct Action clicks bound from React Buttons
    if (window.gameInput.attack) {
      window.gameInput.attack = false;
      this.triggerLightAttack();
    }
    if (window.gameInput.dash) {
      window.gameInput.dash = false;
      this.triggerDash();
    }
    if (window.gameInput.power) {
      window.gameInput.power = false;
      this.triggerRadialPowerBurst();
    }

    // 2. Process elite guards coordinates
    const playerC = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const guards = this.guardsGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];
    guards.forEach((g) => {
      if (!g.active) return;

      // Sync static red under-glow with guard sprite position
      const glow = g.getData('glow') as Phaser.GameObjects.Graphics;
      if (glow) {
        glow.setPosition(g.x, g.y);
      }

      const gDist = Phaser.Math.Distance.Between(playerC.x, playerC.y, g.x, g.y);
      const angle = Math.atan2(playerC.y - g.y, playerC.x - g.x);
      
      let multiplier = 1.0;
      let speedMultiplier = 1.0;
      if (this.corruption >= 100) {
        multiplier = 2.0;
        speedMultiplier = 1.3;
      }

      if (gDist < 400) {
        // Pursuit movement velocity speed
        g.setVelocity(Math.cos(angle) * 115 * speedMultiplier, Math.sin(angle) * 115 * speedMultiplier);

        // A. Handle melee proximity / contact (5 damage, or 1 if blocking)
        if (gDist < 48) {
          let now = time;
          let lastDmg = g.getData('lastDamageTime') || 0;
          if (now > lastDmg + 850) {
            g.setData('lastDamageTime', now);
            let dmgVal = this.isBlocking ? Math.round(1 * multiplier) : Math.round(5 * multiplier);
            this.damagePlayer(dmgVal);
            this.showFloatingText(this.player.x, this.player.y - 20, this.isBlocking ? `BLOCKED! -${dmgVal}HP` : `GUARD HIT -${dmgVal}HP`, 0xff3333);
          }
          g.setVelocity(Math.cos(angle) * -125, Math.sin(angle) * -125); // push away on contact
        }

        // B. Elite guards long-range fire (once every 4.0s with telegraph warning)
        let lastShoot = g.getData('lastShootTime') || 0;
        let telegraphEnd = g.getData('telegraphEndTime') || 0;

        if (gDist >= 110 && gDist <= 380) {
          if (time > lastShoot + 4000) {
            g.setData('telegraphEndTime', time + 600); // 600ms target lock
            g.setData('lastShootTime', time);
            
            // Pulse the wraith white so player knows it is casting
            this.tweens.add({
              targets: g,
              alpha: 0.35,
              yoyo: true,
              duration: 100,
              repeat: 4
            });
          }
        }

        // Fire the projectile skull if telegraph reaches target
        if (telegraphEnd > 0 && time > telegraphEnd) {
          g.setData('telegraphEndTime', 0);
          if (g.active) {
            const proj = this.physics.add.sprite(g.x, g.y, 'projectile');
            this.projectilesGroup.add(proj);
            const fireAngle = Math.atan2(playerC.y - g.y, playerC.x - g.x);
            proj.setVelocity(Math.cos(fireAngle) * 190, Math.sin(fireAngle) * 190);
            
            if (window.gameAudio) {
              window.gameAudio.playSfx('boss_phase');
            }

            this.time.delayedCall(2500, () => {
              if (proj.active) proj.destroy();
            });
          }
        }
      } else {
        g.setVelocity(0, 0);
      }
    });

    // 3. NKANYAMBA COMBAT AI & STATE MACHINE
    const bossDist = Phaser.Math.Distance.Between(playerC.x, playerC.y, this.boss.x, this.boss.y);
    const angleToPlayer = Math.atan2(playerC.y - this.boss.y, playerC.x - this.boss.x);

    // Constant slow float hover tween
    this.boss.y += Math.sin(time * 0.003) * 0.3;

    // Trigger footstep sounds at intervals while moving
    const isMoving = (Math.abs(this.boss.body.velocity.x) > 5 || Math.abs(this.boss.body.velocity.y) > 5);
    if (isMoving) {
      const stepInterval = (this.bossPhase === 1) ? 800 : 450;
      if (time > (this.lastBossFootstepTime || 0) + stepInterval) {
        this.lastBossFootstepTime = time;
        if (window.gameAudio) {
          window.gameAudio.playNkanyambaFootstep();
        }
      }
    }

    if (this.bossPhase === 1) {
      // Phase 1: Slow, lumbering movement (speed 45) toward player
      this.boss.setVelocity(Math.cos(angleToPlayer) * 45, Math.sin(angleToPlayer) * 45);

      if (time > this.lastBossAttackTime + 3500) {
        if (Math.random() > 0.5) {
          this.executeBossSlamAttack(playerC);
        } else {
          this.executeBossScatterProjectiles(angleToPlayer);
        }
      }
    } else {
      // Phase 2: Agitated movement: speed increases to 85
      this.boss.setVelocity(Math.cos(angleToPlayer) * 85, Math.sin(angleToPlayer) * 85);

      // Attack selections in Phase 2
      if (time > this.lastBossAttackTime + 2800) {
        const rng = Math.random();
        if (rng > 0.7) {
          this.executeBossTeleportShroud();
        } else if (rng > 0.4) {
          this.executeBossScatterProjectiles(angleToPlayer);
        } else {
          this.executeBossSlamAttack(playerC);
        }
      }

      // Phase 2 New attack: Summoning hazard pools dynamically under player's feet (every 6000ms: places active dark pool, telegraph warning of 1500ms)
      if (time > (this.lastHazardPoolSpawnTime || 0) + 6000) {
        this.lastHazardPoolSpawnTime = time;
        this.hazardTelegraphX = this.player.x;
        this.hazardTelegraphY = this.player.y;
        this.hazardTelegraphEnd = time + 1500;

        // Animate arms raise
        this.bossTelegraphTick = time + 1500;

        this.time.delayedCall(1500, () => {
          if (this.poolsGroup && this.poolsGroup.active) {
            const pool = this.poolsGroup.create(this.hazardTelegraphX, this.hazardTelegraphY, 'dark-pool').setScale(1.2);
            pool.setBodySize(68, 68);
            pool.refreshBody();

            // Emit violent portal particles
            const portalSplat = this.add.particles(this.hazardTelegraphX, this.hazardTelegraphY, 'part-violet', {
              scale: { start: 0.8, end: 0 },
              alpha: { start: 0.7, end: 0 },
              speed: 100,
              lifespan: 500,
              maxParticles: 15,
            });
            this.time.delayedCall(1000, () => { portalSplat.destroy(); });
          }
          this.hazardTelegraphEnd = 0;
        });
      }
    }

    // Record trail history for faint shadow trail behind him (visual trail in Phase 2)
    if (this.bossPhase === 2 && time > (this.lastTrailRecordTime || 0) + 120) {
      this.lastTrailRecordTime = time;
      this.bossTrailHistory.push({ x: this.boss.x, y: this.boss.y });
      if (this.bossTrailHistory.length > 5) {
        this.bossTrailHistory.shift();
      }
    }

    // Process telegraph graphics fading
    this.telegraphMark.clear();
    
    // 1. Basic slam telegraph warning
    if (time < this.bossTelegraphTick) {
      const remaining = this.bossTelegraphTick - time;
      this.telegraphMark.lineStyle(2.5, 0xff0000, 0.45);
      this.telegraphMark.fillStyle(0xcc0000, 0.12 + (1 - remaining/1200) * 0.2);
      this.telegraphMark.fillCircle(this.boss.x, this.boss.y, 140);
      this.telegraphMark.strokeCircle(this.boss.x, this.boss.y, 140);
    }

    // 2. Custom hazard pool telegraph warning (pulsing violet circle)
    if (this.hazardTelegraphEnd && time < this.hazardTelegraphEnd) {
      const remainingPool = this.hazardTelegraphEnd - time;
      let ratio = 1.0 - (remainingPool / 1500);
      this.telegraphMark.lineStyle(2.0, 0x8a2be2, 0.65);
      this.telegraphMark.fillStyle(0x4b0082, 0.15 + ratio * 0.25);
      this.telegraphMark.fillCircle(this.hazardTelegraphX, this.hazardTelegraphY, 60 * ratio);
      this.telegraphMark.strokeCircle(this.hazardTelegraphX, this.hazardTelegraphY, 60);
    }

    // Emit golden sparks when active
    if (this.sparkEmitterActive && time > this.lastSparkTick) {
      this.lastSparkTick = time + 22; // approx 45 sparks / sec
      this.radialParticles.emitParticleAt(this.boss.x + Phaser.Math.Between(-28, 28), this.boss.y + Phaser.Math.Between(-35, 35), 1);
    }

    // Redraw the gorgeous custom modular stickman and shadow elements in real-time
    this.drawNkanyamba(time);
  }

  triggerLightAttack() {
    if (this.isAttacking) return;
    const now = this.time.now;
    if (now - this.lastStrikeTime < 800) return; // Attack cooldown boundary
    this.isAttacking = true;
    this.lastStrikeTime = now;

    if (window.gameAudio) window.gameAudio.playSfx('attack');

    const originalRot = this.player.getData('facingAngle') ?? 0;
    const lungeX = Math.cos(originalRot) * 55;
    const lungeY = Math.sin(originalRot) * 55;

    // Play attack spritesheet frame flow
    this.player.play('jama-light-attack', true);
    
    // Rotate character fully in line with attack direction momentarily
    this.player.setRotation(originalRot);

    // Rapid electrical thrust tween
    this.tweens.add({
      targets: this.player,
      x: this.player.x + lungeX,
      y: this.player.y + lungeY,
      duration: 80,
      yoyo: true,
      onComplete: () => {
        this.isAttacking = false;
        if (this.player && this.player.active) {
          this.player.setRotation(0);
        }
      },
    });

    // Extended melee range (85px)
    const reach = 100;
    const dmg = 35;

    // Attack Boss
    const bDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
    if (bDist < reach) {
      const angle = Math.atan2(this.boss.y - this.player.y, this.boss.x - this.player.x);
      const diff = Phaser.Math.Angle.ShortestBetween(originalRot, angle);
      if (Math.abs(diff) < 1.4) {
        this.damageBoss(dmg, lungeX * 0.3, lungeY * 0.3);
      }
    }

    // Attack elite guards
    this.guardsGroup.getChildren().forEach((node) => {
      const guard = node as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, guard.x, guard.y);
      if (dist < reach) {
        const angle = Math.atan2(guard.y - this.player.y, guard.x - this.player.x);
        const diff = Phaser.Math.Angle.ShortestBetween(originalRot, angle);
        if (Math.abs(diff) < 1.4) {
          this.hitGuard(guard, dmg, lungeX * 0.4, lungeY * 0.4);
        }
      }
    });
  }

  triggerRadialPowerBurst() {
    // POWER Action button has an 8-second cooldown (handled in React display, checked here)
    if (window.gameAudio) {
      window.gameAudio.playSfx('power');
    }

    // Golden magic shockwave flash
    this.cameras.main.flash(200, 255, 230, 100);

    // Emit blast particles
    this.radialParticles.emitParticleAt(this.player.x, this.player.y, 45);

    // Damage all entities inside 175px radius
    const burstDmg = 90;

    // Boss damage
    const bDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
    if (bDist < 190) {
      this.damageBoss(burstDmg, 0, 0);
    }

    // Elite guards
    this.guardsGroup.getChildren().forEach((node) => {
      const guard = node as Phaser.Physics.Arcade.Sprite;
      const gDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, guard.x, guard.y);
      if (gDist < 190) {
        this.hitGuard(guard, burstDmg, (guard.x - this.player.x)*0.3, (guard.y - this.player.y)*0.3);
      }
    });

    // Gold shockwave glowing rings
    const blastCirc = this.add.graphics();
    this.tweens.addCounter({
      from: 10,
      to: 180,
      duration: 500,
      onUpdate: (twValue) => {
        blastCirc.clear();
        blastCirc.lineStyle(6, 0xffea60, 1 - (twValue.getValue() / 180));
        blastCirc.strokeCircle(this.player.x, this.player.y, twValue.getValue());
      },
      onComplete: () => {
        blastCirc.destroy();
      },
    });
  }

  triggerDash() {
    const now = this.time.now;
    this.dashCooldown = 2200; // 2.2s as specified
    if (now - this.lastDashTime < this.dashCooldown) return;
    this.lastDashTime = now;
    this.isDashing = true;

    if (window.gameAudio) window.gameAudio.playSfx('dash');

    this.tweens.add({
      targets: this.player,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 1,
    });

    // 3 translucent ghost copies at 40ms, 80ms, 120ms
    [40, 80, 120].forEach((delay) => {
      this.time.delayedCall(delay, () => {
        if (this.player && this.player.active) {
          const ghost = this.add.sprite(this.player.x, this.player.y, this.player.texture.key, this.player.frame.name);
          ghost.setFlipX(this.player.flipX);
          ghost.setAlpha(0.35);
          ghost.setDepth(1.85);
          ghost.setRotation(this.player.rotation);
          ghost.setTint(0x00FFA3);
          this.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 250,
            onComplete: () => ghost.destroy()
          });
        }
      });
    });

    this.time.delayedCall(220, () => { // 220ms duration as requested
      this.isDashing = false;
    });

    // Notify React of cooldown overlay ticks
    updateReactState({ lastDashTime: now, dashCooldown: this.dashCooldown });
  }

  executeBossSlamAttack(playerCoord: Phaser.Math.Vector2) {
    this.lastBossAttackTime = this.time.now;
    this.bossTelegraphTick = this.time.now + 1200; // 1.2s warning

    // Anchor boss velocity during tell
    this.boss.setVelocity(0, 0);

    this.time.delayedCall(1200, () => {
      if (!this.boss.active) return;
      this.telegraphMark.clear();

      if (window.gameAudio) window.gameAudio.playSfx('boss_slam');
      this.cameras.main.shake(300, 0.025);

      // Radial shock purple particles
      this.add.particles(this.boss.x, this.boss.y, 'part-violet', {
        scale: { start: 1.2, end: 0 },
        speed: 210,
        lifespan: 500,
        maxParticles: 35,
      });

      // Confirm hit on player within 140px radius slam
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (dist < 142) {
        this.damagePlayer(25);
      }
    });
  }

  executeBossScatterProjectiles(angleToPlayer: number) {
    this.lastBossAttackTime = this.time.now;
    
    if (window.gameAudio) window.gameAudio.playSfx('boss_phase');

    // Scatter 3 projectle skull orbs in a spread pattern
    const angles = [angleToPlayer - 0.26, angleToPlayer, angleToPlayer + 0.26];
    angles.forEach((ang) => {
      const proj = this.physics.add.sprite(this.boss.x, this.boss.y, 'projectile');
      this.projectilesGroup.add(proj);
      proj.setVelocity(Math.cos(ang) * 220, Math.sin(ang) * 220);

      this.time.delayedCall(3000, () => {
        if (proj.active) proj.destroy();
      });
    });
  }

  executeBossTeleportShroud() {
    this.lastBossAttackTime = this.time.now;
    this.boss.setVelocity(0, 0);

    // Become translucent shroud
    this.tweens.add({
      targets: this.boss,
      alpha: 0.1,
      duration: 350,
      onComplete: () => {
        if (!this.boss.active) return;
        // Shift to a random coordinates far from player spacing
        let randomX = 200 + Math.random() * 880;
        let randomY = 150 + Math.random() * 400;

        while (Phaser.Math.Distance.Between(randomX, randomY, this.player.x, this.player.y) < 220) {
          randomX = 200 + Math.random() * 880;
          randomY = 150 + Math.random() * 400;
        }

        this.boss.setPosition(randomX, randomY);

        // materialise
        this.tweens.add({
          targets: this.boss,
          alpha: 1.0,
          duration: 350,
        });
      },
    });
  }

  damageBoss(amount: number, pushX: number, pushY: number) {
    if (window.gameState.isGameOver || window.gameState.gameCompleted) return;

    if (window.gameAudio) window.gameAudio.playSfx('hit');

    // Embezzle dark blood splash particles
    this.impactParticles.emitParticleAt(this.boss.x, this.boss.y, 8);

    this.boss.x += pushX;
    this.boss.y += pushY;

    // Apply flash red to boss sprite
    this.tweens.add({
      targets: this.boss,
      tint: 0xff0000,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        if (this.boss.active) {
          this.boss.setTint(0x8B1A1A); // Restore base enemy tint
        }
      },
    });

    const nextHp = Math.max(0, this.bossHealth - amount);
    this.bossHealth = nextHp;
    updateReactState({ bossHealth: nextHp });

    // Nkanyamba Phase Transition: Dropping below 50% HP (300 / 600)
    if (this.bossPhase === 1 && nextHp <= 300) {
      this.triggerPhase2Transition();
    } else if (nextHp <= 0) {
      this.triggerBossDefeated();
    }
  }

  hitGuard(guard: Phaser.Physics.Arcade.Sprite, damage: number, pushX: number, pushY: number) {
    if (window.gameAudio) window.gameAudio.playSfx('hit');

    // Trigger physical red sparks on guard hit/damage!
    this.impactParticles.emitParticleAt(guard.x, guard.y, 15);

    guard.x += pushX;
    guard.y += pushY;

    let hp = guard.getData('hp') - damage;
    guard.setData('hp', hp);

    // Standard red tint flash on receiving hit
    this.tweens.add({
      targets: guard,
      tint: 0xff0000,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        if (guard.active) {
          guard.setTint(0x8B1A1A); // Restore base enemy tint
        }
      },
    });

    if (hp <= 0) {
      // 1. Immediately disable his body to prevent further collisions or damage ticks
      guard.disableBody(true, false);

      // 2. Perform gorgeous visual dissolving scale-down and fade over exactly 350ms
      this.tweens.add({
        targets: guard,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        angle: 180,
        duration: 350,
        onComplete: () => {
          guard.destroy();

          // 3. Spawns alternating replacement from queue
          if (this.pendingReplacementSpawns > 0) {
            this.pendingReplacementSpawns--;
            let spawnX = this.nextSpawnSideLeft ? 250 : 1030;
            this.nextSpawnSideLeft = !this.nextSpawnSideLeft;
            this.spawnGuard(spawnX, 480);
          }
        },
      });

      if ((window as any).incrementEnemiesDefeated) {
        (window as any).incrementEnemiesDefeated(1);
      }
      updateReactState({ score: window.gameState.score + 150 });
    }
  }

  damagePlayer(amount: number) {
    if (window.gameState.isGameOver || window.gameState.gameCompleted) return;

    // Dash 150ms invincibility iframe check
    if (this.isDashing && (this.time.now - this.lastDashTime < 150)) {
      return;
    }

    if (window.gameAudio) window.gameAudio.playSfx('hurt');

    this.cameras.main.shake(200, 0.018);
    this.impactParticles.emitParticleAt(this.player.x, this.player.y, 6);

    this.tweens.add({
      targets: this.player,
      tint: 0xff0000,
      duration: 150,
      yoyo: true,
      onComplete: () => { this.player.clearTint(); },
    });

    // Apply difficulty modifiers for boss fight too
    const { difficulty } = window.gameState;
    const finalAmt = Math.round(amount * (difficulty === 'hard' ? 1.35 : (difficulty === 'Medium' ? 1.0 : 0.72)));

    const nextHp = Math.max(0, window.gameState.health - finalAmt);
    updateReactState({ health: nextHp });

    if (nextHp <= 0) {
      this.triggerPlayerDeath();
    }
  }

  triggerBossDefeated() {
    this.gameplayStarted = false; // Freeze gameplay ticks!
    updateReactState({ gameCompleted: true });

    // Track statistics for Boss Defeated and Difficulty Completed
    if ((window as any).incrementEnemiesDefeated) {
      (window as any).incrementEnemiesDefeated(1); // Boss counts as enemy!
    }
    if ((window as any).incrementCompletion) {
      (window as any).incrementCompletion(window.gameState.difficulty);
    }
    
    // Stop actor velocities
    this.player.setVelocity(0, 0);
    this.boss.setVelocity(0, 0);
    this.guardsGroup.clear(true, true);

    // Stop boss ambient drone immediately
    if (window.gameAudio) {
      window.gameAudio.stopBossDrone();
    }

    // Massive dramatic lighting spikes / shaking (2000ms, intensity 0.025)
    this.cameras.main.shake(2000, 0.025);

    // Trigger multiple concussive micro-blasts and particles before the final explosion
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 300, () => {
        if (!this.boss || !this.boss.active) return;
        
        // Play concussive sound
        if (window.gameAudio) {
          window.gameAudio.playSfx('hurt');
        }

        // Splat violet clouds
        const pX = this.boss.x + Phaser.Math.Between(-35, 35);
        const pY = this.boss.y + Phaser.Math.Between(-45, 45);
        const concussedEmitter = this.add.particles(pX, pY, 'part-violet', {
          scale: { start: 1.0, end: 0 },
          alpha: { start: 0.8, end: 0 },
          speed: Phaser.Math.Between(100, 240),
          lifespan: 600,
          maxParticles: 12,
        });
        this.time.delayedCall(1000, () => concussedEmitter.destroy());

        this.showFloatingText(pX, pY - 20, "*SKULL SHATTER*", 0x8a2be2);
      });
    }

    // Golden blast laser beam impaling the boss
    this.time.delayedCall(1500, () => {
      if (!this.boss || !this.boss.active) return;

      const laser = this.add.graphics();
      laser.setDepth(4);
      
      this.tweens.addCounter({
        from: 10,
        to: 110,
        duration: 1800,
        onUpdate: (twCounter) => {
          if (!this.boss || !this.boss.active) return;
          laser.clear();
          laser.fillStyle(0xffffff, 0.95);
          laser.fillRect(this.boss.x - twCounter.getValue()*0.5, 0, twCounter.getValue(), 720);
          laser.fillStyle(0xffea30, 0.45);
          laser.fillRect(this.boss.x - twCounter.getValue()*0.8, 0, twCounter.getValue()*1.65, 720);
        },
        onComplete: () => {
          laser.destroy();
          this.boss.destroy();

          // Chains dissolvment around Khwezi
          this.cameras.main.flash(600, 255, 255, 255);
          this.khweziSprite.clearTint();

          // Release ropes in texture drawing (remove glowing chains from Khwezi)
          // Move Jama to Altar
          this.tweens.add({
            targets: this.player,
            x: 640,
            y: 190,
            duration: 1200,
            onComplete: () => {
              // Embrace sequence triggers (transition to ending scene)
              this.time.delayedCall(1600, () => {
                this.shutdownShrineScene();
                this.scene.start('EndingScene');
              });
            },
          });
        },
      });
    });
  }

  triggerPlayerDeath() {
    updateReactState({ isGameOver: true });
    this.player.setVelocity(0, 0);
    this.player.setAngle(90);

    this.time.delayedCall(1200, () => {
      this.shutdownShrineScene();
      this.scene.start('GameOverScene');
    });
  }

  showFloatingText(x: number, y: number, textString: string, color: number) {
    const fText = this.add.text(x, y, textString, {
      fontFamily: 'Courier',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 3,
    });
    fText.setDepth(10);
    this.tweens.add({
      targets: fText,
      y: y - 45,
      alpha: 0,
      duration: 1000,
      onComplete: () => fText.destroy(),
    });
  }

  shutdownShrineScene() {
    if (this.spearParticles) this.spearParticles.destroy();
    if (this.impactParticles) this.impactParticles.destroy();
    if (this.radialParticles) this.radialParticles.destroy();
    this.telegraphMark.clear();

    // Increment player stats playtime
    if (this.startTime) {
      const elapsedSecs = Math.floor((this.time.now - this.startTime) / 1000);
      if (elapsedSecs > 0 && (window as any).incrementPlaytime) {
        (window as any).incrementPlaytime(elapsedSecs);
      }
      this.startTime = 0;
    }
  }

  triggerShieldBash() {
    if (this.isBlocking) return;
    const now = this.time.now;
    if (now - this.lastBashTime < 4000) return;
    this.lastBashTime = now;
    this.isShieldBashing = true;

    if (window.gameAudio) {
      window.gameAudio.playShieldBashSound();
    }

    const originalRotation = this.player.getData('facingAngle') ?? 0;
    const lungeX = Math.cos(originalRotation) * 45;
    const lungeY = Math.sin(originalRotation) * 45;

    updateReactState({ lastBashTime: now, bashCooldown: 4000 });

    this.tweens.add({
      targets: this.player,
      x: this.player.x + lungeX,
      y: this.player.y + lungeY,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.isShieldBashing = false;
      }
    });

    const reach = 55;
    const damage = 15;

    // Check guards
    this.guardsGroup.getChildren().forEach((node) => {
      const enemy = node as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < reach) {
        const angleToEnemy = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
        const diff = Phaser.Math.Angle.ShortestBetween(originalRotation, angleToEnemy);
        if (Math.abs(diff) < 1.3) {
          this.hitGuard(enemy, damage, lungeX * 2.0, lungeY * 2.0);
        }
      }
    });

    // Check boss
    if (this.boss && this.boss.active) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (dist < reach + 20) { // Boss is larger!
        const angleToBoss = Math.atan2(this.boss.y - this.player.y, this.boss.x - this.player.x);
        const diff = Phaser.Math.Angle.ShortestBetween(originalRotation, angleToBoss);
        if (Math.abs(diff) < 1.3) {
          this.damageBoss(damage, lungeX * 2.0, lungeY * 2.0);
        }
      }
    }
  }

  drawWeapons() {
    if (!this.player || !this.player.active) {
      if (this.spearGraphics) this.spearGraphics.clear();
      if (this.shieldGraphics) this.shieldGraphics.clear();
      return;
    }
    
    if (this.spearGraphics) this.spearGraphics.clear();
    if (this.shieldGraphics) this.shieldGraphics.clear();
    
    const isFlipped = this.player.flipX;
    const directionFactor = isFlipped ? -1 : 1;
    
    const isWalking = (Math.abs(this.player.body.velocity.x) > 10 || Math.abs(this.player.body.velocity.y) > 10);
    const bobY = isWalking ? Math.sin(this.time.now * 0.012) * 2.5 : 0;
    
    if (this.isAttacking) {
      this.spearGraphics.setDepth(2.1);
      this.shieldGraphics.setDepth(1.85);

      this.spearGraphics.setPosition(0, 0); // draw absolutely
      this.spearGraphics.setRotation(0);
      this.spearGraphics.setScale(1, 1);
      
      const facingAngle = this.player.getData('facingAngle') ?? 0;
      const spearX = Math.cos(facingAngle) * 12;
      const spearY = Math.sin(facingAngle) * 12 + bobY;
      
      const startX = this.player.x + spearX - Math.cos(facingAngle) * 12;
      const startY = this.player.y + spearY - Math.sin(facingAngle) * 12;
      const endX = this.player.x + spearX + Math.cos(facingAngle) * 28;
      const endY = this.player.y + spearY + Math.sin(facingAngle) * 28;
      
      this.spearGraphics.lineStyle(3, 0x8B5E3C, 1.0);
      this.spearGraphics.lineBetween(startX, startY, endX, endY);
      
      const tipAngle = facingAngle;
      const tipLength = 6;
      const tX = endX + Math.cos(tipAngle) * tipLength;
      const tY = endY + Math.sin(tipAngle) * tipLength;
      
      const leftAngle = tipAngle + Math.PI * 5/6;
      const rightAngle = tipAngle - Math.PI * 5/6;
      const cornerWidth = 3;
      const lX = endX + Math.cos(leftAngle) * cornerWidth;
      const lY = endY + Math.sin(leftAngle) * cornerWidth;
      const rX = endX + Math.cos(rightAngle) * cornerWidth;
      const rY = endY + Math.sin(rightAngle) * cornerWidth;
      
      this.spearGraphics.fillStyle(0xC0C0C0, 1.0);
      this.spearGraphics.fillTriangle(lX, lY, rX, rY, tX, tY);
      
    } else {
      this.spearGraphics.setDepth(1.85);
      this.shieldGraphics.setDepth(2.1);
      
      const spearAngle = (15 * Math.PI / 180) * directionFactor;
      const handX = 12 * directionFactor;
      const handY = 4 + bobY;
      
      this.spearGraphics.setPosition(this.player.x + handX, this.player.y + handY);
      this.spearGraphics.setRotation(spearAngle);
      this.spearGraphics.setScale(1, 1);
      
      this.spearGraphics.lineStyle(2.5, 0x8B5E3C, 1.0);
      this.spearGraphics.lineBetween(0, -28, 0, 12);
      
      this.spearGraphics.fillStyle(0xC0C0C0, 1.0);
      this.spearGraphics.fillTriangle(-3, -28, 3, -28, 0, -34);
    }
    
    const sHandX = -12 * directionFactor;
    const sHandY = 4 + bobY;
    let shieldScale = 1.0;
    if (this.isBlocking) {
      shieldScale = 1.35;
    }
    
    const shieldTilt = -0.15 * directionFactor;
    
    this.shieldGraphics.setPosition(this.player.x + sHandX, this.player.y + sHandY);
    this.shieldGraphics.setScale(shieldScale, shieldScale);
    this.shieldGraphics.setRotation(shieldTilt);
    
    if (this.isBlocking) {
      this.shieldGraphics.fillStyle(0x4a9eff, 0.35);
      this.shieldGraphics.fillEllipse(0, 0, 20, 26);
    }
    
    this.shieldGraphics.fillStyle(0x5C3D1E, 1.0);
    this.shieldGraphics.fillEllipse(0, 0, 16, 22);
    
    let rimColor = 0x8B6914;
    if (this.shieldFlashState === 'gold') {
      rimColor = 0xFFD700;
    } else if (this.shieldFlashState === 'blue') {
      rimColor = 0x4a9eff;
    }
    
    this.shieldGraphics.lineStyle(2, rimColor, 1.0);
    this.shieldGraphics.strokeEllipse(0, 0, 16, 22);
    
    this.shieldGraphics.fillStyle(rimColor, 1.0);
    this.shieldGraphics.fillCircle(0, 0, 4);
    
    this.shieldGraphics.lineStyle(1.5, 0x3d2000, 0.6);
    this.shieldGraphics.lineBetween(-5, -5, 5, 5);
    this.shieldGraphics.lineBetween(-5, 5, 5, -5);
  }

  spawnGuard(x: number, y: number) {
    const guard = this.guardsGroup.create(x, y, 'wraith') as Phaser.Physics.Arcade.Sprite;
    guard.setTint(0x8B1A1A); // base enemy body tint
    guard.setData('hp', 50); // double HP
    guard.setCollideWorldBounds(true);
    guard.setDepth(1.5);

    // Call the unified glow creator
    attachEnemyGlow(this, guard);
  }
}

// 8. ENDING SCENE (VICTORY / DAWN)
export class EndingScene extends Phaser.Scene {
  private sunbeamsGraphics!: Phaser.GameObjects.Graphics;
  private rotationAngle = 0;

  constructor() {
    super('EndingScene');
  }

  create() {
    updateReactState({ activeScene: 'EndingScene' });
    if (window.gameAudio) {
      window.gameAudio.setMusicTheme('ending');
    }

    const w = 1280;
    const h = 720;

    // 1. Draw soft sunrise gradient background layer
    const bg = this.add.graphics();
    // Fill deep violet at the top
    bg.fillGradientStyle(0x05051a, 0x05051a, 0x1d1033, 0x1d1033, 1);
    bg.fillRect(0, 0, w, 400);

    // Warm orange/pink transition in the middle
    bg.fillGradientStyle(0x1d1033, 0x1d1033, 0xfe495c, 0xfe495c, 1);
    bg.fillRect(0, 400, w, 180);

    // Brilliant gold sunrise glow at the bottom
    bg.fillGradientStyle(0xfe495c, 0xfe495c, 0xffd700, 0xffd700, 1);
    bg.fillRect(0, 580, w, 140);

    // 2. Draw rotating sunbeams behind the sun
    this.sunbeamsGraphics = this.add.graphics();
    this.sunbeamsGraphics.setPosition(640, 480);

    // 3. Draw a massive glowing sun
    const sunGlow = this.add.graphics();
    sunGlow.fillStyle(0xffea30, 0.25);
    sunGlow.fillCircle(640, 480, 150);
    sunGlow.fillStyle(0xffd700, 0.95);
    sunGlow.fillCircle(640, 480, 85);

    // 4. Parallax layered elements
    // Layer 1 Hills (Deep purple shadow)
    const hill1 = this.add.graphics();
    hill1.fillStyle(0x36162c, 0.85);
    hill1.beginPath();
    hill1.moveTo(0, h);
    hill1.lineTo(0, h - 220);
    hill1.lineTo(300, h - 275);
    hill1.lineTo(600, h - 195);
    hill1.lineTo(900, h - 235);
    hill1.lineTo(w, h - 200);
    hill1.lineTo(w, h);
    hill1.closePath();
    hill1.fillPath();

    // Layer 2 Hills with simple forest stick tree outlines (fading pines)
    const hill2 = this.add.graphics();
    hill2.fillStyle(0x1b281f, 0.92);
    hill2.beginPath();
    hill2.moveTo(0, h);
    hill2.lineTo(0, h - 160);
    hill2.lineTo(400, h - 125);
    hill2.lineTo(800, h - 170);
    hill2.lineTo(1100, h - 145);
    hill2.lineTo(w, h - 130);
    hill2.lineTo(w, h);
    hill2.closePath();
    hill2.fillPath();

    // Draw little procedural pine tree silhouettes across hill tops
    hill2.fillStyle(0x111c14, 0.95);
    for (let tx = 30; tx < w; tx += 45) {
      const ty = h - 150 + Math.sin(tx * 0.01) * 20;
      hill2.beginPath();
      hill2.moveTo(tx, ty);
      hill2.lineTo(tx - 12, ty + 28);
      hill2.lineTo(tx + 12, ty + 28);
      hill2.closePath();
      hill2.fillPath();
    }

    // Layer 3 foreground flat ground (Dark, rich stone framing)
    const fg = this.add.graphics();
    fg.fillStyle(0x0c0f0a, 1.0);
    fg.fillRect(0, h - 85, w, 85);
  }

  update(time: number) {
    // Smoothly rotate sunbeams
    if (this.sunbeamsGraphics) {
      this.sunbeamsGraphics.clear();
      this.rotationAngle += 0.0016;
      
      this.sunbeamsGraphics.lineStyle(4, 0xffd700, 0.16);
      const beamCount = 12;
      for (let i = 0; i < beamCount; i++) {
        const ang = this.rotationAngle + (i * Math.PI * 2) / beamCount;
        this.sunbeamsGraphics.lineBetween(
          0, 
          0, 
          Math.cos(ang) * 580, 
          Math.sin(ang) * 580
        );
      }
    }
  }
}

// 9. GAME OVER SCENE
export class GameOverScene extends Phaser.Scene {
  private fogGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('GameOverScene');
  }

  create() {
    updateReactState({ activeScene: 'GameOverScene' });
    if (window.gameAudio) {
      window.gameAudio.setMusicTheme('none');
    }

    const w = 1280;
    const h = 720;

    // Dark flat background
    const bg = this.add.graphics();
    bg.fillStyle(0x040306, 1.0);
    bg.fillRect(0, 0, w, h);

    // 1. Slow pulsing purple fog aura in the center
    this.fogGraphics = this.add.graphics();
    this.fogGraphics.setPosition(640, 360);

    this.tweens.addCounter({
      from: 0.75,
      to: 1.25,
      duration: 3200,
      yoyo: true,
      loop: -1,
      onUpdate: (twCounter) => {
        if (!this.fogGraphics) return;
        this.fogGraphics.clear();
        let scale = twCounter.getValue();
        this.fogGraphics.fillStyle(0x3b0254, 0.18 + (scale - 0.75) * 0.08);
        this.fogGraphics.fillCircle(0, 0, 180 * scale);
        this.fogGraphics.fillStyle(0x280133, 0.28);
        this.fogGraphics.fillCircle(0, 0, 90 * scale);
      }
    });

    // 2. Creeping skeletal branches painted across the corners of the screen
    const branches = this.add.graphics();
    branches.lineStyle(3.0, 0x16131c, 0.85);

    // Corner: Top-Left
    branches.beginPath();
    branches.moveTo(0, 0);
    branches.lineTo(150, 120);
    branches.lineTo(220, 140);
    // Sub branches
    branches.moveTo(150, 120);
    branches.lineTo(120, 200);
    branches.moveTo(220, 140);
    branches.lineTo(310, 110);
    branches.strokePath();

    // Corner: Top-Right
    branches.lineStyle(2.8, 0x16131c, 0.8);
    branches.beginPath();
    branches.moveTo(w, 0);
    branches.lineTo(w - 180, 140);
    branches.lineTo(w - 240, 180);
    branches.moveTo(w - 180, 140);
    branches.lineTo(w - 110, 250);
    branches.strokePath();

    // Corner: Bottom-Left
    branches.beginPath();
    branches.moveTo(0, h);
    branches.lineTo(130, h - 110);
    branches.lineTo(160, h - 190);
    branches.moveTo(130, h - 110);
    branches.lineTo(240, h - 80);
    branches.strokePath();

    // Corner: Bottom-Right
    branches.beginPath();
    branches.moveTo(w, h);
    branches.lineTo(w - 140, h - 130);
    branches.lineTo(w - 220, h - 100);
    branches.moveTo(w - 140, h - 130);
    branches.lineTo(w - 110, h - 230);
    branches.strokePath();
  }
}
