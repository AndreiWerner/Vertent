// utils/pdfExtractor/metadados.js
//
// CAMADA ADITIVA de metadados do memorial descritivo: área, unidade da
// área, perímetro, cota máxima e cota mínima.
//
// Este arquivo NÃO é um parser de memorial. Ele não enxerga nem
// produz pontos, confrontantes, intervalos, matrículas, ordem,
// sistema de coordenadas ou origin. Ele recebe o MESMO texto que o
// parser existente já extraiu (PDF nativo/OCR, DOCX ou DOC) e procura
// nele, de forma independente, cinco informações escalares.
//
// Por que separado:
//   - `formatos/memorialNarrativo.js`, `parse.js`, `coordenadas.js` e
//     `formatos/padrao10267.js` são CÓDIGO PROTEGIDO (perímetro e
//     confrontantes já validados em produção) e não foram tocados;
//   - a única integração é uma chamada em `memorial.js`, cujo
//     resultado é anexado ao objeto de retorno -- sem passar por
//     nenhuma estrutura de ponto/confrontante.
//
// PRINCÍPIO: não inventar. Quando um valor não é encontrado com
// contexto textual claro, o campo vem `null` -- nunca um número
// "provável" tirado do primeiro que aparecer no documento (o memorial
// é cheio de números: matrículas, azimutes, distâncias, coordenadas,
// numeração de vértices).

const { parseNumero } = require("../numero");
const { normalizarUnidadeArea, UNIDADE_ALTERNATIVA } = require("../areaUnidade");

// Um número "à brasileira" ou "à americana" -- a conversão em si fica
// por conta do `parseNumero()` já existente, que é quem conhece a
// convenção do projeto para milhar x decimal.
const NUM = "(-?\\d[\\d.,]*)";

// Qualificadores comuns depois da palavra "Área"/"Perímetro". São
// OPCIONAIS: "Área: 5,7985 ha" e "Área total do imóvel de 5,7985 ha"
// precisam funcionar igual (seção 3: identificar por contexto, com
// tolerância a pequenas variações de redação).
const QUALIFICADOR_AREA =
  "(?:\\s+(?:total|superficial|calculada|descrita|georreferenciada|remanescente|" +
  "do\\s+im[óo]vel|do\\s+terreno|do\\s+lote|da\\s+gleba|da\\s+parcela|da\\s+propriedade))*";
const QUALIFICADOR_PERIMETRO =
  "(?:\\s+(?:total|do\\s+im[óo]vel|do\\s+terreno|do\\s+lote|da\\s+gleba|da\\s+parcela))*";

// O que pode aparecer ENTRE o rótulo e o número: dois-pontos, traço,
// igual, ou uma ligação escrita por extenso ("de", "igual a", "é de",
// "com", "perfazendo"). Observe que vírgula e ponto final NÃO entram:
// isso é proposital e é o que impede a frase de fechamento do
// perímetro ("...ponto inicial da descrição deste perímetro.") de ser
// confundida com um valor de perímetro.
const LIGACAO =
  "(?:\\s*[:\\-–—=]\\s*|\\s+(?:de|igual\\s+a|[ée]\\s+de|com|perfazendo|totalizando)\\s+|\\s+)";

const ROTULO_AREA = "[ÁA]rea" + QUALIFICADOR_AREA;
const ROTULO_PERIMETRO = "[Pp]er[íi]metro" + QUALIFICADOR_PERIMETRO;

// 1) Área COM unidade explícita -- forma preferida, porque a unidade
//    confirma que aquele número é mesmo uma área.
const AREA_COM_UNIDADE_RE = new RegExp(
  ROTULO_AREA + LIGACAO + NUM + "\\s*(" + UNIDADE_ALTERNATIVA + ")",
  "gi"
);

// 2) Área SEM unidade -- só aceita a forma com separador explícito
//    ("Área: 14.15"), nunca a forma solta com espaço, para não capturar
//    um número que apenas calhou de vir depois da palavra.
const AREA_SEM_UNIDADE_RE = new RegExp(
  ROTULO_AREA + "\\s*[:\\-–—=]\\s*" + NUM,
  "gi"
);

// 3) Perímetro. A unidade (m / metros) é aceita mas não usada: a
//    coluna `terrenos.perimetro` sempre guardou metros e continua
//    assim -- nenhuma conversão foi introduzida.
const PERIMETRO_RE = new RegExp(
  ROTULO_PERIMETRO + LIGACAO + NUM + "\\s*(?:m\\b|metros\\b|ml\\b)?",
  "gi"
);

// 4) Menção a um vértice/ponto/marco/estaca -- usada SÓ para delimitar
//    a janela de busca das cotas (ver `extrairCotas`). É uma cópia
//    local e propositalmente simplificada: `memorialNarrativo.js` é
//    código protegido e não foi importado nem alterado, e esta regex
//    não produz ponto nenhum -- só posições dentro do texto.
const MENCAO_VERTICE_RE =
  /(?:v[ée]rtice|ponto|marco|estaca)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\-]{0,30})/gi;

// 5) Cota/altitude de um vértice.
const COTA_RE =
  /(?:altitude|cota|eleva[çc][ãa]o|elev)\s*\.?\s*(?:geom[ée]trica|ortom[ée]trica|elipsoidal|do\s+v[ée]rtice|do\s+ponto)?\s*[:\-–—=]?\s*(-?\d[\d.,]*)\s*(?:m\b|metros\b)?/gi;

// Janela (em caracteres) depois da menção de um vértice onde uma cota
// ainda é considerada "daquele vértice". Mesmo espírito do JANELA_MAX
// do parser narrativo: generosa o bastante para a frase inteira do
// vértice (que costuma trazer azimute e distância no meio), curta o
// bastante para não vazar para o vértice seguinte.
const JANELA_COTA = 300;

// Faixa de plausibilidade para uma altitude em metros. Não serve para
// "corrigir" nada -- serve só para descartar um número absurdo que
// tenha casado por acidente (ex.: um trecho de coordenada colado na
// palavra "cota" por falha de OCR). Cobre com folga qualquer terreno
// no Brasil e no mundo.
const ALTITUDE_MIN_PLAUSIVEL = -500;
const ALTITUDE_MAX_PLAUSIVEL = 9000;

function primeiroValor(texto, regex) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(texto))) {
    const valor = parseNumero(match[1]);
    if (valor !== null && Number.isFinite(valor)) {
      return { valor, match };
    }
  }
  return null;
}

/**
 * Área + unidade. Tenta primeiro a forma com unidade explícita; só
 * então a forma "Área: <número>" sem unidade (nesse caso a unidade
 * fica `null` -- nunca é assumido hectare).
 */
function extrairArea(texto) {
  const comUnidade = primeiroValor(texto, AREA_COM_UNIDADE_RE);
  if (comUnidade) {
    return {
      area: comUnidade.valor,
      area_unidade: normalizarUnidadeArea(comUnidade.match[2]),
    };
  }

  const semUnidade = primeiroValor(texto, AREA_SEM_UNIDADE_RE);
  if (semUnidade) {
    return { area: semUnidade.valor, area_unidade: null };
  }

  return { area: null, area_unidade: null };
}

function extrairPerimetro(texto) {
  const achado = primeiroValor(texto, PERIMETRO_RE);
  return achado ? achado.valor : null;
}

/**
 * Cota máxima e mínima.
 *
 * Regra da seção 6 do pedido: a altitude só conta quando está
 * ASSOCIADA a um vértice. Por isso as cotas não são procuradas no
 * documento inteiro -- são procuradas apenas dentro da janela de texto
 * que se segue a cada menção de vértice/ponto/marco. Uma "Altitude
 * média da região: 750 m" solta no cabeçalho, sem vértice antes, é
 * ignorada de propósito.
 *
 * Sem nenhuma cota confiável, devolve `{null, null}` -- os valores
 * nunca são derivados de coordenada, distância ou qualquer outro
 * número do memorial.
 */
function extrairCotas(texto) {
  const mencoes = [];
  MENCAO_VERTICE_RE.lastIndex = 0;
  let match;
  while ((match = MENCAO_VERTICE_RE.exec(texto))) {
    // Sem dígito nenhum não é identificador de vértice -- é frase
    // comum ("ponto inicial da descrição", "ponto de vista"). Mesmo
    // critério usado pelo parser narrativo, replicado aqui para não
    // precisar alterá-lo.
    if (!/\d/.test(match[1])) continue;
    mencoes.push({ index: match.index, fim: MENCAO_VERTICE_RE.lastIndex });
  }

  if (mencoes.length === 0) {
    return { altura_max: null, altura_min: null };
  }

  const cotas = [];
  for (let i = 0; i < mencoes.length; i++) {
    const atual = mencoes[i];
    const proximo = mencoes[i + 1];
    const fimJanela = Math.min(
      proximo ? proximo.index : texto.length,
      atual.fim + JANELA_COTA
    );
    const janela = texto.slice(atual.fim, fimJanela);

    COTA_RE.lastIndex = 0;
    let cotaMatch;
    while ((cotaMatch = COTA_RE.exec(janela))) {
      const valor = parseNumero(cotaMatch[1]);
      if (valor === null || !Number.isFinite(valor)) continue;
      if (valor < ALTITUDE_MIN_PLAUSIVEL || valor > ALTITUDE_MAX_PLAUSIVEL) continue;
      cotas.push(valor);
    }
  }

  if (cotas.length === 0) {
    return { altura_max: null, altura_min: null };
  }

  return {
    altura_max: Math.max(...cotas),
    altura_min: Math.min(...cotas),
  };
}

/**
 * Ponto de entrada da camada de metadados.
 *
 * @param {string} texto texto completo do memorial, exatamente o mesmo
 *   que o parser de pontos/confrontantes já recebe.
 * @returns {{area: number|null, area_unidade: string|null,
 *            perimetro: number|null, altura_max: number|null,
 *            altura_min: number|null}}
 */
function extrairMetadadosMemorial(texto) {
  const s = String(texto || "");
  if (!s.trim()) {
    return {
      area: null,
      area_unidade: null,
      perimetro: null,
      altura_max: null,
      altura_min: null,
    };
  }

  const { area, area_unidade } = extrairArea(s);
  const perimetro = extrairPerimetro(s);
  const { altura_max, altura_min } = extrairCotas(s);

  return { area, area_unidade, perimetro, altura_max, altura_min };
}

module.exports = {
  extrairMetadadosMemorial,
  // exportados para teste unitário isolado de cada regra
  extrairArea,
  extrairPerimetro,
  extrairCotas,
};
