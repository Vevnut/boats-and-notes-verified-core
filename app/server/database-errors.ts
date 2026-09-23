// Only fixed, reviewed messages cross the logging/API boundary. Never include
// a driver message, stack, connection string, hostname, username, or password.
const messages = {
  DB_SETTING_MISSING: "Vercel is missing the DATABASE_URL setting.",
  DB_SETTING_INVALID: "The database connection setting in Vercel is not a valid PostgreSQL address.",
  DB_PASSWORD_REJECTED: "Supabase rejected the database username or password stored in Vercel. This is separate from your app sign-in password.",
  DB_POOLER_IDENTITY: "Supabase could not match the connection's project or database user. Check the Transaction pooler address copied into Vercel.",
  DB_CERTIFICATE: "The app could not verify the database's security certificate. The trusted database certificate setting needs to be checked; secure verification has not been turned off.",
  DB_HOST_NOT_FOUND: "The database address could not be found. Check the Transaction pooler address stored in Vercel.",
  DB_TIMEOUT: "The database connection timed out. Check the Transaction pooler address and whether the database is reachable.",
  DB_NETWORK: "The database connection could not be reached or was interrupted. Check the Transaction pooler connection setting.",
  DB_CONNECTION_LIMIT: "The database has no available connections right now. Please try again shortly.",
  DB_CONNECTION_FAILED: "The permanent database connection failed for a reason that needs further checking.",
} as const;
type ConnectionCode = keyof typeof messages;

export function databaseConnectionFailure(error: unknown): { code: ConnectionCode; error: string } {
  // Drivers may wrap errors in a cause or an AggregateError. Bound traversal
  // and handle cycles without ever returning any untrusted property.
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  let code: ConnectionCode = "DB_CONNECTION_FAILED";
  for (let n = 0; pending.length && n < 12; n++) {
    const value = pending.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const e = value as { code?: unknown; message?: unknown; cause?: unknown; errors?: unknown };
    const driverCode = typeof e.code === "string" ? e.code : "";
    const message = typeof e.message === "string" ? e.message : "";
    if (driverCode === "BN_DB_MISSING") code = "DB_SETTING_MISSING";
    else if (["BN_DB_INVALID", "ERR_INVALID_URL"].includes(driverCode)) code = "DB_SETTING_INVALID";
    else if (["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "CERT_HAS_EXPIRED",
      "CERT_NOT_YET_VALID", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(driverCode)) code = "DB_CERTIFICATE";
    else if (/tenant or user not found/i.test(message)) code = "DB_POOLER_IDENTITY";
    else if (driverCode === "28P01" || /password authentication failed|SASL:.*password/i.test(message)) code = "DB_PASSWORD_REJECTED";
    else if (["ENOTFOUND", "EAI_AGAIN"].includes(driverCode)) code = "DB_HOST_NOT_FOUND";
    else if (driverCode === "ETIMEDOUT" || /connection timeout|timeout exceeded when trying to connect|connection terminated due to connection timeout/i.test(message)) code = "DB_TIMEOUT";
    else if (["ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "ECONNRESET"].includes(driverCode)) code = "DB_NETWORK";
    else if (driverCode === "53300") code = "DB_CONNECTION_LIMIT";
    if (code !== "DB_CONNECTION_FAILED") break;
    if (e.cause) pending.push(e.cause);
    if (Array.isArray(e.errors)) pending.push(...e.errors.slice(0, 12));
  }
  return { code, error: `${messages[code]} No save was confirmed. [${code}]` };
}
