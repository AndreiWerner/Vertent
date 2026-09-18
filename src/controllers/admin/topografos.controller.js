// Endpoint EXCLUSIVO do administrador para criar contas de topógrafo
// pelo Vertent Admin -- até aqui, a única forma de criar um topógrafo
// era via scripts/createTopografo.cjs (acesso ao terminal/servidor).
// Esse script continua existindo para uso operacional; este controller
// só expõe a mesma operação como rota HTTP, protegida por adminAuth
// (ver routes/admin.routes.js -- `router.use(adminAuth)` já cobre
// tudo neste arquivo, então POST /admin/topografos NUNCA fica
// acessível sem um token válido com role "admin").
//
// Mesmo padrão de hash de scripts/createTopografo.cjs (bcryptjs,
// custo 10) -- não introduz um segundo mecanismo de senha.
const bcrypt = require("bcryptjs");
const { get, run } = require("../../database/dbHelpers");

function serializeTopografo(row) {
  // Nunca devolve senha_hash.
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    status: row.status,
    plano: row.plano,
    limite_terrenos: row.limite_terrenos,
    criado_em: row.criado_em,
  };
}

// POST /admin/topografos  { nome, email, senha, plano?, limite_terrenos? }
exports.criar = async (req, res) => {
  try {
    const { nome, email, senha, plano, limite_terrenos } = req.body || {};

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ error: "Nome é obrigatório" });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: "E-mail é obrigatório" });
    }
    if (!senha) {
      return res.status(400).json({ error: "Senha é obrigatória" });
    }

    const emailNormalizado = String(email).trim().toLowerCase();

    const existente = await get("SELECT id FROM topografos WHERE email = ?", [
      emailNormalizado,
    ]);
    if (existente) {
      return res.status(409).json({ error: "E-mail já cadastrado" });
    }

    const limiteTerrenos =
      limite_terrenos === undefined || limite_terrenos === null || limite_terrenos === ""
        ? null
        : Number(limite_terrenos);

    const senhaHash = await bcrypt.hash(senha, 10);

    const inserido = await run(
      `INSERT INTO topografos (nome, email, senha_hash, plano, limite_terrenos)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [nome.trim(), emailNormalizado, senhaHash, plano ?? null, limiteTerrenos]
    );

    const criado = await get("SELECT * FROM topografos WHERE id = ?", [inserido.lastID]);
    return res.status(201).json(serializeTopografo(criado));
  } catch (err) {
    console.error("Erro ao criar topógrafo:", err);
    return res.status(500).json({ error: "Erro ao criar topógrafo" });
  }
};

module.exports.serializeTopografo = serializeTopografo;
