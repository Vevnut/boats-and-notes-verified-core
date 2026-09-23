# Production preparation QA

Scope: preserve the tested app, replace sandbox persistence, prepare Vercel deployment.

- Type-check and production build, including the Vercel function entry.
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
