# Local Development Guide — Ellie's Book

This guide explains how to run Ellie's Book on your own desktop computer. It is
written for someone who is new to this kind of setup. Follow the steps in order.
If a command fails, check the **Troubleshooting** section at the end.

> You run every command in a terminal (macOS: "Terminal"; Windows: "PowerShell"
> or "Windows Terminal"; Linux: your usual terminal). Type one command, press
> Enter, and wait for it to finish before the next one.

---

## 1. What you need first (prerequisites)

You need two tools: **Node.js 22 (LTS)** and **pnpm** (the package manager this
project uses). The simplest way to get pnpm is to let Node.js turn it on for you
with a built-in helper called **corepack**.

### Step 1a — Install Node.js 22 (LTS)

**macOS**

- Easiest: install [Homebrew](https://brew.sh/) if you do not have it, then run:
  ```bash
  brew install node@22
  ```
- Or download the "LTS" installer from [nodejs.org](https://nodejs.org/) and run it.

**Windows**

- Download the "LTS" Windows installer from [nodejs.org](https://nodejs.org/) and
  run it. Accept the defaults.
- Or, if you use `winget`:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```

**Linux**

- Use your distribution's package manager, or the
  [NodeSource](https://github.com/nodesource/distributions) setup for Node 22.
- A simple cross-distro option is [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  nvm install 22
  nvm use 22
  ```

Check it worked (all platforms):

```bash
node --version
```

You should see a version that starts with `v22.` (this project needs Node
`>=22.13.0`).

### Step 1b — Turn on pnpm with corepack

Node.js 22 ships with **corepack**, which can install the exact pnpm version this
project pins. Run this once (all platforms):

```bash
corepack enable
```

That is the simplest path: because `package.json` pins `pnpm` under the
`packageManager` field, corepack will automatically use the correct pnpm version
when you run `pnpm` inside this project.

Check it worked:

```bash
pnpm --version
```

> On Windows, if `corepack enable` reports a permissions problem, open PowerShell
> "as Administrator" once and run it again.

---

## 2. First-time setup

Get the code and install the project's dependencies.

```bash
# 1. Clone the repository (replace the URL if you use SSH)
git clone https://github.com/woussc/Ellies-Book.git
cd Ellies-Book

# 2. Install dependencies (this reads pnpm-lock.yaml and may take a few minutes)
pnpm install
```

You only do this once per computer (plus `pnpm install` again whenever
dependencies change).

---

## 3. Everyday commands

Run all of these from inside the `Ellies-Book` folder.

### Live preview while you work

```bash
pnpm run dev
```

This starts the development server. Open your browser at
**http://localhost:3000** to see the live prototype. The page reloads
automatically when you save a file. Press `Ctrl + C` in the terminal to stop it.

### Production preview

To see the app the way it runs in production (built and optimized):

```bash
pnpm run build   # build the production bundle
pnpm run start   # serve the built app, also at http://localhost:3000
```

### Fast domain tests (no build needed)

This is the quick correctness check for the financial / budget logic. It does not
need a build and runs in a couple of seconds:

```bash
node --test tests/budget-domain.test.mjs
```

### Full test (build + rendered-HTML contract)

```bash
pnpm run test
```

This runs `vinext build` first and then checks the rendered HTML output. It takes
longer than the fast domain test because it builds the app.

### Linter (code style and accessibility checks)

```bash
pnpm run lint
```

> Tip: the cloud CI (GitHub Actions) runs lint, build, both test suites, and the
> visual screenshots automatically on every pull request. Running them locally
> first just helps you catch problems sooner.

---

## 4. Local Cloudflare / Wrangler data (hybrid sync)

Ellie's Book uses a **hybrid local-first + cloud** persistence model (ADR 0001,
Decision 1). The app targets Cloudflare Workers with a D1 (SQLite) database, and
`pnpm run dev` runs it through the Cloudflare Vite plugin, which uses a local
Wrangler/Miniflare emulation under the hood.

For normal local work you do **not** need a Cloudflare account: the dev server
emulates D1 locally, so the hybrid sync endpoint (`/api/sync`) works against a
local SQLite file on your machine. The emulated data lives in Wrangler's local
state folder (commonly under `.wrangler/` in the project). You can delete that
folder to reset local data.

If you later want to generate or update the database schema migrations, the
project uses Drizzle:

```bash
pnpm run db:generate
```

> You only need real Cloudflare credentials when you deploy to the cloud, not for
> local development.

---

## 5. Troubleshooting

**"Wrong Node version" / build or install errors mentioning `engines`.**
Run `node --version`. If it is not `v22.x` (at least `v22.13.0`), install Node 22
(see Step 1a). If you use `nvm`, run `nvm use 22`.

**`pnpm: command not found`.**
Run `corepack enable` (Step 1b), then open a new terminal window and try again. On
Windows you may need to run the enable command in an Administrator PowerShell once.

**`pnpm install` fails or looks stuck.**
Check your internet connection. If it still fails, delete the `node_modules`
folder and try `pnpm install` again. Make sure you are inside the `Ellies-Book`
folder.

**"Port 3000 is already in use."**
Another program (maybe an earlier `pnpm run dev` you did not stop) is using the
port. Stop the other process, or start on a different port:

- macOS / Linux: `PORT=3001 pnpm run dev`
- Windows (PowerShell): `$env:PORT=3001; pnpm run dev`

Then open the browser at the new port, for example http://localhost:3001.

**The page does not load after `pnpm run dev`.**
Wait a few seconds for the first build to finish; the terminal prints a line when
the server is ready. Then refresh http://localhost:3000.

**Lint reports problems.**
Read the file and line it names, fix the issue, and run `pnpm run lint` again. The
linter also checks accessibility rules, so some messages are about `aria`
attributes or element roles.
