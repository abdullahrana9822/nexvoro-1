# NEXVORO storefront

A Next.js storefront with a Supabase-backed catalog, cash-on-delivery checkout, customer accounts, and a protected store admin. The app can also run in a clearly disclosed preview mode when no database is configured.

## Local development

Requirements: Node.js 20 or newer and npm.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase credentials, the site serves the bundled sample catalog, displays a preview notice, and keeps preview-only activity in the current browser. Production checkout is intentionally unavailable without the live database.

Useful checks:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

## Supabase and Super Admin setup

1. Use only the Supabase project explicitly approved for NEXVORO-1 and confirm its project ref before changing schema. For the current setup, the user has authorized the Vercel-connected `supabase-beige-ocean` project despite its existing legacy tables and data. Do not delete, reset, or import over any existing records. The migrations use NEXVORO-prefixed tables and NEXVORO-specific auth/storage helpers.
2. Apply the SQL migrations in order to that approved project: `202611140001_nexvoro_store.sql`, `202611140002_multi_currency.sql`, then `202611140003_admin_accounts.sql`. The commerce migrations create the `nexvoro_*` store tables; the admin migration creates a server-only Super Admin table protected by row-level security.
3. Configure server-side `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SESSION_SECRET` (at least 32 random characters) in `.env.local` for provisioning and in the deployment environment for the app. The service-role key and session secret must never use a `NEXT_PUBLIC_*` name or reach the browser.
4. Run `npm run admin:create` from an interactive terminal to create a Super Admin. It confirms the Supabase project ref, reads the admin name and username, prompts for the password without displaying its characters, hashes it with bcrypt (cost 12), and inserts a `SUPER_ADMIN` record with first-login password change required. It never prints or saves the password and refuses to overwrite an existing username. To reset the password of an existing active Super Admin, run `npm run admin:reset`; it requires the project ref, the exact username, and the typed confirmation `RESET <username>`, then prompts for the new password twice. Resetting increments `session_version` to revoke active sessions, clears any lockout, and requires a password change at next login; it does not re-enable disabled accounts or change roles.
5. Verify `/api/health`, then open `/admin` and sign in. The first login is restricted to the password-change screen; changing to a new password is required before dashboard data or admin APIs are available. Later password updates are available under **Admin → Store settings → Super Admin account security**. All admin data and write/upload APIs require a live, database-verified `SUPER_ADMIN` session.
6. Set the store identity, currency, support email, and confirmed delivery terms before enabling checkout. Add and review the live catalog and promotions. Customer registration/sign-in uses Supabase email/password auth with email confirmation enabled; configure custom SMTP before relying on confirmation delivery to external addresses. Card payments and order/contact/newsletter email delivery are not integrated; checkout currently supports cash on delivery.

The account provisioner and password-reset command require the admin migration and valid server-side Supabase credentials. They make no change if the target project ref or reset confirmation is not confirmed, the migration is missing, or the account is not eligible. Do not run migrations or seeding against a production project until the project, schema, and backup have been confirmed.

## Catalog review and seed

`data/catalog.json` currently contains 61 sample products across 15 categories. Product details, prices, stock quantities, and image rights have not been verified. The catalog verifier checks structural consistency only; it does not verify product claims or image ownership. These sample records do not count toward the requested 40 source-verified sale listings and must not be treated as live inventory.

Homepage collection and discovery definitions live in `data/storefront-edits.json`. Their memberships are saved as product tags through the existing product admin/API/database field; no collection-specific database migration is needed. An editor must assign reviewed products to those tags before the corresponding shelves show products. The AI-generated files in `public/images/collections/` are clearly marked editorial illustrations, not photographs or depictions of specific retail products. Retailer research leads remain unapproved and must not be presented as NEXVORO sale prices or inventory.

`npm run seed:catalog` is a dry run by default and requires Supabase environment variables to inspect the target tables. To write, first review and correct the catalog, then explicitly opt in:

```sh
NEXVORO_CATALOG_REVIEWED=true npm run seed:catalog -- --apply
```

If active NEXVORO catalog rows already exist, the seeder also requires `--replace`. Before any write it exports the target product and category rows under the ignored `catalog-backups/` directory, archives replaced products/categories instead of deleting them, and refuses ambiguous product identity conflicts. It does not create store settings, shipping prices, or discount codes. Configure those separately in admin.

## Runtime notes

- `/api/health` reports schema, admin-secret, and checkout-settings readiness.
- `/api/store` serves the sample catalog when Supabase is absent and live database records when configured.
- Admin writes use server-side Supabase access and a signed, HttpOnly session cookie.
- Checkout totals and inventory are recalculated atomically in Postgres from current product rows.
- The sample catalog is not a verified offer list; no review ratings or discount prices are seeded by default.
