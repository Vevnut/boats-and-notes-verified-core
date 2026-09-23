import assert from "node:assert/strict";
import { databaseConnectionFailure } from "../server/database-errors.js";

const secret = "FAKE-SECRET-MUST-NEVER-APPEAR";
const cases = [
  ["BN_DB_MISSING", "DB_SETTING_MISSING"],
  ["BN_DB_INVALID", "DB_SETTING_INVALID"],
  ["ERR_INVALID_URL", "DB_SETTING_INVALID"],
  ["28P01", "DB_PASSWORD_REJECTED"],
  ["SELF_SIGNED_CERT_IN_CHAIN", "DB_CERTIFICATE"],
  ["DEPTH_ZERO_SELF_SIGNED_CERT", "DB_CERTIFICATE"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DB_CERTIFICATE"],
  ["CERT_HAS_EXPIRED", "DB_CERTIFICATE"],
  ["ERR_TLS_CERT_ALTNAME_INVALID", "DB_CERTIFICATE"],
  ["ENOTFOUND", "DB_HOST_NOT_FOUND"],
  ["EAI_AGAIN", "DB_HOST_NOT_FOUND"],
  ["ETIMEDOUT", "DB_TIMEOUT"],
  ["ENETUNREACH", "DB_NETWORK"],
  ["ECONNREFUSED", "DB_NETWORK"],
  ["53300", "DB_CONNECTION_LIMIT"],
  [secret, "DB_CONNECTION_FAILED"],
] as const;
for (const [code, expected] of cases) {
  const result = databaseConnectionFailure({ code, message: `postgres://user:${secret}@fake-host/db`, stack: secret });
  assert.equal(result.code, expected);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.match(result.error, /No save was confirmed/);
}
assert.equal(databaseConnectionFailure({ message: `Tenant or user not found ${secret}` }).code, "DB_POOLER_IDENTITY");
assert.equal(databaseConnectionFailure({ message: `password authentication failed ${secret}` }).code, "DB_PASSWORD_REJECTED");
assert.equal(databaseConnectionFailure({ message: "Connection terminated due to connection timeout" }).code, "DB_TIMEOUT");
assert.equal(databaseConnectionFailure({ cause: { code: "SELF_SIGNED_CERT_IN_CHAIN" } }).code, "DB_CERTIFICATE");
assert.equal(databaseConnectionFailure(new AggregateError([{ code: "ENETUNREACH" }])).code, "DB_NETWORK");
const cycle: { cause?: unknown } = {};
cycle.cause = cycle;
for (const unknown of [cycle, null, undefined, secret, { message: secret }]) {
  const result = databaseConnectionFailure(unknown);
  assert.equal(result.code, "DB_CONNECTION_FAILED");
  assert.ok(!JSON.stringify(result).includes(secret));
}
console.log("PASS safe connection categories, nested errors, cycles, and secret redaction");
