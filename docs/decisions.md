# Decisions and their reasons

Short records of the choices that are not obvious from the code. The summary is in the [README](../README.md).

## The units are reserved when the purchase starts

- **Problem.** Checking the stock at the start and decreasing it when the payment is approved lets two buyers both be charged for the last unit.
- **Decision.** The units leave the stock in the same database transaction that stores the `PENDING` purchase, with `UPDATE … SET stock = stock - n WHERE stock >= n`. The second buyer gets `409 INSUFFICIENT_STOCK` before any charge. If the payment ends as `DECLINED`, `VOIDED` or `ERROR`, the units go back on sale.
- **Cost.** A purchase holds its units while it is `PENDING`.

## The transaction id is the idempotency key

- **Problem.** A retry from the browser, or a repeated notification from the gateway, must never charge or settle twice.
- **Decision.** The browser chooses a UUID for the purchase and sends it as `Idempotency-Key`. Sending the same request again returns the same transaction. Settling is a single `UPDATE … WHERE status = 'PENDING'`: only the first caller changes the row.

## Each purchase keeps its own customer row

- **Problem.** The same person buying twice creates two customer rows.
- **Decision.** Kept on purpose. There is no login, so an email that is typed proves nothing about who is buying: reusing a row by email would attach a purchase to somebody else's record, or let a stranger overwrite their name and phone. A purchase also has to keep the contact details it was made with.
- **With accounts** and a verified email, a customer would be a single row and each order would keep its own copy.

## A delivery ends as CANCELLED when the payment fails

- **Problem.** A delivery that stayed `PENDING` after a declined payment meant both "waiting for the payment" and "will never be sent".
- **Decision.** `PENDING` → `ASSIGNED` when the payment is approved, `PENDING` → `CANCELLED` when it fails, in the same database transaction that settles the purchase.

## What is kept in the browser, and what never is

The checkout keeps a snapshot in `sessionStorage`, which the browser deletes when the tab is closed.

- **Kept:** the step, the product, the units, the contact and delivery details, and the id of a payment already sent.
- **Never kept:** the card, its token, or anything the gateway answered. That is why a refresh on the summary goes back to the form: the card has to be typed again.
- It expires after 30 minutes and is removed when the purchase ends.
- Storage can be edited by hand, so every field is validated when it is read; anything unexpected discards the whole snapshot.

The rules live in `web/src/store/persistence.ts`.

## A purchase is read by knowing its id

There is no login, so the customer and the delivery of a purchase are protected by its id: a random UUID chosen by the browser, never listed by any endpoint. Email and phone are also returned masked. A store with accounts would check who is asking.

## One small instance instead of a load balancer

CloudFront gives the API its HTTPS certificate, so there is no load balancer and no NAT gateway. The price is a single instance: a restart is a short interruption, and the circuit breaker and the rate limit keep their state in memory.

## The webhook is deployed but not registered

- **What exists.** `POST /webhooks/payment-gateway` is implemented and deployed. It checks the signature of each event and is covered by unit and end-to-end tests that send signed events.
- **What could not be done.** The gateway calls a webhook only if its URL is registered, and that is done in one place: the dashboard of the sandbox account. That dashboard was never reachable during the test: its sign-in page answered `403` before showing the form. There is no API to register the URL with the keys.
- **A second reason.** The account is shared between candidates and has a single events URL, so writing ours would have removed somebody else's.
- **Consequence.** The webhook has never received a real event from the gateway. Payments are confirmed by asking the gateway for the status, which is the path verified against the sandbox.

## Dependencies with known findings

`npm audit --omit=dev` reports 3 moderate findings in the API, in a transitive dependency of TypeORM whose fix requires the next major version, and none in the web app. The full `npm audit` lists more (29 in `api/`, 19 in `web/`), all low or moderate and all in development tools that are not part of what is deployed.
