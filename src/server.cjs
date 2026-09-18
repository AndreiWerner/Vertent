require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes.cjs");
const adminRoutes = require("./routes/admin.routes.js");
const terrenoPublicoRoutes = require("./routes/terrenoPublico.routes.js");
const userTerrenosRoutes = require("./routes/userTerrenos.routes.js");
const topografoRoutes = require("./routes/topografo.routes.js");
const db = require("./database/db.cjs");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/terreno-publico", terrenoPublicoRoutes);
app.use("/users", userTerrenosRoutes);
app.use("/topografo", topografoRoutes);

const PORT = process.env.PORT || 3333;

// Só começa a aceitar requisições depois de confirmar que o
// PostgreSQL está acessível e o schema (tabelas) foi
// verificado/aplicado -- ver database/db.cjs -> database/migrate.js.
// Backend iniciado -> PostgreSQL conectado -> tabelas disponíveis ->
// servidor inicia normalmente (e não silenciosamente com o banco
// fora do ar).
async function start() {
  try {
    await db.ready;
    await db.pool.query("SELECT 1");
    console.log("✅ PostgreSQL conectado");
  } catch (err) {
    console.error("❌ Não foi possível conectar ao PostgreSQL:", err.message);
    console.error(
      "   Verifique se DATABASE_URL está configurada corretamente no .env " +
        "(Supabase → Project Settings → Database → Connection string)."
    );
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log("🔥 Backend rodando na porta", PORT);
  });
}

start();
