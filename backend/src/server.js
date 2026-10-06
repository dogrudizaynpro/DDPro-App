import "dotenv/config";
import app from "./app.js";
import { applyAiToolConfirmationsMigration } from "./services/migration-runner.js";

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  if (process.env.NODE_ENV === "production") {
    await applyAiToolConfirmationsMigration();
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
  console.error(
    `❌ Production database migration failed${code}. Verify DATABASE_URL and database permissions.`
  );
  process.exitCode = 1;
});
