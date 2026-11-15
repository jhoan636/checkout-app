# Product Checkout

[![CI](https://github.com/jhoan636/checkout-app/actions/workflows/ci.yml/badge.svg)](https://github.com/jhoan636/checkout-app/actions/workflows/ci.yml)

Single-product store with a credit card checkout. The customer sees the product and its stock, enters card and delivery data, reviews a payment summary, pays through an external payment gateway (sandbox) and gets the final status. Stock is updated once the payment is resolved.

> Work in progress. Sections marked _TBD_ are completed as each feature lands.

## Repository layout

| Folder | Content |
|---|---|
| `api/` | REST API in NestJS + TypeScript, hexagonal architecture (ports and adapters) and Railway Oriented Programming |
| `web/` | SPA in React + TypeScript + Redux Toolkit, mobile first |
| `infra/` | AWS infrastructure as code (CDK), added with the deployment |

Each app is independent: its own `package.json`, tests and deployment.

## Checkout flow

1. Product page
2. Credit card and delivery info
3. Payment summary
4. Final status
5. Back to the product page with updated stock

## Deployed app

_TBD_

## API documentation

_TBD_

## Data model

_TBD_

## Test coverage

Every pull request runs lint, build and unit tests for `api/` and `web/` in GitHub Actions. The run fails if coverage drops below 80% in statements, branches, functions or lines.

Coverage results: _TBD_

## Running locally

Requirements: Node 22 and Docker.

### API

```bash
cd api
npm install
cp .env.example .env   # then set DB_PASSWORD
npm run db:up          # PostgreSQL in Docker, on port 5433
npm run start:dev      # http://localhost:3000/health
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests |
| `npm run test:cov` | Unit tests with coverage (fails under 80%) |
| `npm run test:e2e` | End-to-end tests, needs the database running |
| `npm run db:down` | Stops the database |

### Web

_TBD_

## Security

- Card data is tokenized directly from the browser with the gateway public key; the card number never reaches this backend.
- Private keys and secrets live only in environment variables, never in the repository.
