// Apaga TODOS os dados de terrenos/usuários/pontos/confrontantes/
// associações -- a ESTRUTURA (tabelas, colunas, constraints, índices)
// continua exatamente igual, só as linhas somem. IDs (SERIAL) voltam
// a começar do 1.
//
// A tabela `admins` NÃO é apagada por padrão (evita trancar o acesso
// ao próprio painel). Passe --incluir-admins se quiser apagar ela
// também -- nesse caso, recrie um admin depois com
// src/scripts/createAdmin.cjs.
//
// Uso:
//   node src/scripts/resetDados.cjs --confirmar
//   node src/scripts/resetDados.cjs --confirmar --incluir-admins
//
// IRREVERSÍVEL. Faça um backup antes se tiver qualquer dúvida (no
// Supabase: Database → Backups, ou `pg_dump` na sua connection string).

require("dotenv").config();
const db = require("../database/db.cjs");

const args = process.argv.slice(2);
const confirmado = args.includes("--confirmar");
const incluirAdmins = args.includes("--incluir-admins");

if (!confirmado) {
  console.error(
    "Isso apaga TODOS os dados (terrenos, usuários, pontos, confrontantes, associações" +
      (incluirAdmins ? ", admins" : "") +
      ") -- a estrutura das tabelas continua intacta.\n" +
      "Irreversível. Rode de novo com --confirmar se tem certeza:\n" +
      "  node src/scripts/resetDados.cjs --confirmar" +
      (incluirAdmins ? " --incluir-admins" : "")
  );
  process.exit(1);
}

const tabelas = ["user_terrenos", "confrontantes", "pontos_terreno", "terrenos", "users"];
if (incluirAdmins) tabelas.push("admins");

function main() {
  const sql = `TRUNCATE TABLE ${tabelas.join(", ")} RESTART IDENTITY CASCADE`;

  db.run(sql, [], function (err) {
    if (err) {
      console.error("❌ Erro ao resetar os dados:", err);
      process.exit(1);
    }
    console.log(`✅ Dados apagados (estrutura intacta): ${tabelas.join(", ")}.`);
    if (!incluirAdmins) {
      console.log("ℹ️  Tabela 'admins' preservada de propósito -- use --incluir-admins para apagá-la também.");
    }
    process.exit(0);
  });
}

// dá um tempinho pro db.cjs terminar de rodar init.sql + migrate() antes do TRUNCATE
setTimeout(main, 500);
