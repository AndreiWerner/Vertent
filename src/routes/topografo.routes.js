const express = require("express");
const multer = require("multer");

const topografoAuth = require("../middleware/topografoAuth");
const TopografoAuthController = require("../controllers/topografo/auth.controller");
const ClientesController = require("../controllers/topografo/clientes.controller");
const TerrenosController = require("../controllers/topografo/terrenos.controller");

const router = express.Router();

// Mesmo limite/estratégia de upload já usada em admin.routes.js (em
// memória, direto pro Supabase Storage).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// ---- Login do topógrafo (única rota pública deste arquivo) ----
router.post("/login", TopografoAuthController.login);

// A partir daqui, tudo exige token de topógrafo válido (role:
// "topografo") -- ver middleware/topografoAuth.js. Toda rota abaixo
// usa req.topografoId (do token) para filtrar os dados; nenhuma
// depende de um id enviado pelo cliente da API.
router.use(topografoAuth);

router.get("/me", TopografoAuthController.me);
router.get("/me/estatisticas", ClientesController.estatisticas);

router.get("/me/clientes", ClientesController.listar);
router.post("/me/clientes", ClientesController.criar);
router.get("/me/clientes/:clienteId", ClientesController.obter);

router.get("/me/clientes/:clienteId/terrenos", TerrenosController.listarPorCliente);
router.post(
  "/me/clientes/:clienteId/terrenos",
  upload.single("glb"),
  TerrenosController.criarParaCliente
);

module.exports = router;
