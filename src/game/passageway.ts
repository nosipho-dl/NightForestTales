import Phaser from 'phaser';

// Event bridge helper to React
const updateReactState = (newState: Partial<any>) => {
  if (window.gameState) {
    window.gameState = { ...window.gameState, ...newState };
    if ((window as any).onGameStateChange) {
      (window as any).onGameStateChange(window.gameState);
    }
  }
};

export class PassagewayScene extends Phaser.Scene {
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

  // Custom graphics layers
  minionsGraphics!: Phaser.GameObjects.Graphics;
  corpsesGraphics!: Phaser.GameObjects.Graphics;
  bgGraphics!: Phaser.GameObjects.Graphics;
  gateGraphics!: Phaser.GameObjects.Graphics;
  gateBarsGraphics!: Phaser.GameObjects.Graphics;
  nkanyambaGraphics!: Phaser.GameObjects.Graphics;
  eyesOverlayGraphics!: Phaser.GameObjects.Graphics;

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

  // Narrative / Cutscene fields
  gameplayStarted = false;
  isCutsceneActive = true;
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  // Nkanyamba rendering variables
  nkAnyambaX = 640;
  nkAnyambaY = 450;
  nkAnyambaRotation = 180;
  nkAnyambaArmsRaisePct = 0;
  nkAnyambaHairFlare = 0;
  nkAnyambaLeftLegAlpha = 1.0;
  nkAnyambaRightLegAlpha = 1.0;
  nkAnyambaTorsoAlpha = 1.0;
  nkAnyambaArmsAlpha = 1.0;
  nkAnyambaHeadAlpha = 1.0;
  nkAnyambaVisible = true;
  nkAnyambaEyesPulseColor = 0xff0000;

  // Gate animation variables
  lockOffset = 0;
  lockAlpha = 1.0;
  chainAlpha = 1.0;
  barsYOffset = 0;
  gateOpenPct = 0;
  gateLockZone!: Phaser.GameObjects.Zone;

  // Minion setup and engagement caps
  totalMinionsDefeated = 0;
  drawEyesActive = false;
  eyePairsDrawData: any[] = [];
  minionCorpses: { x: number, y: number }[] = [];

  // Spawns array
  minionsSpawnData = [
    { id: 0, x: 500, y: 480, group: 1, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 1, x: 640, y: 550, group: 1, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 2, x: 780, y: 480, group: 1, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 3, x: 320, y: 850, group: 2, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 4, x: 350, y: 1200, group: 2, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 5, x: 320, y: 1600, group: 2, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 6, x: 960, y: 900, group: 3, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 7, x: 920, y: 1250, group: 3, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 8, x: 960, y: 1550, group: 3, alpha: 0, blinkTimer: 0, state: 'invisible' },
    { id: 9, x: 640, y: 1100, group: 3, alpha: 0, blinkTimer: 0, state: 'invisible' },
  ];

  constructor() {
    super('PassagewayScene');
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

    updateReactState({ activeScene: 'PassagewayScene', isGameOver: false, gameCompleted: false });
  }

  create() {
    this.startTime = this.time.now;

    // SCENE A Vertical corridor layout 1280px width, 2200px height
    this.physics.world.setBounds(0, 0, 1280, 2200);
    this.cameras.main.setBackgroundColor('#050302');
    this.cameras.main.setBounds(0, 0, 1280, 2200);

    // Initialize layout graphics layer
    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(0.01);

    this.gateGraphics = this.add.graphics();
    this.gateGraphics.setDepth(0.03);

    this.gateBarsGraphics = this.add.graphics();
    this.gateBarsGraphics.setDepth(1.25);

    this.nkanyambaGraphics = this.add.graphics();
    this.nkanyambaGraphics.setDepth(1.3);

    this.eyesOverlayGraphics = this.add.graphics();
    this.eyesOverlayGraphics.setDepth(1.4);

    this.corpsesGraphics = this.add.graphics();
    this.corpsesGraphics.setDepth(0.1);

    this.minionsGraphics = this.add.graphics();
    this.minionsGraphics.setDepth(1.5);

    // Draw non-changing graphics
    this.drawCorridorBackground();
    this.drawGateGraphics();

    // Set up physical barriers so player cannot exit vertical corridor
    this.obstacles = this.physics.add.staticGroup();

    const leftWall = this.add.zone(90, 1100, 180, 2200);
    this.physics.add.existing(leftWall, true);
    this.obstacles.add(leftWall);

    const rightWall = this.add.zone(1190, 1100, 180, 2200);
    this.physics.add.existing(rightWall, true);
    this.obstacles.add(rightWall);

    const bWallZone = this.add.zone(640, 2080, 1280, 240);
    this.physics.add.existing(bWallZone, true);
    this.obstacles.add(bWallZone);

    const gateLeftZone = this.add.zone(290, 350, 580, 100);
    this.physics.add.existing(gateLeftZone, true);
    this.obstacles.add(gateLeftZone);

    const gateRightZone = this.add.zone(990, 350, 580, 100);
    this.physics.add.existing(gateRightZone, true);
    this.obstacles.add(gateRightZone);

    this.gateLockZone = this.add.zone(640, 350, 120, 40);
    this.physics.add.existing(this.gateLockZone, true);
    this.obstacles.add(this.gateLockZone);

    // Vignette lighting Overlay
    this.darknessOverlay = this.add.renderTexture(0, 0, 1280, 2200);
    this.darknessOverlay.setDepth(2.5);
    this.darknessOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

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

    // Particle engines
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

    // Setup player
    this.player = this.physics.add.sprite(640, 2000, 'jama-light');
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

    this.physics.add.collider(this.player, this.obstacles);

    this.guardsGroup = this.physics.add.group();
    this.projectilesGroup = this.physics.add.group();

    this.physics.add.collider(this.guardsGroup, this.obstacles);
    this.physics.add.collider(this.guardsGroup, this.guardsGroup);

    // Hit projectile
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
            if (guard.active && guard.getData('state') === 'chase') {
              const d = Phaser.Math.Distance.Between(proj.x, proj.y, guard.x, guard.y);
              if (d < minD) {
                minD = d;
                target = guard;
              }
            }
          });

          if (target) {
            const angle = Math.atan2((target as any).y - proj.y, (target as any).x - proj.x);
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

    // Start Cutscene Immediately
    this.startNkanyambaCutscene();
  }

  drawCorridorBackground() {
    this.bgGraphics.clear();

    // 1. Ground base
    this.bgGraphics.fillStyle(0x0a0705, 1.0);
    this.bgGraphics.fillRect(0, 0, 1280, 2200);

    // Vertical rectangular floor slabs (#120d0a, 5px gaps)
    this.bgGraphics.fillStyle(0x120d0a, 1.0);
    const slabW = 60;
    const slabH = 90;
    const gap = 5;
    for (let x = 180; x < 1100; x += slabW + gap) {
      for (let y = 0; y < 2200; y += slabH + gap) {
        this.bgGraphics.fillRect(x, y, slabW, slabH);
      }
    }

    // Dull brick cracks (#1f1712 over randomized tiles)
    this.bgGraphics.lineStyle(2, 0x1f1712, 0.7);
    for (let i = 0; i < 40; i++) {
      let cx = Phaser.Math.Between(190, 1090);
      let cy = Phaser.Math.Between(100, 2100);
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(cx, cy);
      cx += Phaser.Math.Between(-30, 30);
      cy += Phaser.Math.Between(-15, 15);
      this.bgGraphics.lineTo(cx, cy);
      cx += Phaser.Math.Between(-30, 30);
      cy += Phaser.Math.Between(-15, 15);
      this.bgGraphics.lineTo(cx, cy);
      this.bgGraphics.strokePath();
    }

    // 2. Left Wall Margin (180px wide) & Columns (#060403 and #18110e)
    this.bgGraphics.fillStyle(0x18110e, 1.0);
    this.bgGraphics.fillRect(0, 0, 180, 2200);
    this.bgGraphics.fillRect(1100, 0, 180, 2200);

    // Thick wall columns at intervals
    this.bgGraphics.fillStyle(0x060403, 1.0);
    for (let y = 100; y < 2100; y += 400) {
      this.bgGraphics.fillRect(140, y, 40, 120);
      this.bgGraphics.fillRect(1100, y, 40, 120);
    }

    // 3. Stagnant green puddles (centered at shapes)
    // Puddle 1: (400, 1100), Puddle 2: (880, 1500)
    this.bgGraphics.fillStyle(0x0a1e12, 0.6);
    this.bgGraphics.fillEllipse(400, 1100, 125, 60);
    this.bgGraphics.fillEllipse(880, 1500, 125, 60);

    this.bgGraphics.lineStyle(1.5, 0x153b20, 0.3);
    this.bgGraphics.strokeEllipse(400, 1100, 125, 60);
    this.bgGraphics.strokeEllipse(880, 1500, 125, 60);

    // Bones
    this.bgGraphics.lineStyle(1.5, 0xd1ccd6, 0.55);
    const bonePositions = [
      { x: 210, y: 350 }, { x: 1050, y: 620 },
      { x: 230, y: 980 }, { x: 1040, y: 1420 },
      { x: 1070, y: 250 }, { x: 215, y: 1750 }
    ];
    bonePositions.forEach(b => {
      this.bgGraphics.lineBetween(b.x - 4, b.y - 3, b.x + 4, b.y + 3);
      this.bgGraphics.lineBetween(b.x + 3, b.y - 4, b.x - 3, b.y + 4);
      this.bgGraphics.strokeCircle(b.x, b.y, 1.5);
    });

    // 4. Bottom wall block: #040302 block spanning 240px off the bottom (y=1960 to 2200)
    this.bgGraphics.fillStyle(0x040302, 1.0);
    this.bgGraphics.fillRect(0, 1960, 1280, 240);

    this.bgGraphics.lineStyle(3, 0x120d0a, 0.8);
    this.bgGraphics.lineBetween(0, 1960, 1280, 1960);
  }

  drawGateGraphics() {
    this.gateGraphics.clear();

    // Dark corridor depth beyond gate
    this.gateGraphics.fillStyle(0x000000, 1.0);
    this.gateGraphics.fillRect(580, 80, 120, 100);

    // Archway flanking walls
    this.gateGraphics.fillStyle(0x040302, 1.0);
    this.gateGraphics.fillRect(180, 80, 400, 100);
    this.gateGraphics.fillRect(700, 80, 400, 100);

    this.gateGraphics.fillStyle(0x120d0a, 1.0);
    this.gateGraphics.fillRect(560, 80, 20, 100);
    this.gateGraphics.fillRect(700, 80, 20, 100);

    // Stone lintel
    this.gateGraphics.fillStyle(0x060403, 1.0);
    this.gateGraphics.fillRect(180, 50, 920, 30);
  }

  drawGateBars() {
    this.gateBarsGraphics.clear();

    const yOff = this.barsYOffset;
    const lAlpha = this.lockAlpha;
    const lOff = this.lockOffset;
    const cAlpha = this.chainAlpha;

    // Outer borders
    this.gateBarsGraphics.lineStyle(4, 0x1a1420, 1.0);
    const barXs = [595, 613, 631, 649, 667, 685];
    barXs.forEach(bx => {
      this.gateBarsGraphics.lineBetween(bx, 80 + yOff, bx, 180 + yOff);
    });

    this.gateBarsGraphics.lineBetween(580, 90 + yOff, 700, 90 + yOff);
    this.gateBarsGraphics.lineBetween(580, 130 + yOff, 700, 130 + yOff);
    this.gateBarsGraphics.lineBetween(580, 170 + yOff, 700, 170 + yOff);

    // Chain
    if (cAlpha > 0) {
      this.gateBarsGraphics.lineStyle(2.5, 0x2a2030, cAlpha);
      const chainXs = [608, 624, 640, 656, 672];
      chainXs.forEach(cx => {
        this.gateBarsGraphics.strokeCircle(cx, 130 + yOff, 8);
      });
    }

    // Padlock
    if (lAlpha > 0) {
      this.gateBarsGraphics.fillStyle(0x2a2030, lAlpha);
      this.gateBarsGraphics.fillRect(636, 128 + lOff + yOff, 8, 12);
      this.gateBarsGraphics.lineStyle(2, 0x2a2030, lAlpha);
      this.gateBarsGraphics.strokeCircle(640, 125 + lOff + yOff, 6);
    }
  }

  drawNkanyamba(time: number) {
    if (!this.nkAnyambaVisible) {
      if (this.nkanyambaGraphics) this.nkanyambaGraphics.clear();
      return;
    }

    this.nkanyambaGraphics.clear();

    const bx = this.nkAnyambaX;
    const by = this.nkAnyambaY;

    const feetAlpha = Math.min(this.nkAnyambaLeftLegAlpha, this.nkAnyambaRightLegAlpha);
    this.nkanyambaGraphics.fillStyle(0x000000, 0.5 * feetAlpha);
    this.nkanyambaGraphics.fillEllipse(bx, by + 45, 30, 8);

    const turnFactor = Math.cos(this.nkAnyambaRotation * Math.PI / 180);

    // Legs
    this.nkanyambaGraphics.lineStyle(5, 0x010002, this.nkAnyambaLeftLegAlpha);
    this.nkanyambaGraphics.lineBetween(bx - 6 * turnFactor, by + 15, bx - 10 * turnFactor, by + 45);

    this.nkanyambaGraphics.lineStyle(5, 0x010002, this.nkAnyambaRightLegAlpha);
    this.nkanyambaGraphics.lineBetween(bx + 6 * turnFactor, by + 15, bx + 10 * turnFactor, by + 45);

    // Torso (robes)
    this.nkanyambaGraphics.fillStyle(0x010002, this.nkAnyambaTorsoAlpha);
    this.nkanyambaGraphics.beginPath();
    this.nkanyambaGraphics.moveTo(bx - 14 * turnFactor, by - 15);
    this.nkanyambaGraphics.lineTo(bx + 14 * turnFactor, by - 15);
    this.nkanyambaGraphics.lineTo(bx + 18 * turnFactor, by + 20);
    this.nkanyambaGraphics.lineTo(bx - 18 * turnFactor, by + 20);
    this.nkanyambaGraphics.closePath();
    this.nkanyambaGraphics.fillPath();

    // Arms
    this.nkanyambaGraphics.lineStyle(4, 0x010002, this.nkAnyambaArmsAlpha);
    const armYOffset = this.nkAnyambaArmsRaisePct * 35;
    this.nkanyambaGraphics.lineBetween(
      bx - 14 * turnFactor, by - 10,
      bx - 26 * turnFactor, by + 10 - armYOffset
    );
    this.nkanyambaGraphics.lineBetween(
      bx + 14 * turnFactor, by - 10,
      bx + 26 * turnFactor, by + 10 - armYOffset
    );

    // Hair Lines (crown)
    const flare = this.nkAnyambaHairFlare;
    this.nkanyambaGraphics.lineStyle(1.5, 0x5a0d8c, this.nkAnyambaHeadAlpha * 0.7);
    const hairAngles = [150, 170, 190, 210, 330, 350, 10, 30];
    hairAngles.forEach(ang => {
      const rad = ang * Math.PI / 180;
      const hx = bx + Math.cos(rad) * 16;
      const hy = by - 33 + Math.sin(rad) * 16;
      const ex = bx + Math.cos(rad) * (22 + flare);
      const ey = by - 33 + Math.sin(rad) * (22 + flare);
      this.nkanyambaGraphics.lineBetween(hx, hy, ex, ey);
    });

    // Head
    this.nkanyambaGraphics.fillStyle(0x010002, this.nkAnyambaHeadAlpha);
    this.nkanyambaGraphics.fillCircle(bx, by - 33, 16);

    // Glowing Eyes
    if (Math.abs(this.nkAnyambaRotation) < 90) {
      this.nkanyambaGraphics.fillStyle(this.nkAnyambaEyesPulseColor, this.nkAnyambaHeadAlpha);
      this.nkanyambaGraphics.fillCircle(bx - 5 * turnFactor, by - 33, 3);
      this.nkanyambaGraphics.fillCircle(bx + 5 * turnFactor, by - 33, 3);
    }
  }

  drawEyesOverlay() {
    this.eyesOverlayGraphics.clear();
    if (!this.drawEyesActive) return;

    this.eyePairsDrawData.forEach(eye => {
      if (eye.state === 'invisible') return;

      this.eyesOverlayGraphics.fillStyle(0xff0000, eye.alpha);
      
      this.eyesOverlayGraphics.fillEllipse(eye.x - 6, eye.y, 4, 6);
      this.eyesOverlayGraphics.fillEllipse(eye.x + 6, eye.y, 4, 6);
    });
  }

  drawCorpses() {
    this.corpsesGraphics.clear();
    this.minionCorpses.forEach(c => {
      this.corpsesGraphics.fillStyle(0x0a0a0a, 0.4);
      this.corpsesGraphics.lineStyle(3, 0x0a0a0a, 0.4);
      
      this.corpsesGraphics.fillCircle(c.x, c.y + 12, 6);
      this.corpsesGraphics.lineBetween(c.x, c.y + 12, c.x + 18, c.y + 12);
      this.corpsesGraphics.lineBetween(c.x + 10, c.y + 12, c.x + 6, c.y + 18);
      this.corpsesGraphics.lineBetween(c.x + 10, c.y + 12, c.x + 14, c.y + 18);
    });
  }

  startNkanyambaCutscene() {
    this.gameplayStarted = false;
    this.isCutsceneActive = true;

    this.player.setPosition(640, 2000);
    this.player.play('jama-light-idle', true);

    this.nkAnyambaX = 640;
    this.nkAnyambaY = 450;
    this.nkAnyambaRotation = 180;
    this.nkAnyambaArmsRaisePct = 0;
    this.nkAnyambaHairFlare = 0;
    this.nkAnyambaVisible = true;

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // STEP 1 — Jama enters
    this.player.play('jama-light-walk', true);
    this.tweens.add({
      targets: this.player,
      y: 1900,
      duration: 1500,
      onComplete: () => {
        this.player.play('jama-light-idle', true);
        
        // STEP 2 — Camera pan
        this.cameras.main.stopFollow();
        this.cameras.main.pan(640, 450, 2000, 'Quad.easeInOut', false);
        this.cameras.main.once('camerapancomplete', () => {
          // STEP 3 — Nkanyamba turn
          if (window.gameAudio) {
            window.gameAudio.playSfx('heartbeat');
          }
          this.tweens.add({
            targets: this,
            nkAnyambaRotation: 0,
            duration: 1200,
            onComplete: () => {
              // STEP 4 — Speech Bubbles
              this.triggerCutsceneDialogue();
            }
          });
        });
      }
    });
  }

  triggerCutsceneDialogue() {
    // Bubble 1
    this.createSpeechBubble({ x: this.nkAnyambaX, y: this.nkAnyambaY }, "So... you managed to make it through alive. Impressive... for a human.", 'nkanyamba', () => {
      
      // Bubble 2
      this.createSpeechBubble({ x: this.nkAnyambaX, y: this.nkAnyambaY }, "Sadly, you cannot stop me. Time is almost up — and your sister will remain a captive of mine for all of eternity.", 'nkanyamba', () => {
        
        // Bubble 3 arms raise
        this.tweens.add({
          targets: this,
          nkAnyambaArmsRaisePct: 1,
          duration: 800
        });

        this.time.delayedCall(400, () => {
          this.createSpeechBubble({ x: this.nkAnyambaX, y: this.nkAnyambaY }, "Followers of darkness...", 'nkanyamba', () => {
            
            // 500ms eyes pulse
            const eyesTimer = this.time.addEvent({
              delay: 80,
              loop: true,
              callback: () => {
                this.nkAnyambaEyesPulseColor = this.nkAnyambaEyesPulseColor === 0xff0000 ? 0x9400d3 : 0xff0000;
              }
            });

            this.time.delayedCall(500, () => {
              eyesTimer.destroy();
              this.nkAnyambaEyesPulseColor = 0xff0000;

              this.createSpeechBubble({ x: this.nkAnyambaX, y: this.nkAnyambaY }, "GET HIM.", 'nkanyamba', () => {
                
                // 800ms pause
                this.time.delayedCall(800, () => {
                  this.createSpeechBubble({ x: this.nkAnyambaX, y: this.nkAnyambaY }, "I do not wish to be disturbed from my meal.", 'nkanyamba', () => {
                    
                    // Bubble 4: Cackle
                    if (window.gameAudio) {
                      window.gameAudio.playSfx('cackle');
                    }
                    this.nkAnyambaHairFlare = 5;
                    const cackleTimer = this.time.addEvent({
                      delay: 150,
                      loop: true,
                      callback: () => {
                        this.nkAnyambaEyesPulseColor = this.nkAnyambaEyesPulseColor === 0xff0000 ? 0x0000ff : 0xff0000;
                      }
                    });

                    this.time.delayedCall(1500, () => {
                      cackleTimer.destroy();
                      this.nkAnyambaHairFlare = 0;
                      this.nkAnyambaEyesPulseColor = 0xff0000;

                      // STEP 5 — Dissolve
                      this.dissolveNkanyamba();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  dissolveNkanyamba() {
    this.tweens.add({
      targets: this,
      nkAnyambaRotation: 180,
      duration: 300
    });

    this.tweens.add({
      targets: this,
      gateOpenPct: 0.35,
      duration: 1500
    });

    this.tweens.add({
      targets: this,
      nkAnyambaY: 390,
      duration: 1500,
      onComplete: () => {
        const spawnSmoke = (x: number, y: number, count: number) => {
          this.impactParticles.emitParticleAt(x, y, count);
        };

        spawnSmoke(this.nkAnyambaX, this.nkAnyambaY + 30, 8);
        this.tweens.add({
          targets: this,
          nkAnyambaLeftLegAlpha: 0,
          nkAnyambaRightLegAlpha: 0,
          duration: 600
        });

        this.time.delayedCall(450, () => {
          spawnSmoke(this.nkAnyambaX, this.nkAnyambaY + 5, 8);
          this.tweens.add({
            targets: this,
            nkAnyambaTorsoAlpha: 0,
            duration: 500
          });
        });

        this.time.delayedCall(800, () => {
          spawnSmoke(this.nkAnyambaX - 15, this.nkAnyambaY - 5, 5);
          spawnSmoke(this.nkAnyambaX + 15, this.nkAnyambaY - 5, 5);
          this.tweens.add({
            targets: this,
            nkAnyambaArmsAlpha: 0,
            duration: 400
          });
        });

        this.time.delayedCall(1100, () => {
          spawnSmoke(this.nkAnyambaX, this.nkAnyambaY - 33, 10);
          this.tweens.add({
            targets: this,
            nkAnyambaHeadAlpha: 0,
            duration: 600,
            onComplete: () => {
              this.nkAnyambaVisible = false;

              for (let i = 0; i < 6; i++) {
                this.impactParticles.emitParticleAt(this.nkAnyambaX + Phaser.Math.Between(-15, 15), this.nkAnyambaY - 20, 2);
                this.radialParticles.emitParticleAt(this.nkAnyambaX + Phaser.Math.Between(-15, 15), this.nkAnyambaY - 20, 2);
              }

              this.tweens.add({
                targets: this,
                gateOpenPct: 0.0,
                duration: 500,
                onComplete: () => {
                  this.time.delayedCall(1500, () => {
                    // STEP 6 — Eyes opening
                    this.triggerMinionsEyesOpening();
                  });
                }
              });
            }
          });
        });
      }
    });
  }

  triggerMinionsEyesOpening() {
    this.eyePairsDrawData = JSON.parse(JSON.stringify(this.minionsSpawnData));
    this.drawEyesActive = true;

    // Group 1
    this.openEyeGroup(1, () => {
      // Group 2
      this.time.delayedCall(400, () => {
        this.openEyeGroup(2, () => {
          // Group 3
          this.time.delayedCall(400, () => {
            this.openEyeGroup(3, () => {
              this.time.delayedCall(500, () => {
                // STEP 7 — Materialize
                this.materializeAllMinions();
              });
            });
          });
        });
      });
    });
  }

  openEyeGroup(groupId: number, onCompleteCallback: () => void) {
    let completedCount = 0;
    const groupItems = this.eyePairsDrawData.filter(e => e.group === groupId);
    
    groupItems.forEach(eye => {
      eye.state = 'fade-in';
      this.tweens.add({
        targets: eye,
        alpha: 0.7,
        duration: 300,
        onComplete: () => {
          eye.alpha = 0;
          this.time.delayedCall(100, () => {
            eye.alpha = 0.7;
            completedCount++;
            if (completedCount === groupItems.length) {
              onCompleteCallback();
            }
          });
        }
      });
    });
  }

  materializeAllMinions() {
    this.drawEyesActive = false;

    let activeSpawnsFinished = 0;

    let hpStat = 55;
    if (this.difficulty === 'easy') hpStat = 40;
    else if (this.difficulty === 'hard') hpStat = 75;

    this.eyePairsDrawData.forEach((spawn, idx) => {
      const minion = this.guardsGroup.create(spawn.x, spawn.y) as Phaser.Physics.Arcade.Sprite;
      minion.setCollideWorldBounds(true);
      minion.setBodySize(32, 48);
      minion.setDepth(1.5);
      
      minion.setData('id', idx);
      minion.setData('spawnX', spawn.x);
      minion.setData('spawnY', spawn.y);
      minion.setData('hp', hpStat);
      minion.setData('maxHp', hpStat);
      minion.setData('scale', 0.1);
      minion.setData('alpha', 0);
      minion.setData('state', 'materializing');
      minion.setData('patrolTargetX', spawn.x);
      minion.setData('patrolTargetY', spawn.y);
      minion.setData('patrolCooldown', 0);
      minion.setData('lastAttackTime', 0);
      minion.setData('telegraphProgress', 0);

      this.tweens.add({
        targets: minion.data.values,
        scale: 1.0,
        alpha: 1.0,
        duration: 800,
        ease: 'Back.easeOut',
        onComplete: () => {
          minion.setData('state', 'patrol');
          activeSpawnsFinished++;
          if (activeSpawnsFinished === 10) {
            this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            this.activateInitialChasers();
            this.isCutsceneActive = false;
            this.gameplayStarted = true;
          }
        }
      });
    });
  }

  activateInitialChasers() {
    const minions = this.guardsGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];
    minions.sort((a, b) => {
      const dA = Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y);
      const dB = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
      return dA - dB;
    });

    for (let i = 0; i < 4; i++) {
      if (minions[i]) {
        this.activateMinion(minions[i]);
      }
    }
    
    this.showFloatingText(this.player.x, this.player.y - 45, "THE SHADOWS ENGAGE!", 0xff0044);
  }

  activateMinion(minion: Phaser.Physics.Arcade.Sprite) {
    if (!minion || !minion.active) return;
    minion.setData('state', 'activating');
    
    const ring = this.add.graphics();
    ring.setDepth(1.4);
    this.tweens.addCounter({
      from: 0,
      to: 40,
      duration: 300,
      onUpdate: (tw) => {
        ring.clear();
        ring.lineStyle(2, 0xff0000, 1.0 - (tw.getValue() / 40));
        ring.strokeCircle(minion.x, minion.y, tw.getValue());
      },
      onComplete: () => {
        ring.destroy();
      }
    });

    minion.setData('alpha', 0.65);
    this.tweens.add({
      targets: minion.data.values,
      alpha: 1.0,
      duration: 300,
      onComplete: () => {
        minion.setData('state', 'chase');
      }
    });
  }

  update(time: number, delta: number) {
    if (window.gameState.isGameOver || window.gameState.gameCompleted) return;

    if (!this.gameplayStarted) {
      if (this.player && this.player.active) {
        this.player.setVelocity(0, 0);
      }
      this.drawDarknessVignette(time);
      this.drawNkanyamba(time);
      this.drawGateBars();
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
        dashCooldownPct
      });
    }

    this.drawWeapons();
    this.handleMovementInputs(time);

    const playerC = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const guards = this.guardsGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];

    guards.forEach((g) => {
      if (!g.active) return;

      const state = g.getData('state');
      const gDist = Phaser.Math.Distance.Between(playerC.x, playerC.y, g.x, g.y);
      const angle = Math.atan2(playerC.y - g.y, playerC.x - g.x);

      if (state === 'patrol') {
        g.setData('alpha', 0.65);
        let cooldown = g.getData('patrolCooldown') || 0;
        if (time > cooldown) {
          const spawnX = g.getData('spawnX');
          const spawnY = g.getData('spawnY');
          const randX = spawnX + Phaser.Math.Between(-80, 80);
          const randY = spawnY + Phaser.Math.Between(-80, 80);
          g.setData('patrolTargetX', randX);
          g.setData('patrolTargetY', randY);
          g.setData('patrolCooldown', time + Phaser.Math.Between(2000, 4000));
        }

        const tx = g.getData('patrolTargetX');
        const ty = g.getData('patrolTargetY');
        const distToTarget = Phaser.Math.Distance.Between(g.x, g.y, tx, ty);
        if (distToTarget > 10) {
          const tAng = Math.atan2(ty - g.y, tx - g.x);
          g.setVelocity(Math.cos(tAng) * 30, Math.sin(tAng) * 30);
        } else {
          g.setVelocity(0, 0);
        }
      } 
      else if (state === 'chase') {
        g.setData('alpha', 1.0);
        let isTelegraphing = g.getData('telegraphProgress') > 0;

        if (isTelegraphing) {
          g.setVelocity(0, 0);
          let prog = g.getData('telegraphProgress') + (delta / 500);
          if (prog >= 1.0) {
            g.setData('telegraphProgress', 0);
            
            if (gDist < 48) {
              let finalDmg = this.isBlocking ? 1 : 12;
              this.damagePlayer(finalDmg);
              this.showFloatingText(this.player.x, this.player.y - 20, this.isBlocking ? "BLOCKED! -1HP" : "SPIRIT HIT! -12HP", 0xff3333);
              this.player.x += Math.cos(angle) * 15;
              this.player.y += Math.sin(angle) * 15;
            }
          } else {
            g.setData('telegraphProgress', prog);
          }
        } else {
          if (gDist < 250) {
            g.setVelocity(Math.cos(angle) * 85, Math.sin(angle) * 85);

            if (gDist < 48) {
              const lastAtt = g.getData('lastAttackTime') || 0;
              if (time > lastAtt + 2000) {
                g.setData('telegraphProgress', 0.01);
                g.setData('lastAttackTime', time);
              }
            }
          } else {
            g.setVelocity(0, 0);
          }
        }
      } else {
        g.setVelocity(0, 0);
      }
    });

    this.drawDarknessVignette(time);
    this.drawMinions(time);
    this.drawCorpses();
    this.drawGateBars();
    this.drawEyesOverlay();
  }

  handleMovementInputs(time: number) {
    if (this.isDashing || this.isCutsceneActive) return;

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
      if (guard.active && guard.getData('state') !== 'materializing') {
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
      if (guard.active && guard.getData('state') !== 'materializing') {
        const d = Phaser.Math.Distance.Between(testX, testY, guard.x, guard.y);
        if (d < 50) {
          this.hitGuard(guard, 25, bashX * 35, bashY * 35);
          this.showFloatingText(guard.x, guard.y - 20, "SHIELD-BASHED!", 0x4a9eff);
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
          if (enemy.active && enemy.getData('state') !== 'materializing') {
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
      this.handleMinionDeath(guard);
    }
  }

  handleMinionDeath(dyingMinion: Phaser.Physics.Arcade.Sprite) {
    this.totalMinionsDefeated++;

    const freedText = this.add.text(dyingMinion.x, dyingMinion.y - 35, "SPIRIT FREED", {
      fontFamily: 'Courier',
      fontSize: '12px',
      color: '#00FFA3',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(3);

    this.tweens.add({
      targets: freedText,
      y: dyingMinion.y - 85,
      alpha: 0,
      duration: 1200,
      onComplete: () => freedText.destroy()
    });

    if (window.gameAudio) {
      window.gameAudio.playSfx('hit');
    }

    this.impactParticles.emitParticleAt(dyingMinion.x, dyingMinion.y, 8);

    this.minionCorpses.push({ x: dyingMinion.x, y: dyingMinion.y });

    if ((window as any).incrementEnemiesDefeated) {
      (window as any).incrementEnemiesDefeated(1);
    }
    updateReactState({ score: window.gameState.score + 150 });

    if (this.totalMinionsDefeated >= 10) {
      this.triggerRewardSequence();
    } else {
      const patrolMinions = this.guardsGroup.getChildren().filter(m => (m as any).active && (m as any).getData('state') === 'patrol') as Phaser.Physics.Arcade.Sprite[];
      if (patrolMinions.length > 0) {
        patrolMinions.sort((a, b) => {
          const dA = Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y);
          const dB = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
          return dA - dB;
        });

        const targetMinion = patrolMinions[0];
        targetMinion.setData('state', 'pending-activation');
        
        this.time.delayedCall(1500, () => {
          if (targetMinion && targetMinion.active) {
            this.activateMinion(targetMinion);
          }
        });
      }
    }
  }

  triggerRewardSequence() {
    this.gameplayStarted = false;
    this.player.setVelocity(0, 0);
    this.player.play('jama-light-idle', true);

    this.guardsGroup.clear(true, true);

    if (this.gateLockZone && this.gateLockZone.active) {
      this.gateLockZone.destroy();
    }

    const pulse = this.add.graphics();
    pulse.fillStyle(0x00FFA3, 0.12);
    pulse.fillRect(0, 0, 1280, 2200);
    pulse.setScrollFactor(0);
    pulse.setDepth(9.0);
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      duration: 400,
      onComplete: () => pulse.destroy()
    });

    const wayTxt = this.add.text(this.player.x, this.player.y - 60, "THE WAY IS OPEN", {
      fontFamily: 'Courier',
      fontSize: '20px',
      color: '#00FFA3',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(3.0);
    this.tweens.add({
      targets: wayTxt,
      y: this.player.y - 120,
      alpha: 0,
      duration: 1500,
      onComplete: () => wayTxt.destroy()
    });

    const startHp = window.gameState.health;
    const startFuel = window.gameState.lanternFuel ?? 100;
    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 1200,
      onUpdate: (tw) => {
        const val = tw.getValue() / 100;
        window.gameState.health = Math.round(startHp + (100 - startHp) * val);
        window.gameState.lanternFuel = Math.round(startFuel + (100 - startFuel) * val);
        updateReactState({ health: window.gameState.health, lanternFuel: window.gameState.lanternFuel });
      }
    });

    const strTxt = this.add.text(this.player.x, this.player.y - 30, "STRENGTH RESTORED", {
      fontFamily: 'Courier',
      fontSize: '14px',
      color: '#f5c842',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(3.0);
    this.tweens.add({
      targets: strTxt,
      y: this.player.y - 80,
      alpha: 0,
      duration: 800,
      onComplete: () => strTxt.destroy()
    });

    this.impactParticles.emitParticleAt(this.player.x, this.player.y, 12);

    this.tweens.add({
      targets: this,
      lockOffset: 30,
      lockAlpha: 0,
      duration: 400
    });

    this.time.delayedCall(400, () => {
      this.tweens.add({
        targets: this,
        chainAlpha: 0,
        duration: 600
      });
    });

    this.time.delayedCall(1000, () => {
      this.tweens.add({
        targets: this,
        barsYOffset: -120,
        duration: 1200
      });
    });

    this.time.delayedCall(1200, () => {
      this.gateGraphics.fillStyle(0xff6600, 0.15);
      this.gateGraphics.fillRect(580, 80, 120, 100);
    });

    this.time.delayedCall(3000, () => {
      this.cameras.main.fadeOut(800, 0, 0, 0);
      
      const screenWidth = this.cameras.main.width;
      const screenHeight = this.cameras.main.height;
      const finalTxt = this.add.text(screenWidth / 2, screenHeight / 2, "THE SHRINE", {
        fontFamily: 'Courier',
        fontSize: '16px',
        color: '#f5c842'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

      this.tweens.add({
        targets: finalTxt,
        alpha: 1,
        duration: 1000,
        yoyo: true,
        hold: 1000,
        onComplete: () => {
          this.scene.start('ShrineScene', {
            health: 100,
            lanternFuel: 100,
            score: window.gameState.score,
            passagewayCleared: true
          });
        }
      });
    });
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

  drawMinions(time: number) {
    this.minionsGraphics.clear();

    this.guardsGroup.getChildren().forEach(node => {
      const g = node as Phaser.Physics.Arcade.Sprite;
      if (!g || !g.active) return;

      const state = g.getData('state');
      const hp = g.getData('hp');
      const mhp = g.getData('maxHp');
      const scale = g.getData('scale') || 1.0;
      const baseAlpha = g.getData('alpha') !== undefined ? g.getData('alpha') : 1.0;

      this.minionsGraphics.fillStyle(0x000000, 0.45 * baseAlpha);
      this.minionsGraphics.fillEllipse(g.x, g.y + 24 * scale, 24 * scale, 6 * scale);

      const minionAlpha = state === 'patrol' ? 0.65 : baseAlpha;
      const bodyColor = 0x0a0a0a;
      const eyeColor = 0xff0000;

      this.minionsGraphics.lineStyle(3, bodyColor, minionAlpha);
      this.minionsGraphics.fillStyle(bodyColor, minionAlpha);

      // Head
      this.minionsGraphics.fillCircle(g.x, g.y - 14 * scale, 8 * scale);

      // Spine
      this.minionsGraphics.lineBetween(g.x, g.y - 6 * scale, g.x, g.y + 10 * scale);

      // Red eyes
      this.minionsGraphics.fillStyle(eyeColor, minionAlpha);
      this.minionsGraphics.fillCircle(g.x - 3 * scale, g.y - 14 * scale, 1.5 * scale);
      this.minionsGraphics.fillCircle(g.x + 3 * scale, g.y - 14 * scale, 1.5 * scale);

      // Chest mark
      this.minionsGraphics.lineStyle(1.5, 0xff0000, 0.45 * minionAlpha);
      this.minionsGraphics.lineBetween(g.x - 3 * scale, g.y, g.x + 3 * scale, g.y);

      this.minionsGraphics.lineStyle(3, bodyColor, minionAlpha);

      // Legs
      this.minionsGraphics.lineBetween(g.x, g.y + 10 * scale, g.x - 8 * scale, g.y + 24 * scale);
      this.minionsGraphics.lineBetween(g.x, g.y + 10 * scale, g.x + 8 * scale, g.y + 24 * scale);

      // Arms
      const isTelegraphing = g.getData('telegraphProgress') > 0;
      const teleProgress = g.getData('telegraphProgress') || 0;

      if (isTelegraphing) {
        this.minionsGraphics.lineBetween(g.x, g.y - 4 * scale, g.x - 12 * scale + teleProgress * 8 * scale, g.y - 8 * scale);
        this.minionsGraphics.lineBetween(g.x, g.y - 4 * scale, g.x + 12 * scale - teleProgress * 8 * scale, g.y - 8 * scale);
      } else {
        const swayY = Math.sin(time * 0.006 + g.x) * 4 * scale;
        this.minionsGraphics.lineBetween(g.x, g.y - 4 * scale, g.x - 12 * scale, g.y + swayY);
        this.minionsGraphics.lineBetween(g.x, g.y - 4 * scale, g.x + 12 * scale, g.y - swayY);
      }

      // Minion HP Bar
      if (hp < mhp && state !== 'materializing') {
        const barW = 28 * scale;
        const pct = hp / mhp;
        this.minionsGraphics.fillStyle(0x111111, minionAlpha);
        this.minionsGraphics.fillRect(g.x - barW / 2, g.y - 28 * scale, barW, 3 * scale);
        this.minionsGraphics.fillStyle(0xff0044, minionAlpha);
        this.minionsGraphics.fillRect(g.x - barW / 2, g.y - 28 * scale, barW * pct, 3 * scale);
      }
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
    if (!sourceObject) return;
    if (sourceObject.active !== undefined && !sourceObject.active) return;

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
