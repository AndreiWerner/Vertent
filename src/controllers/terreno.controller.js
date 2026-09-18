const db = require("../database/db.cjs");

exports.listar = (req, res) => {
  db.all(
    `
    SELECT terrenos.id, terrenos.matricula, terrenos.url
    FROM terrenos
    JOIN permissoes ON permissoes.terreno_id = terrenos.id
    WHERE permissoes.usuario_id = ?
    `,
    [req.userId],
    (err, rows) => {
      res.json(rows);
    },
  );
};
