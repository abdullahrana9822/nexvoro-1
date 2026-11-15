# NEXVORO — Final Real-World QA Report

**Verdict: NOT READY FOR PRODUCTION SIGN-OFF.** The live catalog contains only demo/test listings, the online-payment sandbox requested in the plan is not implemented, and authenticated production tests could not be performed. No production checkout, payment, admin mutation, or database write was made.

## Test scope and timestamp

- **Production URL:** <https://nexvoro-1.vercel.app>
- **Production access:** read-only public page/API retrieval through Arena's page-fetch service, plus read-only Vercel and Supabase metadata/query tools.
- **Working tree:** branch `arena/ba008bd1-nexvoro-1`, HEAD `2ea52c7c4579e9fdbb24ac5a54af2d420e99f8b1`, with uncommitted local changes.
- **Deployed production revision:** Vercel deployment `dpl_9Phvac8sjtrBBipuKvadqJ9nTXmr`, `READY`/`PROMOTED`, commit `2ea52c7c4579e9fdbb24ac5a54af2d420e99f8b1`. The uncommitted working-tree fixes are not in that deployment.
- **Date:** Arena session date is 2026-11-14 UTC. The workspace clock reported 2026-11-15 17:28:02 UTC at report finalization; this one-day clock discrepancy is recorded rather than silently normalized. The attached local Lighthouse JSON files retain their Lighthouse `fetchTime` values.
- **Production browser limitation:** Chromium and Lighthouse navigation to the production host failed with `net::ERR_CONNECTION_CLOSED` from this sandbox. The Arena page-fetch service could retrieve public production content, but it does not provide a rendered browser session, viewport control, screenshots, or Lighthouse metrics. No production scores or screenshots have been fabricated.

## Requested production Lighthouse scorecard

The target categories and lab metrics below are **not measured for production**. The homepage Lighthouse attempt failed before a report could be generated, and Chrome could not navigate to the host. Consequently the remaining production routes are also unmeasured, not estimated.

| Production page | Performance | Accessibility | Best Practices | SEO | LCP | INP | CLS | FCP | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Homepage `/` | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |
| Shop `/shop` | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |
| Product details | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |
| Cart `/cart` | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |
| Checkout `/checkout` | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |
| Login `/login` | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |
| Register `/register` | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |
| Admin login `/admin` | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |
| Authenticated admin dashboard | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M | N/M |

`INP` was not present in the attached Lighthouse navigation-mode lab results either; TBT is reported as its lab proxy, not as INP.

### Supplementary Lighthouse results — local branch build only

These are actual Lighthouse 12.8.2 reports for `http://127.0.0.1:3003/` using the current working tree and preview data. **They are not production measurements and must not be substituted for the table above.**

| Local homepage run | Performance | Accessibility | Best Practices | SEO | FCP | LCP | INP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile, 2026-11-15 17:04:57Z | 90 | 100 | 93 | 100 | 1.09 s | 2.31 s | N/M | 0.000 | 358 ms |
| Desktop, 2026-11-15 17:05:19Z | 99 | 100 | 96 | 100 | 0.25 s | 0.97 s | N/M | 0.002 | 0 ms |

The mobile local result misses the 95+ Best Practices target. Its findings include sub-12px text and failed external Unsplash image requests (`ERR_CONNECTION_CLOSED`). The desktop local Best Practices result also includes external-image console failures. These are sandbox/preview findings and are not proof of production behavior.

Raw reports:

- [`docs/qa-evidence/branch-home-mobile-lighthouse.json`](qa-evidence/branch-home-mobile-lighthouse.json)
- [`docs/qa-evidence/branch-home-desktop-lighthouse.json`](qa-evidence/branch-home-desktop-lighthouse.json)

## Production observations — read-only

Public production page/API content was retrieved without submitting forms or changing data. The page-fetch adapter does not expose HTTP status codes, so this report records returned content rather than asserting unobserved status codes.

- `/api/health` returned `database:true`, `adminConfigured:true`, `commerceConfigured:true`, `mode:"database"`.
- `/api/store` returned `source:"database"`, `database:true`, and `commerceConfigured:true`, but its two active listings are explicitly `[TEST]` demo products with `demo-only` / `test-catalog` tags, synthetic stock/prices, and non-fulfillment descriptions. It also returned a demo-only category. This is a **critical production readiness mismatch**.
- `/shop` rendered those two demo/test listings. Their detail routes (`/product/demo-test-lamp`, `/product/demo-test-earbuds`) returned the not-found page. `/product/iphone-16-pro` also returned the not-found page even though the homepage renders iPhone 16 Pro as its featured object. This is a production storefront/link consistency failure.
- `/cart` rendered an empty-bag state. `/checkout` rendered an empty-bag state and “Delivery terms are being prepared”; no order journey could be completed from a real catalog item.
- `/login` and `/register` rendered their forms. No credentials were entered and no account was created.
- `/admin` rendered the protected Super Admin sign-in screen. `/api/admin/session` returned `authenticated:false`, `configured:true`, `database:true`; `/api/admin/data` returned “Super Admin sign-in required.” No login attempt or dashboard mutation was made.
- A synthetic nonexistent order lookup at `/api/orders/track` returned the generic no-match response. This tests only the safe negative lookup, not a real customer order.
- `/robots.txt` rendered the application not-found page rather than robots directives. The working tree adds an `app/robots.ts` route, but this fix is not deployed.
- The production currency endpoint reported `stale:false` and a 60-minute cache while its quote timestamps were about 17 hours older than its `fetchedAt`. This is an observation to investigate, not a confirmed rate-calculation defect.

### Supabase read-only snapshot

- Database, REST, and Auth health checks reported `ACTIVE_HEALTHY`.
- Four migrations were listed as applied: store, multi-currency, admin accounts, and demo/test products.
- Aggregate counts: 3 products (2 active), 1 category (1 active), 1 existing order, 1 order item. The public store API identifies both active products as demo/test fixtures.
- The same aggregate counts were read again after testing. No production order was created and no customer PII was queried.

## Payment, checkout, and admin safety

- **Payment sandbox is unavailable because there is no payment-provider integration in this codebase.** The order UI/source explicitly says cash on delivery is the available workflow and online card payments are not connected. A source scan found no Stripe, Paymob, PayPal, Razorpay, Checkout.com, or payment-intent integration. Vercel environment-variable metadata contained Supabase/database and session configuration, but no payment-provider/sandbox variable names. No secret values were retrieved or decrypted.
- Missing to perform the requested sandbox test: a selected payment provider integration, provider sandbox account/API credentials, and the required sandbox webhook/configuration. Until those exist, a sandbox payment cannot be run.
- Production Super Admin credentials were not supplied through a secure test session. No password was guessed, read from a secret store, or exposed. The dashboard CRUD tests therefore remain blocked.
- No production order POST, payment, stock change, coupon change, product/category edit, customer edit, or order-status change was attempted. This avoids creating fake successes or mutating real production records without an isolated test environment.

## Requested final checklist

| Test | Result | Evidence / reason |
|---|---|---|
| Production Lighthouse scores (all requested pages) | **NOT MEASURED** | Production Chrome/Lighthouse navigation failed with `net::ERR_CONNECTION_CLOSED`; no scorecard was generated. |
| Real product search/details | **FAIL / BLOCKED** | No real product exists in the live store API; `/shop` exposes only demo fixtures and their detail routes plus the featured iPhone URL return not-found content. A search interaction could not be run in production Chromium because the host connection is blocked. |
| Complete production checkout | **BLOCKED / FAIL** | No real sale-ready product is available; checkout page is empty and delivery terms are being prepared. No order was submitted. |
| Payment sandbox | **FAIL — not implemented** | No provider integration or sandbox credentials/configuration; COD only. |
| Production database order save / stock update | **NOT TESTED** | No order was created; current aggregate is 1 existing order and 1 item. |
| Production Super Admin login | **BLOCKED** | Session is unauthenticated; no secure test credential/session was available. |
| Admin dashboard / order management / CRUD | **BLOCKED** | Protected data API denies unauthenticated access; no production mutations were made. |
| Production responsive/browser console testing | **NOT MEASURED** | Sandbox Chromium cannot connect to the production host. |
| Current-branch responsive smoke test | **PASS (local preview only)** | 14 routes × 12 requested widths (320, 360, 375, 390, 430, 480, 768, 820, 1024, 1280, 1440, 1920), plus six mobile-menu checks: 174 checks; 0 horizontal overflow, 0 non-200 routes, 0 page exceptions. |
| Current-branch local shopping UI smoke test | **PASS (preview data only)** | Searched sample iPhone 16 Pro, selected `256GB`, added it, raised quantity 1→2; subtotal and estimated total displayed Rs 818,000. Checkout remained disabled in no-database preview. No `/api/orders` POST occurred. This is not a real product/order test. |
| Unit/catalog tests | **PASS** | `npm run test`: 11 tests passed. Catalog checker explicitly does not verify product identity, specs, prices, stock, or image rights. |
| Integration / dedicated E2E suites | **NOT CONFIGURED** | `package.json` has no integration or E2E test script/framework. Manual Playwright smoke checks above are limited to local preview. |
| TypeScript | **PASS** | `npm run typecheck` exited 0. |
| ESLint | **PASS** | `npm run lint` exited 0. |
| Production build (current branch) | **PASS** | `npm run build` exited 0. This is a local branch build, not a deployment of the uncommitted changes. |
| Dependency audit | **PASS** | `npm audit --audit-level=high`: 0 vulnerabilities. |
| Diff whitespace check | **PASS** | `git diff --check` exited 0. |

The responsive smoke test above verified viewport/document widths, route loading, page exceptions, and mobile-menu focus/expanded state. It did **not** perform a full visual assessment of every text crop, overlap, image rendering, or authenticated admin chart/table. Production browser checks for those items remain unmeasured. Remote Unsplash image loads failed from the sandbox, so image delivery was not verified.

## Fixes already present on the active branch, not deployed

The current working tree filters fixture-marked products/categories from the database-backed store API, requires an active in-stock non-demo product for commerce readiness, blocks fixture IDs in order creation, removes sample catalog data from the browser's initial/production local-storage fallback, and adds robots rules. The unit tests, typecheck, lint, and build pass. The public production deployment still runs commit `2ea52c7…`, so these safeguards are not live yet.

## Release gate / next steps

Do not declare the live e-commerce flow verified or release-ready until:

1. A verified, fulfillable catalog with correct prices, stock, images, and delivery terms is available in production (or an isolated staging copy).
2. The fixture-filtering branch changes are reviewed and deployed deliberately; then re-check the production store API and health result.
3. A payment provider is selected and its sandbox integration, credentials, and webhook are configured in a non-production environment if online payment is required.
4. A staging Super Admin test account and isolated database are available for auth, CRUD, order-status, stock, and persistence tests.
5. Production Lighthouse/browser testing runs from a browser runner that can reach Vercel, and the authenticated dashboard is measured only after safe test access is provisioned.

No production data or deployment was changed during this QA run.
