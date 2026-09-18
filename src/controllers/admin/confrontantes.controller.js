const { get, all, run, pool } = require("../../database/dbHelpers");
const { uploadFile } = require("../../utils/supabaseStorage");
const { extrairPlanta, extrairMemorial } = require("../../utils/pdfExtractor");
const { converterPontosParaUtm } = require("../../utils/pdfExtractor/coordenadas");

// SIRGAS2000 e WGS84 são tratados como equivalentes pra fins de
// memorial descritivo (diferença sub-métrica, irrelevante aqui) --
// ambos convertidos com precisão via proj4. SAD69 e Córrego Alegre são
// datums mais antigos que exigem parâmetros de transformação (Helmert)
// específicos que não implementamos -- por isso NÃO entram como opção
// aqui: seria pior "aproximar" um datum antigo usando os parâmetros de
// um datum moderno do que simplesmente não oferecer a conversão.
const DATUMS_ACEITOS = ["SIRGAS2000", "WGS84"];

function isPdf(file) {
  return (
    file.mimetype === "application/pdf" ||
    file.originalname.toLowerCase().endsWith(".pdf")
  );
}

// A Planta continua só PDF (o formato de planta em tabela depende de
// posição x/y na página, que só o PDF fornece -- ver ETAPA "MELHORAR
// INTERPRETAÇÃO DE MEMORIAIS", seção 1). Já o Memorial Descritivo
// aceita PDF, DOC e DOCX: o formato narrativo não depende de posição
// na página, então funciona igual com texto extraído de Word.
const EXTENSOES_MEMORIAL_ACEITAS = [".pdf", ".doc", ".docx"];
const MIMETYPES_MEMORIAL_ACEITOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function isDocumentoMemorialAceito(file) {
  const nome = file.originalname.toLowerCase();
  return (
    MIMETYPES_MEMORIAL_ACEITOS.includes(file.mimetype) ||
    EXTENSOES_MEMORIAL_ACEITAS.some((ext) => nome.endsWith(ext))
  );
}

// POST /admin/terrenos/:id/planta (multipart/form-data, campo "pdf")
//
// Faz upload da planta pro Supabase Storage, salva a URL no terreno
// (reaproveitando a coluna `pdf_confrontantes_url`, já existente desde
// o cadastro original do terreno) e roda a extração automática.
//
// IMPORTANTE: isto NÃO salva pontos/confrontantes no banco ainda --
// só devolve o que foi identificado, para conferência no admin (ver
// FUNCIONALIDADE 1, seção "TELA DE CONFERÊNCIA NO ADMIN" do pedido).
// O salvamento de verdade acontece em `confirmarConfrontantes`, depois
// que o administrador revisar/corrigir e confirmar.
exports.enviarPlanta = async (req, res) => {
  try {
    const terreno = await get("SELECT id FROM terrenos WHERE id = ?", [req.params.id]);
    if (!terreno) {
      return res.status(404).json({ error: "Terreno não encontrado" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Selecione um arquivo PDF" });
    }
    if (!isPdf(req.file)) {
      return res.status(400).json({ error: "O arquivo precisa ser um PDF" });
    }

    const plantaUrl = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "plantas"
    );

    await run("UPDATE terrenos SET pdf_confrontantes_url = ? WHERE id = ?", [
      plantaUrl,
      req.params.id,
    ]);

    let extraido;
    try {
      extraido = await extrairPlanta(req.file.buffer);
    } catch (extractErr) {
      // A extração é só uma AJUDA -- se ela falhar (PDF corrompido,
      // biblioteca de OCR com problema, etc.), a planta já foi salva
      // acima; o administrador ainda consegue preencher tudo à mão.
      console.error("Erro na extração automática da planta:", extractErr);
      extraido = {
        pontos: [],
        confrontantes: [],
        aviso:
          "Não foi possível processar automaticamente este PDF. Revise os dados manualmente.",
        usouOcr: false,
      };
    }

    res.json({
      mensagem: "Planta enviada com sucesso",
      planta_pdf_url: plantaUrl,
      ...extraido,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar a planta" });
  }
};

// POST /admin/terrenos/:id/memorial (multipart/form-data, campo "pdf")
//
// O MEMORIAL DESCRITIVO é a fonte principal da automação:
// 1) salva o PDF no Supabase;
// 2) extrai texto nativo ou OCR;
// 3) identifica automaticamente pontos/coordenadas e
//    confrontantes (nome, matrícula e ponto inicial/final);
// 4) devolve os dados para conferência no Admin.
// Nada é gravado em pontos_terreno/confrontantes antes da confirmação.
exports.enviarMemorial = async (req, res) => {
  try {
    const terreno = await get("SELECT id FROM terrenos WHERE id = ?", [req.params.id]);
    if (!terreno) {
      return res.status(404).json({ error: "Terreno não encontrado" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Selecione um arquivo PDF, DOC ou DOCX" });
    }
    if (!isDocumentoMemorialAceito(req.file)) {
      return res.status(400).json({ error: "O arquivo precisa ser um PDF, DOC ou DOCX" });
    }

    const memorialUrl = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "memoriais"
    );

    await run("UPDATE terrenos SET memorial_pdf_url = ? WHERE id = ?", [
      memorialUrl,
      req.params.id,
    ]);

    let extraido;
    try {
      extraido = await extrairMemorial(req.file.buffer, {
        nomeArquivo: req.file.originalname,
        mimetype: req.file.mimetype,
      });
    } catch (extractErr) {
      console.error("Erro na extração automática do memorial:", extractErr);
      extraido = {
        pontos: [],
        confrontantes: [],
        aviso:
          "O memorial foi salvo, mas não foi possível processar automaticamente o conteúdo. " +
          "Revise os pontos e confrontantes manualmente.",
        usouOcr: false,
        formatoReconhecido: "memorial-descritivo",
        coordenadasCompletas: false,
      };
    }

    // A mensagem não pode dizer "processado com sucesso" quando os
    // pontos/confrontantes foram encontrados mas as coordenadas ainda
    // não são utilizáveis (ex.: Lat/Long sem datum confirmado) --
    // "sucesso" tem que significar "pronto pra revisar e salvar",
    // nunca "coordenadas certas garantidas".
    const mensagem = extraido.coordenadasCompletas
      ? "Memorial descritivo enviado e processado com sucesso"
      : "Memorial descritivo enviado. Pontos e confrontantes identificados, porém as " +
        "coordenadas ainda precisam de confirmação -- revise antes de salvar.";

    return res.json({
      mensagem,
      memorial_pdf_url: memorialUrl,
      ...extraido,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao enviar/processar o memorial descritivo" });
  }
};

// GET /admin/terrenos/:id/confrontantes
// Devolve os pontos e confrontantes JÁ CONFIRMADOS (salvos) para esse
// terreno -- para reabrir a tela de edição no admin.
exports.obterConfrontantes = async (req, res) => {
  try {
    const terreno = await get("SELECT id FROM terrenos WHERE id = ?", [req.params.id]);
    if (!terreno) {
      return res.status(404).json({ error: "Terreno não encontrado" });
    }

    const pontos = await all(
      "SELECT numero, x, y FROM pontos_terreno WHERE terreno_id = ? ORDER BY numero",
      [req.params.id]
    );
    const confrontantes = await all(
      "SELECT nome, matricula, ponto_inicio, ponto_fim, ordem FROM confrontantes WHERE terreno_id = ? ORDER BY ordem",
      [req.params.id]
    );

    res.json({ pontos, confrontantes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar confrontantes" });
  }
};

// POST /admin/terrenos/:id/confrontantes
//
// "Confirmar e salvar" da tela de conferência: persiste a lista de
// pontos e confrontantes (já revisada/corrigida pelo administrador --
// pode ter vindo 100% da extração automática, 100% digitada à mão, ou
// uma mistura das duas). Substitui qualquer conjunto anterior desse
// terreno -- reenviar/reconfirmar não duplica linhas.
//
// Body esperado:
// { pontos: [{numero, x, y}], confrontantes: [{nome, matricula, ponto_inicio, ponto_fim, ordem}] }
exports.confirmarConfrontantes = async (req, res) => {
  const terrenoId = req.params.id;
  const { pontos, confrontantes } = req.body;

  if (!Array.isArray(pontos) || !Array.isArray(confrontantes)) {
    return res.status(400).json({ error: "'pontos' e 'confrontantes' precisam ser listas" });
  }

  for (const p of pontos) {
    if (!Number.isFinite(Number(p.numero))) {
      return res.status(400).json({ error: `Ponto com número inválido: ${JSON.stringify(p)}` });
    }
  }

  const numerosValidos = new Set(pontos.map((p) => Number(p.numero)));
  for (const c of confrontantes) {
    if (!c.nome || !String(c.nome).trim()) {
      return res.status(400).json({ error: "Todo confrontante precisa de um nome" });
    }
    if (!Number.isFinite(Number(c.ponto_inicio)) || !Number.isFinite(Number(c.ponto_fim))) {
      return res.status(400).json({ error: `Confrontante "${c.nome}" com ponto inicial/final inválido` });
    }
    if (Number(c.ponto_inicio) === Number(c.ponto_fim)) {
      return res.status(400).json({ error: `Confrontante "${c.nome}": ponto inicial e final não podem ser iguais` });
    }
    // Só valida contra os pontos enviados JUNTO -- não contra os já
    // salvos no banco, já que este mesmo request pode estar
    // cadastrando os pontos pela primeira vez.
    if (numerosValidos.size > 0) {
      if (!numerosValidos.has(Number(c.ponto_inicio)) || !numerosValidos.has(Number(c.ponto_fim))) {
        return res.status(400).json({
          error: `Confrontante "${c.nome}" referencia um ponto que não está na lista de pontos enviada`,
        });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const terreno = await client.query("SELECT id FROM terrenos WHERE id = $1", [terrenoId]);
    if (terreno.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Terreno não encontrado" });
    }

    // Substitui o conjunto anterior por completo -- mais simples e
    // robusto que tentar "diff" contra o que já existia, e evita
    // duplicar linhas se o admin confirmar de novo depois de editar.
    await client.query("DELETE FROM confrontantes WHERE terreno_id = $1", [terrenoId]);
    await client.query("DELETE FROM pontos_terreno WHERE terreno_id = $1", [terrenoId]);

    for (const p of pontos) {
      await client.query(
        "INSERT INTO pontos_terreno (terreno_id, numero, x, y) VALUES ($1, $2, $3, $4)",
        [terrenoId, Number(p.numero), p.x ?? null, p.y ?? null]
      );
    }

    for (const c of confrontantes) {
      await client.query(
        `INSERT INTO confrontantes (terreno_id, nome, matricula, ponto_inicio, ponto_fim, ordem)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          terrenoId,
          String(c.nome).trim(),
          c.matricula ? String(c.matricula).trim() : null,
          Number(c.ponto_inicio),
          Number(c.ponto_fim),
          Number.isFinite(Number(c.ordem)) ? Number(c.ordem) : 0,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ mensagem: "Confrontantes salvos com sucesso", pontos: pontos.length, confrontantes: confrontantes.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar confrontantes" });
  } finally {
    client.release();
  }
};

// Recalcula x/y de uma lista de pontos lat/lon usando um datum
// escolhido MANUALMENTE pelo Admin -- usado quando o memorial não
// informa o sistema de referência (ver aviso "precisa ser confirmado")
// e o Admin sabe/decide qual datum usar, sem precisar reenviar o
// arquivo original nem digitar as coordenadas ponto a ponto.
//
// Não grava nada no banco -- só devolve os x/y recalculados pro Admin
// conferir na mesma tela, igual ao fluxo normal de extração.
exports.recalcularCoordenadas = async (req, res) => {
  try {
    const { datum, pontos } = req.body || {};

    if (!DATUMS_ACEITOS.includes(datum)) {
      return res.status(400).json({
        error: `Datum inválido. Use um de: ${DATUMS_ACEITOS.join(", ")}`,
      });
    }

    if (!Array.isArray(pontos) || pontos.length === 0) {
      return res.status(400).json({ error: "Envie a lista de pontos (numero, lat, lon)" });
    }

    const pontosConvertidos = converterPontosParaUtm(pontos, datum);

    const algumConvertido = pontosConvertidos.some((p) => p.x !== null && p.y !== null);
    if (!algumConvertido) {
      return res.status(400).json({
        error: "Nenhum dos pontos enviados tinha latitude/longitude válidas pra converter.",
      });
    }

    return res.json({ pontos: pontosConvertidos, datum });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao recalcular as coordenadas" });
  }
};
