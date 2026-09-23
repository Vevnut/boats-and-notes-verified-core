// Compatibility name only. This module NEVER connects to Supabase.
// All recovered storage calls are executed against a sandbox-only SQLite file.
export { sandboxDatabase as default } from "./test-database";
