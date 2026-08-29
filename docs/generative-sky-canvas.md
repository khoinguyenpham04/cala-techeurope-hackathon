# Generative Sky Page

The right pane is a **Notion-like Lexical document**, not a transcript-first chat and not a flowchart. The composer stays. Sending a lesson prompt **appends or updates stacked blocks** (headings, quotes, lists, Verified/Unverified callouts) on a page for the selected satellite. Chat is the input device; the page is the lesson.

This sits on top of the existing Sky Console ([mvp-technical-spec.md](./mvp-technical-spec.md)). It does not replace the globe, OMM worker, or Cala enrich path. Telemetry stays on the globe — the page does not mount a live strip.

Stack: first-party `lexical` + `@lexical/react`, with `@lexical/rich-text`, `@lexical/list`, `@lexical/link`, and `@lexical/markdown`. Do **not** default to xyflow / React Flow for this pane. Do **not** invent museum photography — images only later, and only as optional URLs that already arrived from Cala or other cited context.

## Why a page, not a canvas or a chat

A transcript hides structure: operator, parent, country, purpose, and sources are **claims**. Learners should see unknown as an Unverified empty callout, not as a paragraph that quietly omits the gap. A graph of wires is the wrong metaphor for a dossier. Stacked blocks (title, section, callout) match how the evidence is read.

## Three layers (never block telemetry on AI)

```
1. Telemetry          2. Verified claims        3. Story page
CelesTrak OMM    →    Cala dossier         →    Lexical blocks
satellite.js          overlay / enrich          generated from (2)
globe click           empty = unknown           + optional knowledge_search
never waits on AI     sources on every claim    unverified badge if none
```

| Layer | Proves | May wait on | Must not |
| --- | --- | --- | --- |
| **Telemetry** | Identity and geometry: NORAD, name, constellation membership, lat/lon/alt | CelesTrak + worker only | Stall the globe, worker, or click-to-select for Cala or the model |
| **Verified claims** | Operator, ultimate parent, country, purpose, corporate links | Cala enrich / `lookup_satellite_dossier` | Infer Starlink→SpaceX from the catalog name; mix Tavily into satellite |
| **Story page** | A lesson assembled from (2), plus optional open-ended Cala search | Model, only after (2) exists or is explicitly unknown | Invent facts, photos, or sources; remount `web_search` on the satellite agent |

CelesTrak identity is **catalog context**, not ownership evidence. Cala-sourced fields are the only ownership claims. Missing Cala → callout tone `unverified`, empty body. Catalog seed paint on the globe (`seeded: true`) is **not** Cala evidence: the page must not show those seed names as operator/parent/purpose.

`knowledge_search` (`cala_knowledge_search`) is allowed **only** for genuinely open-ended “teach me” follow-ups about an entity already in the dossier (e.g. launch funding). Empty search → the existing empty-Cala sentence. Satellite agent stays Cala-only — no Tavily / `web_search`.

## Right pane layout

```
┌─ header (title, NORAD, Ready, Log) ─────────┐
│                                             │
│   Lexical page (flex-1, scroll)             │
│   Title · catalog callout                   │
│   Who / Why / Country / Purpose callouts    │
│   Lesson blocks when the user has asked     │
│                                             │
├─────────────────────────────────────────────┤
│   ChatComposer (lesson prompt)              │
└─────────────────────────────────────────────┘
```

- The document fills the pane. Composer is sticky chrome at the bottom (same `ChatComposer` as today).
- The long transcript is behind a **Log** toggle. Default is page-first.
- Selecting a satellite **seeds** the page immediately from overlay/dossier already in the app. Enrichment arriving later updates callouts in place. The globe does not wait.
- Generated page is **read-only** for MVP (light local edits are not persisted).

## Cala → blocks

When a NORAD is selected, seed these blocks from catalog + `SatelliteOverlay` / latest `lookup_satellite_dossier` output:

| Block | id | Source | If missing |
| --- | --- | --- | --- |
| **Title** (h1) | `title` | CelesTrak name | Always present once selected |
| **Catalog** callout | `identity` | NORAD + CelesTrak GP URL | Always present once selected. Tone `catalog`, never `verified`. |
| **Constellation** callout | `constellation` | Catalog name prefix (`constellationFromName`) | Omitted (not a Cala claim) |
| **Who** (h2) + **Operator** callout | `who`, `operator` | Cala overlay / dossier `operator` | Tone `unverified`, body “No verified operator” |
| **Why** (h2) + **Ultimate parent** callout | `why`, `parent` | Cala overlay / dossier `ultimateParent` | Tone `unverified`, body “No verified ultimate parent” |
| **Country** (h2) + callout | `country-heading`, `country` | Cala overlay / dossier `country` | Tone `unverified`, body “No verified country” |
| **Purpose** (h2) + callout | `purpose-heading`, `purpose` | Cala overlay / dossier `purpose` | Tone `unverified`, body “No verified purpose” |

Claim callouts (operator, parent, country, purpose) **must** carry Cala source URLs to use tone `verified`. Object/constellation/identity are labeled **catalog**, not Cala-verified. `seeded: true` overlay values are ignored for claims.

Verified callout: value + source name / date / URL. Unverified: empty-state copy, no invented name.

No generated imagery. Live telemetry stays on the globe.

## Agent page JSON (phase B)

After a sourced markdown answer, the satellite agent **may** append a fenced `story-page` JSON block. It must **not** emit that fence when the reply must be exactly the empty-Cala sentence.

```json
{
  "blocks": [
    {
      "id": "operator",
      "type": "callout",
      "tone": "verified",
      "title": "Operator",
      "body": "…",
      "sources": [{ "name": "…", "url": "https://…" }]
    }
  ]
}
```

`type`: `heading` | `paragraph` | `quote` | `list` | `callout`  
`tone`: `verified` | `unverified` | `catalog`

The client merges this into the seed page (stable ids `operator`, `parent`, `country`, `purpose`, `constellation`). Unknown ids become extra blocks above the Lesson heading. The markdown **before** the fence is converted with `@lexical/markdown` into heading / quote / list / paragraph / link nodes and appended under **Lesson**.

Legacy `story-graph` fences are still parsed and mapped onto the same callout ids (edges are ignored).

Phase B is **thin**: schema + parser + merge + optional agent fence. The model is not required to emit JSON for the page to be useful; overlay seed + Lesson markdown already make it a document.

## Lesson cards (phase C — later)

Generative lesson cards (worked examples, “why this orbit”, quizzes) as additional block types, still citing Cala or marked unverified. Still no invented photography. Optional image URLs only from cited Cala/context.

## Phased delivery

| Phase | Ship | Out of scope |
| --- | --- | --- |
| **A** | Lexical page shell in the right pane; seed callouts from existing overlay/dossier; composer under the page; Log toggle hides the transcript | Globe/HUD/camera rewrites; React Flow in this pane |
| **B** | Structured story-page JSON schema; parse + merge from the satellite agent; Lesson markdown → Lexical blocks | Remounting Tavily; forcing JSON on empty Cala |
| **C** | Generative lesson cards driven by (2) + optional `knowledge_search` | Stock photos, unsourced claims |

## Implementation map

| Piece | Where |
| --- | --- |
| Plan (this doc) | `docs/generative-sky-canvas.md` |
| Page types, seed, JSON parse | `web/lib/sky/story-page.ts` |
| Legacy graph fence parser | `web/lib/sky/story-graph.ts` |
| Lexical page | `web/components/sky/sky-story-canvas.tsx`, `story-page-editor.tsx` |
| Callout decorator | `web/components/sky/nodes/callout-node.tsx` |
| Blocks → Lexical | `web/components/sky/page-to-lexical.ts` |
| Pane split | `web/components/chat/chat-workspace.tsx`, `new-chat.tsx` |
| Satellite agent (Cala-only, optional fence) | `agent/src/agents/satellite.ts` |

Telemetry, enrich, and overlay mapping stay on the existing path. Adding `country` to `SatelliteOverlay` is page data only — globe dots still key off `ownerColor`.
