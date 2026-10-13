# Run Thermo Quest on your own server

One small program (`server/relay.js`) serves the game **and** carries chat, walking, emotes, the lecture board and lecture voice for the whole class. The teacher password stays on the server, never in a file students can download.

## What it needs

- A Linux server or VM with Node 18 or newer. 2 vCPU, 2 GB RAM and 20 GB of disk is plenty; recordings use about 115 MB per hour of lecture.
- This game in a private GitHub repository (see README.md).
- Recommended: a domain name, so the game is on https. Browsers only allow microphones on https, so lecture voice needs it.

## Make the VM (Proxmox)

Skip this if you already have an Ubuntu or Debian server.

1. Get the Ubuntu Server LTS installer: in Proxmox click your node, then **local → ISO Images → Download from URL**, and paste the ISO link from ubuntu.com/download/server.
2. **Create VM**: name `thermo-quest`; on **OS** choose that ISO; on **CPU** set 2 cores. The other defaults (2 GB memory, 32 GB disk, bridge `vmbr0`) are fine.
3. Start the VM, open its **Console**, and install Ubuntu with the defaults. Tick **Install OpenSSH server** when asked.
4. After the reboot, log in and run `hostname -I` to get its IP address. You can now work from your own computer with `ssh YOUR-LINUX-USER@THAT-IP`.
5. In Proxmox: VM → **Options → Start at boot → Yes**, so the server comes back after the host restarts.
6. Recordings and chat history exist only on this VM. Add it to a backup job: **Datacenter → Backup → Add**.

## First-time setup (Ubuntu / Debian)

1. **Install Node and git** (skip Node if `node -v` already shows 18 or higher):
   ```
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
2. **Give the VM read-only access to the repo** with a deploy key:
   ```
   ssh-keygen -t ed25519 -f ~/.ssh/thermo_quest -N "" -C thermo-vm
   cat ~/.ssh/thermo_quest.pub
   ```
   On GitHub open the repo, then **Settings → Deploy keys → Add deploy key**. Paste that line and leave "Allow write access" unticked. Then tell ssh to use the key:
   ```
   printf 'Host github-thermo\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/thermo_quest\n  IdentitiesOnly yes\n' >> ~/.ssh/config
   ```
3. **Download the game** (put your GitHub user name in place of YOUR-GITHUB-NAME):
   ```
   sudo mkdir -p /opt/thermo-quest && sudo chown "$USER": /opt/thermo-quest
   git clone git@github-thermo:YOUR-GITHUB-NAME/thermo-quest.git /opt/thermo-quest
   cd /opt/thermo-quest/server && npm install
   ```
4. **Set your teacher password**:
   ```
   cp config.example.json config.json
   nano config.json
   ```
   Change `"change-me"`. Git ignores `config.json`, so updates never overwrite it.
5. **Try it**: run `npm start`, then open `http://YOUR-SERVER-IP:8080` in a browser. The dot above the class chat turns green and says ONLINE. Press Ctrl+C to stop.
6. **Keep it running after you log out.** Create `/etc/systemd/system/thermo-quest.service`, putting the output of `whoami` in place of YOUR-LINUX-USER:
   ```
   [Unit]
   Description=Thermo Quest class server
   After=network.target

   [Service]
   WorkingDirectory=/opt/thermo-quest/server
   ExecStart=/usr/bin/node relay.js
   Restart=always
   User=YOUR-LINUX-USER

   [Install]
   WantedBy=multi-user.target
   ```
   Then run `sudo systemctl enable --now thermo-quest`.
7. **Put it on the internet.** Pick one:
   - **Cloudflare Tunnel** (recommended: no open ports, free https). Your domain must be on Cloudflare.
     1. In the Cloudflare dashboard go to **Networking → Tunnels → Create Tunnel** (older dashboards: **Zero Trust → Networks → Tunnels**). Name it `thermo-quest`.
     2. Under **Setup Environment** pick **Debian**, **64-bit**. Copy the commands under **Install and Run** and paste them into the VM. They install `cloudflared` as a service that starts at boot. When the tunnel shows **Healthy**, select **Continue**.
     3. Open the tunnel, then **Routes → Add route → Published application**. Hostname: a subdomain such as `thermo` on your domain. Service URL: `http://localhost:8080`. Save.
     4. Turn **Rocket Loader off** for that hostname (it breaks the game scripts): **Rules → Configuration Rules**, create a rule where Hostname equals `thermo.YOUR-DOMAIN`, set Rocket Loader **Off**, and deploy.
     5. Open `https://thermo.YOUR-DOMAIN`. The dot above the class chat says ONLINE.

     The tunnel carries WebSockets, which is all this server uses.
   - **Caddy** (a domain pointing straight at the server): `sudo apt install caddy`, put your domain into `server/Caddyfile`, copy it to `/etc/caddy/Caddyfile`, run `sudo systemctl reload caddy`, and open ports 80 and 443.
   - **Neither**: open port 8080 and share `http://YOUR-SERVER-IP:8080`. Everything works except microphones, which browsers block on plain http.

## Updating

Changes go to GitHub first (from Claude Code or your computer). Then on the VM:
```
bash /opt/thermo-quest/update.sh
```
If only game files changed, nothing restarts: students get the new version when they reload the page. If `server/` changed, the script restarts the server, which ends a live lecture and its recording, so run it between classes.

Don't edit files directly on the VM. `git pull` refuses to update a file that was changed there.

## Teaching a lecture

1. In the game, click **TEACHER** under the chat and enter your password.
2. Walk south from Plant Plaza into the **Lecture Hall** and press A.
3. **LOAD PDF / IMAGES** turns each PDF page into a slide (export PowerPoint or Keynote to PDF first). **+ PAPER**, **+ GRID** and **+ CHALK** add blank pages.
4. Prepare as long as you like; nobody sees anything until you press **GO LIVE**. Then every student gets a red JOIN banner and their board follows your pages.
5. Your pages and ink are saved in your browser, so a reload mid-lecture loses nothing.
6. **MIC ON** turns on your microphone. Only people in the Lecture Hall hear you.
7. Students press **RAISE HAND**. Their names appear next to HANDS; click a name to **GIVE FLOOR**, and click it again to take the floor back. Only that student's mic gets through.
8. Every live lecture (board + all voices) is recorded to `server/recordings/`. Students click **REPLAYS** in the Lecture Hall to watch with a seek bar. Delete files there to remove a lecture.

## How much does 30 students use?

- Ink: under 1 Mbit/s in total while you write.
- Turning to a new slide: about 100–200 KB per student, once.
- Walking and chat: tiny. The server only sends walking updates to people on the same screen.
- Voice: 128 kbit/s for each listener while someone talks, so 30 students is about 4 Mbit/s. It travels over the same WebSocket as everything else, so it works through Cloudflare Tunnel, with about half a second of delay.

**How many students can one server hold?** For one lecture, about 150–200 before the board starts to lag. The limit is the single Node process, not the network: even at 200 listeners, voice is about 26 Mbit/s and ink about 5 Mbit/s, a few percent of a 1 Gbps NIC.
