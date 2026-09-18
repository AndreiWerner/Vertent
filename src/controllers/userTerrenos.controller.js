// src/controllers/userTerrenos.controller.js
//
// ETAPA 3A -- endpoints novos para a relação N:N usuário↔terreno
// (tabela user_terrenos, ver database/schema.sql). Protegidos por
// middleware/auth.js (token emitido por /auth/login, role: "user") --
// nunca confia em user_id/terreno_id vindo do cliente, sempre usa
// `req.userId` (do token) como referência (ver ETAPA 3A, seção 11).
//
// Não toca em pontos_terreno/confrontantes/origin/GLB -- só lê
// terrenos.* (colunas leves) e escreve em user_terrenos.

const { get, all, run } = require("../database/dbHelpers");

// GET /users/me/terrenos
exports.listarMeusTerrenos = async (req, res) => {
  try {
    // `terrenos` não tem coluna "nome" (só matricula/url_terreno/área/
    // etc, ver schema.sql) -- ao contrário do exemplo ilustrativo da
    // especificação, não inventamos esse campo aqui.
    const terrenos = await all(
      `
      SELECT t.id, t.matricula, t.area, t.area_unidade, t.perimetro, t.altura_max, t.altura_min
      FROM user_terrenos ut
      JOIN terrenos t ON t.id = ut.terreno_id
      WHERE ut.user_id = ?
      ORDER BY ut.created_at
      `,
      [req.userId]
    );

    return res.json({ terrenos });
  } catch (err) {
    console.error("Erro ao listar terrenos do usuário:", err);
    return res.status(500).json({ error: "Erro ao listar terrenos" });
  }
};

// POST /users/me/terrenos  { matricula }
exports.adicionarTerreno = async (req, res) => {
  try {
    const { matricula } = req.body;

    if (!matricula || !matricula.trim()) {
      return res.status(400).json({ error: "Matrícula obrigatória" });
    }

    const terreno = await get("SELECT id FROM terrenos WHERE matricula = ?", [matricula.trim()]);
    if (!terreno) {
      return res.status(404).json({ error: "Terreno não encontrado para esta matrícula" });
    }

    const existente = await get(
      "SELECT id FROM user_terrenos WHERE user_id = ? AND terreno_id = ?",
      [req.userId, terreno.id]
    );
    if (existente) {
      // Mesmo status (409) já usado pelo projeto para "já existe" (ver
      // admin/usuarios.controller.js e admin/terrenos.controller.js).
      return res.status(409).json({ message: "Esta propriedade já está associada ao usuário." });
    }

    await run("INSERT INTO user_terrenos (user_id, terreno_id) VALUES (?, ?)", [req.userId, terreno.id]);

    return res.status(201).json({ message: "Propriedade associada com sucesso." });
  } catch (err) {
    console.error("Erro ao associar terreno ao usuário:", err);
    return res.status(500).json({ error: "Erro ao associar propriedade" });
  }
};
