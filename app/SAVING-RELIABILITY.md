# Isolated test copy: saving protections

Historical notes only. The protections described here were subsequently adapted to PostgreSQL on the production-preparation branch. For current setup and verification limits, see [PRODUCTION-SETUP.md](PRODUCTION-SETUP.md).

These changes apply only to the isolated SQLite test copy. They do not change the live app, Supabase, Vercel, or the verified GitHub baseline.

## What changed
- Customer forms and work-order text, date and numeric editors retain failed edits and show errors. Work-order editors close only after confirmation, rather than pretending an optimistic update was saved.
- Customer forms and work-order editors back up unfinished drafts to the test server. Reopening an editor can recover those drafts. Draft backup is separate from saving the business record.
- A status bar distinguishes a confirmed save from a pending or failed save. Offline mutations fail visibly instead of waiting silently for connectivity.
- Customer-list loading failures show an error and Retry, not an empty customer database.
- Version checks reject an outdated customer/work-order edit. Save identifiers and stored receipts prevent the same retried operation from being applied twice.
- Each business write and its receipt commit in one SQLite transaction. A multi-step operation is rolled back if a database step fails.
- SQLite uses WAL and FULL synchronous mode. These settings do not substitute for off-machine backups.
- Work-order labor values now use explicit Save, not silent blur saving. Customer and job-line editors were checked at desktop and phone widths.

## Using a draft
Click Save to update the business record. “Draft backed up” means an unfinished copy is on the test server, not that the record has been changed. Closing a form keeps its draft. Download draft makes a JSON copy of unfinished text for manual reference; it is not a full database export or an automatic import file.

If an edit conflicts with another device, the app rejects it. Download the draft if needed, choose Discard draft, reopen the latest record, and reapply only the intended changes. The app does not automatically merge competing changes.

During a complete connection outage, new text can stay in memory while this page remains open, including closing and reopening a form. It cannot be guaranteed to survive a browser crash or reload until the server confirms the draft backup. The browser may warn on leaving; mobile browsers do not guarantee such warnings.

## Coverage and limits
Full draft recovery covers the audited customer form and work-order editable fields. Other forms use the central API confirmation/replay layer, but have not all been converted to recoverable draft editors. Errors in other forms may still require re-entry after a reload.

The backend remains a sandbox test service, not permanent production hosting. Database files, drafts and save receipts live together on its disk. Permanent hosting, monitored automated backups, off-machine copies, restore drills, and account recovery are still needed before daily business reliance. Existing CSV exports are not complete database backups.

## Verification
Run `npm ci`, `npm run check`, and `npm run test:saving`. The regression command builds the app, creates a disposable database and server, verifies eight database reliability checks, and removes only that temporary directory. It never resets the reviewed test database.

Browser failure tests additionally covered failed customer saves, work-order title recovery, two-session conflicts, duplicate prevention after response loss and reload, customer loading errors, offline form closure/reopening, draft download, numeric saving, and desktop/mobile layout.

The original verified baseline remains a separate restore point. No new code has been pushed over that baseline.
