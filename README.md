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

## Supabase and admin setup

1. Create or select a Supabase project and take a backup before applying schema changes.
2. Review and apply `supabase/migrations/202611140001_nexvoro_store.sql` in the intended project. The migration creates separate `nexvoro_*` tables and does not alter or delete existing store tables.
3. Set the values from `.env.example` in the server environment. `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_ACCESS_KEY`, and `SESSION_SECRET` are server-only; never expose the service-role key through a `NEXT_PUBLIC_*` variable. Use a unique admin key of at least 16 characters and a session secret of at least 32 characters.
4. Configure the Supabase Auth redirect URLs for the deployed site if customer accounts are enabled.
5. Verify `/api/health`. It reports database-schema and delivery-settings readiness without returning records. Sign in to `/admin`, set the store identity, currency, support email, and confirmed delivery terms, then save. Checkout stays disabled until the required settings are stored.
6. Add and review the live catalog and promotions in admin. Card payments and outbound email are not integrated; checkout currently supports cash on delivery, and order/contact/newsletter records are stored without an email-delivery service.

Do not run a migration or seed against a production project until the target schema and backup have been confirmed.

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
