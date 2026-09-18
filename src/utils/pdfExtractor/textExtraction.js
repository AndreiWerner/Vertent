// utils/pdfExtractor/textExtraction.js
//
// Extrai o texto de um PDF com a POSIÇÃO (x, y) de cada palavra na
// página -- a posição é essencial para associar números de ponto às
// coordenadas e aos nomes de confrontantes (ver ../pdfExtractor.js).
//
// Duas estratégias, nessa ordem:
//   1. Camada de texto nativa do PDF (pdfjs-dist) -- rápida e precisa,
//      funciona sempre que o PDF não é uma imagem escaneada.
//   2. OCR (tesseract.js) sobre a página renderizada como imagem --
//      usada só quando (1) devolve texto insuficiente (heurística:
//      menos de MIN_NATIVE_CHARS caracteres no total), indicando que o
//      PDF provavelmente é uma planta escaneada/foto.

const path = require("path");
const { createCanvas } = require("@napi-rs/canvas");
const Tesseract = require("tesseract.js");

const MIN_NATIVE_CHARS = 40;

// Dados de idioma (português) empacotados junto do projeto -- em vez
// de baixar de um CDN externo a cada primeira vez que o OCR roda
// (o padrão do tesseract.js). Evita depender de rede em tempo de
// requisição (frágil em produção -- timeout, CDN fora do ar, etc.)
// numa dependência de BUILD (o arquivo já vai junto do deploy).
//
// LIMITAÇÃO CONHECIDA: o arquivo bundlado (src/assets/tessdata/por.traineddata.gz)
// é de uma versão antiga do Tesseract, sem o motor neural LSTM -- por
// isso usamos TESSERACT_ONLY abaixo. A qualidade do OCR em PDFs
// escaneados de baixa qualidade fica abaixo do que um traineddata
// moderno (LSTM) entregaria. Para melhorar: baixe um "por.traineddata.gz"
// mais novo em https://github.com/tesseract-ocr/tessdata_fast e
// substitua o arquivo (nenhuma mudança de código necessária) -- nesse
// caso, troque também TESSERACT_ONLY por Tesseract.OEM.LSTM_ONLY logo
// abaixo.
const TESSDATA_PATH = path.resolve(__dirname, "../../assets/tessdata");

async function loadPdfjs() {
  // pdfjs-dist é ESM-only nas versões recentes; import() dinâmico
  // funciona de dentro de um módulo CommonJS.
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

async function extractNative(buffer) {
  const pdfjsLib = await loadPdfjs();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const items = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    for (const item of content.items) {
      const text = (item.str || "").trim();
      if (!text) continue;

      // item.transform = [scaleX, skewX, skewY, scaleY, x, y] (origem
      // no canto INFERIOR esquerdo, padrão PDF) -- convertida para o
      // canto SUPERIOR esquerdo (padrão mais comum em telas/imagens),
      // pra ficar no mesmo referencial usado pelo caminho de OCR
      // abaixo (que já vem em coordenadas de imagem).
      const x = item.transform[4];
      const y = viewport.height - item.transform[5];

      items.push({ text, x, y, page: pageNum });
      totalChars += text.length;
    }
  }

  return { items, totalChars, pageCount: doc.numPages, pdfjsLib, doc };
}

async function extractWithOcr(buffer, pdfjsLib, doc) {
  const items = [];
  const worker = await Tesseract.createWorker("por", Tesseract.OEM.TESSERACT_ONLY, {
    langPath: TESSDATA_PATH,
    gzip: true,
    cacheMethod: "none",
  });

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      // Escala 2x: OCR sai bem melhor com mais resolução do que o
      // tamanho "real" (72dpi) do PDF.
      const viewport = page.getViewport({ scale: 2 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      await page.render({ canvasContext: context, viewport }).promise;

      const { data } = await worker.recognize(canvas.toBuffer("image/png"), {}, { blocks: true });

      for (const block of data.blocks || []) {
        for (const paragraph of block.paragraphs || []) {
          for (const line of paragraph.lines || []) {
            for (const word of line.words || []) {
              const text = (word.text || "").trim();
              if (!text) continue;

              // bbox do tesseract já está em coordenadas de imagem
              // (origem no canto superior esquerdo) -- só precisa
              // "desfazer" a escala 2x usada acima pra voltar pro
              // mesmo referencial do caminho nativo (escala 1x da
              // página).
              items.push({
                text,
                x: (word.bbox.x0 + word.bbox.x1) / 2 / 2,
                y: (word.bbox.y0 + word.bbox.y1) / 2 / 2,
                page: pageNum,
              });
            }
          }
        }
      }
    }
  } finally {
    await worker.terminate();
  }

  return items;
}

/**
 * @param {Buffer} buffer conteúdo do PDF
 * @returns {Promise<{ items: Array<{text:string,x:number,y:number,page:number}>, usouOcr: boolean }>}
 */
async function extractTextItems(buffer) {
  const { items, totalChars, pdfjsLib, doc } = await extractNative(buffer);

  if (totalChars >= MIN_NATIVE_CHARS) {
    return { items, usouOcr: false };
  }

  // Texto nativo insuficiente -> provável PDF escaneado/imagem.
  const ocrItems = await extractWithOcr(buffer, pdfjsLib, doc);
  return { items: ocrItems, usouOcr: true };
}

module.exports = { extractTextItems, MIN_NATIVE_CHARS };
