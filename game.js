'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// ---- Temas visuales (skins) ----
// Cada skin define su paleta (índices 1–7 alineados con PIECES/COLORS),
// el fondo y color de rejilla del canvas, y su propia función de dibujo de bloque.
const SKIN_STORAGE_KEY = 'tetris-skin';

// Dibuja el contorno de un rectángulo con esquinas redondeadas (para la skin Pastel).
function roundRectPath(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    background: '#1a1a25',
    gridColor: '#22222e',
    colors: COLORS,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // brillo superior
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    label: 'Neón',
    background: '#000000',
    gridColor: '#0d0d1a',
    colors: [null, '#00e5ff', '#ffea00', '#d500f9', '#00e676', '#ff1744', '#3d5afe', '#ff9100'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      // save/restore para que el shadowBlur no contamine otros dibujos.
      context.save();
      context.globalAlpha = alpha ?? 1;
      context.shadowBlur = 14;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.restore();
    },
  },
  pastel: {
    label: 'Pastel',
    background: '#2e2e3e',
    gridColor: '#3a3a4a',
    colors: [null, '#a0e7e5', '#fbf8cc', '#cdb4db', '#b9fbc0', '#ffadad', '#a3c4f3', '#ffd6a5'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = this.colors[colorIndex];
      // esquinas redondeadas simuladas
      roundRectPath(context, x * size + 2, y * size + 2, size - 4, size - 4, 7);
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    label: 'Pixel art',
    background: '#12121a',
    gridColor: '#000000',
    colors: COLORS,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size;
      const py = y * size;
      context.globalAlpha = alpha ?? 1;
      // color base
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      // textura: rejilla 4×4 con luces y sombras alternas
      const cell = size / 4;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          context.fillStyle = (i + j) % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)';
          context.fillRect(px + i * cell, py + j * cell, cell, cell);
        }
      }
      // borde oscuro para separar bloques
      context.strokeStyle = 'rgba(0,0,0,0.55)';
      context.lineWidth = 2;
      context.strokeRect(px + 1, py + 1, size - 2, size - 2);
      context.globalAlpha = 1;
    },
  },
};

function loadSkin() {
  try {
    const saved = localStorage.getItem(SKIN_STORAGE_KEY);
    if (saved && SKINS[saved]) return saved;
  } catch (_) {
    // localStorage no disponible o datos corruptos: se usa la skin por defecto.
  }
  return 'retro';
}

function saveSkin() {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, currentSkin);
  } catch (_) {
    // localStorage no disponible: la preferencia no persiste entre sesiones.
  }
}

const KEYMAP_STORAGE_KEY = 'tetris-keymap';
const HIGHSCORES_STORAGE_KEY = 'tetris-highscores';
const STATS_STORAGE_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;
const MAX_NAME_LENGTH = 12;

const DEFAULT_KEYMAP = {
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  softDrop: ['KeyS', 'ArrowDown'],
  rotate: ['KeyW', 'KeyK', 'ArrowUp', 'Space'],
  hardDrop: ['KeyL', 'Enter'],
  pause: ['KeyP', 'Escape'],
};

const ACTION_LABELS = {
  moveLeft: 'Mover izquierda',
  moveRight: 'Mover derecha',
  softDrop: 'Bajar',
  rotate: 'Rotar',
  hardDrop: 'Caída instantánea',
  pause: 'Pausa',
};

const CODE_LABELS = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Espacio',
  Enter: 'Enter',
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const controlsList = document.getElementById('controls-list');
const remapBtn = document.getElementById('remap-btn');
const overlayBox = document.getElementById('overlay-box');
const keymapBox = document.getElementById('keymap-box');
const skinSelect = document.getElementById('skin-select');
const keymapOverlay = document.getElementById('keymap-overlay');
const keymapList = document.getElementById('keymap-list');
const keymapError = document.getElementById('keymap-error');
const keymapResetBtn = document.getElementById('keymap-reset-btn');
const keymapCloseBtn = document.getElementById('keymap-close-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControlsList = document.getElementById('pause-controls-list');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const startLevelSelect = document.getElementById('start-level-select');

const MAX_START_LEVEL = 15;

const startOverlay = document.getElementById('start-overlay');
const startHighscores = document.getElementById('start-highscores');
const startBestCombo = document.getElementById('start-best-combo');
const startMaxLines = document.getElementById('start-max-lines');
const playBtn = document.getElementById('play-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const gameoverRecords = document.getElementById('gameover-records');
const gameoverHighscores = document.getElementById('gameover-highscores');
const gameoverBestCombo = document.getElementById('gameover-best-combo');
const gameoverMaxLines = document.getElementById('gameover-max-lines');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, pausedByKeymap;
let combo, maxCombo;
let keyMap = loadKeyMap();
let highscores = loadHighscores();
let stats = loadStats();
let remappingAction = null;
let currentSkin = loadSkin();
let startLevel = 1;   // nivel elegido en el menú; se aplica a la PRÓXIMA partida
let baseLevel = 1;    // nivel base de la partida actual (fijado en init)

function codeToLabel(code) {
  return CODE_LABELS[code] || (code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code);
}

function loadKeyMap() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEYMAP_STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      const merged = {};
      for (const action of Object.keys(DEFAULT_KEYMAP)) {
        merged[action] = Array.isArray(saved[action]) && saved[action].length
          ? saved[action]
          : DEFAULT_KEYMAP[action];
      }
      return merged;
    }
  } catch (_) {
    // localStorage no disponible o datos corruptos: se usan los valores por defecto.
  }
  return Object.fromEntries(Object.entries(DEFAULT_KEYMAP).map(([action, codes]) => [action, [...codes]]));
}

function saveKeyMap() {
  try {
    localStorage.setItem(KEYMAP_STORAGE_KEY, JSON.stringify(keyMap));
  } catch (_) {
    // localStorage no disponible: la reasignación no persiste entre sesiones.
  }
}

function loadHighscores() {
  try {
    const saved = JSON.parse(localStorage.getItem(HIGHSCORES_STORAGE_KEY));
    if (Array.isArray(saved)) {
      return saved
        .filter(e => e && typeof e.score === 'number')
        .map(e => ({
          name: typeof e.name === 'string' ? e.name : 'ANÓNIMO',
          score: e.score,
          lines: typeof e.lines === 'number' ? e.lines : 0,
          level: typeof e.level === 'number' ? e.level : 1,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_HIGHSCORES);
    }
  } catch (_) {
    // localStorage no disponible o datos corruptos: se empieza sin records.
  }
  return [];
}

function saveHighscores() {
  try {
    localStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(highscores));
  } catch (_) {
    // localStorage no disponible: los records no persisten entre sesiones.
  }
}

function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      return {
        bestCombo: typeof saved.bestCombo === 'number' ? saved.bestCombo : 0,
        maxLines: typeof saved.maxLines === 'number' ? saved.maxLines : 0,
      };
    }
  } catch (_) {
    // localStorage no disponible o datos corruptos: se usan valores por defecto.
  }
  return { bestCombo: 0, maxLines: 0 };
}

function saveStats() {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (_) {
    // localStorage no disponible: las estadísticas no persisten entre sesiones.
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function qualifiesForTop(sc) {
  if (sc <= 0) return false;
  if (highscores.length < MAX_HIGHSCORES) return true;
  return sc > highscores[highscores.length - 1].score;
}

function highscoresMarkup(list, highlightIndex) {
  if (!list.length) {
    return '<li class="highscore-empty">Aún no hay records. ¡Sé el primero!</li>';
  }
  return list.map((e, i) => {
    const cls = i === highlightIndex ? 'highscore-row highlight' : 'highscore-row';
    return `<li class="${cls}">` +
      `<span class="hs-rank">${i + 1}</span>` +
      `<span class="hs-name">${escapeHtml(e.name)}</span>` +
      `<span class="hs-score">${e.score.toLocaleString()}</span>` +
      `</li>`;
  }).join('');
}

function renderStartScreen() {
  startHighscores.innerHTML = highscoresMarkup(highscores, -1);
  startBestCombo.textContent = stats.bestCombo;
  startMaxLines.textContent = stats.maxLines;
}

function showGameOverRecords(highlightIndex) {
  gameoverHighscores.innerHTML = highscoresMarkup(highscores, highlightIndex);
  gameoverBestCombo.textContent = stats.bestCombo;
  gameoverMaxLines.textContent = stats.maxLines;
  gameoverRecords.classList.remove('hidden');
}

function showNameEntry() {
  gameoverRecords.classList.add('hidden');
  nameEntry.classList.remove('hidden');
  nameInput.value = '';
  nameInput.focus();
}

function hideNameEntry() {
  nameEntry.classList.add('hidden');
}

function submitScore() {
  const name = (nameInput.value.trim() || 'ANÓNIMO').slice(0, MAX_NAME_LENGTH).toUpperCase();
  const entry = { name, score, lines, level };
  highscores.push(entry);
  highscores.sort((a, b) => b.score - a.score);
  highscores = highscores.slice(0, MAX_HIGHSCORES);
  saveHighscores();
  hideNameEntry();
  showGameOverRecords(highscores.indexOf(entry));
  renderStartScreen();
}

function actionForCode(code) {
  for (const action of Object.keys(keyMap)) {
    if (keyMap[action].includes(code)) return action;
  }
  return null;
}

function renderControlsList() {
  const html = Object.keys(DEFAULT_KEYMAP).map(action => {
    const keys = keyMap[action].map(code => `<kbd>${codeToLabel(code)}</kbd>`).join(' ');
    return `<li>${keys} ${ACTION_LABELS[action]}</li>`;
  }).join('');
  controlsList.innerHTML = html;
  pauseControlsList.innerHTML = html;
}

function renderKeymapModal() {
  keymapList.innerHTML = '';
  for (const action of Object.keys(DEFAULT_KEYMAP)) {
    const li = document.createElement('li');
    li.className = 'keymap-row';

    const label = document.createElement('span');
    label.className = 'keymap-action-label';
    label.textContent = ACTION_LABELS[action];

    const keyBadge = document.createElement('kbd');
    keyBadge.textContent = codeToLabel(keyMap[action][0]);

    const changeBtn = document.createElement('button');
    changeBtn.type = 'button';
    changeBtn.className = 'keymap-change-btn';
    changeBtn.textContent = 'Cambiar';
    changeBtn.addEventListener('click', () => startRemap(action, changeBtn, keyBadge));

    li.append(label, keyBadge, changeBtn);
    keymapList.appendChild(li);
  }
}

function startRemap(action, changeBtn, keyBadge) {
  if (remappingAction) return;
  remappingAction = action;
  changeBtn.textContent = 'Pulsa una tecla…';
  changeBtn.classList.add('listening');
  keyBadge.textContent = '…';
}

function showKeymapError(message) {
  keymapError.textContent = message;
  keymapError.classList.remove('hidden');
}

function hideKeymapError() {
  keymapError.textContent = '';
  keymapError.classList.add('hidden');
}

function applyRemap(action, code) {
  const owner = actionForCode(code);
  if (owner && owner !== action) {
    showKeymapError(`"${codeToLabel(code)}" ya está asignada a "${ACTION_LABELS[owner]}". Elige otra tecla.`);
    renderKeymapModal();
    return;
  }
  hideKeymapError();
  keyMap[action] = [code];
  saveKeyMap();
  renderKeymapModal();
  renderControlsList();
}

function openKeymapModal() {
  hideKeymapError();
  renderKeymapModal();
  overlayBox.classList.add('hidden');
  keymapBox.classList.remove('hidden');
  overlay.classList.remove('hidden');
  if (!paused && !gameOver) {
    pausedByKeymap = true;
    paused = true;
    cancelAnimationFrame(animId);
  }
}

function closeKeymapModal() {
  remappingAction = null;
  hideKeymapError();
  keymapBox.classList.add('hidden');
  if (pausedByKeymap) {
    pausedByKeymap = false;
    paused = false;
    overlay.classList.add('hidden');
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  } else if (paused || gameOver) {
    overlayBox.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  // Delega el dibujo del bloque en la skin activa.
  SKINS[currentSkin].drawBlock(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  // Pinta el fondo según la skin activa (en vez de clearRect) para que el
  // color de fondo del tablero cambie con el tema sin depender del CSS.
  ctx.fillStyle = SKINS[currentSkin].background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.fillStyle = SKINS[currentSkin].background;
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  // Persistir estadísticas globales de la partida.
  if (maxCombo > stats.bestCombo) stats.bestCombo = maxCombo;
  if (lines > stats.maxLines) stats.maxLines = lines;
  saveStats();

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');

  if (qualifiesForTop(score)) {
    showNameEntry();
  } else {
    hideNameEntry();
    showGameOverRecords(-1);
  }
  renderStartScreen();
}

function openPauseMenu() {
  renderControlsList();
  pauseControlsList.classList.add('hidden');
  pauseControlsBtn.textContent = 'Ver controles';
  startLevelSelect.value = String(startLevel);
  pauseOverlay.classList.remove('hidden');
}

function closePauseMenu() {
  pauseOverlay.classList.add('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function resumeGame() {
  if (paused && !gameOver) togglePause();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  pausedByKeymap = false;
  gameOver = false;
  combo = 0;
  maxCombo = 0;
  dropInterval = Math.max(100, 1000 - (baseLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlayBox.classList.remove('hidden');
  keymapBox.classList.add('hidden');
  hideNameEntry();
  gameoverRecords.classList.add('hidden');
  closePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Si el foco está en un control de formulario (p. ej. el selector de skin),
  // deja que reciba las teclas nativas y no proceses acciones del juego.
  if (!remappingAction && /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) {
    return;
  }

  if (remappingAction) {
    if (e.code === 'Escape') {
      closeKeymapModal();
    } else {
      applyRemap(remappingAction, e.code);
      remappingAction = null;
    }
    e.preventDefault();
    return;
  }

  if (!keymapBox.classList.contains('hidden')) {
    if (e.code === 'Escape') closeKeymapModal();
    return;
  }

  const action = actionForCode(e.code);

  if (action === 'pause') {
    if (e.repeat) return;
    togglePause();
    return;
  }

  if (paused || gameOver) return;

  switch (action) {
    case 'moveLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'moveRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'softDrop':
      e.preventDefault();
      softDrop();
      break;
    case 'rotate':
      e.preventDefault();
      tryRotate();
      break;
    case 'hardDrop':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// Aplica una skin en caliente: guarda la preferencia, sincroniza el fondo
// del canvas y vuelve a dibujar sin recargar la página.
function applySkin(key) {
  if (!SKINS[key]) return;
  currentSkin = key;
  saveSkin();
  const skin = SKINS[key];
  canvas.style.background = skin.background;
  nextCanvas.style.background = skin.background;
  if (board && current && next) {
    draw();
    drawNext();
  }
}

restartBtn.addEventListener('click', init);
remapBtn.addEventListener('click', openKeymapModal);
skinSelect.value = currentSkin;
skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

playBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  init();
});

resetScoresBtn.addEventListener('click', () => {
  highscores = [];
  stats = { bestCombo: 0, maxLines: 0 };
  saveHighscores();
  saveStats();
  renderStartScreen();
});

saveScoreBtn.addEventListener('click', submitScore);

// El campo de nombre no debe disparar acciones del juego: se aísla del handler global.
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitScore();
  }
  e.stopPropagation();
});
keymapCloseBtn.addEventListener('click', closeKeymapModal);
keymapResetBtn.addEventListener('click', () => {
  keyMap = Object.fromEntries(Object.entries(DEFAULT_KEYMAP).map(([action, codes]) => [action, [...codes]]));
  saveKeyMap();
  hideKeymapError();
  renderKeymapModal();
  renderControlsList();
});
overlay.addEventListener('click', e => {
  if (e.target === overlay && !keymapBox.classList.contains('hidden')) closeKeymapModal();
});

resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', init);
pauseControlsBtn.addEventListener('click', () => {
  const collapsed = pauseControlsList.classList.toggle('hidden');
  pauseControlsBtn.textContent = collapsed ? 'Ver controles' : 'Ocultar controles';
});
startLevelSelect.addEventListener('change', () => {
  const value = parseInt(startLevelSelect.value, 10);
  if (Number.isFinite(value)) {
    startLevel = Math.min(MAX_START_LEVEL, Math.max(1, value));
  }
});

// Poblar el selector de nivel inicial (1–15).
for (let i = 1; i <= MAX_START_LEVEL; i++) {
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = String(i);
  startLevelSelect.appendChild(option);
}
startLevelSelect.value = String(startLevel);

renderControlsList();
applySkin(currentSkin);
init();
renderStartScreen();
