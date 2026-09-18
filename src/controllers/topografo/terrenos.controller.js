// MULTI-TENANCY -- terrenos escopados a um cliente de UM topógrafo.
//
// A criação de terreno aqui é uma cópia isolada (não uma chamada
// direta) da mesma lógica já usada em
// controllers/admin/terrenos.controller.js:criar -- MESMOS utils
// (parseNumero, encryptCpf, uploadFile, extractOriginFromGlb,
// resolverUnidadeArea), mesmo formato de resposta. Optou-se por NÃO
// tocar/reaproveitar diretamente aquele controller (seção 27 do
// pedido: "não faça uma refatoração ampla... procure implementação
// isolada") -- qualquer mudança ali arriscaria o fluxo do Admin, que
// já está em produção. Aqui é código NOVO, só usado por esta rota
// nova; a única diferença real é o vínculo obrigatório com
// `cliente_id` e a checagem de posse do cliente antes de tudo.
const { get, all, run } = require("../../database/dbHelpers");
const bcrypt = require("bcryptjs");
const { encryptCpf } = require("../../utils/crypto");
const { uploadFile } = require("../../utils/supabaseStorage");
const { parseNumero } = require("../../utils/numero");
const { normalizarUnidadeArea, extrairUnidadeArea } = require("../../utils/areaUnidade");
const { isValidCpf } = require("../admin/usuarios.controller");
const { extractOriginFromGlb } = require("../../utils/glbOrigin");
const { buscarClienteDoTopografo } = require("./clientes.controller");

function resolverUnidadeArea(areaUnidadeInformada, areaBruta) {
  return normalizarUnidadeArea(areaUnidadeInformada) ?? extrairUnidadeArea(areaBruta);
}

// GET /topografo/me/clientes/:clienteId/terrenos
exports.listarPorCliente = async (req, res) => {
  try {
    const cliente = await buscarClienteDoTopografo(req.params.clienteId, req.topografoId);
    if (!cliente) {
      // Cliente não existe OU pertence a outro topógrafo -- mesma
      // resposta nos dois casos (seção 12 do pedido).
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const terrenos = await all(
      `SELECT id, matricula, url_terreno, area, area_unidade, perimetro, altura_max, altura_min, criado_em
       FROM terrenos WHERE cliente_id = ? ORDER BY id DESC`,
      [cliente.id]
    );

    return res.json(terrenos);
  } catch (err) {
    console.error("Erro ao listar terrenos do cliente:", err);
    return res.status(500).json({ error: "Erro ao listar terrenos" });
  }
};

// POST /topografo/me/clientes/:clienteId/terrenos (multipart/form-data)
// Campos: nome, cpf, matricula, area, area_unidade, perimetro, altura_max, altura_min
// Arquivo: glb (obrigatório)
//
// Mesmo fluxo do cadastro do Admin: cria também um `users` (login do
// app mobile por CPF+matrícula) -- isso NÃO é a mesma coisa que o
// `cliente` do topógrafo (ver comentário no topo do schema.sql, seção
// "MULTI-TENANCY"); o `cliente` é quem o topógrafo cadastra como dono
// do imóvel, o `users` é quem efetivamente loga no app pra ver o
// terreno em 3D -- podem ter os mesmos dados (nome/cpf) na prática,
// mas são registros/tabelas diferentes de propósito.
exports.criarParaCliente = async (req, res) => {
  try {
    const cliente = await buscarClienteDoTopografo(req.params.clienteId, req.topografoId);
    if (!cliente) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    // Preparo para cobrança (seção 17/18) -- só aplicado aqui porque é
    // uma rota NOVA, sem nenhum fluxo existente que possa quebrar.
    // `limite_terrenos` NULL (padrão) nunca bloqueia.
    const topografo = await get("SELECT limite_terrenos FROM topografos WHERE id = ?", [
      req.topografoId,
    ]);
    if (topografo?.limite_terrenos != null) {
      const atual = await get(
        `SELECT COUNT(*)::int AS total
         FROM terrenos t
         JOIN clientes c ON c.id = t.cliente_id
         WHERE c.topografo_id = ?`,
        [req.topografoId]
      );
      if (atual.total >= topografo.limite_terrenos) {
        return res.status(403).json({
          error: `Limite de ${topografo.limite_terrenos} terreno(s) do plano atual foi atingido.`,
        });
      }
    }

    const { nome, cpf, matricula, area, perimetro, altura_max, altura_min, area_unidade } =
      req.body;

    if (!nome || !cpf || !matricula) {
      return res.status(400).json({ error: "Nome, CPF e matrícula são obrigatórios" });
    }

    const cpfLimpo = String(cpf).replace(/\D/g, "");
    if (!isValidCpf(cpfLimpo)) {
      return res.status(400).json({ error: "CPF inválido" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Selecione um arquivo GLB" });
    }
    if (!req.file.originalname.toLowerCase().endsWith(".glb")) {
      return res.status(400).json({ error: "O arquivo precisa ser .glb" });
    }

    const usuarioExistente = await get("SELECT id FROM users WHERE matricula = ?", [matricula]);
    if (usuarioExistente) {
      return res.status(409).json({ error: "Matrícula já cadastrada" });
    }

    const cpfHash = await bcrypt.hash(cpfLimpo, 10);
    const cpfEncrypted = encryptCpf(cpfLimpo);

    const origem = extractOriginFromGlb(req.file.buffer);
    if (!origem) {
      console.warn(
        `Terreno matrícula ${matricula} (topógrafo ${req.topografoId}): GLB sem metadados de origin do Topo Textura.`
      );
    }

    const glbUrl = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "terrenos"
    );

    const usuario = await run(
      "INSERT INTO users (nome, cpf_hash, cpf_encrypted, matricula, status) VALUES (?, ?, ?, ?, 'ativo') RETURNING id",
      [nome, cpfHash, cpfEncrypted, matricula]
    );

    const terreno = await run(
      `INSERT INTO terrenos
         (matricula, url_terreno, area, area_unidade, perimetro, altura_max, altura_min,
          origin_x, origin_y, origin_z, origin_epsg, cliente_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        matricula,
        glbUrl,
        parseNumero(area),
        resolverUnidadeArea(area_unidade, area),
        parseNumero(perimetro),
        parseNumero(altura_max),
        parseNumero(altura_min),
        origem?.origin_x ?? null,
        origem?.origin_y ?? null,
        origem?.origin_z ?? null,
        origem?.epsg ?? null,
        cliente.id,
      ]
    );

    return res.status(201).json({
      mensagem: "Terreno cadastrado com sucesso",
      usuarioId: usuario.lastID,
      terrenoId: terreno.lastID,
      clienteId: cliente.id,
      url_terreno: glbUrl,
    });
  } catch (err) {
    console.error("Erro ao cadastrar terreno para cliente do topógrafo:", err);
    return res.status(500).json({ error: "Erro ao cadastrar terreno" });
  }
};
