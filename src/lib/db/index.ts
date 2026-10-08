import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { env } from "../env";
import type { DB } from "./tipos";

export type { DB } from "./tipos";
export type BaseDeDatos = Kysely<DB>;

// En desarrollo Next recarga módulos; se guarda la instancia en globalThis para no abrir un pool por recarga.
const global = globalThis as typeof globalThis & { __fabiotobonDb?: { pool: Pool; db: BaseDeDatos } };

function crear() {
  const pool = new Pool({ connectionString: env().DATABASE_URL, max: 10 });
  const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  return { pool, db };
}

function instancia() {
  global.__fabiotobonDb ??= crear();
  return global.__fabiotobonDb;
}

export function db(): BaseDeDatos {
  return instancia().db;
}

export function pool(): Pool {
  return instancia().pool;
}

export async function cerrarDb(): Promise<void> {
  const actual = global.__fabiotobonDb;
  global.__fabiotobonDb = undefined;
  if (actual) await actual.db.destroy();
}
