const bcrypt = require("bcryptjs");
const { get, all, run } = require("../../database/dbHelpers");
const { encryptCpf } = require("../../utils/crypto");
const { uploadFile } = require("../../utils/supabaseStorage");
const { parseNumero } = require("../../utils/numero");
const { normalizarUnidadeArea, extrairUnidadeArea } = require("../../utils/areaUnidade");
const { isValidCpf } = require("./usuarios.controller");
const { extractOriginFromGlb } = require("../../utils/glbOrigin");

// A unidade da área pode chegar de dois jeitos, e os dois precisam
// continuar funcionando:
//   1) num campo próprio `area_unidade` -- é o que o Admin envia
//      depois de confirmar o que foi extraído do memorial;
//   2) colada no próprio campo `area` ("14,15 ha"), que é como o
//      formulário sempre aceitou digitar à mão.
// O campo próprio tem prioridade. Não encontrando unidade em nenhum
// dos dois (ex.: o Admin digitou só "14.15", como sempre pôde),
// devolve `null` -- hectare NUNCA é assumido por padrão.
function resolverUnidadeArea(areaUnidadeInformada, areaBruta) {
  return normalizarUnidadeArea(areaUnidadeInformada) ?? extrairUnidadeArea(areaBruta);
}

// GET /admin/terrenos?busca=&status=
exports.listar = async (req, res) => {
  try {
    const { busca, status } = req.query;

    let sql = `
      SELECT t.*, u.nome AS proprietario, u.status AS status_usuario
      FROM terrenos t
      JOIN users u ON u.matricula = t.matricula
      WHERE 1=1
    `;
    const params = [];

    if (busca) {
      // ILIKE (case-insensitive) para manter o mesmo comportamento que
      // LIKE já tinha no SQLite (case-insensitive por padrão para
      // ASCII); LIKE puro no PostgreSQL é case-sensitive.
      sql += " AND (u.nome ILIKE ? OR t.matricula ILIKE ?)";
      params.push(`%${busca}%`, `%${busca}%`);
    }

    if (status === "ativo" || status === "inativo") {
      sql += " AND u.status = ?";
      params.push(status);
    }

    sql += " ORDER BY t.id DESC";

    const rows = await all(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar terrenos" });
  }
};

// GET /admin/terrenos/:id
exports.obter = async (req, res) => {
  try {
    const row = await get(
      `SELECT t.*, u.nome AS proprietario, u.status AS status_usuario
       FROM terrenos t
       JOIN users u ON u.matricula = t.matricula
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: "Terreno não encontrado" });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar terreno" });
  }
};

// POST /admin/terrenos (multipart/form-data)
// Campos: nome, cpf, matricula, area, perimetro, altura_max, altura_min
// Arquivo: glb (obrigatório na criação)
exports.criar = async (req, res) => {
  try {
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

    const usuarioExistente = await get("SELECT id FROM users WHERE matricula = ?", [
      matricula,
    ]);
    if (usuarioExistente) {
      return res.status(409).json({ error: "Matrícula já cadastrada" });
    }

    const cpfHash = await bcrypt.hash(cpfLimpo, 10);
    const cpfEncrypted = encryptCpf(cpfLimpo);

    // Lido do PRÓPRIO arquivo enviado (extras do node "Terreno" -- ver
    // utils/glbOrigin.js), nunca recalculado aqui. `origem` fica
    // `null` se o .glb não tiver esses metadados (GLB de antes dessa
    // funcionalidade existir no Topo Textura) -- terreno é cadastrado
    // normalmente mesmo assim, só sem `origin` por enquanto.
    const origem = extractOriginFromGlb(req.file.buffer);
    if (!origem) {
      console.warn(
        `Terreno matrícula ${matricula}: GLB enviado não tem os metadados de origin do Topo Textura ` +
          `(node "Terreno" com extras.topotexture_origin_x). Terreno será cadastrado sem origin.`
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
         (matricula, url_terreno, area, area_unidade, perimetro, altura_max, altura_min, origin_x, origin_y, origin_z, origin_epsg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
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
      ]
    );

    res.status(201).json({
      mensagem: "Terreno cadastrado com sucesso",
      usuarioId: usuario.lastID,
      terrenoId: terreno.lastID,
      url_terreno: glbUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cadastrar terreno" });
  }
};

// PUT /admin/terrenos/:id (multipart/form-data - arquivo "glb" é opcional)
exports.atualizar = async (req, res) => {
  try {
    const existente = await get("SELECT * FROM terrenos WHERE id = ?", [req.params.id]);
    if (!existente) {
      return res.status(404).json({ error: "Terreno não encontrado" });
    }

    const { area, perimetro, altura_max, altura_min, area_unidade } = req.body;
    let urlTerreno = existente.url_terreno;
    // Só reextrai o origin quando um GLB NOVO é enviado -- sem arquivo
    // novo, o GLB (e portanto o origin gravado nele) continua o
    // mesmo, então mantém o que já estava salvo.
    let origem = {
      origin_x: existente.origin_x,
      origin_y: existente.origin_y,
      origin_z: existente.origin_z,
      epsg: existente.origin_epsg,
    };

    if (req.file) {
      if (!req.file.originalname.toLowerCase().endsWith(".glb")) {
        return res.status(400).json({ error: "O arquivo precisa ser .glb" });
      }
      const origemExtraida = extractOriginFromGlb(req.file.buffer);
      if (!origemExtraida) {
        console.warn(
          `Terreno id ${req.params.id}: GLB enviado na atualização não tem os metadados de origin ` +
            `do Topo Textura. origin_x/y/z ficarão NULL para este terreno.`
        );
      }
      origem = origemExtraida ?? { origin_x: null, origin_y: null, origin_z: null, epsg: null };

      urlTerreno = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        "terrenos"
      );
    }

    await run(
      `UPDATE terrenos
       SET area = ?, area_unidade = ?, perimetro = ?, altura_max = ?, altura_min = ?, url_terreno = ?,
           origin_x = ?, origin_y = ?, origin_z = ?, origin_epsg = ?
       WHERE id = ?`,
      [
        parseNumero(area) ?? existente.area,
        // Mesma regra dos demais campos: sem valor novo, mantém o que
        // já estava salvo (não apaga a unidade de um terreno já
        // cadastrado só porque este request não mandou o campo).
        resolverUnidadeArea(area_unidade, area) ?? existente.area_unidade,
        parseNumero(perimetro) ?? existente.perimetro,
        parseNumero(altura_max) ?? existente.altura_max,
        parseNumero(altura_min) ?? existente.altura_min,
        urlTerreno,
        origem.origin_x,
        origem.origin_y,
        origem.origin_z,
        origem.epsg,
        req.params.id,
      ]
    );

    res.json({ mensagem: "Terreno atualizado com sucesso", url_terreno: urlTerreno });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar terreno" });
  }
};

// DELETE /admin/terrenos/:id
// Só apaga o registro do terreno (o usuário continua existindo, sem terreno vinculado).
// A confirmação com o administrador acontece no painel, antes de chamar esta rota.
exports.excluir = async (req, res) => {
  try {
    const existente = await get("SELECT * FROM terrenos WHERE id = ?", [req.params.id]);
    if (!existente) {
      return res.status(404).json({ error: "Terreno não encontrado" });
    }

    await run("DELETE FROM terrenos WHERE id = ?", [req.params.id]);
    res.json({ mensagem: "Terreno excluído com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir terreno" });
  }
};
