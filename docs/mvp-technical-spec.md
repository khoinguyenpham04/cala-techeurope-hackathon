# Sky Console MVP — technical spec

Three-pane console: live CelesTrak payloads over a European city, progressive Cala ownership enrichment, and a right-pane chat that answers only from cited Cala evidence.

## Architecture

```
CelesTrak OMM JSON (shipped `barcelona-omm.json`)
        │
        ▼
Browser SGP4 worker (1 Hz, Barcelona, elevation > 0°)
        │
        ▼
COBE globe (lat/lon markers) ──► selected NORAD
        │                         │
        │                         ▼
        │              POST /api/satellites/enrich
        │              (Next rewrite → Flue :5173)
        │                         │
        │                         ▼
        │                   Cala REST (server-only)
        │                         │
        ├◄── overlayFromDossiers ─┤
        │     (grey until ownerColor)
        │                         │
        │                         ▼
        │              Satellite Flue agent
        │              (dossier tool, no Tavily)
        │                         │
        ▼                         ▼
   HUD / inspector          Cited chat pane
```

- **web** (`:3000`) — Next.js UI, orbit cache route, same-origin rewrites. Never holds `CALA_API_KEY`.
- **agent** (`:5173`) — Flue process: Cala REST adapter, bulk enrich, satellite + assistant agents.
- Browser talks only to Next. Next rewrites `/api/satellites/*` and `/api/agents/*` to Flue (`FLUE_SERVER_URL`, default `http://localhost:5173`).

## Data contracts

### CelesTrak catalog (`GET /api/orbits`)

Slim OMM JSON parsed by `json2satrec` (not legacy TLE — six-digit NORAD IDs overflow TLE’s fixed width).

`OrbitCatalogResponse`: `{ records: SlimOmm[], fetchedAt, cachedUntil, source: "live" | "cache" | "stale", stale, dropped, error? }`.

### Visible payload (worker → globe)

Emitted only when observer elevation is **strictly greater than 0°**. Inspector fields (`altitudeKm`, `elevationDeg`, …) are physical; `displayRadius` is a compressed scene scale so LEO/MEO/GEO stay readable on one globe.

### Enrichment (`POST /api/satellites/enrich`)

Body: `{ selectedNoradId?, satellites: [{ noradId, name?, constellation? }] }` (max 120). Selected NORAD is resolved first.

Response: `{ dossiers: SatelliteDossier[], skipped: string[], halted?, error? }`.

`SatelliteDossier` keeps Cala provenance on each field (`value` + `sources[]` with name, URL, date) and `evidenceState`: `verified` | `partial` | `unknown`.

### Globe overlay

`overlayFromDossiers` maps dossiers to `SatelliteOverlayMap`. Dots stay the unknown grey (`#94a3b8`) until `ownerColor` is set. Headline counter is **top verified ultimate-parent count / all visible payloads** — unknowns remain in the denominator.

### Chat session (`web/lib/sessions.ts`)

Satellite sessions persist `noradId` and observer `city` (id or display name). Opening a saved session restores globe selection through `useSkySelection`.

## Source policy

Two-source join, never mixed:

| Source | Proves |
| --- | --- |
| CelesTrak | Object identity: NORAD ID, name, constellation membership, geometry |
| Cala | Operator, ultimate parent, country, purpose, corporate relationships — only when a property/relationship carries a source |

Anything without Cala evidence is `unknown`. The model must not infer ownership from the catalog name (no Starlink→SpaceX shortcuts). Satellite chat has no Tavily/`web_search` tool. Empty Cala evidence yields exactly: `No verified Cala data found`.

## Catalog (local)

Hackathon demo ships a CelesTrak `GROUP=stations` snapshot (`web/lib/orbit/seed/barcelona-omm.json`, ~22 objects, epoch 2026-08-29). No runtime CelesTrak fetch and no 2h cache. SGP4 still runs at 1 Hz over **Barcelona**; HUD **Above city** is the default.

## Cala failure discipline

Implemented in the Flue adapter (`agent/src/lib/cala.ts`) and surfaced to the HUD:

- Client timeout budget **180s**. Timeout retries the **identical** request **once**, then halts.
- **429**, unreachable, and unconfigured halt immediately — no further batches this session.
- Empty rows are not a halt; they stay `unknown`. “Query too complex” is distinct from empty; simplify once where the adapter already does so. Do not silently fall back to model knowledge.
- The globe HUD shows an amber banner when enrichment halts (`rate_limited` / `timeout` / `unreachable` / `unconfigured`). Grey dots and the unknown denominator remain valid UI.

`CALA_API_KEY` is read only by the Flue process (`agent/.env`). It is not a `NEXT_PUBLIC_*` var and is not sent to the browser.

## Setup

See the root [README](../README.md). Defaults: web `http://localhost:3000`, agent `http://localhost:5173`. Copy `agent/.env.example` → `agent/.env` and set a model key plus `CALA_API_KEY`.

## Attribution

- **CelesTrak** — GP (OMM) `GROUP=stations` snapshot committed as `barcelona-omm.json`. Not fetched at runtime.
- **Cala** — verified entity graph, [cala.ai](https://cala.ai/). Ownership, parent, country, and purpose in the inspector and chat are Cala-sourced when present.

## Known limitations

- Observer is Barcelona only.
- Cala typically has constellation/operator/company entities, not a row per NORAD ID; many payloads share one dossier template.
- Enrichment is progressive and budgeted; a halt leaves remaining dots grey until the page is reloaded.
- Without `CALA_API_KEY`, enrich returns `unconfigured`; chat cannot cite ownership.
- Display altitude is compressed; inspector altitude is the real value.
- The globe is [COBE](https://cobe.vercel.app): lat/lon markers (far side fades), not true 3D orbits. Marker count is capped so the canvas stays light; the HUD still counts every visible payload.
- Orbit worker is 1 Hz; horizon membership changes as objects rise and set.
- Satellite agent is pinned to one NORAD ID per conversation.
- General assistant may use Tavily `web_search`; satellite agent must not.
