const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { listarMeusTerrenos, adicionarTerreno } = require("../controllers/userTerrenos.controller");

// Protegidas por token de usuário (role: "user", emitido por
// /auth/login -- ver ETAPA 3A). O app mobile atual não usa essas
// rotas ainda (não foi alterado nesta etapa); ficam prontas para uma
// versão futura.
router.get("/me/terrenos", auth, listarMeusTerrenos);
router.post("/me/terrenos", auth, adicionarTerreno);

module.exports = router;
