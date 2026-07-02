# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Tetris clásico en JavaScript vanilla con HTML5 Canvas. **Sin dependencias, sin build, sin package.json.** Solo tres archivos fuente: `index.html`, `style.css`, `game.js`.

## Running

No hay compilación ni tests. Para probar cambios, abre el juego en un navegador:

```bash
open index.html                 # macOS (abre el archivo directamente)
python3 -m http.server 8000     # o sirve estáticamente y abre http://localhost:8000
```

## Architecture (`game.js`)

Todo el estado vive en variables de módulo (`board`, `current`, `next`, `score`, `level`, `dropInterval`…). El flujo es `init()` → `spawn()` → bucle de `requestAnimationFrame` (`loop`), que acumula `dt` y baja la pieza cuando supera `dropInterval`.

Conceptos clave para entender antes de modificar la lógica:

- **Tablero**: matriz `ROWS × COLS`; cada celda es `0` (vacía) o un índice `1–7` que es a la vez el tipo de pieza y el índice en `COLORS`/`PIECES`. Estos tres arrays deben mantenerse alineados por índice.
- **Piezas**: matrices cuadradas. La rotación (`rotateCW`) es transposición + reverso de filas; `tryRotate` prueba wall kicks `[0, -1, 1, -2, 2]`.
- **`collide(shape, x, y)`** es la función central: toda validación de movimiento/rotación/spawn pasa por aquí. `ghostY()` la usa para proyectar la caída.
- **Ciclo de bloqueo**: `lockPiece()` → `merge()` (fija la pieza) → `clearLines()` → `spawn()`. Si la pieza nueva ya colisiona al aparecer, `spawn()` llama a `endGame()`.
- **Progresión**: `clearLines()` recalcula `level` (cada 10 líneas) y `dropInterval = max(100, 1000 - (level-1)*90)`. La puntuación usa `LINE_SCORES` × nivel.

## Modifying game parameters

Constantes tuneables al inicio de `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`.

**Importante:** si cambias `COLS`, `ROWS` o `BLOCK`, debes actualizar manualmente `width`/`height` del `<canvas id="board">` en `index.html` (deben ser `COLS*BLOCK` × `ROWS*BLOCK`). No se derivan automáticamente.

## Controles

El `keydown` handler en `game.js` acepta doble esquema, WASD y flechas: `A`/`ArrowLeft` y `D`/`ArrowRight` mueven, `S`/`ArrowDown` soft drop, `W`/`K`/`ArrowUp`/`Space` rotan, `L`/`Enter` hard drop, `P` pausa. `README.md` y la lista de `CONTROLS` en `index.html` deben mantenerse sincronizados con este set — al tocar controles, actualiza los tres archivos.

## GitHub Actions

`.github/workflows/` contiene automatizaciones con `anthropics/claude-code-action@v1`, autenticadas con el secret `CLAUDE_CODE_OAUTH_TOKEN`:
- `claude.yml` — responde a menciones `@claude` en issues/PRs.
- `claude-code-review.yml` — review automática en cada PR.
- `claude-issue-triage.yml` — al abrir/editar issues, asigna labels y publica un diagnóstico como comentario.

## Language

El proyecto está en español (README, comentarios, UI). Mantén el español en documentación y mensajes de cara al usuario.
