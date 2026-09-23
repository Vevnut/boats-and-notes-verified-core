# Boats and Notes: verified core

## Production preparation branch

This branch prepares the app for Vercel + Supabase. It is not deployed. Start with [the production setup guide](app/PRODUCTION-SETUP.md), not the historical quick start below. The approved additive saving-protection migration has been applied; the production app still needs its server-only database connection and real-host acceptance testing. It requires owner sign-in and does not create sample records or use SQLite.

Generated `app/dist` output is no longer tracked on this branch; Vercel builds it from source. The baseline tag and recovery archive below remain unchanged. `SHA256SUMS.txt` verifies the original baseline only, not this modified production tree. Use the archive or baseline tag when following the historical recovery instructions.

## Historical recovery baseline

This private repository preserves the functioning Boats and Notes core reviewed and approved on September 23, 2026. It is a recovery baseline, not a production deployment or customer-data backup.

## Recovery checkpoint

- **Baseline tag:** `verified-baseline-2026-09-23`.
- **Source checkpoint:** `5b893956288332fba8ebd29d0205f7d457371bb2`, from the isolated recovery workspace. This repository starts a fresh, sanitized history; that older commit is provenance, not a commit in this repository.
- **Portable archive:** [Boats-and-Notes-Functioning-Core-2026-09-23.zip](recovery/Boats-and-Notes-Functioning-Core-2026-09-23.zip), stored directly in this repository because the GitHub release attachment upload was rejected.
- **Archive SHA-256:** `8a09f03a9e6564f67c6385246ec6e17ae5f09c5eb679f4830cd2be92cb08b954`.
- **Verification:** A clean copy installed dependencies, passed TypeScript checks, rebuilt, started independently, and returned the expected isolated test API and fictional records.

## Contents

`app/` contains the editable frontend/backend, locked dependency versions, build configuration, built output, and fictional sample fixtures. `START-HERE.md` contains full restore instructions and production-readiness cautions, while `SHA256SUMS.txt` verifies the 124 files from the original core package.

The manifest intentionally covers the original checkpoint files only. This repository's README, root ignore rules, release notes, and separately stored recovery ZIP are additional Git-tracked files. The dated baseline tag preserves the original source snapshot; the subsequent archive-storage commit adds the exact ZIP without changing app files.

## Quick start

With Node.js 20.20.1 and npm 10.8.2, from the repository root:

```sh
sha256sum -c SHA256SUMS.txt
cd app
npm ci
npm run check
npm run build
./node_modules/.bin/playwright-core install chromium
npm start
```

Open `http://127.0.0.1:5000`. A fresh start creates a local SQLite test database with fictional examples; there is no production connection.

## Safety boundaries

- No customer database, uploaded customer photos, `.env` file, production credential, or original privileged key is included.
- Database files, runtime uploads, logs, and installed dependencies are excluded by ignore rules.
- The original GitHub app repository, live deployment, and real database were not changed to create this repository.
- Authentication, durable production storage, permissions, import mapping, and removal of test-reset controls are prerequisites to loading real customer data.
- Do not run the inherited `db:push` script against a live database.

## Future changes

Keep the dated baseline tag and release as the recovery point. Make future changes in new commits and branches rather than replacing the saved checkpoint, and save another dated release after verifying an important version.

This repository is a manual checkpoint, not automatic synchronization with the preview or live app. Keep an offline archive as an independent backup and periodically test restoration.
