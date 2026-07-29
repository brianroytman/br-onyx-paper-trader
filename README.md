# Onyx Paper Trading Simulator

A paper-trading application for prediction markets. Authenticated users browse live
markets from the Onyx Predictions API and place simulated buy-YES / buy-NO orders that
fill instantly at the current upstream price.

**Nothing executes against the upstream venue.** Every order, fill, position, and balance
is recorded in this application's own database. Onyx is read-only — the source of truth
for prices, and nothing else.

**Live:** https://br-onyx-paper-trader-564764484340.us-central1.run.app

## What it does

- **Authentication** — email/password sign-up and login. Each account has its own balance,
  order history, and positions.
- **Live market data** — every market exposed by the Onyx API is browsable, with search and
  status filtering. Prices refresh in the UI on a three-second cycle.
- **Paper orders** — market orders on either side of any open market, filled instantly at
  the current upstream price for that side.
- **Account state** — every account starts with a $1,000 paper balance. Positions, average
  entry price, unrealized P&L, and total equity are tracked against the latest prices.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast build, minimal config |
| Backend | NestJS | Clear module boundaries, DI, first-class TypeScript |
| Database | Postgres + Prisma | Real transactions — the core requirement for order execution |
| Auth | Firebase Authentication | No password handling in application code |
| Deployment | Google Cloud Run | One container, one URL, scales to zero |

The Nest server also serves the compiled React bundle, so the whole application ships as a
single container. One deployment target instead of two, and no CORS configuration.

## Design principles

These drive most of the decisions below, and are expanded on as the pieces land:

- **The server owns pricing.** The order endpoint accepts no price. Fill prices are fetched
  server-side at execution time, so a client cannot influence what it pays.
- **Orders are atomic.** Cash, order, and position are written in a single database
  transaction. An account is never left partially updated.
- **Postgres is the source of truth** for everything this app owns. Market prices are never
  persisted — Onyx remains authoritative.
- **Upstream shape stops at the boundary.** Onyx responses are normalized into an internal
  type, so their schema never reaches our API or UI.
- **Money is never a float.** All monetary values are stored as integers in minor units.

## Architecture

```
React SPA (served by Nest)
      │  Firebase ID token
      ▼
NestJS on Cloud Run
  ├── auth/        token verification, lazy user provisioning
  ├── markets/     Onyx client, response normalizer, short-lived cache
  ├── orders/      price lookup, transactional execution
  └── portfolio/   valuation, unrealized P&L
      │
      ├──▶ Postgres              (source of truth)
      └──▶ Onyx Predictions API  (prices, read-only, never persisted)
```

## Build plan

- [x] Scaffold NestJS API and React client
- [x] Containerize and deploy to Cloud Run
- [ ] Integrate and normalize Onyx market data
- [ ] Firebase authentication and Postgres persistence
- [ ] Transactional order execution
- [ ] Portfolio valuation and order history

## Running locally

Requires Node 24 and npm.

```bash
npm install && npm install --prefix client
```

Development — two terminals. API on `:8080`, client on `:5173` proxying `/api`:

```bash
npm run start:dev
```

```bash
npm run dev --prefix client
```

Production shape — one process serving both, identical to the deployed container:

```bash
npm run build --prefix client && npm run build && node dist/main.js
```

## Deployment

Built from the Dockerfile and deployed as a single Cloud Run service:

```bash
gcloud run deploy br-onyx-paper-trader --source . --allow-unauthenticated --min-instances=1
```

The image installs both dependency trees, builds the React bundle, compiles the API, and
runs one Node process that serves the bundle at the root and the API under `/api`.

`--min-instances=1` keeps one warm instance so the first request doesn't pay a cold start.
