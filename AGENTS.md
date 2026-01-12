# Claude Agent Web UI

Browser-based UI + Bun HTTP/SSE server for agentic chat with the Claude Agent SDK.

## Technology

- **Server:** Bun (HTTP + SSE)
- **UI:** React 19 + TypeScript, Tailwind CSS 4
- **Build:** Vite 7 (web) + electron-vite (legacy)
- **Runtime:** Bun (package manager, scripts, tests)

## Layout

```
src/
├── server/     # Bun HTTP/SSE server + agent session manager
├── renderer/   # React Web UI
└── shared/     # Types shared between processes
.claude/        # Claude Agent SDK skills compiled into the app bundle
resources/      # Bundled runtime binaries (bun, uv, etc.)
scripts/        # Build hooks (preDev, beforeBuild, afterPack, runtime downloads)
static/         # Icons and static assets
```

## Skills integration

- Skills live in `.claude/skills/<skill-name>/` (each contains `SKILL.md` + `scripts/`).
- Built-in sample: `workspace-tools` with a depth-limited `list-directory` utility.
- `scripts/buildSkills.js` compiles TypeScript tools in `.claude/skills` to `out/.claude/skills/` using the root dependencies (no separate `.claude` package) and Bun `--compile`.
- Skill TypeScript is checked via the root `tsconfig.json`; there is no package.json or node_modules under `.claude`.
- `scripts/preDev.js` runs before `bun run dev` to download runtime binaries and build skills.
- `scripts/beforeBuild.js` runs during production builds to download binaries, copy runtime deps to `out/node_modules`, and build skills.
- `scripts/afterPack.js` trims unused vendor assets and confirms `.claude/skills` are present.
- The server uses the current workspace and `.claude` skills as provided by build scripts.

### Adding a skill

1. Create `.claude/skills/<skill-name>/SKILL.md` with `name` + `description`.
2. Add TypeScript tools under `.claude/skills/<skill-name>/scripts/`.
3. Run `bun run dev` (or rerun `scripts/buildSkills.js`) to compile binaries into `out/.claude/skills/`.
4. Start the server; the workspace `.claude` folder will be used at runtime.

## Commands

```bash
bun install       # Install dependencies
bun run typecheck # TypeScript checks
bun run lint      # ESLint
bun run test      # Bun tests
bun run format    # Prettier
bun run server    # Start Bun HTTP/SSE server
bun run dev:web   # Start Vite dev server for Web UI
bun run build:web # Build Web UI into dist/
bun run start     # Build Web UI and start server (single port)
bun run dev:single # Build Web UI in watch mode and start server (single port)
```

## Defaults

- Agent directory is required and passed via `--agent-dir` on server start.
- Initial prompt is optional via `--prompt`.
- Anthropic API key is provided via `ANTHROPIC_API_KEY`.
- Server listens on port 3000 by default; override with `--port`.

## Workflow

- After a series of code changes, **always** run: lint, typecheck, test, and format commands to ensure the code is working as expected.
- When drafting commit messages, **always** follow Conventional Commits format.
