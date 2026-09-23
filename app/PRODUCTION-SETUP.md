# Boats and Notes: production preparation

Prepared September 23, 2026. This is a deployment candidate, not a live production deployment.
The original app, reviewed test copy, original GitHub baseline tag and customer records are preserved.

## What has changed

- The app uses PostgreSQL on Supabase, not the temporary Computer SQLite database.
- Vercel serves both the frontend and authenticated API through the same address.
- The existing 15 core table structures were checked for compatibility. No sample data is imported.
- A request's multi-step changes and retry receipt commit together. Failed transactions roll back.
- Database locks coordinate simultaneous requests across server instances.
- PostgreSQL row revisions reject stale edits; retry identifiers prevent duplicate creates.
- Recovery drafts and preferences have separate owner-protected tables.
- Sign-in uses the existing Supabase app-owner account. The API verifies the signed-in user, restricts access to the configured owner, and executes database queries as the authenticated database role with row-level security.
- The app now has a Download backup button. It exports core records and preferences as JSON. Inline photos are included; external photo URLs are references, not file backups.
- PDF generation packages its own Chromium browser. It does not rely on a Computer-installed browser.
- Test reset controls, automatic sample seeding and sample invoice watermarks are removed.
- Payments and external catalog URL imports stay disabled.

## Verified here

TypeScript checking, production build, and ten regression groups passed against a disposable local PostgreSQL database created from the inspected Supabase schema. Tests covered authorization boundaries, concurrent retries, conflicting edits, related record creation, transactional rollback, draft ordering/tombstones, a fresh server instance, backups/preferences, actual PDF bytes, and owner-isolating database policies.

Browser tests use a local disposable database and mocked authentication, not the owner's real password.
They are not proof that the final Vercel host can connect to Supabase.
Browser checks confirmed customer creation, a visible failed-save error with retained inputs, successful retry, draft recovery after reloading and signing back in, backup download, sign-out, and desktop/mobile layouts. The local database was PostgreSQL 18; the actual Supabase connection and Vercel runtime still need acceptance testing.

## Database preparation completed

### Approved recovery tables

The migration is `migrations/20260923_saving_protection.sql`.
With your explicit approval, it was applied to the existing BoatsandNotes project (`xohodqluvqoonqrlamdz`) on September 23, 2026. It added a private schema called `bn_private` and exactly three tables:

- `save_receipts`: records which saves succeeded, so retrying does not duplicate them.
- `recovery_drafts`: keeps unfinished edits and discard markers.
- `preferences`: keeps app display/settings preferences.

It also adds an index, enables row-level security, and grants authenticated users access only to their own rows.
It does not delete, overwrite, seed, or alter the existing customer, boat, work-order or other public tables.
Read-only verification confirmed all three tables exist, are empty, have row-level security enabled, deny anonymous reads, and have the intended owner-based policies. Existing public-table access policies and ID-sequence permissions were checked for compatibility. No existing app records were changed.

## Still required before deployment

### Add the database connection in Vercel

1. In the existing BoatsandNotes Supabase project, open **Connect**.
2. Choose the **Transaction pooler** connection and copy its PostgreSQL URI. Use the exact host shown in that panel and port 6543, not an invented host.
3. Replace the password placeholder with the existing database password. Reserved password characters must be URL-encoded. Do not reset the database password without checking the old app's dependencies.
4. In Vercel's **Environment Variables**, add `DATABASE_URL` and paste the completed URI directly there. Do not put it in GitHub, chat, screenshots, or a variable beginning with `VITE_`.
5. If certificate verification needs the project's CA, download that public certificate from Supabase Database Settings and put its PEM text in `DATABASE_CA_CERT`. Certificate verification stays enabled.

Supabase recommends transaction pooling for transient serverless connections ([connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)).
Its certificate guidance explains full certificate verification and where to obtain the project CA ([SSL guide](https://supabase.com/docs/guides/platform/ssl-enforcement)).

The Supabase URL, public publishable key, and existing owner ID are already configured in `server/config.ts`. The public key is not a database password or service-role key.
The connection string above is the server-only secret still needed.

### Use the correct code revision

The preparation branch is `production-prep-2026-09-23` in the existing private repository.
Do not deploy the older `main` baseline by mistake. Review/merge the prepared branch before importing `main`, or explicitly select the preparation branch.
The original baseline tag remains untouched.

For Vercel:

- Project name: `boats-and-notes`
- Root directory: `app`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist/public`
- Node.js: 22.x (specified in package.json)
- Server function: `api/index.ts`; API routing is supplied in `vercel.json`
- Do not set `VITE_API_BASE` in Vercel. Production uses same-origin requests.

## Final acceptance after deploying

Before loading real data, verify the actual hosted app:

- Open the permanent URL and sign in with the existing app-owner account.
- Create a clearly marked temporary test customer, boat and work order.
- Close/reopen the app, sign in again, and confirm the records remain.
- Edit from a second browser/device; verify the same database and conflicting-edit protection.
- Download a PDF and a JSON backup from the hosted app.
- Test a connection interruption: no false success, draft retained, retry creates no duplicate.
- Check function logs for connection/certificate/packaging errors without logging personal records.
- Remove only the clearly marked test records after checking dependencies.
- Import the existing customer export only after verifying its format and reviewing the import mapping.

## Current limits and recovery

- Full reloads/new tabs currently require sign-in again. Tokens stay in memory rather than browser storage; saved records and confirmed drafts remain in Supabase.
- Unfinished offline edits cannot be guaranteed to survive closing the browser before their database backup succeeds. Use Download draft when disconnected.
- Automated independent database/file backups and a real restore drill are not configured or verified by this work.
- Large backups may exceed the hosting provider's response limits. The app's Download backup feature is not a replacement for database-level backups, especially as stored photos and records grow.
- Keep the existing customer export. Download periodic app backups to your own computer.
- Hosting availability, account recovery and billing remain dependent on your Vercel/Supabase accounts. No app can guarantee it will never be unavailable.
- The existing public-table foreign keys remain authoritative. In particular, deleting a related customer/boat/work order leaves scheduled events with cleared references rather than deleting those events, as specified by the existing Supabase schema.

## Development checks

Run `npm ci`, `npm run check`, and `npm run build` from `app`.
The production regression command is `npm run test:saving`; it requires a disposable local PostgreSQL database named `boats_notes_qa`, the metadata-only fixture in `tests/schema-fixture.sql`, and the saving-protection migration.
Supply its local connection through `TEST_DATABASE_URL`. Tests refuse a remote host or another database name.
No test authentication switch is present in the production entry; the injectable test handler is used only by files under `tests/`.
