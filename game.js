const GAME_WIDTH = 420;
const GAME_HEIGHT = 760;
const ROAD_LEFT = 66;
const ROAD_RIGHT = 354;
const PLAYER_Y = GAME_HEIGHT - 92;

const state = {
  score: 0,
  hp: 3,
  weaponLevel: 1,
  nextWeaponDecayAt: 0,
  nextFireAt: 0,
  enemySpawnAt: 0,
  dead: false
};

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-root',
  backgroundColor: '#9cb3c7',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: {
    preload,
    create,
    update
  }
};

new Phaser.Game(config);

let player;
let cursors;
let restartKey;
let bullets;
let enemies;
let powerUps;
let scoreText;
let hpText;
let weaponText;
let messageText;
let roadLines;
let sideTrees;
let touchInput;
let restartButton;

function preload() {
  makeRectTexture(this, 'playerTex', 62, 44, 0x1e88e5);
  makeRectTexture(this, 'enemyTex', 34, 34, 0xbf360c);
  makeRectTexture(this, 'enemyHeavyTex', 44, 44, 0x7f0000);
  makeRectTexture(this, 'bulletTex', 8, 20, 0xffee58);
  makeRectTexture(this, 'powerTex', 20, 20, 0xffb300);
  makeRectTexture(this, 'roadLineTex', 8, 34, 0xeceff1);
  makeRectTexture(this, 'treeTex', 18, 30, 0x2e7d32);
}

function create() {
  resetState();
  drawEnvironment.call(this);

  bullets = this.physics.add.group({ allowGravity: false, maxSize: 260 });
  enemies = this.physics.add.group({ allowGravity: false, maxSize: 220 });
  powerUps = this.physics.add.group({ allowGravity: false, maxSize: 60 });

  player = this.physics.add.sprite((ROAD_LEFT + ROAD_RIGHT) / 2, PLAYER_Y, 'playerTex');
  player.body.setAllowGravity(false);
  player.body.setImmovable(true);
  player.setDepth(5);

  this.physics.add.overlap(bullets, enemies, onBulletHitEnemy, null, this);
  this.physics.add.overlap(player, enemies, onPlayerHitEnemy, null, this);
  this.physics.add.overlap(player, powerUps, onGetPowerUp, null, this);

  cursors = this.input.keyboard.createCursorKeys();
  restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

  touchInput = {
    touchActive: false,
    touchX: (ROAD_LEFT + ROAD_RIGHT) / 2,
    pointerId: null
  };
  this.input.addPointer(3);
  createTouchControls.call(this);

  scoreText = this.add.text(12, 12, 'Score: 0', { fontSize: '19px', color: '#102027' }).setDepth(30);
  hpText = this.add.text(12, 36, 'HP: 3', { fontSize: '18px', color: '#1b5e20' }).setDepth(30);
  weaponText = this.add.text(12, 60, 'Weapon Lv: 1', { fontSize: '18px', color: '#ef6c00' }).setDepth(30);
  messageText = this.add.text(12, 84, 'HP 3: 충돌/적 돌파 각각 1 감소', {
    fontSize: '15px',
    color: '#263238'
  }).setDepth(30);
  restartButton = createRestartButton.call(this);

  state.enemySpawnAt = this.time.now + 500;
}

function update() {
  if (Phaser.Input.Keyboard.JustDown(restartKey)) {
    this.scene.restart();
    return;
  }

  scrollEnvironment();

  if (state.dead) {
    player.setVelocity(0, 0);
    return;
  }

  handlePlayerMove();

  if (this.time.now >= state.nextFireAt) {
    shootBullet.call(this);
  }

  if (state.weaponLevel > 1 && this.time.now >= state.nextWeaponDecayAt) {
    state.weaponLevel -= 1;
    weaponText.setText('Weapon Lv: ' + state.weaponLevel);
    messageText.setText('시간 경과로 화력 감소');
    state.nextWeaponDecayAt = this.time.now + 5000;
  }

  if (this.time.now >= state.enemySpawnAt) {
    spawnEnemyWave.call(this);
    const nextGap = Phaser.Math.Between(250, 450) - state.weaponLevel * 20;
    state.enemySpawnAt = this.time.now + Math.max(140, nextGap);
  }

  enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;

    enemy.y += enemy.fallSpeed;
    enemy.x += enemy.drift;

    if (enemy.x < ROAD_LEFT + 16 || enemy.x > ROAD_RIGHT - 16) {
      enemy.drift *= -1;
    }

    if (enemy.y > GAME_HEIGHT + 32) {
      enemy.destroy();
      damagePlayer.call(this, 1, '적 돌파');
    }
  });

  bullets.children.iterate((bullet) => {
    if (!bullet || !bullet.active) return;
    if (bullet.y < -30 || bullet.x < ROAD_LEFT - 30 || bullet.x > ROAD_RIGHT + 30) {
      bullet.destroy();
    }
  });

  powerUps.children.iterate((item) => {
    if (!item || !item.active) return;
    item.y += 2.3;
    item.angle += 6;
    if (item.y > GAME_HEIGHT + 30) {
      item.destroy();
    }
  });
}

function drawEnvironment() {
  const g = this.add.graphics();

  g.fillStyle(0x90a4ae, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  g.fillStyle(0xcfd8dc, 1);
  g.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, GAME_HEIGHT);

  g.fillStyle(0xb0bec5, 1);
  g.fillRect(ROAD_LEFT + 4, 0, ROAD_RIGHT - ROAD_LEFT - 8, GAME_HEIGHT);

  g.fillStyle(0x8d6e63, 1);
  g.fillRect(ROAD_LEFT - 6, 0, 6, GAME_HEIGHT);
  g.fillRect(ROAD_RIGHT, 0, 6, GAME_HEIGHT);

  g.lineStyle(2, 0xffffff, 0.5);
  g.strokeRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, GAME_HEIGHT);

  g.destroy();

  roadLines = this.add.group();
  for (let y = -20; y < GAME_HEIGHT + 70; y += 68) {
    const mark = this.add.image((ROAD_LEFT + ROAD_RIGHT) / 2, y, 'roadLineTex');
    mark.setAlpha(0.82);
    roadLines.add(mark);
  }

  sideTrees = this.add.group();
  for (let y = -30; y < GAME_HEIGHT + 60; y += 56) {
    const leftTree = this.add.image(24 + Phaser.Math.Between(-8, 8), y, 'treeTex').setAlpha(0.9);
    const rightTree = this.add.image(GAME_WIDTH - 24 + Phaser.Math.Between(-8, 8), y + 24, 'treeTex').setAlpha(0.9);
    sideTrees.add(leftTree);
    sideTrees.add(rightTree);
  }
}

function scrollEnvironment() {
  roadLines.children.iterate((line) => {
    line.y += 5.8;
    if (line.y > GAME_HEIGHT + 22) {
      line.y = -22;
    }
  });

  sideTrees.children.iterate((tree) => {
    tree.y += 2.8;
    if (tree.y > GAME_HEIGHT + 26) {
      tree.y = -30;
      tree.x += Phaser.Math.Between(-6, 6);
    }
  });
}

function handlePlayerMove() {
  const speed = 410;
  const left = cursors.left.isDown;
  const right = cursors.right.isDown;
  const minX = ROAD_LEFT + 26;
  const maxX = ROAD_RIGHT - 26;

  if (touchInput.touchActive) {
    const targetX = Phaser.Math.Clamp(touchInput.touchX, minX, maxX);
    if (targetX < player.x - 10) {
      player.setVelocityX(-speed);
    } else if (targetX > player.x + 10) {
      player.setVelocityX(speed);
    } else {
      player.setVelocityX(0);
    }
    player.setVelocityY(0);
    player.y = PLAYER_Y;
    player.x = Phaser.Math.Clamp(player.x, minX, maxX);
    return;
  }

  if (left && !right) {
    player.setVelocityX(-speed);
  } else if (right && !left) {
    player.setVelocityX(speed);
  } else {
    player.setVelocityX(0);
  }

  player.setVelocityY(0);
  player.y = PLAYER_Y;

  player.x = Phaser.Math.Clamp(player.x, minX, maxX);
}

function createTouchControls() {
  this.input.on('pointerdown', (pointer) => {
    touchInput.touchActive = true;
    touchInput.pointerId = pointer.id;
    touchInput.touchX = pointer.worldX;
  });

  this.input.on('pointermove', (pointer) => {
    if (touchInput.touchActive && touchInput.pointerId === pointer.id && pointer.isDown) {
      touchInput.touchX = pointer.worldX;
    }
  });

  this.input.on('pointerup', (pointer) => {
    if (touchInput.pointerId === pointer.id) {
      touchInput.touchActive = false;
      touchInput.pointerId = null;
    }
  });
}

function createRestartButton() {
  const bg = this.add.rectangle(GAME_WIDTH - 66, 28, 104, 34, 0x263238, 0.62).setDepth(42);
  bg.setStrokeStyle(2, 0xffffff, 0.45);
  const label = this.add.text(GAME_WIDTH - 66, 28, 'RESTART', {
    fontSize: '14px',
    color: '#ffffff'
  }).setOrigin(0.5).setDepth(43);

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', () => {
    this.scene.restart();
  });

  bg.label = label;
  return bg;
}

function shootBullet() {
  const level = state.weaponLevel;
  const shots = [];

  if (level >= 4) {
    shots.push({ vx: -170 });
    shots.push({ vx: -70 });
    shots.push({ vx: 0 });
    shots.push({ vx: 70 });
    shots.push({ vx: 170 });
  } else if (level === 3) {
    shots.push({ vx: -95 });
    shots.push({ vx: 0 });
    shots.push({ vx: 95 });
  } else if (level === 2) {
    shots.push({ vx: -50 });
    shots.push({ vx: 50 });
  } else {
    shots.push({ vx: 0 });
  }

  shots.forEach((s) => {
    const bullet = bullets.create(player.x, player.y - 28, 'bulletTex');
    bullet.body.setAllowGravity(false);
    bullet.setVelocity(s.vx, -700 - level * 28);
    bullet.setScale(level >= 3 ? 1.15 : 1.0);
    bullet.setTint(level >= 3 ? 0xffca28 : 0xfff176);
  });

  const fireDelay = level >= 4 ? 64 : level === 3 ? 82 : level === 2 ? 100 : 124;
  state.nextFireAt = this.time.now + fireDelay;
}

function spawnEnemyWave() {
  const roll = Phaser.Math.Between(1, 100);
  const elapsed = this.time.now / 1000;

  if (roll <= 34) {
    spawnEnemy.call(this, Phaser.Math.Between(ROAD_LEFT + 22, ROAD_RIGHT - 22), false);
    return;
  }

  if (roll <= 74) {
    const center = Phaser.Math.Between(ROAD_LEFT + 70, ROAD_RIGHT - 70);
    spawnEnemy.call(this, center - 44, false);
    spawnEnemy.call(this, center + 44, false);
    return;
  }

  if (elapsed > 55 && roll <= 90) {
    const leftLane = Phaser.Math.Between(ROAD_LEFT + 22, ROAD_LEFT + 70);
    const rightLane = Phaser.Math.Between(ROAD_RIGHT - 70, ROAD_RIGHT - 22);
    spawnEnemy.call(this, leftLane, false);
    spawnEnemy.call(this, rightLane, false);
    spawnEnemy.call(this, Phaser.Math.Between(ROAD_LEFT + 40, ROAD_RIGHT - 40), false);
    return;
  }

  const left = Phaser.Math.Between(ROAD_LEFT + 34, ROAD_LEFT + 94);
  const right = Phaser.Math.Between(ROAD_RIGHT - 94, ROAD_RIGHT - 34);
  spawnEnemy.call(this, left, false);
  spawnEnemy.call(this, (ROAD_LEFT + ROAD_RIGHT) / 2, true);
  spawnEnemy.call(this, right, false);
}

function spawnEnemy(x, heavy) {
  const tier = pickEnemyTier(this.time.now, heavy);
  let enemy;

  if (tier.kind === 'heavy') {
    enemy = enemies.create(x, -30, 'enemyHeavyTex');
  } else {
    enemy = enemies.create(x, -30, 'enemyTex');
  }

  enemy.hp = tier.hp;
  enemy.fallSpeed = Phaser.Math.FloatBetween(tier.speedMin, tier.speedMax);
  enemy.scoreValue = tier.score;
  enemy.setTint(tier.color);
  enemy.enemyType = tier.type;

  enemy.body.setAllowGravity(false);
  enemy.drift = Phaser.Math.FloatBetween(-tier.drift, tier.drift);
}

function pickEnemyTier(nowMs, heavySpawn) {
  const elapsed = nowMs / 1000;
  const roll = Phaser.Math.Between(1, 100);

  if (elapsed < 25) {
    return { kind: 'light', type: 'normal', hp: 1, score: 100, color: 0xbf360c, speedMin: 2.9, speedMax: 4.2, drift: 0.45 };
  }

  if (elapsed < 60) {
    if (roll <= 18) {
      return { kind: 'light', type: 'runner', hp: 1, score: 150, color: 0x00acc1, speedMin: 4.8, speedMax: 6.2, drift: 0.9 };
    }
    if (roll <= 35 || heavySpawn) {
      return { kind: 'heavy', type: 'armor', hp: 3, score: 220, color: 0xd32f2f, speedMin: 2.2, speedMax: 3.1, drift: 0.35 };
    }
    return { kind: 'light', type: 'normal', hp: 1, score: 110, color: 0xbf360c, speedMin: 3.0, speedMax: 4.3, drift: 0.45 };
  }

  if (roll <= 18) {
    return { kind: 'light', type: 'runner', hp: 2, score: 260, color: 0x00bcd4, speedMin: 5.5, speedMax: 7.0, drift: 1.15 };
  }
  if (roll <= 38 || heavySpawn) {
    return { kind: 'heavy', type: 'tank', hp: 6, score: 420, color: 0x4e342e, speedMin: 1.6, speedMax: 2.3, drift: 0.22 };
  }
  if (roll <= 65) {
    return { kind: 'heavy', type: 'armor', hp: 4, score: 300, color: 0x8e24aa, speedMin: 2.0, speedMax: 2.9, drift: 0.32 };
  }
  if (roll <= 82) {
    return { kind: 'light', type: 'brute', hp: 3, score: 240, color: 0xe53935, speedMin: 2.7, speedMax: 3.5, drift: 0.5 };
  }
  return { kind: 'light', type: 'normal', hp: 1, score: 130, color: 0xbf360c, speedMin: 3.3, speedMax: 4.6, drift: 0.48 };
}

function onBulletHitEnemy(bullet, enemy) {
  if (!bullet.active || !enemy.active) return;

  bullet.destroy();
  enemy.hp -= bullet.damage || 1;

  if (enemy.hp > 0) {
    enemy.setAlpha(0.45);
    this.time.delayedCall(60, () => {
      if (enemy.active) {
        enemy.setAlpha(1);
      }
    });
    return;
  }

  state.score += enemy.scoreValue || 100;
  scoreText.setText('Score: ' + state.score);

  // Occasional drops only.
  if (Phaser.Math.Between(1, 100) <= 8) {
    spawnPowerUp(enemy.x, enemy.y);
  }

  enemy.destroy();
}

function spawnPowerUp(x, y) {
  const isPowerUp = Phaser.Math.Between(1, 100) <= 60;
  const item = powerUps.create(x, y, 'powerTex');
  item.effect = isPowerUp ? 'up' : 'down';
  item.body.setAllowGravity(false);
}

function onGetPowerUp(playerObj, item) {
  item.destroy();
  messageText.setText('아이템 획득!');

  if (item.effect === 'up' && state.weaponLevel < 4) {
    state.weaponLevel += 1;
    weaponText.setText('Weapon Lv: ' + state.weaponLevel);
    if (state.weaponLevel > 1) {
      state.nextWeaponDecayAt = this.time.now + 5000;
    }
    return;
  }

  if (item.effect === 'down' && state.weaponLevel > 1) {
    state.weaponLevel -= 1;
    weaponText.setText('Weapon Lv: ' + state.weaponLevel);
    if (state.weaponLevel > 1) {
      state.nextWeaponDecayAt = this.time.now + 5000;
    } else {
      state.nextWeaponDecayAt = 0;
    }
    return;
  }

  if (item.effect === 'up') {
    state.score += 120;
    scoreText.setText('Score: ' + state.score);
    messageText.setText('아이템 보너스 +120');
  }
}

function onPlayerHitEnemy(playerObj, enemy) {
  if (!enemy.active || state.dead) return;
  enemy.destroy();
  damagePlayer.call(this, 1, '충돌');
}

function damagePlayer(amount, reason) {
  state.hp -= amount;
  hpText.setText('HP: ' + state.hp);

  player.setTint(0xff8a80);
  this.time.delayedCall(120, () => {
    if (player.active) player.clearTint();
  });

  if (state.hp <= 0) {
    lose.call(this, reason + ' - 게임오버 (R 재시작)');
  } else {
    messageText.setText(reason + ' HP -' + amount);
  }
}

function lose(message) {
  if (state.dead) return;
  state.dead = true;
  player.setTint(0x90a4ae);
  messageText.setText(message);
}

function resetState() {
  state.score = 0;
  state.hp = 3;
  state.weaponLevel = 1;
  state.nextWeaponDecayAt = 0;
  state.nextFireAt = 0;
  state.enemySpawnAt = 0;
  state.dead = false;
}

function makeRectTexture(scene, key, width, height, color) {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillRect(0, 0, width, height);
  g.generateTexture(key, width, height);
  g.destroy();
}
