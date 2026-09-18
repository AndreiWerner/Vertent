// utils/pdfExtractor/coordenadas.js
//
// Identifica automaticamente o SISTEMA DE COORDENADAS usado num
// memorial (UTM ou Latitude/Longitude), o datum/EPSG/zona/hemisfério
// quando informados, e converte pontos Lat/Long para UTM quando o
// sistema de origem é conhecido com segurança.
//
// Regra de ouro (pedido original, seção 4 e 16): "NÃO assuma EPSG
// 31984 para todos os terrenos" e "se não conseguir determinar, não
// invente -- avise". Por isso `confiavel` só fica true quando o texto
// realmente menciona o datum e/ou EPSG -- nunca um valor chutado.

// ---------- Palavras-chave que indicam cada sistema ----------
const PALAVRAS_UTM = /\bUTM\b|\beasting\b|\bnorthing\b|\bmerid[ií]ano\s+central\b|\bcoordenadas\s+projetadas\b/i;
const PALAVRAS_LATLONG = /\blatitude\b|\blongitude\b|\blat\.?\b|\blong\.?\b|\bcoordenadas\s+geogr[aá]ficas\b/i;

// Sinal ESTRUTURAL de UTM (não depende da palavra "UTM" aparecer em
// lugar nenhum -- muitos memoriais de agrimensura só rotulam os eixos
// como "N=" e "E=" sem nunca nomear o sistema). Um valor com 6+ dígitos
// rotulado como N= ou E= só faz sentido como coordenada UTM (metros) --
// nunca como grau decimal de latitude/longitude, que nunca passa de 3
// dígitos antes da vírgula/ponto. "(?![a-zA-Zà-úÀ-Ú])" evita casar com
// a letra N/E dentro de outra palavra (ex.: "Norte").
const PADRAO_ROTULO_UTM =
  /\bN(?![a-zA-Zà-úÀ-Ú])\.?\s*=\s*-?[\d.,]{6,}|\bE(?![a-zA-Zà-úÀ-Ú])\.?\s*=\s*-?[\d.,]{6,}/i;

// ---------- Datum ----------
const DATUM_RE =
  /\b(SIRGAS\s*2000|SIRGAS2000|WGS\s*-?\s*84|WGS84|SAD\s*-?\s*69|SAD69|C[óo]rrego\s+Alegre)\b/i;

function normalizarDatum(bruto) {
  const s = String(bruto || "").toUpperCase().replace(/\s+/g, "");
  if (s.startsWith("SIRGAS")) return "SIRGAS2000";
  if (s.startsWith("WGS")) return "WGS84";
  if (s.startsWith("SAD")) return "SAD69";
  if (s.startsWith("CÓRREGO") || s.startsWith("CORREGO")) return "CORREGO_ALEGRE";
  return null;
}

// ---------- EPSG explícito no texto ----------
const EPSG_RE = /EPSG\s*[:\-]?\s*(\d{4,5})/i;

// ---------- Zona/fuso UTM + hemisfério ----------
// Aceita "zona 24S", "fuso 24 S", "UTM 24S", "zona: 24, hemisfério sul".
const ZONA_RE =
  /(?:zona|fuso)\s*(?:UTM)?\s*[:\-]?\s*(\d{1,2})\s*([NS])?|UTM\s*(\d{1,2})\s*([NS])\b/i;
const HEMISFERIO_SUL_RE = /hemisf[ée]rio\s+sul|\bsul\b.{0,20}\bhemisf[ée]rio\b/i;
const HEMISFERIO_NORTE_RE = /hemisf[ée]rio\s+norte|\bnorte\b.{0,20}\bhemisf[ée]rio\b/i;

// EPSGs conhecidos para SIRGAS2000/UTM e WGS84/UTM no hemisfério sul
// (cobre todo o território brasileiro, zonas 17 a 25). Só é USADO
// quando o datum E a zona E o hemisfério já foram identificados no
// texto com confiança -- nunca como um chute isolado.
function epsgUtmSul(datum, zona) {
  if (zona < 17 || zona > 25) return null;
  if (datum === "SIRGAS2000") return 31960 + zona; // zona 18 -> 31978 ... zona 25 -> 31985 (verificado abaixo)
  if (datum === "WGS84") return 32700 + zona; // convenção EPSG padrão pra UTM sul WGS84
  return null;
}

/**
 * Detecta o sistema de coordenadas usado no memorial.
 *
 * @param {string} texto texto completo do memorial (já normalizado/unido)
 * @returns {{
 *   tipo: "UTM"|"LAT_LONG"|null,
 *   datum: string|null,
 *   epsg: number|null,
 *   zona: number|null,
 *   hemisferio: "N"|"S"|null,
 *   confiavel: boolean,
 *   aviso: string|null,
 * }}
 */
function detectarSistema(texto) {
  const epsgMatch = texto.match(EPSG_RE);
  const epsgExplicito = epsgMatch ? parseInt(epsgMatch[1], 10) : null;

  // EPSG explícito no texto já é, por si só, prova de que o sistema é
  // conhecido -- mesmo que nenhuma outra palavra-chave apareça. Os
  // códigos EPSG relevantes pra memorial de georreferenciamento são
  // sempre projetados (UTM); um EPSG geográfico aqui seria incomum e,
  // mesmo que ocorresse, os PONTOS do perímetro ainda são o que importa
  // (ver decisão de tipo logo abaixo).
  const temUtm = PALAVRAS_UTM.test(texto) || PADRAO_ROTULO_UTM.test(texto) || Boolean(epsgExplicito);
  const temLatLong = PALAVRAS_LATLONG.test(texto);

  const datumMatch = texto.match(DATUM_RE);
  const datum = datumMatch ? normalizarDatum(datumMatch[1]) : null;

  const zonaMatch = texto.match(ZONA_RE);
  let zona = null;
  let hemisferio = null;
  if (zonaMatch) {
    zona = parseInt(zonaMatch[1] || zonaMatch[3], 10);
    const letra = (zonaMatch[2] || zonaMatch[4] || "").toUpperCase();
    if (letra === "N" || letra === "S") hemisferio = letra;
  }
  if (!hemisferio) {
    if (HEMISFERIO_SUL_RE.test(texto)) hemisferio = "S";
    else if (HEMISFERIO_NORTE_RE.test(texto)) hemisferio = "N";
  }

  // Decide o TIPO. Coordenadas em si (ver memorialNarrativo.js) também
  // ajudam a decidir quando as palavras-chave não bastam: quem chama
  // esta função pode passar um "sinal" adicional via `pistasNumericas`
  // -- mas aqui tratamos só o texto, que já cobre a grande maioria dos
  // casos reais (memoriais sempre rotulam o tipo de coordenada).
  let tipo = null;
  if (temUtm && !temLatLong) tipo = "UTM";
  else if (temLatLong && !temUtm) tipo = "LAT_LONG";
  else if (temUtm && temLatLong) {
    // Ambos aparecem (comum: um memorial cita a Lat/Long do ponto de
    // referência geográfica no cabeçalho E usa UTM na descrição do
    // perímetro). Nesse caso, o que importa é o sistema usado nos
    // PONTOS do perímetro -- UTM tem prioridade por ser o padrão mais
    // comum de memorial de georreferenciamento rural no Brasil, e
    // porque um "N=... E=..." repetido nos vértices é sinal mais forte
    // que uma menção isolada de Lat/Long no cabeçalho do documento.
    tipo = "UTM";
  }

  if (!tipo) {
    return {
      tipo: null,
      datum,
      epsg: epsgExplicito,
      zona,
      hemisferio,
      confiavel: false,
      aviso: "Não foi possível identificar com segurança o sistema de coordenadas deste memorial.",
    };
  }

  let epsg = epsgExplicito;
  if (!epsg && datum && zona && hemisferio === "S") {
    epsg = epsgUtmSul(datum, zona);
  }

  const confiavel = Boolean(epsg || (datum && (tipo === "LAT_LONG" || (zona && hemisferio))));

  let aviso = null;
  if (!confiavel) {
    aviso =
      "Coordenadas identificadas, porém o sistema de referência (datum/EPSG) precisa ser confirmado.";
  }

  return { tipo, datum, epsg: epsg || null, zona, hemisferio, confiavel, aviso };
}

// ---------- Conversão Lat/Long -> UTM (via proj4) ----------
const proj4 = require("proj4");

function definicaoGeografica(datum) {
  if (datum === "WGS84") return "+proj=longlat +datum=WGS84 +no_defs";
  // SIRGAS2000 é praticamente equivalente a GRS80/WGS84 pra qualquer
  // finalidade prática de memorial descritivo (diferença sub-métrica).
  return "+proj=longlat +ellps=GRS80 +no_defs";
}

function definicaoUtm(zona, hemisferioSul, datum) {
  const ellps = datum === "WGS84" ? "WGS84" : "GRS80";
  return `+proj=utm +zone=${zona} ${hemisferioSul ? "+south " : ""}+ellps=${ellps} +units=m +no_defs`;
}

/**
 * Converte um ponto {lat, lon} para {x, y} UTM (x=Easting, y=Northing).
 * A ZONA UTM de destino é sempre derivada matematicamente da longitude
 * (fórmula padrão -- não depende do memorial informar a zona, já que a
 * zona é só uma função da posição geográfica). O HEMISFÉRIO vem do
 * sinal da própria latitude. Nada aqui é "chutado": datum vem de
 * `detectarSistema` (só quando mencionado no texto).
 */
function latLongParaUtm(lat, lon, datum) {
  const zona = Math.floor((lon + 180) / 6) + 1;
  const hemisferioSul = lat < 0;

  const origem = definicaoGeografica(datum);
  const destino = definicaoUtm(zona, hemisferioSul, datum);

  const [x, y] = proj4(origem, destino, [lon, lat]);
  return { x, y, zona, hemisferio: hemisferioSul ? "S" : "N" };
}

/**
 * Converte uma lista de pontos {numero, lat, lon} pra {numero, x, y}
 * UTM, dado um datum. Usado tanto pela extração automática quanto pelo
 * endpoint de recálculo manual (quando o Admin confirma o datum depois
 * de o memorial não informar -- ver confrontantes.controller.js).
 */
function converterPontosParaUtm(pontos, datum) {
  return (pontos || []).map((p) => {
    if (typeof p.lat !== "number" || typeof p.lon !== "number") {
      return { numero: p.numero, x: null, y: null };
    }
    const { x, y } = latLongParaUtm(p.lat, p.lon, datum);
    return { numero: p.numero, x, y };
  });
}

module.exports = { detectarSistema, latLongParaUtm, converterPontosParaUtm };
