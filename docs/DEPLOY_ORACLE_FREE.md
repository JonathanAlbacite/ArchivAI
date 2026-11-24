# Deploying on a free Oracle Cloud server (plan)

Notes from planning how to host The Archivist's Legacy as cheaply as possible.
**Status: plan only. Nothing here has been set up yet, and no deployment files
exist in the repo yet** (see "Still to do" at the end).

Prices and free-tier limits below were correct to the best of our knowledge
when written. Check them before signing up.

---

## Why one server

The app has three things that make free "split" hosting awkward:

| Problem | Why it matters |
|---|---|
| Big Unity files | `unitybuild.wasm` and `customizerbuild.wasm` are about 110 MB each; the `.data` files are 40–45 MB. Cloudflare Pages rejects files over 25 MB. |
| Uploads saved on disk | Lesson modules, campaign attachments and character models go to `server/uploads/`. Hosts like Railway or Render wipe the disk on redeploy unless you add a volume. |
| MySQL database | Prisma uses `provider = "mysql"`. Free MySQL hosting is scarce and small. |

A single server has no file-size limit, keeps its disk, and can run MySQL
itself. The app runs on it without code changes, apart from the security fix
below.

## Options we compared

| Option | Monthly cost | Effort | Reliability |
|---|---|---|---|
| **A. Oracle Cloud Always Free server** (this document) | $0 | Highest | OK, with caveats |
| B. Small Hetzner server, same setup as A | about €4–6 | High | Very good |
| C. Cloudflare Pages (frontend) + Railway (backend and MySQL) | about $5–10, plus a domain if using R2 | Lowest | Very good |
| D. A mix of free services (Pages + Render free + free MySQL + R2) | $0 | High, plus code changes | Poor: the backend sleeps (30–60 s to wake), uploads need code changes, tiny database |

If option A becomes a problem (capacity, reclaiming), the same setup moves to
option B almost unchanged.

### Unity files with options B, C and D (for reference)

- **Shrink the builds:** rebuild both Unity projects with
  - Compression Format: Brotli, with "Decompression Fallback" ticked
  - Managed Stripping Level: High
  - IL2CPP Code Generation: Optimize Size
  - Development Build: unticked

  This might fit under 25 MB per file. It's not guaranteed: the `.data` files
  hold art and sound, which may not compress much.
- **Cloudflare R2:** free up to 10 GB of storage with free downloads, but it
  needs a card on file. Its `r2.dev` address is for testing only;
  production needs your own domain. It also needs a CORS rule and a
  `VITE_UNITY_BASE_URL` setting in the code.

Option A needs neither, because the server has no file-size limit.

---

## Fix before anything goes online (required for every option)

`server/scripts/seedAdmin.js` creates the admin account with the hardcoded
password **`password`**. The server runs this seed on every start
(`runAllSeeds()` in `server/index.js`), so the password is reset to
`password` on every restart. On a public server, anyone who guesses it has
admin access.

Fix: read the admin password from `server/.env` (for example `ADMIN_PASSWORD`)
and only set it when the admin account is first created, not on every boot.

---

## How it fits together

```
Students / teachers
        │  https://archivai.duckdns.org
        ▼
┌───────────────── Oracle free server (Ubuntu, ARM) ─────────────────┐
│  Caddy (web server, automatic HTTPS)                               │
│   ├─ /             → built website (client/dist)                   │
│   ├─ /unitybuild/, /customizerbuild/ → Unity files, pre-compressed │
│   ├─ /api/*        → Node backend on port 3000                     │
│   └─ /uploads/character-sets/* → Node backend                      │
│                                                                    │
│  Node backend (kept running by systemd)                            │
│  MySQL (only reachable from inside the server)                     │
│  server/uploads/ on the server's own disk (survives restarts)      │
└────────────────────────────────────────────────────────────────────┘
```

- **One web address for everything**, so the website and backend are on the
  same site and CORS isn't an issue.
- **Smaller Unity downloads without rebuilding Unity:** compress the Unity
  files once on the server (`.br` and `.gz` copies), and Caddy sends the
  compressed copy. Rough estimate: about 30–50 MB per first load instead of
  about 155 MB. The `.data` files may not shrink much.
- **No file-size limits and no wiped disk.**

## What the free tier gives you

| Resource | Free limit | This app needs |
|---|---|---|
| ARM server (Ampere A1) | up to 4 CPU cores and 24 GB of memory in total | 2 cores, 12 GB |
| Disk (block volume) | 200 GB in total | about 50 GB |
| Downloads | 10 TB a month | far less, even at 155 MB per load |
| File storage (Object Storage) | 20 GB | off-server backups |

## Things to know before signing up

1. **A card is required** to verify your identity. Always Free resources aren't
   charged.
2. **Choose your home region carefully.** Free ARM servers can only be created
   in your home region, and it can't be changed later. Popular regions are
   often "out of capacity". A less busy region near your students helps.
3. **Idle free servers can be reclaimed.** Oracle may take back a free server
   that stays nearly idle for about a week. Common fix: upgrade the account to
   **Pay As You Go**. You're still charged nothing within the free limits,
   reclaiming stops, and getting a server is usually easier. If you do, **set a
   budget alert at $1**.
4. **Firewall gotcha.** Oracle blocks web traffic in two places: the network's
   **Security List** in the dashboard, and the server's own `iptables` rules.
   Ports 80 and 443 must be opened in both, or the site won't load.
5. **You're the system administrator:** updates, backups and fixing it if it
   goes down are on you.

---

## Setup steps (about 1–3 hours the first time)

1. **Create the server**
   - Ubuntu 22.04 or 24.04 on the **VM.Standard.A1.Flex** shape (2 cores,
     12 GB memory, 50–100 GB disk).
   - Add your SSH key and note the server's public IP address.
   - Open ports 80 and 443 in the Security List.
2. **Get a web address**
   - Free: create something like `archivai.duckdns.org` at duckdns.org and
     point it at the server's IP.
   - Or buy a domain (about $10 a year).
3. **Install the software** over SSH:
   - Node 20 or later
   - MySQL
   - Caddy
   - git and Git LFS (the Unity files are stored with Git LFS)
   - build tools (`build-essential`), so `bcrypt` can compile on ARM
   - Also open ports 80 and 443 in the server's own `iptables` rules.
4. **Set up MySQL**
   - Create a database and a user with a strong password.
   - Keep MySQL reachable only from inside the server (the default).
5. **Get the code:** `git clone` the repo, then `git lfs pull` to download the
   real Unity files.
6. **Configure the backend.** Create `server/.env` with:
   - `DATABASE_URL`, e.g. `mysql://archivai:<password>@localhost:3306/archivai`
   - `JWT_SECRET`, a long random value
   - `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`
   - `PORT=3000`
   - the admin password setting from the security fix above
7. **Prepare the backend**, in `server/`:
   - `npm ci`
   - `npx prisma generate`
   - `npx prisma migrate deploy`
8. **Build the frontend**, in `client/`:
   - Set `VITE_API_URL=https://archivai.duckdns.org`.
   - Run `npm ci` and `npm run build`.
   - Create `.br` and `.gz` copies of the Unity files in `client/dist`.
9. **Keep the backend running** with a systemd service that starts
   `node index.js` in `server/` at boot and restarts it if it crashes.
10. **Configure Caddy**
    - Serve `client/dist`, with every page route falling back to `index.html`
      so refreshing a page works.
    - Serve the Unity files with `file_server { precompressed br gzip }`.
    - Proxy `/api/*` and `/uploads/character-sets/*` to `localhost:3000`.
    - Caddy gets the HTTPS certificate automatically.
11. **Set up backups**
    - A nightly cron job runs `mysqldump` on the database and archives
      `server/uploads/`.
    - It copies both to Oracle Object Storage (free, 20 GB), so a dead
      server doesn't lose data.

## Deploying updates later

Nothing deploys automatically when you push to GitHub. Run one update script
over SSH:

1. `git pull` and `git lfs pull`
2. `npm ci` in `server/` and `client/`
3. `npx prisma migrate deploy`
4. Rebuild the frontend and re-compress the Unity files
5. Restart the systemd service

It takes about a minute. A GitHub Action could automate this later; it's
optional.

---

## Still to do in the repo

- [ ] **Admin password fix** in `server/scripts/seedAdmin.js` (required).
- [ ] **`deploy/` folder** containing:
  - [ ] Caddy config
  - [ ] systemd service file
  - [ ] first-time setup script
  - [ ] update script
  - [ ] backup script
  - [ ] example `server/.env` file
- [ ] **Step-by-step guide** with exact commands to copy and paste.

No other app code changes are needed for this option.
