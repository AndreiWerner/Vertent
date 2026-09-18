// Compatibilidade com a API de callback do sqlite3 (`db.get/db.all/db.run`),
// mas por baixo dos panos usando o Pool do PostgreSQL. Existe pra que
// controllers escritos originalmente contra o sqlite3
// (`auth.controller.cjs`, `admin/auth.controller.js`) não precisem ser
// reescritos -- só a implementação por trás de `db.get/db.all/db.run`
// mudou, a forma de chamar continua idêntica, inclusive o `this.lastID`/
// `this.changes` dentro do callback de `db.run` (ver abaixo).
//
// Consultas escritas com placeholders `?` (estilo SQLite) continuam
// funcionando sem alteração -- ver `toPositionalParams` em
// `database/sql.cjs`.

const pool = require("./pool.cjs");
const { toPositionalParams } = require("./sql.cjs");
const { migrate } = require("./migrate.js");

// Resolve depois que o schema (tabelas) foi criado/verificado no
// PostgreSQL -- `server.cjs` espera essa promise antes de começar a
// aceitar requisições (ver seção "health check" no README).
const ready = migrate(pool).catch((err) => {
  console.error("❌ Erro ao aplicar o schema do PostgreSQL:", err.message);
  throw err;
});

// sqlite3 aceita tanto `db.get(sql, params, cb)` quanto `db.get(sql, cb)`
// (sem params) -- todo o código deste projeto já usa a forma com 3
// argumentos, mas essas três funções aceitam as duas por segurança.
function normalizeArgs(params, callback) {
  if (typeof params === "function") {
    return [[], params];
  }
  return [params || [], callback];
}

function run(sql, params, callback) {
  [params, callback] = normalizeArgs(params, callback);
  const text = toPositionalParams(sql);
  pool
    .query(text, params)
    .then((result) => {
      if (typeof callback !== "function") return;
      // `this.lastID`/`this.changes` só existem no sqlite3 original
      // por causa do rowid automático do SQLite; no PostgreSQL,
      // `lastID` só fica disponível se a própria query tiver
      // `RETURNING id` (ver os INSERTs em terrenos.controller.js e
      // scripts/createAdmin.cjs) -- fica `undefined` nas queries que
      // não retornam nada (UPDATE/DELETE), igual no sqlite3 pra
      // comandos sem rowid aplicável.
      const context = {
        lastID: result.rows?.[0]?.id,
        changes: result.rowCount,
      };
      callback.call(context, null);
    })
    .catch((err) => {
      if (typeof callback === "function") callback(err);
    });
}

function get(sql, params, callback) {
  [params, callback] = normalizeArgs(params, callback);
  const text = toPositionalParams(sql);
  pool
    .query(text, params)
    .then((result) => callback(null, result.rows[0]))
    .catch((err) => callback(err));
}

function all(sql, params, callback) {
  [params, callback] = normalizeArgs(params, callback);
  const text = toPositionalParams(sql);
  pool
    .query(text, params)
    .then((result) => callback(null, result.rows))
    .catch((err) => callback(err));
}

module.exports = { get, all, run, ready, pool };
