const bcrypt = require("bcryptjs");
const db = require("../database/db.cjs");

// 👉 DADOS DO USUÁRIO
const nome = "júlia";
const cpf = "2";
const matricula = "2";

// 🔐 gera hash do CPF
const cpf_hash = bcrypt.hashSync(cpf, 10);

// 💾 insere no banco
db.run(
  `INSERT INTO users (nome, cpf_hash, matricula) VALUES (?, ?, ?)`,
  [nome, cpf_hash, matricula],
  function (err) {
    if (err) {
      console.error("Erro:", err);
    } else {
      console.log("✅ Usuário criado com ID:", this.lastID);
    }
  }
);