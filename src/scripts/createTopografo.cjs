// Cria (ou atualiza a senha de) um topógrafo -- mesmo padrão de
// scripts/createAdmin.cjs. Não existe cadastro de topógrafo pelo
// painel de propósito nesta etapa: só quem tem acesso ao
// servidor/terminal consegue criar um.
//
// Uso local:
//   node src/scripts/createTopografo.cjs "Nome" email@exemplo.com "senhaForte123" [limiteTerrenos] [plano]
// Uso no Render: abra o Shell do serviço e rode o mesmo comando.

const bcrypt = require("bcryptjs");
require("dotenv").config();
const db = require("../database/db.cjs");

const [, , nome, email, senha, limiteTerrenosArg, plano] = process.argv;

if (!nome || !email || !senha) {
  console.error(
    'Uso: node src/scripts/createTopografo.cjs "Nome" email@exemplo.com "senha" [limiteTerrenos] [plano]'
  );
  process.exit(1);
}

const limiteTerrenos = limiteTerrenosArg ? Number(limiteTerrenosArg) : null;

async function main() {
  const senhaHash = await bcrypt.hash(senha, 10);

  db.run(
    `INSERT INTO topografos (nome, email, senha_hash, plano, limite_terrenos)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       senha_hash = excluded.senha_hash,
       nome = excluded.nome,
       plano = COALESCE(excluded.plano, topografos.plano),
       limite_terrenos = COALESCE(excluded.limite_terrenos, topografos.limite_terrenos)`,
    [nome, email.trim().toLowerCase(), senhaHash, plano ?? null, limiteTerrenos],
    function (err) {
      if (err) {
        console.error("Erro ao criar/atualizar topógrafo:", err);
        process.exit(1);
      }
      console.log(`✅ Topógrafo pronto: ${email}`);
      process.exit(0);
    }
  );
}

// dá um tempinho pro db.cjs terminar de rodar o schema antes de inserir
setTimeout(main, 500);
