// Versão baseada em Promise (usada pelos controllers de /admin) das
// mesmas operações de database/db.cjs, direto contra o Pool do
// PostgreSQL. Continua aceitando queries com placeholders `?`, e
// `run()` continua devolvendo `{ lastID, changes }` -- `lastID` só
// vem preenchido se a própria query tiver `RETURNING id` (ver os
// INSERTs em terrenos.controller.js).
const pool = require("./pool.cjs");
const { toPositionalParams } = require("./sql.cjs");

async function get(sql, params = []) {
  const result = await pool.query(toPositionalParams(sql), params);
  return result.rows[0];
}

async function all(sql, params = []) {
  const result = await pool.query(toPositionalParams(sql), params);
  return result.rows;
}

async function run(sql, params = []) {
  const result = await pool.query(toPositionalParams(sql), params);
  return { lastID: result.rows?.[0]?.id, changes: result.rowCount };
}

module.exports = { pool, get, all, run };
