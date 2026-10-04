# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
`halo-butterfly-next` is a **theme for the Halo CMS** (not a standalone web app). The
deliverable is an installable theme ZIP built into `dist/`. "Running it" means building
the ZIP and installing it into a running **Halo 2.26.1** server. Standard build/dev/test
commands live in `package.json` (`dev`, `build`, `typecheck`, `check`, `verify`, `parity:check`, `lab`);
see also `README.md`, `CONTRIBUTING.md`, and `docs/COMPARISON-LAB.md`. `src/` is source;
`templates/` and `dist/` are generated artifacts — do not hand-edit or commit them.

### Node version (non-obvious)
`engines.node` requires `>=24 <25`, but this VM has an `/exec-daemon/node` (v22) shim
prepended to `PATH` that otherwise shadows Node. Setup added an `~/.bashrc` snippet that
puts nvm's Node 24 ahead of the shim, so new shells already resolve `node -v` → `v24.x`.
If a shell ever reports Node 22, run: `nvm use 24` (nvm is at `~/.nvm`), or re-source
`~/.bashrc`. Install Bun 1.4.0 separately; Corepack does not manage Bun. Keep Node 24 for build/test scripts.

### Build / lint / test (no services needed)
These need only Node 24 + bun and touch no external services:
- `bun run typecheck` — strict TypeScript checks for all maintained browser code.
- `bun run check` — Node built-in test runner (`tests/*.test.mjs`), plus the lab's Python guard tests.
- `bun run parity:check` — feature-matrix / parity consistency check (the closest thing to a lint gate).
- `bun run build` — produces `dist/halo-butterfly-next-<version>.zip`.
- `bun run verify` — runs `typecheck` + `parity:check` + `check` + `build` + package check together (use this as the primary gate).
- `bun run dev` — rebuilds the ZIP on source changes. It does **not** start Halo and does not deploy to any site.

### End-to-end testing = the comparison lab (real Halo)
To render/test the theme in a real Halo instance, use the lab (full docs: `docs/COMPARISON-LAB.md`):
```
bun run build
python3 scripts/lab/lab.py bootstrap --package dist/halo-butterfly-next-<version>.zip --source-sha "$(git rev-parse HEAD)"
python3 scripts/lab/lab.py health
```
- Requires Java 21+ (present) and network on first run (downloads the pinned Halo 2.26.1 JAR + upstream Hexo Butterfly). Everything lives under the git-ignored `.runtime/comparison/`.
- Loopback-only ports: **Halo `18091`**, Hexo reference site `14000` (override via `HALO_PORT`/`HEXO_PORT`/`LAB_RUNTIME`).
- `bootstrap` leaves both processes running; stop them with `python3 scripts/lab/lab.py stop`.
- Halo admin credentials are generated (random password, `0600`) at `.runtime/comparison/halo/credentials.json`. Admin console is at `/console`, login at `/login`.
- Quick HTTP smoke check against a running Halo: `node scripts/smoke.mjs --base http://127.0.0.1:18091`.

### IMPORTANT lab caveat (non-obvious)
`lab.py bootstrap` can exit with a **non-zero code because of the OPTIONAL Hexo reference
site**, printing `Lab error: Hexo title/date/cover/body differs from fixture` (upstream
Hexo Butterfly / renderer drift). This does **not** mean the Halo side failed: in practice
Halo still boots on `18091`, the theme is installed + activated, and the 12 fixture posts
are seeded and rendering. To verify the actual product regardless of that exit code, hit
Halo directly (`curl http://127.0.0.1:18091/`, `node scripts/smoke.mjs`) and/or log into
`/console`. The Hexo site is only needed for side-by-side parity comparison, not to test
the theme itself.
