// utils/pdfExtractor/docExtraction.js
//
// Extrai texto puro de arquivos Word (.doc e .docx), pra alimentar o
// MESMO parser de memorial usado pelo PDF (ver memorial.js). Ao
// contrário do PDF (que dá posição x/y de cada palavra via
// pdfjs-dist), a extração de um .doc/.docx só devolve texto corrido,
// sem coordenadas na página -- por isso os formatos que dependem de
// TABELA por posição (formatos/padrao10267.js,
// formatos/tabelaComCabecalho.js) não se aplicam a Word; só o formato
// narrativo (formatos/memorialNarrativo.js), que já é 100% baseado em
// texto corrido, funciona igual para PDF e Word. Ver orquestração em
// memorial.js -> parseMemorialTexto.
//
// .docx (Office Open XML, 2007+): usamos `mammoth`, biblioteca pura
// JS (sem binário nativo), lê o XML interno do .docx diretamente.
// Funciona igual em qualquer ambiente Node, incluindo o Render.
//
// .doc (formato binário OLE antigo, pré-2007): usamos `word-extractor`,
// também pura JS (parseia o Compound File Binary Format sem depender
// de `antiword`/LibreOffice instalados no servidor). É uma biblioteca
// bem menos madura que o suporte a .docx (formato binário legado é
// mais difícil de interpretar de forma 100% confiável) -- funciona
// bem pro caso comum (texto corrido gerado pelo Word), mas documentos
// .doc com estruturas muito incomuns podem eventualmente falhar. Ver
// tratamento de erro em extractTextFromDoc.

const mammoth = require("mammoth");
const WordExtractor = require("word-extractor");

async function extractTextFromDocx(buffer) {
  const resultado = await mammoth.extractRawText({ buffer });
  return resultado.value || "";
}

async function extractTextFromDoc(buffer) {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody() || "";
}

/**
 * Detecta o tipo de arquivo (pdf/docx/doc) a partir do nome e/ou
 * mimetype. Prioriza a extensão do nome (mais confiável que o
 * mimetype, que navegadores/clientes às vezes mandam genérico como
 * "application/octet-stream").
 */
function detectarTipoArquivo(nomeArquivo, mimetype) {
  const nome = String(nomeArquivo || "").toLowerCase();

  if (nome.endsWith(".docx")) return "docx";
  if (nome.endsWith(".doc")) return "doc";
  if (nome.endsWith(".pdf")) return "pdf";

  const mime = String(mimetype || "").toLowerCase();
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx";
  }
  if (mime === "application/msword") return "doc";
  if (mime === "application/pdf") return "pdf";

  // Padrão: assume PDF (comportamento anterior, mantido por
  // compatibilidade -- todo o pipeline já existente só lidava com PDF).
  return "pdf";
}

module.exports = { extractTextFromDocx, extractTextFromDoc, detectarTipoArquivo };
