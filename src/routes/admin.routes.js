const express = require("express");
const multer = require("multer");

const adminAuth = require("../middleware/adminAuth");
const AdminAuthController = require("../controllers/admin/auth.controller");
const DashboardController = require("../controllers/admin/dashboard.controller");
const TerrenosController = require("../controllers/admin/terrenos.controller");
const UsuariosController = require("../controllers/admin/usuarios.controller");
const ConfrontantesController = require("../controllers/admin/confrontantes.controller");
const TopografosController = require("../controllers/admin/topografos.controller");

const router = express.Router();

// Upload em memória (o arquivo vai direto pro Supabase Storage, nunca
// fica salvo em disco no Render nem em base64 no banco).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB - ajuste se necessário
});

// ---- Login do admin (única rota pública deste arquivo) ----
router.post("/login", AdminAuthController.login);

// A partir daqui, tudo exige token de admin válido
router.use(adminAuth);

router.get("/me", AdminAuthController.me);

router.get("/dashboard", DashboardController.resumo);

router.get("/terrenos", TerrenosController.listar);
router.post("/terrenos", upload.single("glb"), TerrenosController.criar);
router.get("/terrenos/:id", TerrenosController.obter);
router.put("/terrenos/:id", upload.single("glb"), TerrenosController.atualizar);
router.delete("/terrenos/:id", TerrenosController.excluir);

router.get("/usuarios", UsuariosController.listar);
router.get("/usuarios/:id", UsuariosController.obter);
router.put("/usuarios/:id", UsuariosController.atualizar);
router.patch("/usuarios/:id/status", UsuariosController.atualizarStatus);

// Criação de contas de Topógrafo -- função EXCLUSIVA do administrador.
// Já protegida pelo `router.use(adminAuth)` acima: um token com
// role "topografo" ou "user" nunca passa daqui (403), e sem token
// válido dá 401. Não existe rota pública equivalente em nenhum outro
// arquivo de rotas.
router.post("/topografos", TopografosController.criar);

// Planta (extração automática de pontos/confrontantes) e memorial
// descritivo -- ver FUNCIONALIDADE 1 e 2 do pedido de confrontantes.
router.post("/terrenos/:id/planta", upload.single("pdf"), ConfrontantesController.enviarPlanta);
router.post("/terrenos/:id/memorial", upload.single("pdf"), ConfrontantesController.enviarMemorial);
router.post(
  "/terrenos/:id/recalcular-coordenadas",
  ConfrontantesController.recalcularCoordenadas
);
router.get("/terrenos/:id/confrontantes", ConfrontantesController.obterConfrontantes);
router.post("/terrenos/:id/confrontantes", ConfrontantesController.confirmarConfrontantes);

module.exports = router;
