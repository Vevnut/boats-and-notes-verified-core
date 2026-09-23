# Production preparation QA

Scope: preserve the tested app, replace sandbox persistence, prepare Vercel deployment.

- Type-check and production build, including the Vercel function entry.
- Native ESM runtime check: separately transpiled API entry imports successfully; health/config respond and records reject anonymous access. Added after the actual Vercel runtime exposed extensionless server imports.
- PostgreSQL: CRUD, typed IDs/dates/booleans, generated defaults, FK behavior.
- Saving: concurrent retry, stale edit, rollback on injected failure, receipt on new instance.
- Draft recovery: newest sequence wins; discarded draft cannot resurrect.
- Auth: no anonymous app API; wrong owner rejected; RLS prevents other-owner reads.
- Disabled routes: no sample reset, Square payments or arbitrary URL import.
- Backup: all 15 core record tables and preferences; external photo references disclosed.
- PDF: actual packaged serverless Chromium, no sample watermark.
- Browser: desktop/mobile sign-in form, validation and failure visibility; no horizontal overflow.
- Browser: disposable authenticated customer creation, failed-save retention/retry, backup, draft recovery after reload/re-authentication, and sign-out.
- Browser: desktop/mobile light layout and desktop dark appearance checked; no runtime page errors.
- Exploratory: offline request does not display a successful save.

Not signoff: real-owner sign-in, actual Supabase pooler TLS connection, Vercel deployment,
customer import, automated backups, and a restore drill. These require remaining setup.

The approved additive migration was applied to the real BoatsandNotes Supabase project on September 23, 2026. Read-only verification confirmed the three empty recovery tables, owner policies, and existing public-table/sequence access permissions. No real customer data was written during testing.

## App-password recovery checks

Mocked Supabase calls in the local browser, without sending email or changing any real password:

- Forgot-password control preserves the entered email; reset request uses the current app origin as the redirect.
- Opening a recovery link as a new document verifies its session and removes the credential fragment from the address bar.
- Mismatched new passwords are rejected without an update request.
- Matching passwords generate one update request, followed by local sign-out and a clear success message.
- Recovery credentials remain absent from localStorage and sessionStorage.
- Expired links show a recovery-request form and remove the error fragment.
- Invalid app credentials remain distinct from an accepted sign-in followed by a database error.
- Desktop request screen and mobile reset form were visually checked.

Real email delivery, the user's new password, and the authenticated production database connection still require the user's end-to-end check.

## Connection diagnostics

After the user reported accepted app authentication followed by a database connection failure:

- Added fixed safe error categories for missing/invalid settings, rejected database credentials, pooler identity, certificate verification, DNS, timeout, network, and connection limits.
- Never return or log driver messages, stacks, database addresses, or secrets. Unit tests include secret-bearing errors, nested causes, aggregates, and cycles.
- Native ESM integration checks cover authenticated requests with missing and invalid database settings. Anonymous requests still receive 401.
- Certificate verification remains required. No environment variables, database passwords, schema, or production records were changed.
- Type checking, production build, connection tests, native ESM checks, and all 10 disposable-database saving regression groups passed.
- This improves diagnosis only. The actual Vercel-to-Supabase connection is not yet verified.

## Work-order HTTP 412 fix

User confirmed production sign-in and matching records on desktop/mobile after
installing the Supabase CA certificate. Subsequent work-order edits returned 412.

- Read-only reproduction on the production health endpoint: no version header
  returns 200; `If-Match: 123:(0,1)` returns Vercel's `PRECONDITION_FAILED` 412;
  the identical value in `X-Record-Version` returns 200.
- Client switches record versions to `X-Record-Version`. The server accepts the
  old header for compatibility, preserves receipt fingerprints, and rejects
  conflicting version headers.
- Regression coverage: work-order summary/notes, job title/price, old-header
  receipt replay through new header, stale/missing/conflicting versions.
- Browser acceptance passed: desktop inline notes, job title, and flat price;
  notes persisted after reload and sign-in; separate mobile session read the same
  notes and saved a new value. Actual outgoing PATCH requests carried only
  `X-Record-Version`, never `If-Match`.
- Desktop stale draft rejected after mobile edit, with text retained. Explicit
  discard then loaded the newest mobile value. Desktop/mobile screenshots
  reviewed; no page runtime errors or mobile horizontal overflow.
- Type check, build, connection diagnostics, native ESM checks, and all 11
  disposable-database regression groups passed.
- No production customer records will be edited by these tests.
