# Thermo Quest

Browser game for EvCC ENGR& 224 (Thermodynamics). Students walk a 16-screen pixel world, solve problems at stations, chat, and attend live lectures (shared whiteboard, teacher voice, raise hand, recordings). `server/relay.js` serves these files as they are and relays all multiplayer traffic over one WebSocket.

## Rules
- Run `node check.js` before every commit and fix everything it reports. It syntax-checks every script, including the logic inside the .dc.html file (one syntax error blanks the whole game), and checks template holes, maps and exits, NPC spots, and steam-table consistency.
- When a change is done and the check passes, commit and push to `main`. The class server pulls from there.
- No build step. Don't add bundlers, frameworks or npm packages to the game. The server's only dependency is `ws`.
- Never commit `server/config.json`, `server/chat-history.json`, `server/recordings/` or course PDFs.

## Run locally
`cd server && npm install && npm start`, then open http://localhost:8080. The teacher password comes from `server/config.json` (falls back to `config.example.json`: `change-me`).

## Files
- `Thermo Quest.dc.html`: the entire game. Rendered in the browser by `support.js`; never edit `support.js`.
- `steam.js`: water and gas property tables (Çengel & Boles, SI), unit conversions, and the homework problem generator. A classic script that sets `window.THERMO`.
- `net.js` (multiplayer client), `board.js` (lecture whiteboard: PDF/image pages, stylus ink, sync), `voice.js` (mic to 16 kHz μ-law chunks over the WebSocket, jitter-buffered playback). ES modules, loaded with dynamic `import()`.
- `multiplayer-config.js`: only used without the class server (Supabase or demo mode). relay.js serves a generated version instead.
- `server/relay.js`: Node 18+. Static files, WebSocket relay, teacher auth, lecture recording.

## Editing `Thermo Quest.dc.html`
The file has two parts.

1. **Template**, between `<x-dc>` and `</x-dc>`:
   - Inline `style="…"` only; no classes or stylesheets. Pseudo-states use `style-hover="…"`, `style-active`, `style-focus`.
   - `{{ name }}` holes are plain dotted lookups. Expressions such as `{{ a + b }}`, `{{ !x }}` or `{{ f() }}` silently render nothing; compute the value in `renderVals()` and expose it by name.
   - Conditionals and lists: `<sc-if value="{{ flag }}" hint-placeholder-val="{{ false }}">` and `<sc-for list="{{ items }}" as="item" hint-placeholder-count="0">`. Keep the hint attributes.
   - Handlers: `onClick="{{ handler }}"`. Close every tag and double-quote every attribute.
2. **Logic**, `class Component extends DCLogic { … }` inside `<script type="text/x-dc" data-dc-script>`. Plain JavaScript, no imports or TypeScript. It works like a React class component without `render()`: `renderVals()` returns everything the template reads. The constants above the class hold the game data.
   - Most strings are single-quoted. Escape apostrophes (`'don\'t'`) or reword the line; an unescaped one has broken the game before.

## Where things live (search for these names)
- `MAPS`: 16 × 11 tile strings per screen. `SOLID`: tile characters that block walking. `SCREENS`: name, colors, `exits` {n, s, e, w}, `npc` / `npcs`, `doors`. The minimap layout is the `grid` array near `const grid = [`.
  - Every open tile on a screen's edge needs an exit in that direction, and the neighbor needs an opening on the facing edge. Openings don't have to line up: the player arrives in the nearest open lane (`lane()`).
- `STATIONS`: door id to station name, chapter and unlock order. `RIGS`: problem stations (`defaults`, `compute`, answers with `ans` and `tol`, hints).
- `CRITTERS`: NPCs (name, kind, colors, dialogue `lines`), placed with `SCREENS[x].npcs`.
- Lecture: `bd*` methods (board), `vc*` (voice and raise hand), `rp*` (replays).
- Multiplayer: the events students may send are `STUDENT_EVENTS` in `server/relay.js`; the event list in `net.js` must match.

## Physics data
Keep the tables consistent: h = u + Pv, h_g = h_f + h_fg, s_fg = h_fg / T(K). `check.js` verifies these and Clapeyron for every saturation row. Answers are graded with the tolerances in `RIGS` and `steam.js`'s `grade`.

## Deploying
On the VM, `bash update.sh` pulls `main`. It restarts the server only when `server/` changed; a restart ends a live lecture and its recording, so avoid shipping server changes during class.
