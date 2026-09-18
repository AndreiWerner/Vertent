// Testes da camada ADITIVA de metadados do memorial (área, unidade da
// área, perímetro, cota máxima e cota mínima).
//
// Mesmo estilo do regressao.test.cjs (Node puro, sem framework):
//   node src/utils/pdfExtractor/__tests__/metadados.test.cjs
// Sai com código != 0 se algo falhar.
//
// Inclui, no fim, a verificação mais importante desta etapa: que a
// presença dos metadados NÃO alterou nenhum ponto nem confrontante.

const assert = require("assert");

const { extrairMetadadosMemorial } = require("../metadados");
const { parseMemorialTexto } = require("../memorial");
const { normalizarUnidadeArea, extrairUnidadeArea } = require("../../areaUnidade");

let passou = 0;
let falhou = 0;

function teste(nome, fn) {
  try {
    fn();
    console.log(`OK   - ${nome}`);
    passou++;
  } catch (err) {
    console.log(`FALHOU - ${nome}`);
    console.log(`       ${err.message}`);
    falhou++;
  }
}

// =================================================================
// CASOS OBRIGATÓRIOS A-E (seção 15 do pedido)
// =================================================================

teste("CASO A: área em hectares com vírgula decimal ('Área: 5,7985 ha')", () => {
  const m = extrairMetadadosMemorial("Área: 5,7985 ha");
  assert.strictEqual(m.area, 5.7985);
  assert.strictEqual(m.area_unidade, "ha");
});

teste("CASO B: área com ponto decimal ('Área: 14.15 ha')", () => {
  const m = extrairMetadadosMemorial("Área: 14.15 ha");
  assert.strictEqual(m.area, 14.15);
  assert.strictEqual(m.area_unidade, "ha");
});

teste("CASO C: perímetro ('Perímetro: 965,65 m')", () => {
  const m = extrairMetadadosMemorial("Perímetro: 965,65 m");
  assert.strictEqual(m.perimetro, 965.65);
});

teste("CASO D: cotas máxima e mínima a partir das altitudes dos vértices", () => {
  const texto =
    "Inicia-se no vértice 1, de coordenadas N= 1,00 m e E= 1,00 m, altitude 749,78 m; " +
    "segue até o vértice 2, de coordenadas N= 2,00 m e E= 2,00 m, altitude 751,32 m; " +
    "segue até o vértice 3, de coordenadas N= 3,00 m e E= 3,00 m, altitude 742,11 m.";
  const m = extrairMetadadosMemorial(texto);
  assert.strictEqual(m.altura_max, 751.32);
  assert.strictEqual(m.altura_min, 742.11);
});

teste("CASO E: memorial sem cota -> null, sem inventar valores", () => {
  const texto =
    "Inicia-se no vértice 1, de coordenadas N= 7.743.633,23 m e E= 810.553,68 m, com " +
    "azimute 90° e distância 120,45 m até o vértice 2.";
  const m = extrairMetadadosMemorial(texto);
  assert.strictEqual(m.altura_max, null);
  assert.strictEqual(m.altura_min, null);
});

// =================================================================
// VARIAÇÕES DE REDAÇÃO
// =================================================================

teste("Área: variações de caixa e redação ('área total do imóvel de 14,15 HA')", () => {
  const m = extrairMetadadosMemorial("com área total do imóvel de 14,15 HA, situado...");
  assert.strictEqual(m.area, 14.15);
  assert.strictEqual(m.area_unidade, "ha");
});

teste("Área: 'hectares' por extenso", () => {
  const m = extrairMetadadosMemorial("Área de 5,7985 hectares.");
  assert.strictEqual(m.area, 5.7985);
  assert.strictEqual(m.area_unidade, "ha");
});

teste("Área: unidade diferente de hectare é preservada (m² / m2 / metros quadrados)", () => {
  assert.strictEqual(extrairMetadadosMemorial("Área: 1.200,50 m²").area_unidade, "m²");
  assert.strictEqual(extrairMetadadosMemorial("Área: 1200 m2").area_unidade, "m²");
  assert.strictEqual(
    extrairMetadadosMemorial("Área de 1200 metros quadrados").area_unidade,
    "m²"
  );
});

teste("Área: hectare NÃO é assumido quando o documento não traz unidade", () => {
  const m = extrairMetadadosMemorial("Área: 14.15");
  assert.strictEqual(m.area, 14.15);
  assert.strictEqual(m.area_unidade, null);
});

teste("Perímetro: variações ('Perimetro 965,65 metros', 'perímetro de 965,65 m')", () => {
  assert.strictEqual(extrairMetadadosMemorial("Perimetro 965,65 metros").perimetro, 965.65);
  assert.strictEqual(extrairMetadadosMemorial("perímetro de 965,65 m").perimetro, 965.65);
});

teste("Cotas: aceita 'Cota', 'Elevação' e 'Elev.' além de 'Altitude'", () => {
  const texto =
    "no vértice 1, Cota: 700,00 m; no vértice 2, Elevação 800,50 m; " +
    "no vértice 3, Elev. 650,25 m.";
  const m = extrairMetadadosMemorial(texto);
  assert.strictEqual(m.altura_max, 800.5);
  assert.strictEqual(m.altura_min, 650.25);
});

// =================================================================
// NÃO INVENTAR / NÃO CONFUNDIR NÚMEROS
// =================================================================

teste("Não pega número aleatório: documento sem área/perímetro -> tudo null", () => {
  const texto =
    "Matrícula 12.512. Do vértice 2 ao vértice 13, confronta com José Alves. " +
    "Azimute 123°45'67\" e distância 456,78 m.";
  const m = extrairMetadadosMemorial(texto);
  assert.strictEqual(m.area, null);
  assert.strictEqual(m.area_unidade, null);
  assert.strictEqual(m.perimetro, null);
  assert.strictEqual(m.altura_max, null);
  assert.strictEqual(m.altura_min, null);
});

teste("Não confunde a frase de fechamento ('...deste perímetro.') com um valor", () => {
  const texto =
    "até o vértice 1, ponto inicial da descrição deste perímetro. Matrícula 2.086.";
  assert.strictEqual(extrairMetadadosMemorial(texto).perimetro, null);
});

teste("Não usa distância/azimute como cota (exige rótulo de altitude)", () => {
  const texto = "no vértice 1, com azimute 90° e distância 749,78 m até o vértice 2.";
  const m = extrairMetadadosMemorial(texto);
  assert.strictEqual(m.altura_max, null);
  assert.strictEqual(m.altura_min, null);
});

teste("Não usa altitude solta de cabeçalho, sem vértice associado", () => {
  const texto = "Altitude média da região: 750,00 m. Documento sem vértices numerados.";
  const m = extrairMetadadosMemorial(texto);
  assert.strictEqual(m.altura_max, null);
  assert.strictEqual(m.altura_min, null);
});

teste("Texto vazio/indefinido não quebra", () => {
  for (const entrada of ["", null, undefined, "   "]) {
    const m = extrairMetadadosMemorial(entrada);
    assert.strictEqual(m.area, null);
    assert.strictEqual(m.perimetro, null);
    assert.strictEqual(m.altura_max, null);
  }
});

// =================================================================
// UNIDADE -- normalização (usada também no cadastro manual do Admin)
// =================================================================

teste("Unidade: HA / Ha / ha / hectare / hectares -> 'ha'", () => {
  for (const v of ["HA", "Ha", "ha", "hectare", "hectares"]) {
    assert.strictEqual(normalizarUnidadeArea(v), "ha", `falhou para "${v}"`);
  }
});

teste("Unidade: cadastro manual '14,15 ha' separa número e unidade", () => {
  const { parseNumero } = require("../../numero");
  assert.strictEqual(parseNumero("14,15 ha"), 14.15);
  assert.strictEqual(extrairUnidadeArea("14,15 ha"), "ha");
});

teste("Unidade: cadastro manual só com número continua funcionando (unidade null)", () => {
  const { parseNumero } = require("../../numero");
  assert.strictEqual(parseNumero("14.15"), 14.15);
  assert.strictEqual(extrairUnidadeArea("14.15"), null);
});

// =================================================================
// INTEGRAÇÃO -- metadados chegam no retorno de parseMemorialTexto()
// SEM alterar pontos/confrontantes (seções 13 e 19)
// =================================================================

// Memorial completo, com pontos, confrontantes, área, perímetro e
// altitudes -- exatamente o cenário da seção 19 do pedido.
const MEMORIAL_COMPLETO = `
  MEMORIAL DESCRITIVO
  Área: 5,7985 ha
  Perímetro: 965,65 m

  Inicia-se a descrição deste perímetro no vértice 1, de coordenadas
  N= 7.743.633,23 m e E= 810.553,68 m, altitude 749,78 m; deste, segue
  confrontando com o imóvel de João Batista Ferreira, Matrícula: 3.210
  com azimute 90 e distância 50 m até o vértice 2, de coordenadas
  N= 7.743.683,23 m e E= 810.603,68 m, altitude 751,32 m. Daí, passa a
  confrontar com o imóvel de Maria Aparecida Souza, Matrícula: 4.500
  com azimute 180 e distância 30 m até o vértice 3, de coordenadas
  N= 7.743.713,23 m e E= 810.633,68 m, altitude 742,11 m. Deste, volta
  a confrontar com o imóvel de João Batista Ferreira, Matrícula: 3.210
  com azimute 270 e distância 40 m até o vértice 1, ponto inicial da
  descrição deste perímetro. Sistema SIRGAS 2000, UTM, zona 24S.
`;

// "ANTES": como o parser se comportava sem a camada de metadados --
// reproduzido aqui chamando diretamente o formato narrativo, que é o
// código PROTEGIDO e NÃO foi alterado nesta etapa.
const memorialNarrativo = require("../formatos/memorialNarrativo");
const { detectarSistema } = require("../coordenadas");

teste("REGRESSÃO: metadados não alteram pontos/confrontantes (ANTES == DEPOIS)", () => {
  const sistema = detectarSistema(MEMORIAL_COMPLETO);
  const antes = memorialNarrativo.tentar(MEMORIAL_COMPLETO, sistema);
  const depois = parseMemorialTexto({ texto: MEMORIAL_COMPLETO });

  // quantidade e numeração dos pontos
  assert.strictEqual(depois.pontos.length, antes.pontos.length);
  assert.deepStrictEqual(
    depois.pontos.map((p) => p.numero),
    antes.pontos.map((p) => p.numero)
  );

  // quantidade, nomes, matrículas, intervalos e ordem dos confrontantes
  assert.strictEqual(depois.confrontantes.length, antes.confrontantes.length);
  assert.deepStrictEqual(depois.confrontantes, antes.confrontantes);
});

teste("REGRESSÃO: valores concretos de pontos/confrontantes do memorial completo", () => {
  const r = parseMemorialTexto({ texto: MEMORIAL_COMPLETO });
  assert.strictEqual(r.pontos.length, 3);
  assert.strictEqual(r.confrontantes.length, 3);
  assert.deepStrictEqual(
    r.confrontantes.map((c) => [c.ponto_inicio, c.ponto_fim, c.ordem]),
    [[1, 2, 0], [2, 3, 1], [3, 1, 2]]
  );
  assert.strictEqual(r.confrontantes[0].nome, "João Batista Ferreira");
  assert.strictEqual(r.confrontantes[0].matricula, "3.210");
  assert.strictEqual(r.confrontantes[1].matricula, "4.500");
  // coordenadas dos pontos inalteradas
  assert.strictEqual(r.pontos[0].y, 7743633.23);
  assert.strictEqual(r.pontos[0].x, 810553.68);
  assert.strictEqual(r.sistemaCoordenadas.tipo, "UTM");
});

teste("INTEGRAÇÃO: os 5 metadados vêm no retorno, junto dos campos já existentes", () => {
  const r = parseMemorialTexto({ texto: MEMORIAL_COMPLETO });

  assert.strictEqual(r.area, 5.7985);
  assert.strictEqual(r.area_unidade, "ha");
  assert.strictEqual(r.perimetro, 965.65);
  assert.strictEqual(r.altura_max, 751.32);
  assert.strictEqual(r.altura_min, 742.11);

  // contrato antigo intacto
  for (const campo of [
    "pontos",
    "confrontantes",
    "aviso",
    "sistemaCoordenadas",
    "formatoReconhecido",
    "coordenadasCompletas",
  ]) {
    assert.ok(campo in r, `campo "${campo}" sumiu do retorno`);
  }
});

teste("INTEGRAÇÃO: formato LEGADO também recebe os metadados", () => {
  const texto =
    "Área: 2,50 ha. Perímetro: 300,00 m. Do vértice 2 ao vértice 13, confronta com " +
    "José Alves, matrícula 999.";
  const r = parseMemorialTexto({ texto });
  assert.strictEqual(r.formatoReconhecido, "memorial-descritivo");
  assert.strictEqual(r.area, 2.5);
  assert.strictEqual(r.area_unidade, "ha");
  assert.strictEqual(r.perimetro, 300);
  // confrontante do formato legado inalterado
  assert.strictEqual(r.confrontantes.length, 1);
  assert.strictEqual(r.confrontantes[0].ponto_inicio, 2);
  assert.strictEqual(r.confrontantes[0].ponto_fim, 13);
});

teste("INTEGRAÇÃO: memorial sem metadados devolve null neles e não afeta o resto", () => {
  const texto =
    "Do vértice 2 ao vértice 13, confronta com José Alves, matrícula 999.";
  const r = parseMemorialTexto({ texto });
  assert.strictEqual(r.area, null);
  assert.strictEqual(r.area_unidade, null);
  assert.strictEqual(r.perimetro, null);
  assert.strictEqual(r.altura_max, null);
  assert.strictEqual(r.altura_min, null);
  assert.strictEqual(r.confrontantes.length, 1);
});

console.log();
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou > 0 ? 1 : 0);
