const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não configurada no .env (string de conexão do Supabase Postgres, " +
      "em Project Settings → Database → Connection string → 'Transaction' ou 'Session' pooler)."
  );
}

console.log("DB HOST:", new URL(process.env.DATABASE_URL).hostname);
console.log("DB PORT:", new URL(process.env.DATABASE_URL).port);
console.log("DB USER:", new URL(process.env.DATABASE_URL).username);
// rejectUnauthorized: false -- o Supabase usa um certificado de uma CA
// que normalmente não está na cadeia de confiança padrão do Node;
// isso ainda criptografa a conexão (TLS), só não valida a cadeia
// completa do certificado. É a configuração padrão recomendada pelo
// próprio Supabase para conexão via `pg` a partir de um servidor.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  // Erros em conexões OCIOSAS do pool (ex.: o Supabase encerrou a
  // conexão por inatividade) -- não devem derrubar o processo, só
  // avisar. Erros durante uma query já são tratados por quem chama
  // pool.query(...) (ver database/db.cjs e database/dbHelpers.js).
  console.error("❌ Erro inesperado numa conexão ociosa do PostgreSQL:", err.message);
});

module.exports = pool;
