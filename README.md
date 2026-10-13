# Thermo Quest

A pixel-art world for EvCC ENGR& 224 Thermodynamics. Students make a character, explore a 16-screen map, solve problems at nine stations, chat with classmates and join live lectures.

## Features

- **Problem stations**: generated homework-style problems with hints and graded answers. Steam and gas tables (Çengel & Boles, SI) checked against NIST.
- **Shared world**: students see each other walk, chat and emote. The teacher can post announcements, mute players and clear chat.
- **Lecture Hall**: a shared whiteboard (PDF or image slides; paper, grid and chalkboard pages; pressure-sensitive pen, highlighter, eraser, laser pointer), teacher voice, raise hand, and automatic recordings students can replay.
- **One small server**: `server/relay.js` serves the game and carries all class traffic over one WebSocket. No database, no build step, one npm dependency.

## Requirements

- **Students**: a current web browser.
- **Server**: Linux with Node 18 or newer. 2 vCPU, 2 GB RAM and 20 GB disk is plenty for a class. Recordings use about 115 MB per lecture hour.
- **https for lecture voice**: browsers only allow microphones on https (or on localhost). Cloudflare Tunnel or Caddy gives you https for free.

## Installation

### 1. Try it on your computer

Install Node 18 or newer from nodejs.org, then from this folder:

```
cd server
npm install
npm start
```

Open http://localhost:8080. Click **TEACHER** under the chat; the password is `change-me` until you create `server/config.json` from `config.example.json`.

### 2. Put it on GitHub

Make the repository **private**. Pick one:

- **Claude Code**: open this folder and say *"Put this folder in a new private GitHub repo called thermo-quest."*
- **GitHub Desktop**: **File → Add Local Repository**, choose this folder, click **create a repository**, then **Create Repository**, then **Publish repository** with "Keep this code private" ticked.
- **Terminal**, with GitHub's `gh` tool:
  ```
  git init -b main
  git add .
  git commit -m "Thermo Quest"
  gh repo create thermo-quest --private --source=. --push
  ```

`.gitignore` keeps your password, chat history and recordings out of the repo.

### 3. Install it on the class server

[SERVER-SETUP.md](SERVER-SETUP.md) has every command. In order:

1. Create an Ubuntu VM (Proxmox steps included).
2. Install Node and git, and give the VM a read-only deploy key for the repo.
3. Clone to `/opt/thermo-quest`, run `npm install`, and set your teacher password in `server/config.json`.
4. Run it as a systemd service so it survives reboots.
5. Publish it on https with Cloudflare Tunnel (turn Rocket Loader off) or Caddy.

Then read [Teaching a lecture](SERVER-SETUP.md#teaching-a-lecture).

## Updating

1. Open this folder in Claude Code and describe the change. [CLAUDE.md](CLAUDE.md) tells Claude how the game is built; it runs `node check.js`, then commits and pushes.
2. On the VM: `bash /opt/thermo-quest/update.sh`. If `server/` changed, this restarts the server and ends a live lecture, so run it between classes.

## Files

| File | What it is |
| --- | --- |
| `Thermo Quest.dc.html` | The whole game: map, stations, characters, Lecture Hall |
| `steam.js` | Property tables, unit conversions, problem generator |
| `net.js`, `board.js`, `voice.js` | Multiplayer, lecture whiteboard, lecture voice |
| `support.js` | Renders the game file. Don't edit |
| `multiplayer-config.js` | Only for running without the server ([MULTIPLAYER-SETUP.md](MULTIPLAYER-SETUP.md)) |
| `server/relay.js` | The class server |
| `server/config.example.json` | Copy to `config.json` and set your password |
| `server/Caddyfile` | Only for the Caddy option |
| `check.js` | Run `node check.js` before every commit |
| `update.sh` | Pulls updates on the server |
| `CLAUDE.md` | Instructions for Claude Code |

## Not in this repository

Your password (`server/config.json`), chat history, lecture recordings and course PDFs. Recordings and chat history exist only on the server, so back up the VM.
