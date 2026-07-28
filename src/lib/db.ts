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
    global.sportsBookingSql = postgres(connectionString, {
    // Local EDB PostgreSQL uses non-TLS loopback; hosted databases can opt into TLS with DATABASE_SSL=true.
    ssl: process.env.DATABASE_SSL === "true" ? "require" : false,
      max: 10,
      idle_timeout: 20,
    });
  }
  return global.sportsBookingSql;
}
