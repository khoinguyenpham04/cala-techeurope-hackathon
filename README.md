# Skyla

Orbit is infrastructure. Skyla makes it teachable.

A live globe of real satellites. Click one. Ask why it exists, when it was built, what it does. Skyla answers with a story card — sourced facts, photos, and generated video — so you see the object, not a spreadsheet of numbers.

## Product

- Live globe: who is up there, right now
- One question → one card: why it was built, its history, or what it does
- History plays as short videos, year by year
- Every claim carries a source

Try it: pick the ISS, then ask *When was this built?*

## Setup

Two processes. Install at the repo root, then each app:

```sh
npm install
cd agent && npm install
cd ../web && npm install
```

Copy env:

```sh
cp agent/.env.example agent/.env
cp web/.env.example web/.env.local
```

Then run:

```sh
# terminal 1 — Skyla agent
cd agent && npm run dev          # http://localhost:5173

# terminal 2 — Skyla web
cd web && npm run dev            # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000). The web app talks to the agent through `/api/agents/*` and `/api/satellites/*`. Set `FLUE_SERVER_URL` if the agent is not on `:5173`.

## Environment variables

Keys live in `agent/.env`. That is the brain of Skyla.

| Variable | Where | What it unlocks |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | agent | Claude models ([Pi providers](https://pi.dev/docs/latest/providers#api-keys)) |
| `GEMINI_API_KEY` | agent | Gemini models |
| OpenAI key (Pi) | agent | Default model `openai/gpt-5.6-luna` |
| `CALA_API_KEY` | agent | Sourced ownership, country, purpose — [console.cala.ai/api-keys](https://console.cala.ai/api-keys) |
| `TAVILY_API_KEY` | agent | Live web sources and photos for every story card |
| `FAL_KEY` | agent | History-reel video (MiniMax H3 Max) |
| `FLUE_SERVER_URL` | web | Agent origin. Default `http://localhost:5173` |

## APIs and tools

| Tool | What Skyla gets |
| --- | --- |
| [CelesTrak](https://celestrak.org/) | Live-quality orbits — who is up there, and where |
| [Cala](https://docs.cala.ai/) | Verified operator, parent, country, purpose, citations |
| [Flue](https://flueframework.com) | Durable `assistant` and `satellite` agents |
| [satellite.js](https://github.com/shashwatak/satellite-js) | Positions updated every second |
| [COBE](https://cobe.vercel.app) | Fast WebGL globe |
| Tavily | Web sources and images for the cards |
| MiniMax on [fal](https://fal.ai) | History videos, year by year |

CelesTrak · Cala · Flue · COBE · MiniMax (fal)
