# agent

A [Flue](https://flueframework.com) agent project.

## Setup

```sh
npm install
```

Then add a model provider API key to `.env` (any [provider Pi supports](https://pi.dev/docs/latest/providers#api-keys)).

For satellite enrichment and grounded chat, also set `CALA_API_KEY` in `.env` (see `.env.example`). The key is read only by this process. For Cursor MCP inspection, put `"X-API-KEY": "${env:CALA_API_KEY}"` in `~/.cursor/mcp.json` — never a literal secret, and never in this repo.

## Talk to your agent

```sh
npx flue run src/agents/assistant.ts --message "Say hello!"
```

Conversations are durable — pass `--id <id>` to continue one.

## Develop

```sh
npm run dev
```

The Assistant is served at `http://localhost:5173/agents/assistant` — see `src/app.ts` for the route map and an example request.

## Deploy

```sh
npm run build
node dist/server.mjs
```

## Learn more

- [Flue docs](https://flueframework.com/docs/) — or `npx flue docs` from the terminal.
