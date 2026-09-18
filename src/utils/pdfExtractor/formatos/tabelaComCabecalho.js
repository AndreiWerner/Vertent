// Parser de quadros de coordenadas com cabeçalho.
// Aceita PONTO E N, PONTO N E, PONTO X Y e PONTO Y X.
// A posição das colunas é determinada pelo cabeçalho; não assume
// que a primeira coordenada é sempre E.

const { numeroDoToken, paraNumero } = require("./padrao10267");

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function ehCoord(texto) {
  return /^-?[\d.,]+$/.test(String(texto ?? "").trim());
}

function agruparPorLinha(items, tolerancia = 4) {
  const porPagina = new Map();
  for (const item of items || []) {
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
  return linhas.map((l) => l.sort((a, b) => a.x - b.x));
}

function detectarCabecalho(linha) {
  const texto = normalizar(linha.map((i) => i.text).join(" "));
  const tokens = linha.map((i) => ({
    ...i,
    n: normalizar(i.text),
  }));

  const p = tokens.findIndex((t) => /^(PONTO|P|VERTICE|VERTICE|V)$/.test(t.n));
  const e = tokens.findIndex((t) => /^(E|ESTE|EASTING|X)$/.test(t.n));
  const n = tokens.findIndex((t) => /^(N|NORTE|NORTHING|Y)$/.test(t.n));

  if (p < 0 || e < 0 || n < 0 || e === n) return null;

  // X/Y pode significar E/N dependendo da convenção do quadro.
  // Para cabeçalhos explícitos E/N, a semântica é inequívoca.
  const eToken = tokens[e].n;
  const nToken = tokens[n].n;
  const eixoX = eToken === "X" && nToken === "Y" ? "X" : "E";
  const eixoY = eToken === "X" && nToken === "Y" ? "Y" : "N";

  return { pontoIndex: p, xIndex: e, yIndex: n, eixoX, eixoY, texto };
}

function parseTabela(items) {
  const linhas = agruparPorLinha(items);
  let cabecalho = null;
  let linhaCabecalho = -1;

  for (let i = 0; i < linhas.length; i++) {
    const h = detectarCabecalho(linhas[i]);
    if (h) {
      cabecalho = h;
      linhaCabecalho = i;
      break;
    }
  }

  if (!cabecalho) return null;

  const pontos = [];
  const vistos = new Set();

  for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const p = linha[cabecalho.pontoIndex];
    if (!p) continue;

    const numero = numeroDoToken(p.text);
    if (numero === null || vistos.has(numero)) continue;

    const ix = linha[cabecalho.xIndex];
    const iy = linha[cabecalho.yIndex];
    if (!ix || !iy || !ehCoord(ix.text) || !ehCoord(iy.text)) continue;

    const x = paraNumero(ix.text);
    const y = paraNumero(iy.text);
    if (x === null || y === null) continue;

    vistos.add(numero);
    pontos.push({ numero, x, y });
  }

  if (!pontos.length) return null;

  return {
    pontos,
    confrontantes: [],
    aviso: null,
    formatoReconhecido: "tabela-com-cabecalho",
    cabecalho: {
      x: cabecalho.eixoX,
      y: cabecalho.eixoY,
    },
  };
}

module.exports = { parseTabela };
