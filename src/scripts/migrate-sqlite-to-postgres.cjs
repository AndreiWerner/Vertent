// Migra os dados existentes de src/database.sqlite para o PostgreSQL
// (Supabase). Abre o SQLite em modo SOMENTE LEITURA (nunca escreve
// nele), preserva os IDs originais, e é seguro rodar mais de uma vez
// -- registros já migrados são ignorados (ON CONFLICT (id) DO NOTHING),
// nunca duplicados. Não apaga nem modifica nada no SQLite.
//
// Uso:
//   node src/scripts/migrate-sqlite-to-postgres.cjs
//   (ou: npm run migrate:from-sqlite)
//
// Pré-requisito: DATABASE_URL configurada no .env, apontando para o
// PostgreSQL do Supabase.

require("dotenv").config();
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const pool = require("../database/pool.cjs");
const { migrate } = require("../database/migrate.js");

const SQLITE_PATH = path.resolve(__dirname, "../database.sqlite");

function openSqliteReadOnly() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

function sqliteAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function resetSequence(table) {
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
  );
}

async function migrateTable({ db, table, columns, rowToParams }) {
  const rows = await sqliteAll(db, `SELECT * FROM ${table}`);

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const insertSql = `
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (id) DO NOTHING
  `;

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const result = await pool.query(insertSql, rowToParams(row));
    if (result.rowCount > 0) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  await resetSequence(table);

  console.log(
    `  ${table}: ${rows.length} no SQLite -> ${inserted} migrado(s), ${skipped} já existente(s) (ignorado(s))`
  );
}

async function main() {
  console.log(`Lendo (somente leitura): ${SQLITE_PATH}`);
  const sqliteDb = await openSqliteReadOnly();

  console.log("Verificando/aplicando schema no PostgreSQL...");
  await migrate(pool);

  console.log("Migrando dados...");

  // Ordem importa: "terrenos" não tem FK de verdade para "users" (ver
  // schema.sql), então a ordem entre elas não é estritamente
  // obrigatória, mas migrar admins/users antes de terrenos segue a
  // ordem lógica de dependência do sistema.
  await migrateTable({
    db: sqliteDb,
    table: "admins",
    columns: ["id", "nome", "email", "senha_hash", "criado_em"],
    rowToParams: (r) => [r.id, r.nome, r.email, r.senha_hash, r.criado_em],
  });

  await migrateTable({
    db: sqliteDb,
    table: "users",
    columns: ["id", "nome", "cpf_hash", "matricula", "status", "cpf_encrypted"],
    rowToParams: (r) => [r.id, r.nome, r.cpf_hash, r.matricula, r.status || "ativo", r.cpf_encrypted],
  });

  await migrateTable({
    db: sqliteDb,
    table: "terrenos",
    columns: [
      "id",
      "matricula",
      "url_terreno",
      "area",
      "perimetro",
      "altura_max",
      "altura_min",
      "pdf_confrontantes_url",
      "criado_em",
    ],
    rowToParams: (r) => [
      r.id,
      r.matricula,
      r.url_terreno,
      r.area,
      r.perimetro,
      r.altura_max,
      r.altura_min,
      r.pdf_confrontantes_url,
      r.criado_em,
    ],
  });

  sqliteDb.close();
  await pool.end();
  console.log("✅ Migração concluída.");
}

main().catch((err) => {
  console.error("❌ Erro durante a migração:", err);
  process.exit(1);
});
