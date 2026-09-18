const db = require("../../database/db.cjs");

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

exports.resumo = async (req, res) => {
  try {
    const totalTerrenos = await get("SELECT COUNT(*) AS total FROM terrenos");
    const totalUsuarios = await get("SELECT COUNT(*) AS total FROM users");
    const usuariosAtivos = await get(
      "SELECT COUNT(*) AS total FROM users WHERE status = 'ativo'"
    );
    const usuariosInativos = await get(
      "SELECT COUNT(*) AS total FROM users WHERE status = 'inativo'"
    );

    const recentes = await all(
      `SELECT u.nome, u.matricula, u.status, t.area, t.url_terreno
       FROM terrenos t
       JOIN users u ON u.matricula = t.matricula
       ORDER BY t.id DESC
       LIMIT 5`
    );

    res.json({
      totalTerrenos: totalTerrenos.total,
      totalUsuarios: totalUsuarios.total,
      usuariosAtivos: usuariosAtivos.total,
      usuariosInativos: usuariosInativos.total,
      terrenosRecentes: recentes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar dashboard" });
  }
};
