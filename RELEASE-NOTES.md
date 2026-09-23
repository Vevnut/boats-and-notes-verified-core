# Verified functioning core: September 23, 2026

User-reviewed Boats and Notes recovery baseline, saved separately from the original repository and live app.

## Preserved

Editable frontend/backend, compiled app, package lockfile, fictional test fixtures, restore instructions, and per-file checksums. No customer database or production credentials are included.

## Verified

The archive passed ZIP integrity and all 124 file checksum checks. A clean installation passed TypeScript checks, rebuilt successfully, and started independently with the expected test API and fictional records.

The recovery build also passed representative customer and work-order edits, photo upload, appointment creation, parts ordering, exports, sample reset, and desktop/mobile checks. The detailed scope and limitations are in `app/TEST-COPY.md`.

## Archive identity

- File: `Boats-and-Notes-Functioning-Core-2026-09-23.zip`
- SHA-256: `8a09f03a9e6564f67c6385246ec6e17ae5f09c5eb679f4830cd2be92cb08b954`
- Original recovery source commit: `5b893956288332fba8ebd29d0205f7d457371bb2`

The GitHub release attachment upload was rejected, so the exact portable ZIP is stored in the repository's `recovery` folder on `main`. GitHub's automatically generated source-code ZIP/tarball represents the tagged repository snapshot and is a different archive with a different checksum. The dated tag preserves the app baseline; a subsequent documentation/archive commit adds the portable ZIP without changing the app.

This release remains an isolated test core. It is not production hosting, a backup of real customer records, or an automatic backup of future edits.
