# Boats and Notes isolated test copy

This is a separate recovery candidate based on the retrieved July 28 source. Preserve the layout and workflows while comparing against the user's current app. This is not production software.

## Isolation

- Database: sandbox-only `test-data/sample.sqlite`. No Supabase connection is created.
- Synthetic fixtures only. All people, hull/engine identifiers, part numbers and prices are fictional.
- Payments and product URL imports return a disabled response. Server `fetch` is blocked.
- Photo uploads write data URLs into the local test database, never Supabase Storage.
- PDF rendering disables JavaScript and blocks external requests. Output carries a sample warning.
- No service worker or browser storage. Preferences use the local test backend.
- No production credentials, connectors, migrations, or original seed scripts are required.
- The original recovered archive is untouched. This project is a separate directory and must deploy as a NEW artifact.

## Running

Use `npm ci`, `npm run build`, then `npm start` from this directory. The backend uses port 5000. Deploy `dist/public` as a separate preview; its API placeholder forwards to this sandbox backend.

Test edits survive reloads and process restarts while this sandbox filesystem remains available. They are not a production backup or a promise of permanent hosting. Do not enter real customer records.

## QA inventory

- Verify test banner on desktop/mobile and sample warning on print views.
- Verify isolated status response; payment and URL import return 403.
- Verify no Supabase or payment network request in browser capture.
- Exercise dashboard, customer list/detail, boat detail, work orders/detail, invoices, schedule, templates, catalog, orders, activity and settings.
- Exercise customer create/edit/reload, a work-order job update and reload, sample photo upload, search and export.
- Exercise theme toggle both directions and mobile navigation.
- Exercise reset cancellation and confirmed reset of sample records.
- Negative checks: nonexistent detail route, missing required customer fields.
- Inspect desktop and mobile layouts for blank screens and overflow.
- Record limitations rather than treating all inherited workflows as fully validated.

## Completed checks

- TypeScript check and production build passed.
- All 13 primary screens opened without a JavaScript page error. Desktop (1440px) and phone (375px) checks showed no document-level horizontal overflow.
- Customer creation, required-name validation, editing, reload persistence, and process-restart persistence passed.
- Work-order job-title editing and reload persistence passed.
- Photo upload into the local test database passed.
- Global customer search, appointment creation, parts ordering, missing-customer handling, and mobile drawer navigation passed.
- CSV download through the Export control passed. Work-order PDF returned a valid PDF and its extracted text included the sample-only warning.
- Light/dark switching, reset cancellation, and confirmed sample reset passed.
- Payment and URL-import endpoints returned 403. Browser request capture contained no Supabase, Square, or live-app requests.
- Fixtures were reset after testing: four customers, four boats, five service records, six catalog parts, and three scheduled events.

## Boundaries

This test copy is for comparing recovered screens and trying fictional workflows, not for real operations. Production authentication, Supabase permissions, payment processing, real customer-data recovery, external imports, and every inherited shortcut or print variation have not been validated. Some inherited schedule keyboard actions explicitly remain unimplemented.

The test backend is session-backed and has no production authentication. Do not add real customer data, credentials, or payment information. Exported PDFs and prices are examples only. A production rebuild needs a separate security review, permanent hosting/storage plan, data-recovery plan, and approval before connecting to any real database.
