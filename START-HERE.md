# Boats and Notes: functioning core backup

This is a portable recovery checkpoint of the functioning isolated app that you reviewed and approved. It preserves the app itself, not your customer records, and does not depend on the preview URL remaining available.

## What is preserved

- **Editable app:** React screens, styles, logos, navigation, customer and boat workflows, work orders, job lines, parts, scheduling, invoices, photos, and print/export code.
- **Backend:** Express routes and the isolated SQLite storage implementation.
- **Build inputs:** Dependency lockfile, package manifest, TypeScript/Vite configuration, and build script.
- **Built app:** The compiled frontend and backend in `app/dist`, in addition to the editable source.
- **Test setup:** Fictional sample fixtures in source code and the QA notes in `app/TEST-COPY.md`.
- **Integrity:** `SHA256SUMS.txt` records the exact bytes of every included file.

## Intentionally excluded

No database snapshot, real customer records, uploaded customer photos, production credentials, `.env` files, installed dependencies, old Git history, or original privileged key is included. The fictional records created by the test seed are examples, not recovered customer data.

## Identity

- Checkpoint date: September 23, 2026, Eastern Time.
- App source commit: `5b893956288332fba8ebd29d0205f7d457371bb2`.
- Tested runtime: Node.js `20.20.1`, npm `10.8.2`.
- Package purpose: functioning-core recovery, not a production database backup.
- Existing test preview: [Boats and Notes isolated test copy](https://www.perplexity.ai/computer/a/boats-and-notes-isolated-test-jUys_3jPRs2h6AeaZivrSQ).

The preview is a convenience, not the backup. The ZIP can be unpacked elsewhere if this conversation, sandbox, or preview becomes unavailable.

## Restore on a computer or server

Extract the ZIP into a new folder. Do not extract it over your live app or an existing database.

From a terminal in the extracted backup folder:

```sh
# Linux: verify that the package contents have not changed.
sha256sum -c SHA256SUMS.txt

# Enter the app directory. Keep this as the working directory when starting it.
cd app

# Install the dependency versions recorded in package-lock.json.
npm ci

# Check and rebuild the editable app.
npm run check
npm run build

# Install the Chromium version used by the PDF renderer.
./node_modules/.bin/playwright-core install chromium

# Start the isolated app on its default port.
npm start
```

Open `http://127.0.0.1:5000` in a browser. On its first start, the app creates a new `test-data/sample.sqlite` database and fills it with fictional examples.

On macOS, `shasum -a 256 -c SHA256SUMS.txt` can replace the Linux checksum command. Installation of native SQLite bindings and Chromium may require operating-system build tools or browser libraries. The dependencies and browser binaries are not inside this ZIP, so a fresh installation requires access to their download services.

If port 5000 is already occupied, on Linux/macOS use `PORT=5100 npm start` and open `http://127.0.0.1:5100`. Run the restore in a separate folder and use a different port when another instance is running.

## Before loading real customer data

This core is still configured as an isolated test app. It is not ready for real customer data just because its screens work.

- Keep the test seed separate from a real database.
- Add and verify production authentication, permissions, and durable storage.
- Add a reviewed import process and validate customer/boat/work-order relationships.
- Keep real credentials outside source code.
- Review inherited database configuration; do not run `npm run db:push` against a live database.
- Keep payments and external imports disabled until deliberately configured and tested.
- Retire the sample-reset endpoint before production use.

No production connection or live-app change was made to create this package.

## Keep it recoverable

Download this ZIP to your own computer and copy it to a second location, such as an external drive. Keep the separately saved Google Drive copy as another recovery route once its upload is confirmed.

Keep this dated baseline rather than overwriting it. Save a new dated checkpoint after important future changes, and periodically test that a saved copy can still be restored. No hosting service or backup can guarantee “forever,” but independent copies make loss of one service recoverable.
