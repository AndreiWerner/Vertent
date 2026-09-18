const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../database/db.cjs");

exports.login = (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
  }

  db.get(
    "SELECT * FROM admins WHERE email = ?",
    [email.trim().toLowerCase()],
    async (err, admin) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erro interno" });
      }

      if (!admin) {
        return res.status(401).json({ error: "E-mail ou senha inválidos" });
      }

      const senhaValida = await bcrypt.compare(senha, admin.senha_hash);
      if (!senhaValida) {
        return res.status(401).json({ error: "E-mail ou senha inválidos" });
      }

      const token = jwt.sign(
        { id: admin.id, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );

      return res.json({
        token,
        admin: { id: admin.id, nome: admin.nome, email: admin.email },
      });
    }
  );
};

exports.me = (req, res) => {
  db.get(
    "SELECT id, nome, email FROM admins WHERE id = ?",
    [req.adminId],
    (err, admin) => {
      if (err) return res.status(500).json({ error: "Erro interno" });
      if (!admin) return res.status(404).json({ error: "Administrador não encontrado" });
      return res.json(admin);
    }
  );
};
