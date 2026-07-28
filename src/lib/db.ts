import postgres, { type Sql } from "postgres";

declare global {
  var sportsBookingSql: Sql | undefined;
}

/** Opens one server-only PostgreSQL client, after DATABASE_URL has been configured. */
export function db(): Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local and set it first.");
  }

  if (!global.sportsBookingSql) {
    const isLocalConnection = /(localhost|127\.0\.0\.1|\[::1\])/.test(connectionString);
    global.sportsBookingSql = postgres(connectionString, {
      // Never use a plaintext connection outside localhost. DATABASE_SSL=false is accepted only for local development.
      ssl: !isLocalConnection && process.env.DATABASE_SSL !== "false" ? "require" : false,
      max: 10,
      idle_timeout: 20,
    });
  }
  return global.sportsBookingSql;
}
