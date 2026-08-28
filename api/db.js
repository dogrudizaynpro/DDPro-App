// ============================================================
// DDPro API — GERÇEK VERİTABANI BAĞLANTI KATMANI
// DOĞRU DİZAYN PRO
// PostgreSQL
// ============================================================

const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false
    })
  : null;

// ------------------------------------------------------------
// VERİTABANI DURUMU
// ------------------------------------------------------------

const database = {
  connected: false,
  provider: "postgresql",
  urlConfigured: Boolean(databaseUrl),
  pool
};

// ------------------------------------------------------------
// BAĞLANTI TESTİ
// ------------------------------------------------------------

async function connectDatabase() {
  if (!pool) {
    return {
      success: false,
      connected: false,
      provider: "postgresql",
      error: "DATABASE_URL tanımlı değil."
    };
  }

  try {
    await pool.query("SELECT 1");

    database.connected = true;

    return {
      success: true,
      connected: true,
      provider: "postgresql"
    };
  } catch (error) {
    database.connected = false;

    return {
      success: false,
      connected: false,
      provider: "postgresql",
      error: error.message
    };
  }
}

// ------------------------------------------------------------
// SQL SORGUSU
// ------------------------------------------------------------

async function query(text, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL tanımlı değil.");
  }

  const result = await pool.query(text, params);

  database.connected = true;

  return result;
}

// ------------------------------------------------------------
// VERİTABANI DURUMU
// ------------------------------------------------------------

function getDatabaseStatus() {
  return {
    connected: database.connected,
    provider: database.provider,
    urlConfigured: database.urlConfigured
  };
}

// ------------------------------------------------------------
// BAĞLANTIYI KAPAT
// ------------------------------------------------------------

async function disconnectDatabase() {
  if (pool) {
    await pool.end();
  }

  database.connected = false;

  return {
    success: true,
    connected: false
  };
}

// ------------------------------------------------------------
// EXPORT
// ------------------------------------------------------------

module.exports = {
  database,
  pool,
  connectDatabase,
  query,
  getDatabaseStatus,
  disconnectDatabase
};
