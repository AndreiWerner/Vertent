const express = require("express");
const router = express.Router();
const TerrenoPublicoController = require("../controllers/terrenoPublico.controller");

// Rota pública e somente leitura -- sem middleware de autenticação de
// propósito: é o endpoint que o Vertente Web (sem sessão de usuário)
// chama para carregar confrontantes, planta e memorial. Só existe
// aqui o método GET; nenhuma rota de escrita foi adicionada a este
// router.
router.get("/:matricula", TerrenoPublicoController.obterPublico);

module.exports = router;
