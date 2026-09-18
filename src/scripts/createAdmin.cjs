// Cria (ou atualiza a senha de) um administrador do painel.
// Uso local:      node src/scripts/createAdmin.cjs "Seu Nome" seu@email.com "senhaForte123"
// Uso no Render:  abra o Shell do serviço e rode o mesmo comando.
//
// Não existe cadastro de admin pelo painel de propósito - só quem tem
// acesso ao servidor/terminal consegue criar um administrador.

const bcrypt = require("bcryptjs");
require("dotenv").config();
const db = require("../database/db.cjs");

const [, , nome, email, senha] = process.argv;

if (!nome || !email || !senha) {
  console.error(
    'Uso: node src/scripts/createAdmin.cjs "Nome" email@exemplo.com "senha"'
  );
  process.exit(1);
}

async function main() {
  const senhaHash = await bcrypt.hash(senha, 10);

  db.run(
    `INSERT INTO admins (nome, email, senha_hash)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET senha_hash = excluded.senha_hash, nome = excluded.nome`,
    [nome, email.trim().toLowerCase(), senhaHash],
    function (err) {
      if (err) {
        console.error("Erro ao criar/atualizar admin:", err);
        process.exit(1);
      }
      console.log(`✅ Administrador pronto: ${email}`);
      process.exit(0);
    }
  );
}

// dá um tempinho pro db.cjs terminar de rodar init.sql + migrate() antes de inserir
setTimeout(main, 500);
