// Normalização da UNIDADE da área.
//
// `terrenos.area` continua sendo uma coluna numérica (DOUBLE
// PRECISION) -- ver schema.sql. Quem já converte o texto em número é o
// `parseNumero()` (utils/numero.js), que por construção DESCARTA
// qualquer sufixo não numérico ("5,7985 ha" -> 5.7985). Este arquivo é
// a peça que faltava: capturar essa unidade ANTES de ela ser
// descartada, e devolvê-la sempre na mesma forma canônica, para ser
// gravada na coluna nova `terrenos.area_unidade` (TEXT).
//
// `numero.js` não foi alterado -- o comportamento dele continua
// exatamente o mesmo para todo mundo que já o usava.

// Ordem IMPORTA: as variações mais longas vêm primeiro, senão "ha"
// casaria antes de "hectares" e "m" antes de "m²". Cada grupo aponta
// para a forma canônica usada no banco.
const UNIDADES = [
  { canonica: "ha", padrao: /\b(?:hectares?|ha)\b/i },
  { canonica: "m²", padrao: /\b(?:metros?\s+quadrados?|m\s*[²2])(?![\w])/i },
  { canonica: "km²", padrao: /\b(?:quil[óo]metros?\s+quadrados?|km\s*[²2])(?![\w])/i },
  { canonica: "alqueire", padrao: /\b(?:alqueires?)\b/i },
];

// Alternativa combinada, para ser embutida em regexes maiores (ex.: a
// extração de área do memorial, em pdfExtractor/metadados.js). Mesma
// ordem/prioridade da lista acima.
const UNIDADE_ALTERNATIVA =
  "(?:hectares?|ha|metros?\\s+quadrados?|m\\s*[²2]|quil[óo]metros?\\s+quadrados?|km\\s*[²2]|alqueires?)";

/**
 * Converte qualquer grafia de unidade de área para a forma canônica.
 *
 *   "HA" / "Ha" / "hectare" / "hectares"      -> "ha"
 *   "m2" / "m²" / "metros quadrados"          -> "m²"
 *   "km2" / "km²"                             -> "km²"
 *   "alqueire" / "alqueires"                  -> "alqueire"
 *
 * Nunca assume hectare por padrão: uma entrada sem unidade
 * reconhecível devolve `null` (a unidade fica desconhecida, não
 * "chutada"). Ver seção 1 do pedido.
 *
 * @param {string|null|undefined} bruto
 * @returns {string|null}
 */
function normalizarUnidadeArea(bruto) {
  if (bruto === null || bruto === undefined) return null;

  const texto = String(bruto).trim();
  if (!texto) return null;

  for (const { canonica, padrao } of UNIDADES) {
    if (padrao.test(texto)) return canonica;
  }
  return null;
}

/**
 * Extrai a unidade de um valor de área escrito junto com o número.
 *
 *   "14,15 ha"  -> "ha"
 *   "1200 m2"   -> "m²"
 *   "14.15"     -> null  (só o número, sem unidade -- cadastro manual
 *                         antigo continua funcionando igual)
 *
 * É só um apelido semântico de `normalizarUnidadeArea` (que já
 * procura a unidade em qualquer posição do texto), mantido separado
 * porque deixa a intenção explícita em quem chama.
 *
 * @param {string|number|null|undefined} valorComUnidade
 * @returns {string|null}
 */
function extrairUnidadeArea(valorComUnidade) {
  if (typeof valorComUnidade === "number") return null;
  return normalizarUnidadeArea(valorComUnidade);
}

module.exports = { normalizarUnidadeArea, extrairUnidadeArea, UNIDADE_ALTERNATIVA };
