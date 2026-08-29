# Skyla

TechEurope × Cala hackathon MVP: a three-pane satellite console. A local stations catalog is propagated over **Barcelona**; Cala progressively paints verified owners; the right pane answers only from cited Cala evidence.

Default observer: **Barcelona**. Grey dots mean “not yet verified,” not “not there.” The headline counter is `top verified parent / all visible`.

Technical detail: [docs/mvp-technical-spec.md](docs/mvp-technical-spec.md).

## Setup

Two processes. Install once at the repo root (leftover Three.js) plus each app:

```sh
npm install
cd agent && npm install
cd ../web && npm install
```

Copy env (no secrets in git):

```sh
cp agent/.env.example agent/.env
cp web/.env.example web/.env.local
```

Then run:

```sh
# terminal 1 — Flue agent + Cala adapter
cd agent && npm run dev          # http://localhost:5173

# terminal 2 — Next.js console
cd web && npm run dev            # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000). Next rewrites `/api/agents/*` and `/api/satellites/*` to the agent. Override with `FLUE_SERVER_URL` on the web process if Flue is not on `:5173`.

## Environment variables

Cala keys stay in **`agent/.env` only**. Never `NEXT_PUBLIC_*` for Cala, never the Next app, never the browser.

| Variable | Where | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | agent | Claude models (any [Pi provider](https://pi.dev/docs/latest/providers#api-keys) works) |
| `GEMINI_API_KEY` | agent | Gemini models |
| OpenAI key as required by Pi | agent | Default model `openai/gpt-5.6-luna` |
| `CALA_API_KEY` | agent | Verified entity graph — enrichment + satellite chat. [console.cala.ai/api-keys](https://console.cala.ai/api-keys) |
| `TAVILY_API_KEY` | agent | Optional. Mounts `web_search` on the **assistant** only, not the satellite agent |
| `FLUE_SERVER_URL` | web (optional) | Flue origin for rewrites. Default `http://localhost:5173` |

Cursor MCP inspection (interactive only, not the runtime path): in `~/.cursor/mcp.json` use `"X-API-KEY": "${env:CALA_API_KEY}"`. Do not put a literal key in the repo.

## APIs and tools

| API / tool | Used for |
| --- | --- |
| [CelesTrak](https://celestrak.org/) GP OMM JSON (`GROUP=stations`, shipped) | Identity and SGP4 elements. Local file only — not fetched at runtime |
| [Cala](https://docs.cala.ai/) REST (`knowledge_query`, entity search / introspect / retrieve, `knowledge_search`) | Operator, ultimate parent, country, purpose, citations |
| [Flue](https://flueframework.com) | Durable agents: `assistant` and `satellite` |
| [satellite.js](https://github.com/shashwatak/satellite-js) `json2satrec` | Off-main-thread propagation at 1 Hz |
| [COBE](https://cobe.vercel.app) | Lightweight dotted WebGL globe (`cobe@2`) |
| Tavily | General assistant web search only |

## Source policy (short)

CelesTrak proves *what object it is*. Cala proves *who owns it* when a field carries a source. Missing Cala evidence stays `unknown`. Satellite chat will not invent ownership or fall back to the web.

## Attribution

Attribution: orbital elements **CelesTrak**; ownership **Cala**; globe **[COBE](https://cobe.vercel.app)** (Shu Ding). See [docs/mvp-technical-spec.md](docs/mvp-technical-spec.md) for cache policy, failure discipline, and limitations.
