// MULTI-TENANCY -- login do topógrafo. Reaproveita exatamente o mesmo
// mecanismo de autenticação que já existe para o admin
// (controllers/admin/auth.controller.js): bcrypt para a senha,
// jsonwebtoken com a mesma JWT_SECRET do projeto -- só o `role` no
// payload ("topografo") e a tabela consultada (`topografos`) mudam.
// Não há cadastro público: um topógrafo só é criado via
// scripts/createTopografo.cjs (mesmo padrão de createAdmin.cjs) --
// deixado assim de propósito nesta etapa, igual ao admin.
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { get } = require("../../database/dbHelpers");

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    }

    const topografo = await get("SELECT * FROM topografos WHERE email = ?", [
      email.trim().toLowerCase(),
    ]);

    if (!topografo) {
      return res.status(401).json({ error: "E-mail ou senha inválidos" });
    }

    const senhaValida = await bcrypt.compare(senha, topografo.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: "E-mail ou senha inválidos" });
    }

    if (topografo.status === "inativo") {
      return res.status(403).json({ error: "Acesso desativado. Entre em contato com o suporte." });
    }

    const token = jwt.sign(
      { id: topografo.id, role: "topografo" },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      topografo: {
        id: topografo.id,
        nome: topografo.nome,
        email: topografo.email,
        plano: topografo.plano,
        limite_terrenos: topografo.limite_terrenos,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

// GET /topografo/me -- usa SEMPRE req.topografoId (do token), nunca um
// id vindo de parâmetro/query.
exports.me = async (req, res) => {
  try {
    const topografo = await get(
      "SELECT id, nome, email, telefone, status, plano, limite_terrenos, criado_em FROM topografos WHERE id = ?",
      [req.topografoId]
    );
    if (!topografo) {
      return res.status(404).json({ error: "Topógrafo não encontrado" });
    }
    return res.json(topografo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno" });
  }
};
