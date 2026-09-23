// Compatibility facade for the recovered storage layer.
// Every query now executes in the authenticated PostgreSQL request transaction.
export { database as default } from "./postgres.js";
