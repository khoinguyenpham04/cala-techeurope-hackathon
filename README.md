# Skyla

Orbit is infrastructure. Skyla makes it teachable.

A live globe of real satellites. Click one. Ask why it exists, when it was built, what it does. Skyla answers with a story card — sourced facts, photos, and generated video — so you see the object, not a spreadsheet of numbers.

## Product

- Live globe: who is up there, right now
- One question → one card: why it was built, its history, or what it does
- History plays as short videos, year by year
- Every claim carries a source

Try it: pick the ISS, then ask *When was this built?*

## Run

```sh
cd agent && npm install && npm run dev   # :5173
cd web && npm install && npm run dev     # :3000
```

Open [localhost:3000](http://localhost:3000). Put API keys in `agent/.env` only (a model key, `CALA_API_KEY`, and `FAL_KEY` for video).

## Stack

CelesTrak · Cala · Flue · COBE · MiniMax (fal)
