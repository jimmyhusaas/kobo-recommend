import postgres from "postgres";

const connectionString = process.env.DATABASE_URL ?? "postgresql://placeholder";

// Singleton across hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __kobo_sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  global.__kobo_sql ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__kobo_sql = sql;
}

export const DEFAULT_USER_ID =
  process.env.DEFAULT_USER_ID ?? "00000000-0000-0000-0000-000000000001";
