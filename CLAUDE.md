# Product Checkout — project rules

Single-product store with a credit card checkout paid through an external payment gateway (sandbox). Two independent apps in one repository: `api/` (NestJS) and `web/` (React).

## Hard rules

- Never write the payment company's name anywhere in this repository (code, comments, docs, commit messages, file names). Call it "payment gateway".
- Never commit secrets. Gateway URLs and keys come only from environment variables; `.env.example` holds placeholders.
- Never store or log card numbers, CVC or expiry dates. The browser tokenizes the card with the gateway public key; the API only receives the token.
- Tests are written with Jest, in the same step as the code they cover. Coverage must stay above 80% in `api/` and `web/`.
- TDD for business logic (domain rules, use cases, validators, reducers): write the failing test first, then the minimum code to pass, then refactor. Configuration, database adapters and styles are tested alongside the code.
- Unit tests never touch a real database or the network; they use in-memory fakes of the ports.
- All code, comments, docs and commit messages are in English.
- Do not run `git commit` or `git push`. The repository owner commits; propose a Conventional Commits message instead (`feat(api): ...`, `feat(web): ...`, `test: ...`, `chore: ...`, `docs: ...`).
- Work in small steps. Finish one step, run its tests, and stop for review before starting the next.

## API (`api/`)

- NestJS 11, TypeScript strict, PostgreSQL with TypeORM.
- Hexagonal architecture (ports and adapters):
  - `domain/`: entities, value objects and pure rules. No framework or database imports.
  - `application/`: use cases and ports (interfaces). Depends only on `domain/`.
  - `infrastructure/`: adapters (HTTP controllers, TypeORM repositories, payment gateway client).
- No business logic in controllers. Controllers validate input, call one use case and map the result to HTTP.
- Railway Oriented Programming: use cases return `Result<T, E>` and chain steps; expected failures are values, not exceptions. Exceptions are only for programming errors.
- Money is an integer in cents. Never use floats for amounts.
- A transaction is persisted as `PENDING` before the gateway is called. Its status only moves forward: `PENDING` to `APPROVED`, `DECLINED`, `VOIDED` or `ERROR`.
- Stock is decremented once, in the same database transaction that marks the payment `APPROVED`, with a conditional update.
- A gateway timeout is not a failure: the transaction stays `PENDING` and is resolved by status query or webhook.
- Webhooks are verified with their checksum before use and must be idempotent.

## Web (`web/`)

- React 19, TypeScript, Vite, Redux Toolkit (Flux). No other state libraries.
- Mobile first. Minimum reference: iPhone SE (375 px wide). Layout with flexbox and grid; nothing may overflow the viewport.
- Five screens: product, card and delivery info, summary (backdrop), final status, back to product.
- Checkout progress survives a refresh. Persist only non-sensitive state (step, delivery data, transaction id). Never persist card data.
- The screen never decides the payment result: it asks the API.
- Tests with Jest and React Testing Library, testing behavior, not implementation details.

## Agents

Specialized agents live in `.claude/agents/`: `nest-developer`, `react-developer`, `ux-ui-designer` and `code-reviewer`.
