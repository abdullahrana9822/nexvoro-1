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

1. Create a **separate Supabase project for NEXVORO-1** and confirm its project ref. Do not reuse the older NEXVORO production database or any unrelated Supabase project. Take a backup before applying schema changes.
2. Apply the SQL migrations in order to that dedicated project: `202611140001_nexvoro_store.sql`, `202611140002_multi_currency.sql`, then `202611140003_admin_accounts.sql`. The commerce migrations create separate `nexvoro_*` tables; the admin migration creates a server-only Super Admin table protected by row-level security.
3. Configure server-side `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SESSION_SECRET` (at least 32 random characters) in `.env.local` for provisioning and in the deployment environment for the app. The service-role key and session secret must never use a `NEXT_PUBLIC_*` name or reach the browser.
4. Run `npm run admin:create` from an interactive terminal. The script confirms the Supabase project ref, reads the admin name and username, prompts for the password without echoing it, hashes it with bcrypt (cost 12), and inserts a `SUPER_ADMIN` record with first-login password change required. It never prints the password and refuses to overwrite an existing username.
5. Verify `/api/health`, then open `/admin` and sign in. The first login is restricted to the password-change screen; changing to a new password is required before dashboard data or admin APIs are available. Later password updates are available under **Admin → Store settings → Super Admin account security**. All admin data and write/upload APIs require a live, database-verified `SUPER_ADMIN` session.
6. Set the store identity, currency, support email, and confirmed delivery terms before enabling checkout. Add and review the live catalog and promotions. Card payments and outbound email are not integrated; checkout currently supports cash on delivery, and order/contact/newsletter records are stored without an email-delivery service.

The account provisioner requires the admin migration to be applied and valid server-side Supabase credentials. It makes no change if the target project ref is not confirmed, the migration is missing, or the username already exists. Do not run migrations or seeding against a production project until the project, schema, and backup have been confirmed.

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
