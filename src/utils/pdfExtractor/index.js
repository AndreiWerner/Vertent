// utils/pdfExtractor/index.js
//
// Ponto de entrada único do pipeline de extração:
//   PDF/DOCX/DOC -> texto (nativo, OCR, ou extração de Word)
//                -> parser de memorial/planta
//                -> pontos + confrontantes estruturados
//
// `extrairPlanta` continua PDF-only (o formato de planta em tabela
// depende de posição x/y na página, que só o PDF fornece). `extrairMemorial`
// agora aceita PDF, DOCX e DOC -- ver docExtraction.js e memorial.js.

const { extractTextItems } = require("./textExtraction");
const { parseItems } = require("./parse");
const { parseMemorialTexto } = require("./memorial");
const { extractTextFromDocx, extractTextFromDoc, detectarTipoArquivo } = require("./docExtraction");

async function extrairPlanta(buffer) {
  const { items, usouOcr } = await extractTextItems(buffer);
  const { pontos, confrontantes, aviso, formatoReconhecido } = parseItems(items);
  return { pontos, confrontantes, aviso, usouOcr, formatoReconhecido };
}

/**
 * @param {Buffer} buffer conteúdo do arquivo do memorial
 * @param {{nomeArquivo?: string, mimetype?: string}} [arquivo] metadados
 *   do upload, usados só pra decidir PDF vs DOCX vs DOC. Omitir mantém
 *   o comportamento anterior (sempre tratado como PDF) -- qualquer
 *   código existente que já chamava `extrairMemorial(buffer)` com um
 *   argumento só continua funcionando exatamente igual.
 */
async function extrairMemorial(buffer, arquivo = {}) {
  const tipo = detectarTipoArquivo(arquivo.nomeArquivo, arquivo.mimetype);

  if (tipo === "docx") {
    const texto = await extractTextFromDocx(buffer);
    const resultado = parseMemorialTexto({ texto });
    return { ...resultado, usouOcr: false };
  }

  if (tipo === "doc") {
    const texto = await extractTextFromDoc(buffer);
    const resultado = parseMemorialTexto({ texto });
    return { ...resultado, usouOcr: false };
  }

  // PDF (padrão -- mantém compatibilidade total com quem chama sem
  // passar `arquivo`, ou com originalname/mimetype de PDF).
  const { items, usouOcr } = await extractTextItems(buffer);
  const resultado = parseMemorialTexto({ items });
  return { ...resultado, usouOcr };
}

module.exports = { extrairPlanta, extrairMemorial };
