// utils/pdfExtractor/formatos/memorialNarrativo.js
//
// Formato de memorial descritivo NARRATIVO (perímetro contínuo): ao
// contrário do "padrão 10.267" (quadro de coordenadas em tabela +
// frase isolada "do ponto X ao Y, confronta com..."), este formato
// descreve o perímetro em prosa corrida -- cada vértice aparece com
// sua coordenada embutida na frase, e a troca de confrontante é
// ANUNCIADA no meio da descrição, sem nunca repetir os dois pontos do
// intervalo na mesma frase. Exemplo real (UTM):
//
//   "...até o vértice 13, de coordenadas N=7.743.591,39 m e
//   E=810.635,19 m. Daí, passa a confrontar com o imóvel de Valdir
//   Lopes Faria, Matrícula: R – 10 - 2.086 com azimute..."
//
// A mesma ESTRUTURA (vértice numerado + coordenada na mesma frase,
// troca de confrontante anunciada no meio) também é usada por
// memoriais em Latitude/Longitude -- só o formato da coordenada em si
// muda. Por isso este arquivo separa: (1) a detecção da ESTRUTURA
// (sempre igual) de (2) a extração do VALOR da coordenada (plugável,
// escolhida pelo chamador via `sistema.tipo` -- ver coordenadas.js).
//
// O intervalo de cada confrontante não vem escrito em lugar nenhum --
// tem que ser DEDUZIDO pela posição dos vértices no texto: o último
// vértice citado antes de uma troca de confrontante é, ao mesmo
// tempo, o ponto final do confrontante anterior E o ponto inicial do
// próximo. Ver `tentar()` no final deste arquivo.

const { paraNumero } = require("./padrao10267");

// Qualquer menção a "vértice X" ou "ponto X" -- COM ou SEM coordenada
// logo em seguida (a versão de fechamento do perímetro, ex. "até o
// vértice 2, ponto inicial da descrição", não repete a coordenada).
// Isso também substitui a necessidade de uma regex separada só pro
// fechamento: o último marco do texto já é, naturalmente, essa
// menção final.
//
// X pode ser um número simples ("vértice 13", padrão de memoriais
// "clássicos") OU um código alfanumérico ("vértice HEEO-P-8671",
// comum em memoriais gerados por sistemas de georreferenciamento tipo
// SIGEF/INCRA) -- o parser não pode assumir um formato só. Exigimos
// pelo menos um dígito no token (`temDigito`, verificado depois do
// match) pra não confundir com frases como "ponto inicial da
// descrição" ou "ponto de vista", que não têm número nenhum.
const VERTICE_RE = /(?:v[ée]rtice|ponto)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\-]{0,30})/gi;

// Tamanho máximo da janela de texto (depois de cada menção de vértice)
// onde procuramos a coordenada correspondente. Generoso o bastante pra
// cobrir frases longas com azimute/distância no meio, mas limitado pra
// não vazar pra coordenada do PRÓXIMO vértice.
const JANELA_MAX = 300;

// Aceita tanto a primeira menção ("segue confrontando com o imóvel
// de...", gerúndio) quanto as trocas seguintes ("passa a confrontar" /
// "volta a confrontar", infinitivo) -- por isso NÃO dependemos de
// detectar as palavras de transição ("Daí"/"Deste"/"Este"), que o
// extrator de PDF às vezes quebra de forma imprevisível (ex.: "D aí"
// em vez de "Daí"). O gatilho real e estável é sempre
// "confront(ando|ar) com ... NOME".
//
// "o imóvel de" é OPCIONAL (alguns memoriais escrevem só "confrontando
// com Fulano..." direto, sem essa expressão) e o fim da frase aceita
// tanto "com azimute" quanto "com o seguinte azimute e distância"
// (variação comum de redação) -- ver seção 10 do pedido original:
// "pequenas diferenças de redação" não podem quebrar o reconhecimento.
const CONFRONTA_RE =
  /confronta(?:ndo|r)(?:-se)?\s+com\s+(?:o\s+im[oó]vel\s+de\s+)?([^,]+?)\s*,\s*Matr[ií]cula:?\s*([\s\S]*?)\s*,?\s*com\s+(?:o\s+seguinte\s+)?azimute/gi;

/**
 * Normaliza uma matrícula capturada do texto corrido.
 *
 * Cuidados específicos (ver pedido original, seção "ATENÇÃO ÀS
 * MATRÍCULAS"):
 *  - o extrator de PDF às vezes quebra dois dígitos de um mesmo
 *    número com um espaço no meio (ex.: "R – 1 0 - 2.086", onde "10"
 *    virou "1 0") -- isso é sempre um artefato de extração, nunca um
 *    espaço "de verdade" dentro de uma matrícula, então é seguro colar
 *    de volta;
 *  - o ponto decimal de "2.086"/"1.054" é parte da matrícula, não fim
 *    de frase -- por isso este parser NUNCA usa ponto como separador
 *    de frase pra decidir onde a matrícula termina (quem decide isso
 *    é sempre "até antes de ` com azimute`", nunca pontuação);
 *  - traços diferentes (– en dash, — em dash) são uniformizados para
 *    "-", e o espaçamento ao redor do traço é normalizado.
 */
function normalizarMatricula(bruto) {
  let s = String(bruto || "").trim();
  s = s.replace(/[–—−]/g, "-"); // en dash / em dash / minus sign -> hífen comum
  s = s.replace(/\s*-\s*/g, "-"); // remove espaço ao redor do hífen
  s = s.replace(/(\d)\s+(\d)/g, "$1$2"); // cola dígitos quebrados por espaço (artefato do PDF)
  s = s.replace(/[.,;:]+$/, ""); // pontuação de frase grudada no fim (não no meio -- "2.086" preservado)
  return s.trim();
}

function limparNome(bruto) {
  return String(bruto || "")
    .replace(/\s+/g, " ")
    .replace(/^[,;\s]+|[,;\s]+$/g, "")
    .trim();
}

// ---------- Extração da COORDENADA (parte plugável) ----------

// UTM: "N=... m e E=... m" (ou variações -- "=" opcional, "m" opcional,
// ordem N/E ou E/N tanto faz, já que cada valor é identificado pelo
// próprio rótulo, nunca pela posição). O "(?![a-zA-Zà-úÀ-Ú])" evita
// casar com a letra N/E no meio de outra palavra (ex.: "Norte").
function extrairUtmDaJanela(janela) {
  const nMatch = janela.match(/\bN(?![a-zA-Zà-úÀ-Ú])\.?\s*=?\s*(-?[\d.,]+)/i);
  const eMatch = janela.match(/\bE(?![a-zA-Zà-úÀ-Ú])\.?\s*=?\s*(-?[\d.,]+)/i);
  if (!nMatch || !eMatch) return null;

  const y = paraNumero(nMatch[1]); // N = northing
  const x = paraNumero(eMatch[1]); // E = easting
  if (y === null || x === null) return null;

  return { x, y, northingOriginal: nMatch[1], eastingOriginal: eMatch[1] };
}

function grauMinSegParaDecimal(grau, min, seg, letraHemisferio) {
  const g = Math.abs(parseFloat(String(grau).replace(",", ".")));
  const m = parseFloat(String(min).replace(",", "."));
  const s = seg !== undefined && seg !== null ? parseFloat(String(seg).replace(",", ".")) : 0;
  if (!Number.isFinite(g) || !Number.isFinite(m)) return null;

  let decimal = g + m / 60 + (Number.isFinite(s) ? s : 0) / 3600;

  const negativoPeloSinal = String(grau).trim().startsWith("-");
  const negativoPelaLetra = /[SWOo]/i.test(letraHemisferio || "");
  if (negativoPeloSinal || negativoPelaLetra) decimal = -decimal;

  return decimal;
}

// Busca UM valor (latitude OU longitude) por rótulo, independente de
// qual vem primeiro no texto -- memoriais diferentes escrevem em
// ordens diferentes ("Latitude...Longitude..." ou o inverso), então
// nunca assumimos uma ordem fixa. Tenta DMS com símbolos primeiro (mais
// específico, tem "°"), depois DMS "nu" (só números separados por
// espaço, sem °/'/" nenhum -- variação de redação mais rara, mas
// pedida explicitamente), com decimal como última alternativa.
function extrairValorGeografico(janela, rotulo, letrasHemisferioPositivo, letrasHemisferioNegativo) {
  const letras = `${letrasHemisferioPositivo}${letrasHemisferioNegativo}`;

  const dmsComSimbolosRe = new RegExp(
    `(${rotulo}\\.?\\s*[:\\-]?\\s*(-?\\d{1,3})\\s*[°º]\\s*(\\d{1,2})\\s*['′]\\s*(\\d{1,2}(?:[.,]\\d+)?)?\\s*["″]?\\s*([${letras}])?)`,
    "i"
  );
  const dmsComSimbolos = janela.match(dmsComSimbolosRe);
  if (dmsComSimbolos) {
    const valor = grauMinSegParaDecimal(dmsComSimbolos[2], dmsComSimbolos[3], dmsComSimbolos[4], dmsComSimbolos[5]);
    if (Number.isFinite(valor)) return { valor, original: dmsComSimbolos[1].trim() };
  }

  // DMS "nu": só três números separados por espaço, sem nenhum
  // símbolo de grau/minuto/segundo (ex.: "Lat 20 15 32,608 S"). Exige
  // exatamente 3 números pra não confundir com um decimal solto.
  const dmsNuRe = new RegExp(
    `(${rotulo}\\.?\\s*[:\\-]?\\s*(-?\\d{1,3})\\s+(\\d{1,2})\\s+(\\d{1,2}(?:[.,]\\d+)?)\\s*([${letras}])?)(?!\\s*[°º\\d])`,
    "i"
  );
  const dmsNu = janela.match(dmsNuRe);
  if (dmsNu) {
    const valor = grauMinSegParaDecimal(dmsNu[2], dmsNu[3], dmsNu[4], dmsNu[5]);
    if (Number.isFinite(valor)) return { valor, original: dmsNu[1].trim() };
  }

  const decimalRe = new RegExp(
    `(${rotulo}\\.?\\s*[:\\-]?\\s*(-?\\d{1,3}(?:[.,]\\d+)?)\\s*([${letras}])?)(?!\\s*[°º])`,
    "i"
  );
  const decMatch = janela.match(decimalRe);
  if (decMatch) {
    let valor = parseFloat(decMatch[2].replace(",", "."));
    if (!Number.isFinite(valor)) return null;
    const letraNeg = new RegExp(`[${letrasHemisferioNegativo}]`, "i");
    if (letraNeg.test(decMatch[3] || "")) valor = -Math.abs(valor);
    return { valor, original: decMatch[1].trim() };
  }

  return null;
}

// Lat/Long: aceita "Latitude"/"Lat" e "Longitude"/"Long" em QUALQUER
// ordem (memoriais diferentes escrevem em ordens diferentes -- ex.:
// "(Longitude: ..., Latitude: ...)), decimal OU graus/minutos/
// segundos (com ou sem os símbolos °/'/"), com hemisfério pelo sinal
// (-20) ou pela letra (S/N/E/W/O). Devolve também o texto ORIGINAL tal
// como escrito no memorial (preservação pedida -- ver memorial.js).
function extrairLatLongDaJanela(janela) {
  const lat = extrairValorGeografico(janela, "Lat(?:itude)?", "N", "S");
  const lon = extrairValorGeografico(janela, "Long(?:itude)?", "E", "WOo");
  if (!lat || !lon) return null;
  return {
    lat: lat.valor,
    lon: lon.valor,
    latitudeOriginal: lat.original,
    longitudeOriginal: lon.original,
  };
}

/**
 * @param {string} texto texto completo do memorial (já unido, na
 *   ordem em que aparece -- de um PDF com posição, ou de um DOC/DOCX
 *   sem posição nenhuma; este parser nunca precisou de posição)
 * @param {{tipo?: "UTM"|"LAT_LONG"}} sistema sistema de coordenadas já
 *   detectado (ver coordenadas.js) -- default UTM por compatibilidade
 *   com o comportamento anterior (memoriais que não passam `sistema`
 *   continuam funcionando exatamente como antes).
 * @returns {{pontos: Array, confrontantes: Array} | null}
 */
function tentar(texto, sistema = {}) {
  const tipo = sistema.tipo === "LAT_LONG" ? "LAT_LONG" : "UTM";
  const extrairCoordenada = tipo === "LAT_LONG" ? extrairLatLongDaJanela : extrairUtmDaJanela;

  // Alguns memoriais numeram vértices com números simples (1, 2, 3...)
  // -- nesse caso usamos o número EXATO como está escrito, é
  // informação que o topógrafo já deu. Outros usam códigos
  // alfanuméricos (ex.: "HEEO-P-8671", padrão comum de sistemas de
  // georreferenciamento tipo SIGEF/INCRA) -- como não há um "número"
  // certo pra usar (e a coluna do banco exige inteiro), numeramos
  // sequencialmente na ordem em que aparecem no texto. Os dois casos
  // convivem no mesmo mapa por segurança, mas nunca se misturam dentro
  // de um mesmo memorial na prática.
  const mapaSequencial = new Map();
  function numeroDoCodigo(codigoBruto) {
    if (/^\d{1,6}$/.test(codigoBruto)) {
      return parseInt(codigoBruto, 10);
    }
    if (!mapaSequencial.has(codigoBruto)) {
      mapaSequencial.set(codigoBruto, mapaSequencial.size + 1);
    }
    return mapaSequencial.get(codigoBruto);
  }

  const marcos = []; // {numero, identificador, index, fim} -- posição de CADA menção de vértice, na ordem
  VERTICE_RE.lastIndex = 0;
  let match;
  while ((match = VERTICE_RE.exec(texto))) {
    const codigoBruto = match[1];
    // Sem nenhum dígito, não é um código de vértice de verdade -- é
    // uma frase comum tipo "ponto inicial da descrição" ou "ponto de
    // vista", que também casa com o padrão "ponto <palavra>".
    if (!/\d/.test(codigoBruto)) continue;

    const numero = numeroDoCodigo(codigoBruto);
    if (!Number.isFinite(numero)) continue;
    marcos.push({ numero, identificador: codigoBruto, index: match.index, fim: VERTICE_RE.lastIndex });
  }

  const pontos = [];
  const vistos = new Set();
  for (let i = 0; i < marcos.length; i++) {
    const marco = marcos[i];
    if (vistos.has(marco.numero)) continue; // primeira ocorrência com coordenada vale, repetições (ex.: fechamento) não

    const proximo = marcos[i + 1];
    const fimJanela = Math.min(
      proximo ? proximo.index : texto.length,
      marco.fim + JANELA_MAX
    );
    const janela = texto.slice(marco.fim, fimJanela);

    const coordenada = extrairCoordenada(janela);
    if (!coordenada) continue;

    vistos.add(marco.numero);
    pontos.push(
      tipo === "LAT_LONG"
        ? {
            numero: marco.numero,
            identificador: marco.identificador,
            lat: coordenada.lat,
            lon: coordenada.lon,
            latitudeOriginal: coordenada.latitudeOriginal,
            longitudeOriginal: coordenada.longitudeOriginal,
          }
        : {
            numero: marco.numero,
            identificador: marco.identificador,
            x: coordenada.x,
            y: coordenada.y,
            northingOriginal: coordenada.northingOriginal,
            eastingOriginal: coordenada.eastingOriginal,
          }
    );
  }

  // Vértice de FECHAMENTO do perímetro: como marcos agora inclui
  // QUALQUER menção (com ou sem coordenada), a própria última menção
  // do texto já costuma ser a referência de fechamento (ex.: "até o
  // vértice 2, ponto inicial da descrição..."). Se não houver marco
  // nenhum, não há como fechar.
  const vertexFechamento = marcos.length ? marcos[marcos.length - 1].numero : null;

  // Confrontantes: cada ocorrência de "confronta(ndo/r) com o imóvel
  // de NOME, Matrícula: MAT" anuncia o confrontante do trecho que
  // COMEÇA no último vértice citado antes dela.
  const anuncios = [];
  CONFRONTA_RE.lastIndex = 0;
  while ((match = CONFRONTA_RE.exec(texto))) {
    const nome = limparNome(match[1]);
    const matricula = normalizarMatricula(match[2]);
    if (!nome) continue;
    anuncios.push({ nome, matricula: matricula || null, index: match.index });
  }

  if (pontos.length === 0 && anuncios.length === 0) {
    return null;
  }

  // Para cada anúncio, o "marco-fronteira" é o último vértice citado
  // ANTES dele no texto -- ao mesmo tempo ponto final do confrontante
  // anterior e ponto inicial deste.
  const fronteiras = anuncios.map((anuncio) => {
    let ultimo = null;
    for (const marco of marcos) {
      if (marco.index >= anuncio.index) break;
      ultimo = marco.numero;
    }
    return ultimo;
  });

  const confrontantes = [];
  for (let i = 0; i < anuncios.length; i++) {
    const pontoInicio = fronteiras[i];
    const pontoFim =
      i + 1 < fronteiras.length ? fronteiras[i + 1] : vertexFechamento;

    if (pontoInicio === null || pontoFim === null || pontoInicio === pontoFim) {
      continue;
    }

    confrontantes.push({
      nome: anuncios[i].nome,
      matricula: anuncios[i].matricula,
      ponto_inicio: pontoInicio,
      ponto_fim: pontoFim,
      ordem: confrontantes.length,
    });
  }

  if (pontos.length === 0 && confrontantes.length === 0) {
    return null;
  }

  return { pontos, confrontantes };
}

module.exports = { tentar, normalizarMatricula };
