import "dotenv/config";
import app from "./app.js";
import {
  applyDatabaseMigrations,
  MigrationError,
} from "./services/migration-runner.js";

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  if (process.env.NODE_ENV === "production") {
    const { applied, skipped } = await applyDatabaseMigrations();
    console.log(
      `✅ Database migrations: ${applied.length} applied${
        applied.length ? ` (${applied.join(", ")})` : ""
      }, ${skipped.length} already applied; schema/RLS/grants verified.`
    );
  }

  app.listen(PORT, () => {
    console.log(
      `\n✅ DDPRO Backend Server\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/health`);
    console.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    );
  });
};

startServer().catch((error) => {
  const code = error?.code ? ` (database error ${error.code})` : "";
  const detail = error instanceof MigrationError ? ` ${error.message}` : "";
  console.error(
    `❌ Production database migration failed${code}.${detail} Verify DATABASE_URL, DATABASE_SSL_CA / DATABASE_SSL_CA_PATH, the database hostname and permissions.`
  );
  process.exitCode = 1;
});
