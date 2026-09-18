// MULTI-TENANCY -- CRUD de clientes, escopado ao topógrafo autenticado.
//
// ISOLAMENTO (seção 11/12 do pedido): TODA query aqui filtra por
// `topografo_id = req.topografoId` (vindo do token, nunca do corpo da
// requisição). Um topógrafo nunca recebe nem consegue adivinhar dados
// de outro -- tentar obter um cliente de outro topógrafo dá 404 (a
// mesma resposta de "não existe", pra não revelar que o registro
// existe mas pertence a outra conta).
const { get, all, run } = require("../../database/dbHelpers");
const { encryptCpf, decryptCpf } = require("../../utils/crypto");

function serializeCliente(row) {
  let cpf = null;
  try {
    cpf = decryptCpf(row.cpf_encrypted);
  } catch {
    cpf = null; // CPF_ENCRYPTION_KEY ausente/errada -- mesmo tratamento de usuarios.controller.js
  }
  return {
    id: row.id,
    topografo_id: row.topografo_id,
    nome: row.nome,
    cpf,
    email: row.email,
    telefone: row.telefone,
    criado_em: row.criado_em,
  };
}

// GET /topografo/me/clientes?busca=
exports.listar = async (req, res) => {
  try {
    const { busca } = req.query;

    let sql = "SELECT * FROM clientes WHERE topografo_id = ?";
    const params = [req.topografoId];

    if (busca) {
      sql += " AND nome ILIKE ?";
      params.push(`%${busca}%`);
    }

    sql += " ORDER BY id DESC";

    const rows = await all(sql, params);
    return res.json(rows.map(serializeCliente));
  } catch (err) {
    console.error("Erro ao listar clientes do topógrafo:", err);
    return res.status(500).json({ error: "Erro ao listar clientes" });
  }
};

// GET /topografo/me/clientes/:clienteId
exports.obter = async (req, res) => {
  try {
    const cliente = await buscarClienteDoTopografo(req.params.clienteId, req.topografoId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    return res.json(serializeCliente(cliente));
  } catch (err) {
    console.error("Erro ao buscar cliente:", err);
    return res.status(500).json({ error: "Erro ao buscar cliente" });
  }
};

// POST /topografo/me/clientes  { nome, cpf?, email?, telefone? }
// `topografo_id` é SEMPRE o do token autenticado -- o frontend não
// pode (e não precisa) enviar esse campo (seção 14 do pedido).
exports.criar = async (req, res) => {
  try {
    const { nome, cpf, email, telefone } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: "Nome é obrigatório" });
    }

    let cpfEncrypted = null;
    if (cpf && String(cpf).trim()) {
      const cpfLimpo = String(cpf).replace(/\D/g, "");
      cpfEncrypted = encryptCpf(cpfLimpo);
    }

    const inserido = await run(
      `INSERT INTO clientes (topografo_id, nome, cpf_encrypted, email, telefone)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [req.topografoId, nome.trim(), cpfEncrypted, email ?? null, telefone ?? null]
    );

    const criado = await get("SELECT * FROM clientes WHERE id = ?", [inserido.lastID]);
    return res.status(201).json(serializeCliente(criado));
  } catch (err) {
    console.error("Erro ao criar cliente:", err);
    return res.status(500).json({ error: "Erro ao criar cliente" });
  }
};

// GET /topografo/me/estatisticas
// Contagens calculadas em SQL, nunca recebidas do frontend (seção 16).
exports.estatisticas = async (req, res) => {
  try {
    const clientes = await get("SELECT COUNT(*)::int AS total FROM clientes WHERE topografo_id = ?", [
      req.topografoId,
    ]);
    const terrenos = await get(
      `SELECT COUNT(*)::int AS total
       FROM terrenos t
       JOIN clientes c ON c.id = t.cliente_id
       WHERE c.topografo_id = ?`,
      [req.topografoId]
    );

    return res.json({ clientes: clientes.total, terrenos: terrenos.total });
  } catch (err) {
    console.error("Erro ao calcular estatísticas do topógrafo:", err);
    return res.status(500).json({ error: "Erro ao calcular estatísticas" });
  }
};

// Reaproveitada pelo controller de terrenos (mesma checagem de posse
// exigida antes de listar/criar terrenos de um cliente -- seção 15).
async function buscarClienteDoTopografo(clienteId, topografoId) {
  return get("SELECT * FROM clientes WHERE id = ? AND topografo_id = ?", [
    clienteId,
    topografoId,
  ]);
}

module.exports.buscarClienteDoTopografo = buscarClienteDoTopografo;
module.exports.serializeCliente = serializeCliente;
