// utils/pdfExtractor/parse.js
//
// Transforma a lista de {text, x, y, page} (ver ./textExtraction.js)
// em dados ESTRUTURADOS: pontos numerados com coordenadas, e
// confrontantes associados a um intervalo de pontos.
//
// Isso é uma HEURÍSTICA, não um parser garantido -- plantas de
// levantamento variam de layout entre escritórios/topógrafos. Foi
// desenhada em cima do padrão mais comum em plantas de
// georreferenciamento no Brasil (Lei 10.267): um "quadro de
// coordenadas" (vértice + E + N) e uma descrição textual do tipo "do
// vértice X ao Y, confronta com Fulano, matrícula NNN". Por isso a
// tela de conferência do admin (ver controllers/admin/confrontantes.controller.js
// -> enviarPlanta) é OBRIGATÓRIA antes de qualquer coisa ser
// realmente salva -- ver o pedido original, seção "TELA DE
// CONFERÊNCIA NO ADMIN".

// Aceita "V12", "P12", "PV12", "Vértice 12", "Ponto 12" ou só "12" --
// em todos os casos o número do ponto é o que importa.
const PONTO_TOKEN = /^(?:V|P|PV)?0*(\d{1,4})$/i;

// Só precisa reconhecer "isso parece um número" -- a interpretação de
// verdade (separador decimal vírgula OU ponto, com OU sem separador de
// milhar) fica por conta de `paraNumero`, chamada logo em seguida em
// `extrairPontos`. Coordenadas UTM tipicamente vêm SEM separador de
// milhar (ex.: "123456.78"), diferente de área/perímetro no restante
// do sistema -- por isso não dá pra exigir o agrupamento de 3 em 3.
const COORD_TOKEN = /^-?[\d.,]+$/;

const MATRICULA_RE = /matr[ií]cula[s]?\s*n?[ºo°]?[:\s]*([\d.\-/]{2,20})/i;

// A ordem das alternativas importa: sem \b, "a" (sozinho) casaria com
// o "a" de "ao" antes de "ao" ser tentado, sobrando "o" pro próximo
// grupo -- \b em cada palavra evita esse casamento parcial.
const INTERVALO_RE =
  /(?:v[ée]rtice|ponto)s?\s*(?:n[ºo°]?\s*)?(\w+)\s*(?:\bat[ée]\b|\bao\b|\ba\b|-|–|→|->)\s*(?:v[ée]rtice|ponto)?\s*(?:n[ºo°]?\s*)?(\w+)/i;

const CONFRONTA_RE = /confronta(?:nte)?(?:\s*(?:com|:))?\s+([^,.\n]{2,80})/i;

function numeroDoToken(token) {
  const match = String(token).match(PONTO_TOKEN);
  if (!match) return null;
  const numero = parseInt(match[1], 10);
  return Number.isFinite(numero) ? numero : null;
}

function paraNumero(texto) {
  // mesma convenção de utils/numero.js (o admin já usa esse padrão
  // pros campos de área/perímetro/altura -- reaproveitado aqui pra
  // interpretar coordenadas no mesmo formato).
  const limpo = String(texto).trim();
  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");
  let normalizado = limpo;
  if (temVirgula && temPonto) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    normalizado = limpo.replace(",", ".");
  }
  const numero = parseFloat(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

// Agrupa itens que estão aproximadamente na mesma linha (mesma altura
// "y", com uma tolerância) -- é assim que uma "linha de tabela" é
// reconstruída a partir de palavras soltas.
function agruparPorLinha(items, tolerancia = 4) {
  const porPagina = new Map();
  for (const item of items) {
    if (!porPagina.has(item.page)) porPagina.set(item.page, []);
    porPagina.get(item.page).push(item);
  }

  const linhas = [];
  for (const pageItems of porPagina.values()) {
    const ordenado = [...pageItems].sort((a, b) => a.y - b.y || a.x - b.x);
    let atual = [];
    let ultimoY = null;

    for (const item of ordenado) {
      if (ultimoY !== null && Math.abs(item.y - ultimoY) > tolerancia) {
        if (atual.length) linhas.push(atual);
        atual = [];
      }
      atual.push(item);
      ultimoY = item.y;
    }
    if (atual.length) linhas.push(atual);
  }

  return linhas.map((linha) => linha.sort((a, b) => a.x - b.x));
}

/**
 * Procura linhas no formato "<ponto> <coordenada> <coordenada>"
 * (quadro de coordenadas) e devolve os pontos encontrados.
 */
function extrairPontos(linhas) {
  const pontos = [];

  for (const linha of linhas) {
    if (linha.length < 3) continue;

    const numero = numeroDoToken(linha[0].text);
    if (numero === null) continue;

    const coords = linha
      .slice(1)
      .filter((item) => COORD_TOKEN.test(item.text))
      .map((item) => paraNumero(item.text))
      .filter((n) => n !== null);

    if (coords.length >= 2) {
      pontos.push({ numero, x: coords[0], y: coords[1] });
    }
  }

  // Se o mesmo número aparecer mais de uma vez (ex.: citado de novo
  // fora da tabela), fica só a primeira ocorrência com coordenadas.
  const vistos = new Set();
  return pontos.filter((p) => {
    if (vistos.has(p.numero)) return false;
    vistos.add(p.numero);
    return true;
  });
}

/**
 * Procura, no texto corrido, trechos "do ponto X ao Y ... confronta
 * com NOME ... matrícula NNN" e devolve os confrontantes encontrados.
 * Funciona por FRASE (dividida por pontuação, não por quebra de linha
 * visual -- uma frase pode "quebrar" em duas linhas no PDF).
 */
function extrairConfrontantes(textoCompleto) {
  const trechos = textoCompleto
    .split(/(?<=[.;])\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const confrontantes = [];
  let ordem = 0;

  for (const trecho of trechos) {
    const intervalo = trecho.match(INTERVALO_RE);
    if (!intervalo) continue;

    const pontoInicio = numeroDoToken(intervalo[1]);
    const pontoFim = numeroDoToken(intervalo[2]);
    if (pontoInicio === null || pontoFim === null || pontoInicio === pontoFim) continue;

    const matriculaMatch = trecho.match(MATRICULA_RE);
    const confrontaMatch = trecho.match(CONFRONTA_RE);

    if (!confrontaMatch) continue;

    let nome = confrontaMatch[1].trim();
    // Se a matrícula foi capturada dentro do mesmo trecho do nome
    // (ex.: "João da Silva, matrícula 1234"), tira a matrícula do nome.
    if (matriculaMatch) {
      nome = nome.replace(MATRICULA_RE, "").replace(/,\s*$/, "").trim();
    }
    nome = nome.replace(/^com\s+/i, "").trim();
    if (!nome) continue;

    confrontantes.push({
      nome,
      // remove um ponto final de frase que às vezes fica grudado
      // (ex.: "matrícula 1234." no fim da sentença) -- mas preserva
      // pontos que são parte do formato da matrícula em si (ex.:
      // "12.345-6"), já que só tira o ÚLTIMO caractere se for ".".
      matricula: matriculaMatch ? matriculaMatch[1].trim().replace(/\.$/, "") : null,
      ponto_inicio: pontoInicio,
      ponto_fim: pontoFim,
      ordem: ordem++,
    });
  }

  return confrontantes;
}

/**
 * @param {Array<{text:string,x:number,y:number,page:number}>} items
 * @returns {{ pontos: Array, confrontantes: Array, aviso: string|null }}
 */
function parsePadrao10267(items) {
  const linhas = agruparPorLinha(items);
  const pontos = extrairPontos(linhas);

  // Para os CONFRONTANTES (diferente de `pontos`, que depende da
  // posição de cada linha da tabela), a quebra de linha VISUAL não
  // importa -- uma frase pode quebrar em duas linhas no PDF (comum em
  // descrições mais longas). Por isso todo o texto é unido com espaço
  // (não "\n") antes de ser dividido em frases de verdade, só por
  // pontuação -- ver `extrairConfrontantes`.
  const textoCompleto = linhas.map((linha) => linha.map((i) => i.text).join(" ")).join(" ");
  const confrontantes = extrairConfrontantes(textoCompleto);

  let aviso = null;
  if (pontos.length === 0 && confrontantes.length === 0) {
    aviso =
      "Não foi possível identificar automaticamente os pontos e confrontantes neste PDF. " +
      "Revise os dados manualmente.";
  } else if (confrontantes.length === 0) {
    aviso =
      "Os pontos foram identificados, mas nenhum confrontante foi reconhecido automaticamente. " +
      "Revise os dados manualmente.";
  } else if (pontos.length === 0) {
    aviso =
      "Confrontantes foram identificados, mas as coordenadas dos pontos não foram encontradas " +
      "(os números dos pontos ainda podem ser usados como referência). Revise os dados manualmente.";
  }

  return { pontos, confrontantes, aviso };
}

module.exports = { parsePadrao10267, numeroDoToken, paraNumero };
