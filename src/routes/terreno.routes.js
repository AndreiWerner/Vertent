const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { listar } = require("../controllers/terreno.controller");

router.get("/", auth, listar);

module.exports = router;
