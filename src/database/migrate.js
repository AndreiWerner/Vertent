// Aplica src/database/schema.sql no PostgreSQL -- sempre de forma
// idempotente (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS),
// nunca destrutiva (sem DROP TABLE). Roda automaticamente a cada
// início do servidor (ver database/db.cjs) -- mesmo comportamento que
// já existia com o schema SQLite, só que agora contra o Postgres.

const fs = require("fs");
const path = require("path");

async function migrate(pool) {
  const schemaSql = fs.readFileSync(path.resolve(__dirname, "schema.sql"), "utf8");
  await pool.query(schemaSql);
  console.log("✅ Schema PostgreSQL verificado/aplicado (tabelas: admins, users, terrenos)");
  await migrarAssociacoesAntigas(pool);
}

// ETAPA 3A -- migra as associações implícitas (users.matricula ==
// terrenos.matricula) para user_terrenos. Roda a cada início do
// servidor, junto com o schema -- é seguro rodar de novo: só insere o
// que ainda não existe (ON CONFLICT DO NOTHING), nunca apaga ou
// duplica. NUNCA cria terreno nem apaga usuário -- um usuário cuja
// matrícula não bate com nenhum terreno só é registrado no log, para
// análise (ver ETAPA 3A, seção 6).
async function migrarAssociacoesAntigas(pool) {
  const { rows: migradas } = await pool.query(`
    INSERT INTO user_terrenos (user_id, terreno_id)
    SELECT u.id, t.id
    FROM users u
    JOIN terrenos t ON t.matricula = u.matricula
    ON CONFLICT (user_id, terreno_id) DO NOTHING
    RETURNING user_id, terreno_id
  `);

  if (migradas.length > 0) {
    console.log(
      `✅ ${migradas.length} associação(ões) usuário↔terreno migrada(s) para user_terrenos.`
    );
  }

  const { rows: semCorrespondencia } = await pool.query(`
    SELECT u.id, u.matricula
    FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM terrenos t WHERE t.matricula = u.matricula)
  `);

  if (semCorrespondencia.length > 0) {
    const lista = semCorrespondencia.map((u) => `id=${u.id} matricula='${u.matricula}'`).join(", ");
    console.warn(
      `⚠️  ${semCorrespondencia.length} usuário(s) com matrícula sem terreno correspondente ` +
        `(não alterados, apenas registrados para análise): ${lista}`
    );
  }
}

module.exports = { migrate };
