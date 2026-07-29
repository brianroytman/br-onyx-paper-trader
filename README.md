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
- **Live market data** — all 5,046 markets Onyx exposes are browseable, with search and
  status filtering. Prices refresh in the UI on a three-second cycle and flash green or red
  as they move.
- **Paper orders** — market orders on either side of any open, priced market, filled
  instantly at the price the server fetches at execution time.
- **Account state** — every account starts with a $1,000 paper balance. Positions, average
  entry price, unrealized P&L, and total equity are tracked against the latest prices.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast build, minimal config |
| Backend | NestJS | Clear module boundaries, DI, first-class TypeScript |
| Database | Postgres + Prisma 7 | Real transactions — the core requirement for order execution |
| Auth | Firebase Authentication | No password handling in application code |
| Deployment | Google Cloud Run | One container, one URL |

The Nest server also serves the compiled React bundle, so the whole application ships as a
single container — one deployment target instead of two, and no CORS configuration.

## Architecture

```
React SPA (served by Nest)
      │  Firebase ID token
      ▼
NestJS on Cloud Run
  ├── auth/        token verification, lazy user provisioning
  ├── markets/     Onyx client, response normalizer, 5s snapshot cache
  ├── orders/      live price lookup, transactional execution
  └── portfolio/   valuation, unrealized P&L
      │
      ├──▶ Postgres              (source of truth)
      └──▶ Onyx Predictions API  (prices, read-only, never persisted)
```

Business logic lives in two pure modules — `orders/order.math.ts` and
`portfolio/portfolio.math.ts` — that take values and return values. They hold every rule
about money and are tested directly, with no mocks and no database.

## Running locally

Requires Node 24 and npm.

```bash
npm install && npm install --prefix client
```

Set the server environment in `.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `GOOGLE_CLOUD_PROJECT` | Firebase Admin project resolution |

And the Firebase web config in `client/.env` — public by design, shipped in the bundle:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_APP_ID`.

```bash
npx prisma migrate dev
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

## Data model

Three tables. **All monetary values are integer cents — never floating point.**

| Model | Key fields |
|---|---|
| `User` | `uid` (Firebase, unique), `email`, `cashCents` |
| `Order` | `userId`, `marketId`, `marketName`, `side`, `quantity`, `fillPriceCents`, `totalCents` |
| `Position` | composite key `(userId, marketId, side)`, `quantity`, `totalCostCents` |

- One `Order` row is both the order and its fill. Every order fills instantly, so a separate
  `Fill` entity and a status column would model states this system cannot enter.
- `marketName` is denormalized onto `Order` and `Position` so history and holdings render
  without a round trip to Onyx.
- YES and NO on the same market are separate positions — correct and simple for a buy-only
  system.
- Average entry price is derived as `totalCostCents / quantity` rather than stored, so the
  two can never disagree.

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/markets` | — | All markets, with search, status filter, and paging |
| `GET` | `/api/markets/:id` | — | A single market |
| `POST` | `/api/orders` | ✅ | Place a market order |
| `GET` | `/api/portfolio` | ✅ | Cash, positions with P&L, equity, recent orders |
| `GET` | `/api/me` | ✅ | Account summary |
| `GET` | `/api/health` | — | Liveness |

Market browsing is intentionally public — prediction-market venues let visitors look before
signing up, and it keeps the read path free of auth concerns.

```json
POST /api/orders
{ "marketId": "3983c5e4-…", "side": "YES", "quantity": 10 }
```

Note the absence of a price field. That omission is the security property.

## Order execution

Four invariants hold:

| Invariant | Enforced by |
|---|---|
| The client cannot influence fill price | Price is absent from the request; the server fetches it |
| No account can overdraw | Balance verified *inside* the transaction |
| No partially applied order | Balance, order, and position commit in one Prisma transaction |
| No fills at stale prices | The execution path bypasses the browse cache |

Validate the request, fetch the live quote from Onyx, then open a transaction that verifies
the balance, decrements cash, inserts the order, and upserts the position. Any failure rolls
the whole thing back, so an account is never left half-updated.

Rejected with `400`: non-integer or non-positive quantities, closed markets, unpriced
markets, and insufficient funds.

## Live pricing

Prices refresh every three seconds in the UI, served from a five-second server-side
snapshot. Concurrent requests share a single in-flight fetch, so upstream traffic is a
function of the cache TTL rather than of how many browsers are open. If Onyx blips, the last
good snapshot is served rather than failing the page.

Search and filtering run server-side against that snapshot — with ~5,000 markets, shipping
the full list every three seconds would be several hundred kilobytes per poll.

## Testing

```bash
npm test
```

42 tests, all against pure functions — order cost, YES/NO price selection, quantity
validation, position merging, weighted average entry, market value, unrealized P&L, total
equity, and upstream response mapping. No mocks, no database, no network.

Notably `toCents` has a test for IEEE 754 error: `0.29 * 100` is `28.999999999999996`.

## Deployment

Single Cloud Run service built from the Dockerfile, which installs both dependency trees,
generates the Prisma client, builds the React bundle, and compiles the API.

```bash
npx prisma migrate deploy
```

```bash
gcloud run deploy br-onyx-paper-trader --source . --allow-unauthenticated --min-instances=1 \
  --set-env-vars "DATABASE_URL=…,GOOGLE_CLOUD_PROJECT=…"
```

Migrations run from a workstation, never from the container entrypoint — concurrent
instances would race, and a bad migration would become a crash loop rather than a failed
command with an intact previous revision.

## Design decisions and trade-offs

**Server-authoritative pricing.** The order endpoint accepts no price. Any client-supplied
price would be a trivially exploitable way to buy at whatever number the user typed.

**One transaction per order.** The alternative — sequential writes with compensating logic —
has a window where money has left an account without a position existing.

**Integer cents everywhere.** Floating-point money accumulates representation error under
repeated arithmetic, and this system does nothing but repeated arithmetic on money.

**Polling over WebSockets.** Freshness is bounded by how often *we* poll Onyx, so pushing to
the browser would add a hop without adding freshness. The server-side cache already makes
upstream traffic independent of client count. A server-side poller fanning out over SSE is
the better architecture at scale and is the natural next step.

**NO price is derived, not fetched.** Onyx exposes only `yes_price`. These are binary
contracts settling at 100¢, so NO is its complement. Many markets return `null`; those are
surfaced as unpriced and are not tradable.

**Fills use the bid, and that is a simplification.** `/markets/{symbol}` returns
`yes_price: null` for every market — only the list endpoint populates it — so fills are
priced from `/markets/{symbol}/prices`, whose `bid_price` matches what the list reports and
therefore what the user was shown. A real venue would fill a buyer at the ask; modelling the
spread properly is the first thing I would fix.

**One container, not two.** A separate static host plus an API service means two deployments,
CORS, and two sets of environment variables — at the cost of coupling frontend and backend
release cadence, which is irrelevant here.

**Managed Postgres over Cloud SQL.** Identical engine and transactional guarantees, no VPC
connector to provision inside the time budget. The connection uses the pooler endpoint; the
direct endpoint is IPv6-only and unreachable from Cloud Run.

## Not implemented

Out of scope for the time budget, roughly in the order I would add them:

1. **Fill at the ask rather than the bid** — the spread is available and currently ignored
2. **Sell orders and position closing** — the largest functional gap; needs realized P&L
3. **Idempotency keys on order submission** — a double-clicked Confirm places two orders
4. **Server-side price poller with SSE** — decouples upstream rate from client count
5. **Limit orders** — needs a resting-order model and a matching pass
6. **Integration and end-to-end tests** — only unit-level tests exist
7. **Secret Manager** — secrets are Cloud Run environment variables today
8. **CI pipeline** — no automated build or test gate

## Notes on the exercise

Cloud accounts and local toolchain — GCP project, Firebase, Postgres, Node, Docker — were
provisioned before the first commit. No application code was written before the clock
started; the first commit is an empty marker at the moment work began.
