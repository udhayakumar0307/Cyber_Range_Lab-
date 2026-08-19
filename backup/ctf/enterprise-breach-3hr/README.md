# Enterprise Breach — 3-Hour Team CTF

Auto-synced into the platform via `event.json` in this folder (run "Sync Now" on the
SysAdmin → CTF tab, or `POST /api/v1/admin/ctf/sync`).

- **Duration:** 3 hours
- **Format:** teams of 4, up to 10 teams (40 participants max)
- **Categories:** Cryptography, Web, Network

## What's in this folder

| Path | Purpose |
|---|---|
| `event.json` | Synced into the platform's `CTF` / `CTFChallenge` tables |
| `ans.txt` | All three flags, for admin reference only — do not distribute to students |
| `crypto/` | Cryptography challenge files (ciphertext + instructions) |
| `docker/vm/` | The team desktop VM image (Chrome, terminal, file manager via noVNC) |
| `docker/webapp/` | The vulnerable "Hidden Admin Panel" web challenge |
| `docker/netsvc/` | The "Port Scan Secret" network challenge target |
| `docker/docker-compose.yml` | Brings up one team's full isolated environment |

## Running it

Each team gets its **own** isolated stack (desktop VM + webapp + network target),
so nothing leaks between teams. From `docker/`:

```bash
docker compose build
HOST_VNC_PORT=6081 docker compose -p team01 up -d
```

Repeat with a different `-p` project name and a different `HOST_VNC_PORT` for each
of the up to 10 teams (`team01`..`team10`, ports `6081`..`6090`, for example).

Each team then opens `http://<server-ip>:<their-port>` in a browser to reach their
desktop VM (noVNC — no client software needed). Inside that desktop they have:

- **Chromium** — for the Web challenge
- **A terminal** — for `nmap`/`nc` (Network challenge) and general recon
- **A file manager** — the Cryptography challenge files are pre-loaded at
  `~/Desktop/challenge/crypto/`

The webapp and network-service containers are only reachable from *inside* that
team's desktop VM (same internal `challenge_net` network), matching a real
internal-network pentest setup.

## Tearing down after the event

```bash
docker compose -p team01 down
docker compose -p team02 down
# ...etc
```
