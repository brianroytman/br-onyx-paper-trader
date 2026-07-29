# Onyx Paper Trading Simulator

Paper trading for prediction markets. Log in, browse live markets from the Onyx
Predictions API, and buy YES or NO. Orders fill right away at the current upstream price.

No order is ever sent to Onyx. Orders, fills, positions, and balances all live in this
app's own database. Onyx is read-only, and only for prices.

**Live:** https://br-onyx-paper-trader-564764484340.us-central1.run.app

## What it does

- Sign up and log in with email and password. Each account has its own balance, orders,
  and positions.
- Browse all 5,046 markets Onyx exposes, with search plus league and status filters.
  Prices refresh every 3 seconds and flash green or red when they move.
- Buy YES or NO on any open market that has a price.
- Start with $1,000. Track positions, average entry, unrealized P&L, and total equity.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React, Vite, TypeScript |
| Backend | NestJS |
| Database | Postgres with Prisma 7 |
| Auth | Firebase Authentication |
| Hosting | Google Cloud Run |

Nest also serves the built React bundle, so the whole app is one container and one URL.
No CORS setup, one thing to deploy.

## Architecture

```
React SPA (served by Nest)
      │  Firebase ID token
      ▼
NestJS on Cloud Run
  ├── auth/        verify token, create user on first request
  ├── markets/     Onyx client, mapper, 5s cache
  ├── orders/      price lookup, transactional fill
  └── portfolio/   valuation and P&L
      │
      ├──▶ Postgres              (source of truth)
      └──▶ Onyx Predictions API  (prices, read-only)
```

The money math lives in `orders/order.math.ts` and `portfolio/portfolio.math.ts`. Both are
plain functions with no database or network calls, which is why they are easy to test.

## Running locally

Needs Node 24.

```bash
npm install && npm install --prefix client
```

Put `DATABASE_URL` and `GOOGLE_CLOUD_PROJECT` in `.env`, and the four `VITE_FIREBASE_*`
values in `client/.env`. The Firebase web config is public by design and ships in the
bundle.

```bash
npx prisma migrate dev
```

Two terminals for development. API on `:8080`, client on `:5173` proxying `/api`:

```bash
npm run start:dev
```

```bash
npm run dev --prefix client
```

To run it the way it runs in production, as one process:

```bash
npm run build --prefix client && npm run build && node dist/main.js
```

## Data model

Three tables. All money is stored as integer cents, never as a float.

| Model | Key fields |
|---|---|
| `User` | `uid` (Firebase, unique), `email`, `cashCents` |
| `Order` | `userId`, `marketId`, `marketName`, `side`, `quantity`, `fillPriceCents`, `totalCents` |
| `Position` | key `(userId, marketId, side)`, `quantity`, `totalCostCents` |

- An `Order` row is also the fill. Every order fills instantly, so a separate `Fill` table
  and a status column would describe states this app can't reach.
- `marketName` is copied onto `Order` and `Position` so history renders without calling
  Onyx again.
- YES and NO on the same market are separate positions.
- Average entry is calculated as `totalCostCents / quantity` instead of being stored, so
  the two can't drift apart.

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/markets` | no | Markets, with search, league and status filters, paging |
| `GET` | `/api/markets/:id` | no | One market |
| `POST` | `/api/orders` | yes | Place an order |
| `GET` | `/api/portfolio` | yes | Cash, positions, P&L, equity, recent orders |
| `GET` | `/api/me` | yes | Account summary |
| `GET` | `/api/health` | no | Liveness |

Browsing is public. Most prediction market sites let you look before signing up.

```json
POST /api/orders
{ "marketId": "3983c5e4-…", "side": "YES", "quantity": 10 }
```

There is no price field. That is the point.

We read two Onyx endpoints and write to none. `GET /markets` gives the catalog, 1,000 per
page with no total, so we page until a short page comes back.
`GET /markets/{symbol}/prices` gives the quote used to fill an order. Onyx has a
`POST /orders`, and we never call it.

## Live prices

The UI polls every 3 seconds. The server keeps a 5-second snapshot, and requests arriving
at the same time share one upstream fetch, so traffic to Onyx doesn't grow with the number
of users.

The catalog is loaded at startup and served stale-while-revalidate. Only the first call
after boot waits. After that a stale snapshot refreshes in the background instead of making
someone wait for it. Paging through 5,046 markets takes a few seconds, so doing that on the
request path would stall about every other poll. If a refresh fails, the old snapshot stays.

Search and filters run on the server against that snapshot, so the browser gets one page
instead of a few hundred kilobytes every poll.

## Order execution

| Rule | How it holds |
|---|---|
| The client can't set the fill price | No price in the request. The server fetches it. |
| No account can go negative | Balance checked inside the transaction |
| No half-finished order | Balance, order, and position commit together |
| No fills on stale prices | The order path skips the browse cache |

Validate the request, get the live quote, then open one transaction that checks the
balance, subtracts the cash, inserts the order, and updates the position. If anything
fails, all of it rolls back.

Returns `400` for fractional or zero quantities, closed markets, markets with no price, and
not enough cash.

## Testing

```bash
npm test
```

44 tests over the plain functions: order cost, YES/NO price selection, quantity checks,
position merging, weighted average entry, market value, unrealized P&L, total equity, and
mapping the Onyx response. No mocks, no database.

One of them covers float error. `0.29 * 100` is `28.999999999999996` in JavaScript, which
is why prices are converted to cents at the edge and kept as integers after that.

## Deployment

One Cloud Run service, built from the Dockerfile.

```bash
npx prisma migrate deploy
```

```bash
gcloud run deploy br-onyx-paper-trader --source . --allow-unauthenticated --min-instances=1 \
  --set-env-vars "DATABASE_URL=…,GOOGLE_CLOUD_PROJECT=…"
```

Migrations run from a laptop, not from the container start command. Several instances
starting at once would race, and a bad migration would turn into a crash loop instead of a
failed command with the old revision still up.

## Decisions

**The server owns the price.** If the client could send a price, it could buy at any number
it wanted.

**One transaction per order.** Writing the three rows separately leaves a window where the
cash is gone but the position doesn't exist yet.

**Integer cents.** Float math drifts, and this app does almost nothing but math on money.

**Polling, not WebSockets.** Prices are only as fresh as our own polling of Onyx, so
pushing to the browser would add a hop without adding freshness. A server-side poller with
SSE would be better at scale and is the obvious next step.

**League comes from the symbol.** Onyx reports `sport: "OTHER"` on almost everything, so
that field is no use for filtering. The symbol has the league in it
(`NX.F.OPT.MLB-00001-2026.O.1.10`), so it gets parsed in the mapper. The dropdown options
come from the data, currently MLB and WNBA.

**NO is derived.** Onyx only gives `yes_price`. These are binary contracts that settle at
100¢, so NO is 100 minus YES. Plenty of markets have no price at all, and those show as
unpriced and can't be traded.

**Fills use the bid, which is a shortcut.** `/markets/{symbol}` returns `yes_price: null`
for every market, so fills are priced from `/markets/{symbol}/prices`. Its `bid_price` is
the same number the list shows, so the fill matches what the user saw. A real venue would
fill a buyer at the ask. Fixing that is first on the list below.

**One container, not two.** Splitting the frontend onto static hosting means two deploys,
CORS, and two sets of env vars.

**Hosted Postgres instead of Cloud SQL.** Same engine, same transactions, no VPC connector
to set up inside the time limit. It connects through the pooler, because the direct
endpoint is IPv6 only and Cloud Run can't reach it.

## What I'd do next

1. Fill at the ask instead of the bid. The spread is right there and currently ignored.
2. Sell orders and closing positions. This is the biggest missing piece and needs realized
   P&L.
3. Idempotency keys on orders. The Confirm button disables while a request is in flight,
   but a retry after a timeout could still double fill.
4. Server-side price poller with SSE.
5. Limit orders, which need resting orders and a matching step.
6. Integration and end-to-end tests. Right now it's only unit tests.
7. Secret Manager instead of env vars on the service.
8. CI.

## Note on the exercise

Cloud accounts and local tooling (GCP project, Firebase, Postgres, Node, Docker) were set
up before the first commit. No application code was written before the clock started. The
first commit is an empty one marking the start.
