const { get, all, run } = require("../../database/dbHelpers");
const { decryptCpf } = require("../../utils/crypto");

function isValidCpf(cpf) {
  return /^\d{11}$/.test(cpf);
}

function serializeUser(row) {
  let cpf = null;
  try {
    cpf = decryptCpf(row.cpf_encrypted);
  } catch (err) {
    // CPF_ENCRYPTION_KEY ausente/errada, ou usuário antigo sem cpf_encrypted
    cpf = null;
  }

  return {
    id: row.id,
    nome: row.nome,
    matricula: row.matricula,
    status: row.status,
    cpf, // null quando não foi possível descriptografar (ex: cadastros antigos)
  };
}

exports.listar = async (req, res) => {
  try {
    const { busca, status } = req.query;

    let sql = "SELECT * FROM users WHERE 1=1";
    const params = [];

    if (busca) {
      // ILIKE (case-insensitive) para manter o mesmo comportamento que
      // LIKE já tinha no SQLite -- ver mesmo comentário em
      // terrenos.controller.js.
      sql += " AND (nome ILIKE ? OR matricula ILIKE ?)";
      params.push(`%${busca}%`, `%${busca}%`);
    }

    if (status === "ativo" || status === "inativo") {
      sql += " AND status = ?";
      params.push(status);
    }

    sql += " ORDER BY id DESC";

    const rows = await all(sql, params);
    res.json(rows.map(serializeUser));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
};

exports.obter = async (req, res) => {
  try {
    const row = await get("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(serializeUser(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const { nome, matricula } = req.body;
    const existente = await get("SELECT * FROM users WHERE id = ?", [req.params.id]);

    if (!existente) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    if (matricula && matricula !== existente.matricula) {
      const conflito = await get(
        "SELECT id FROM users WHERE matricula = ? AND id != ?",
        [matricula, req.params.id]
      );
      if (conflito) {
        return res.status(409).json({ error: "Matrícula já cadastrada" });
      }
    }

    await run(
      "UPDATE users SET nome = ?, matricula = ? WHERE id = ?",
      [
        nome ?? existente.nome,
        matricula ?? existente.matricula,
        req.params.id,
      ]
    );

    // Se a matrícula mudou, o terreno vinculado precisa acompanhar
    if (matricula && matricula !== existente.matricula) {
      await run("UPDATE terrenos SET matricula = ? WHERE matricula = ?", [
        matricula,
        existente.matricula,
      ]);
    }

    const atualizado = await get("SELECT * FROM users WHERE id = ?", [req.params.id]);
    res.json({ mensagem: "Usuário atualizado com sucesso", usuario: serializeUser(atualizado) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
};

exports.atualizarStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (status !== "ativo" && status !== "inativo") {
      return res.status(400).json({ error: "Status inválido (use 'ativo' ou 'inativo')" });
    }

    const existente = await get("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!existente) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    await run("UPDATE users SET status = ? WHERE id = ?", [status, req.params.id]);
    res.json({ mensagem: `Usuário ${status === "ativo" ? "ativado" : "desativado"} com sucesso` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
};

module.exports.isValidCpf = isValidCpf;
module.exports.serializeUser = serializeUser;
