# Emanet Merkez

The 2earl staff console for Emanet at **merkez.emanet.dev**: partners and their price lists
and fields, agents and their verification, the review queue, deliveries, invoices, partners'
payments, agents' payouts, the trial balance and the rules. Only 2earl staff can sign in.

Data and rules live in [emanet-core](https://github.com/2earl/emanet-core) (its `ControlApi`
entrypoint, over a Service Binding); this Worker keeps only sign-in transactions and sessions.
Sign-in is [login.2earl.com](https://github.com/2earl/login).

## Who can do what

| Role (login staff) | Can                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------- |
| support            | Read everything; settle identity reviews (accept with a VIN, or reject with a reason)     |
| admin, owner       | Also: partners, price lists, fields, agents' status, delivery confirmation, money, rules |

- **Every sign-in asks login for a second factor** (`acr_values=urn:2earl:aal2`); one without it
  is refused. Sessions last 2 hours idle, 12 hours at most.
- **Money and rules need a second factor from the last 15 minutes**: price lists, invoices,
  receipts, payouts, settings and the payout rule. Otherwise the page offers "Confirm it's you".
- **Payouts at or above the dual-approval amount** (a setting, ₺25,000 by default) need a second,
  different admin. The core enforces it; the console only shows it.
- The staff role is read from login on every request, so removing someone takes effect at once.
- Every change is recorded in the core's audit log under the staff member's ID.

## Pages

| Path                       | What                                                                     |
| -------------------------- | ------------------------------------------------------------------------ |
| `/`                        | Today: open reviews, agents waiting for KYC, payouts, cases to invoice   |
| `/reviews`, `/reviews/:id` | Identity reviews (no VIN, plate conflicts) and deliveries with evidence |
| `/partners`, `/partners/:id` | Partners, their tax details, status, price list and custom fields     |
| `/agents`                  | Agents by status; change status with a reason                            |
| `/money`, `/money/ledger`  | Invoicing, payments received, payouts, the trial balance                 |
| `/settings`                | Claim and SLA rules, VAT, withholding, dual approval, the payout rule    |

Evidence photos are read from the `emanet-evidence` R2 bucket, only while their delivery is open
for review, and never cached.

## Develop

```sh
pnpm install
pnpm test        # Worker tests with stand-ins for login and emanet-core (vitest.config.ts)
pnpm typecheck
pnpm lint
```

Pages are written in English; `src/locales/tr.ts` translates them, and `test/i18n.test.ts` fails
on any sentence without a translation.

## Deploy

`.github/workflows/deploy.yml` deploys `main` after approval in the `production` environment
(secret `CLOUDFLARE_API_TOKEN`; the account ID is in `wrangler.jsonc`). It makes `SESSION_PEPPER` once
if the Worker doesn't have it, applies D1 migrations, deploys, and checks the site answers.

Order: emanet-core first (the `ControlApi` it binds to), then this Worker; the custom domain is
attached by emanet-core's `infra/` (`merkez_live = true`). The D1 database `emanet-merkez` is made
there too; put its ID in `wrangler.jsonc` before the first deploy.

Proprietary; see [LICENSE](LICENSE).
