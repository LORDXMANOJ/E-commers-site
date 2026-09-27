/**
 * Starts a real PostgreSQL server for local development — no Docker or system install needed.
 * Data lives in backend/.pgdata (git-ignored). Creates the app and test databases on first run.
 *
 *   npm run db:local        (leave it running in its own terminal)
 */
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

// Override with LOCAL_PG_PORT if 5433 is taken (remember to update DATABASE_URL too).
const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const DATABASES = ["aurelle", "aurelle_test"];
const dataDir = path.resolve(__dirname, "..", ".pgdata");

async function main() {
  // embedded-postgres is ESM-only; a dynamic import works from this CommonJS package.
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
    onLog: (m: string) => process.env.PG_DEBUG && console.log(m),
    onError: (e: unknown) => console.error(String(e)),
  });

  const firstRun = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (firstRun) {
    console.log("Initialising a new PostgreSQL cluster in", dataDir);
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  for (const db of DATABASES) {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${db}"`);
      console.log(`Created database ${db}`);
    }
  }
  await client.end();

  console.log(`PostgreSQL running on postgresql://postgres:postgres@localhost:${PORT}/aurelle`);
  console.log("Press Ctrl+C to stop.");

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log("\nStopping PostgreSQL…");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error("Failed to start local PostgreSQL:", err ?? "(see log above; is the port already in use?)");
  process.exit(1);
});
