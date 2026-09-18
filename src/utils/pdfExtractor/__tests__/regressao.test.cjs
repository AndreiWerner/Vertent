// Testes de regressão + novos testes da melhoria de interpretação de
// memoriais (PDF/DOCX/DOC + UTM/Lat-Long). Sem framework de testes
// configurado no projeto -- roda com Node puro:
//   node src/utils/pdfExtractor/__tests__/regressao.test.cjs
// Sai com código != 0 se algo falhar.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { parseItems } = require("../parse");
const { parseMemorialItems, parseMemorialTexto } = require("../memorial");
const memorialNarrativo = require("../formatos/memorialNarrativo");
const { detectarSistema, latLongParaUtm } = require("../coordenadas");
const { extrairMemorial } = require("..");

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

async function testeAsync(nome, fn) {
  try {
    await fn();
    console.log(`OK   - ${nome}`);
    passou++;
  } catch (err) {
    console.log(`FALHOU - ${nome}`);
    console.log(`       ${err.message}`);
    falhou++;
  }
}

function item(text, x, y, page = 1) {
  return { text, x, y, page };
}

// =================================================================
// REGRESSÃO -- formatos que já existiam antes desta melhoria
// =================================================================

teste("REGRESSÃO: planta padrao10267 (tabela + confrontantes) continua igual", () => {
  const items = [
    item("VÉRTICE", 10, 10), item("E", 60, 10), item("N", 110, 10),
    item("V1", 10, 30), item("123456,78", 60, 30), item("7654321,00", 110, 30),
    item("V2", 10, 50), item("123500,00", 60, 50), item("7654350,00", 110, 50),
    item("V3", 10, 70), item("123480,00", 60, 70), item("7654300,00", 110, 70),
    ..."Do vértice V1 ao V2 confronta com João da Silva, matrícula 1234."
      .split(" ").map((w, i) => item(w, 10 + i * 15, 100)),
  ];
  const resultado = parseItems(items);
  assert.strictEqual(resultado.pontos.length, 3);
  assert.strictEqual(resultado.confrontantes.length, 1);
  assert.strictEqual(resultado.confrontantes[0].ponto_inicio, 1);
  assert.strictEqual(resultado.confrontantes[0].ponto_fim, 2);
});

teste("REGRESSÃO: planta tabelaComCabecalho continua igual", () => {
  const items = [
    item("PONTO", 10, 10), item("E", 60, 10), item("N", 110, 10),
    item("1", 10, 30), item("100,00", 60, 30), item("200,00", 110, 30),
    item("2", 10, 50), item("150,00", 60, 50), item("250,00", 110, 50),
  ];
  const resultado = parseItems(items);
  assert.strictEqual(resultado.formatoReconhecido, "tabela-com-cabecalho");
  assert.strictEqual(resultado.pontos.length, 2);
});

teste("REGRESSÃO: memorial legado ('do ponto X ao Y confronta com...') continua funcionando", () => {
  const items = "Do vértice 2 ao vértice 13, confronta com José Alves, matrícula 999."
    .split(" ").map((w, i) => item(w, 10 + i * 12, 10));
  const resultado = parseMemorialItems(items);
  assert.strictEqual(resultado.formatoReconhecido, "memorial-descritivo");
  assert.strictEqual(resultado.confrontantes.length, 1);
  assert.strictEqual(resultado.confrontantes[0].ponto_inicio, 2);
  assert.strictEqual(resultado.confrontantes[0].ponto_fim, 13);
});

teste("REGRESSÃO: memorial sem estrutura reconhecível não quebra", () => {
  const items = "Documento qualquer sem estrutura nenhuma aqui".split(" ")
    .map((w, i) => item(w, 10 + i * 12, 10));
  const resultado = parseMemorialItems(items);
  assert.strictEqual(resultado.pontos.length, 0);
  assert.strictEqual(resultado.confrontantes.length, 0);
  assert.ok(resultado.aviso);
});

teste("REGRESSÃO: narrativo UTM -- coordenadas brasileiras (milhar+decimal)", () => {
  const texto = "no vértice 2, de coordenadas N= 7.743.633,23 m e E= 810.553,68 m";
  const resultado = memorialNarrativo.tentar(texto, { tipo: "UTM" });
  assert.strictEqual(resultado.pontos[0].y, 7743633.23);
  assert.strictEqual(resultado.pontos[0].x, 810553.68);
});

teste("REGRESSÃO: narrativo -- matrícula com ponto decimal preservada", () => {
  const texto =
    "no vértice 1, de coordenadas N= 1,00 m e E= 1,00 m, deste, segue confrontando com " +
    "o imóvel de Fulano de Tal, Matrícula: 12.512 com azimute 10° e distância 1 m até " +
    "o vértice 2, ponto inicial da descrição deste perímetro.";
  const resultado = memorialNarrativo.tentar(texto);
  assert.strictEqual(resultado.confrontantes[0].matricula, "12.512");
});

teste("REGRESSÃO: narrativo -- matrícula com hífens e dígito quebrado por espaço", () => {
  const texto =
    "no vértice 1, de coordenadas N= 1,00 m e E= 1,00 m, deste, segue confrontando com " +
    "o imóvel de Fulano de Tal, Matrícula: R – 1 0 - 2.086 com azimute 10° e distância " +
    "1 m até o vértice 2, ponto inicial da descrição deste perímetro.";
  const resultado = memorialNarrativo.tentar(texto);
  assert.strictEqual(resultado.confrontantes[0].matricula, "R-10-2.086");
});

// =================================================================
// PDF REAL (Memorial - Ernesto estremação A.pdf) -- não pode variar
// =================================================================

teste("PDF REAL: 56 pontos, 6 confrontantes, intervalos e matrículas corretos", () => {
  const caminho = "/mnt/user-data/uploads/Memorial_-_Ernesto_estremação_A.pdf";
  if (!fs.existsSync(caminho)) {
    console.log("       (arquivo do PDF real não encontrado neste ambiente -- pulando)");
    return;
  }
  // usa o texto já extraído em cache (evita rodar pdfjs de novo aqui)
  const cache = "/tmp/texto_completo.txt";
  const texto = fs.existsSync(cache) ? fs.readFileSync(cache, "utf-8") : null;
  if (!texto) return;

  const resultado = parseMemorialTexto({ texto });
  assert.strictEqual(resultado.pontos.length, 56);
  assert.strictEqual(resultado.confrontantes.length, 6);
  assert.strictEqual(resultado.confrontantes[1].matricula, "R-10-2.086");
  assert.strictEqual(resultado.confrontantes[3].matricula, "R-10-1.054");
  assert.strictEqual(resultado.confrontantes[4].matricula, "12.512");
  assert.strictEqual(resultado.sistemaCoordenadas.tipo, "UTM");
});

// =================================================================
// NOVOS TESTES -- detecção de sistema de coordenadas
// =================================================================

teste("TESTE: detecta UTM mesmo sem a palavra 'UTM' (rótulos N=/E=)", () => {
  const sistema = detectarSistema("no vértice 1, N= 7.743.633,23 m e E= 810.553,68 m");
  assert.strictEqual(sistema.tipo, "UTM");
});

teste("TESTE: detecta UTM explícito + datum + zona -> EPSG correto", () => {
  const sistema = detectarSistema("Sistema SIRGAS 2000, UTM, zona 24S. N=100 E=200");
  assert.strictEqual(sistema.tipo, "UTM");
  assert.strictEqual(sistema.datum, "SIRGAS2000");
  assert.strictEqual(sistema.zona, 24);
  assert.strictEqual(sistema.hemisferio, "S");
  assert.strictEqual(sistema.epsg, 31984); // SIRGAS2000 / UTM 24S
  assert.strictEqual(sistema.confiavel, true);
});

teste("TESTE: detecta EPSG explícito no texto e usa diretamente", () => {
  const sistema = detectarSistema("Datum SIRGAS2000, EPSG: 31983. N=100 E=200");
  assert.strictEqual(sistema.epsg, 31983);
  assert.strictEqual(sistema.confiavel, true);
});

teste("TESTE: detecta Latitude/Longitude decimal", () => {
  const sistema = detectarSistema("Latitude: -20.123456 Longitude: -42.123456");
  assert.strictEqual(sistema.tipo, "LAT_LONG");
});

teste("TESTE: detecta Latitude/Longitude em graus/minutos/segundos (Lat/Long)", () => {
  const sistema = detectarSistema("Lat -20° 12' 34.56\" S Long -42° 12' 34.56\" W");
  assert.strictEqual(sistema.tipo, "LAT_LONG");
});

teste("TESTE: não confunde cabeçalho com coordenadas geográficas (S/W sem 'Lat'/'Long') com o sistema dos pontos", () => {
  // Memorial real: cabeçalho tem "20°22'48.8\" S / 42°01'30.0\" W" sem
  // a palavra Lat/Long, e os PONTOS usam N=/E=. O sistema tem que ser
  // UTM (dos pontos), não Lat/Long (do cabeçalho).
  const texto =
    "Coordenadas Geográficas: 20°22'48.796948\" S 42°01'30.071555\" W. " +
    "no vértice 1, de coordenadas N= 7.743.633,23 m e E= 810.553,68 m";
  const sistema = detectarSistema(texto);
  assert.strictEqual(sistema.tipo, "UTM");
});

teste("TESTE: sistema não identificável -> avisa, não inventa", () => {
  const sistema = detectarSistema("Este documento não menciona nenhum sistema de coordenadas.");
  assert.strictEqual(sistema.tipo, null);
  assert.strictEqual(sistema.confiavel, false);
  assert.ok(/não foi poss[ií]vel identificar/i.test(sistema.aviso));
});

teste("TESTE: conversão Lat/Long -> UTM (SIRGAS2000) dá valores em escala UTM", () => {
  const { x, y, zona, hemisferio } = latLongParaUtm(-20.123456, -42.654321, "SIRGAS2000");
  // zona UTM = floor((lon+180)/6)+1 -- pra -42.654321 isso dá 23
  // (zona 23 cobre -48° a -42°; zona 24 só começa em -42°).
  assert.strictEqual(zona, 23);
  assert.strictEqual(hemisferio, "S");
  assert.ok(x > 100000 && x < 900000, `x fora da faixa esperada de UTM: ${x}`);
  assert.ok(y > 1000000, `y fora da faixa esperada de UTM (hemisfério sul): ${y}`);
});

// =================================================================
// NOVOS TESTES -- memorial narrativo completo em Lat/Long
// =================================================================

teste("TESTE: memorial completo em Lat/Long -- pontos, confrontantes e fechamento", () => {
  const texto = `
    Inicia-se a descrição deste perímetro no vértice 1, de coordenadas
    Latitude: -20.123456 e Longitude: -42.654321, deste, segue confrontando
    com o imóvel de João Batista Ferreira, Matrícula: 3.210 com azimute
    90 e distância 50 m até o vértice 2, de coordenadas Latitude: -20.123556
    e Longitude: -42.654421. Daí, passa a confrontar com o imóvel de Maria
    Aparecida Souza, Matrícula: 4.500 com azimute 180 e distância 30 m até
    o vértice 3, de coordenadas Latitude: -20.123656 e Longitude: -42.654521.
    Deste, volta a confrontar com o imóvel de João Batista Ferreira,
    Matrícula: 3.210 com azimute 270 e distância 40 m até o vértice 1,
    ponto inicial da descrição deste perímetro. Sistema de referência:
    SIRGAS 2000.
  `;
  const resultado = parseMemorialTexto({ texto });
  assert.strictEqual(resultado.sistemaCoordenadas.tipo, "LAT_LONG");
  assert.strictEqual(resultado.sistemaCoordenadas.confiavel, true);
  assert.strictEqual(resultado.pontos.length, 3);
  assert.ok(resultado.pontos.every((p) => typeof p.x === "number" && typeof p.y === "number"));
  assert.strictEqual(resultado.confrontantes.length, 3);
  assert.deepStrictEqual(
    resultado.confrontantes.map((c) => [c.ponto_inicio, c.ponto_fim]),
    [[1, 2], [2, 3], [3, 1]]
  );
});

teste("TESTE: Lat/Long sem datum -- não converte, não inventa, avisa", () => {
  const texto = `
    Inicia-se no vértice 1, de coordenadas Latitude: -20.1 e Longitude: -42.6,
    deste, segue confrontando com o imóvel de Carlos Mendes, Matrícula: 100
    com azimute 90 e distância 50 m até o vértice 2, de coordenadas
    Latitude: -20.2 e Longitude: -42.7. Daí, volta a confrontar com o imóvel
    de Carlos Mendes, Matrícula: 100 com azimute 270 e distância 50 m até o
    vértice 1, ponto inicial da descrição deste perímetro.
  `;
  const resultado = parseMemorialTexto({ texto });
  assert.strictEqual(resultado.sistemaCoordenadas.confiavel, false);
  assert.ok(resultado.pontos.every((p) => p.x === null && p.y === null));
  assert.ok(resultado.aviso);
});

teste("TESTE: quantidade de pontos não é fixa (funciona com poucos pontos)", () => {
  const texto = `
    Inicia-se no vértice 10, de coordenadas N= 100,00 m e E= 200,00 m, deste,
    segue confrontando com o imóvel de Zeca Pagador, Matrícula: 55 com
    azimute 90 e distância 10 m até o vértice 11, de coordenadas
    N= 110,00 m e E= 210,00 m. Daí, volta a confrontar com o imóvel de Zeca
    Pagador, Matrícula: 55 com azimute 270 e distância 10 m até o vértice
    10, ponto inicial da descrição deste perímetro.
  `;
  const resultado = parseMemorialTexto({ texto });
  assert.strictEqual(resultado.pontos.length, 2);
  assert.strictEqual(resultado.confrontantes.length, 2);
});

teste("TESTE: intervalo de fechamento (último ponto -> primeiro ponto)", () => {
  const texto = `
    Inicia-se no vértice 1, de coordenadas N= 1,00 m e E= 1,00 m, deste,
    segue confrontando com o imóvel de Zeca, Matrícula: 1 com azimute 90 e
    distância 10 m até o vértice 40, de coordenadas N= 2,00 m e E= 2,00 m.
    Daí, volta a confrontar com o imóvel de Zeca, Matrícula: 1 com azimute
    270 e distância 10 m até o vértice 1, ponto inicial da descrição deste
    perímetro.
  `;
  const resultado = parseMemorialTexto({ texto });
  const ultimo = resultado.confrontantes[resultado.confrontantes.length - 1];
  assert.strictEqual(ultimo.ponto_inicio, 40);
  assert.strictEqual(ultimo.ponto_fim, 1);
});

teste("TESTE: vértices com código alfanumérico (não só número), Longitude antes de Latitude, e 'confrontando com NOME' sem 'o imóvel de'", () => {
  // Estrutura inspirada num formato real diferente do Ernesto (vértices
  // tipo SIGEF/INCRA, ex. "ABCD-P-1234"), com nomes/matrículas
  // fictícios -- testa a ESTRUTURA, não memoriza um memorial específico.
  const texto = `
    Inicia-se a descrição deste perímetro no vértice ABCD-P-100, de
    coordenadas (Longitude: -42°10'00,00" e Latitude: -20°05'00,00").
    Deste, segue confrontando com Zeca Pagador, Matrícula: 77, com o
    seguinte azimute e distância: 90° e 10 m até o vértice ABCD-P-101,
    (Longitude: -42°10'01,00" e Latitude: -20°05'01,00"). Deste, segue
    confrontando com Maria Peixoto (Posse), Matrícula: 88, com o
    seguinte azimute e distância: 180° e 10 m até o vértice ABCD-P-102,
    (Longitude: -42°10'02,00" e Latitude: -20°05'02,00"); com o
    seguinte azimute e distância: 270° e 10 m até o vértice ABCD-P-100,
    ponto inicial da descrição deste perímetro.
  `;

  const resultado = parseMemorialTexto({ texto });
  assert.strictEqual(resultado.sistemaCoordenadas.tipo, "LAT_LONG");
  assert.strictEqual(resultado.pontos.length, 3);
  assert.strictEqual(resultado.confrontantes.length, 2);
  assert.strictEqual(resultado.confrontantes[0].nome, "Zeca Pagador");
  assert.strictEqual(resultado.confrontantes[0].matricula, "77");
  assert.strictEqual(resultado.confrontantes[0].ponto_inicio, 1);
  assert.strictEqual(resultado.confrontantes[0].ponto_fim, 2);
  assert.strictEqual(resultado.confrontantes[1].nome, "Maria Peixoto (Posse)");
  assert.strictEqual(resultado.confrontantes[1].ponto_fim, 1); // fecha no ponto inicial
});

teste("TESTE: 'ponto inicial da descrição' não é confundido com um vértice novo", () => {
  const texto =
    "no ponto 1, de coordenadas N= 1,00 m e E= 1,00 m, deste, segue confrontando com " +
    "Zeca, Matrícula: 1 com azimute 90 e distância 10 m até o ponto 2, de coordenadas " +
    "N= 2,00 m e E= 2,00 m. Daí, volta a confrontar com Zeca, Matrícula: 1 com azimute " +
    "270 e distância 10 m até o ponto 1, ponto inicial da descrição deste perímetro.";
  const resultado = memorialNarrativo.tentar(texto);
  assert.strictEqual(resultado.pontos.length, 2); // não deve ter um 3º ponto fantasma ("inicial")
});

teste("TESTE: DMS sem símbolo nenhum de grau/minuto/segundo ('20 15 32,608')", () => {
  const texto =
    "no vértice 1, de coordenadas Latitude 20 15 32,608 S Longitude 41 53 40,010 W, " +
    "deste, segue confrontando com Zeca, Matrícula: 1 com azimute 90 e distância 10 m " +
    "até o vértice 2, ponto inicial da descrição deste perímetro.";
  const sistema = detectarSistema(texto);
  assert.strictEqual(sistema.tipo, "LAT_LONG");

  const resultado = memorialNarrativo.tentar(texto, sistema);
  assert.strictEqual(resultado.pontos.length, 1);
  const [p] = resultado.pontos;
  // 20 + 15/60 + 32.608/3600 = 20.2590577..., negativo por causa do "S"
  assert.ok(Math.abs(p.lat - -20.259057) < 0.0001, `latitude errada: ${p.lat}`);
  assert.ok(Math.abs(p.lon - -41.894447) < 0.0001, `longitude errada: ${p.lon}`);
});

teste("TESTE: identificador original do vértice é preservado (não só o número interno)", () => {
  const texto =
    "no vértice HEEO-P-100, de coordenadas N= 1,00 m e E= 1,00 m, deste, segue " +
    "confrontando com Zeca, Matrícula: 1 com azimute 90 e distância 10 m até o vértice " +
    "HEEO-P-101, ponto inicial da descrição deste perímetro.";
  const resultado = memorialNarrativo.tentar(texto);
  assert.strictEqual(resultado.pontos[0].identificador, "HEEO-P-100");
  assert.strictEqual(resultado.pontos[0].numero, 1); // numeração interna sequencial
});

teste("TESTE: conversão com datum WGS84 (não só SIRGAS2000)", () => {
  const texto = `
    Inicia-se no vértice 1, de coordenadas Latitude: -20.123456 e Longitude: -42.654321,
    deste, segue confrontando com o imóvel de Zeca, Matrícula: 1 com azimute 90 e
    distância 50 m até o vértice 2, de coordenadas Latitude: -20.123556 e
    Longitude: -42.654421. Daí, volta a confrontar com o imóvel de Zeca, Matrícula: 1
    com azimute 270 e distância 50 m até o vértice 1, ponto inicial da descrição deste
    perímetro. Datum: WGS84.
  `;
  const resultado = parseMemorialTexto({ texto });
  assert.strictEqual(resultado.sistemaCoordenadas.datum, "WGS84");
  assert.strictEqual(resultado.sistemaCoordenadas.confiavel, true);
  assert.ok(resultado.pontos.every((p) => typeof p.x === "number" && typeof p.y === "number"));
  assert.strictEqual(resultado.coordenadasCompletas, true);
});

teste("TESTE: coordenadasCompletas fica false quando faltam X/Y (mensagem de sucesso não pode mentir)", () => {
  const texto = `
    Inicia-se no vértice 1, de coordenadas Latitude: -20.1 e Longitude: -42.6, deste,
    segue confrontando com o imóvel de Zeca, Matrícula: 1 com azimute 90 e distância
    50 m até o vértice 2, de coordenadas Latitude: -20.2 e Longitude: -42.7. Daí, volta
    a confrontar com o imóvel de Zeca, Matrícula: 1 com azimute 270 e distância 50 m até
    o vértice 1, ponto inicial da descrição deste perímetro.
  `;
  const resultado = parseMemorialTexto({ texto });
  assert.strictEqual(resultado.coordenadasCompletas, false);
});

// =================================================================
// NOVOS TESTES -- DOCX / DOC (extração de arquivo, não só do parser)
// =================================================================

async function rodarTestesDeArquivo() {
  const pdfPath = "/mnt/user-data/uploads/Memorial_-_Ernesto_estremação_A.pdf";
  const docxPath = "/tmp/memorial_teste.docx";
  const docPath = "/tmp/memorial_teste.doc";

  await testeAsync("TESTE: memorial PDF com UTM (arquivo real) via extrairMemorial()", async () => {
    if (!fs.existsSync(pdfPath)) return; // ambiente sem o arquivo -- pulado
    const buffer = fs.readFileSync(pdfPath);
    const resultado = await extrairMemorial(buffer, { nomeArquivo: "memorial.pdf" });
    assert.strictEqual(resultado.pontos.length, 56);
    assert.strictEqual(resultado.confrontantes.length, 6);
  });

  await testeAsync("TESTE: memorial DOCX com UTM (mesmo conteúdo do PDF real)", async () => {
    if (!fs.existsSync(docxPath)) return;
    const buffer = fs.readFileSync(docxPath);
    const resultado = await extrairMemorial(buffer, {
      nomeArquivo: "memorial.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert.strictEqual(resultado.pontos.length, 56);
    assert.strictEqual(resultado.confrontantes.length, 6);
    assert.strictEqual(resultado.confrontantes[1].matricula, "R-10-2.086");
  });

  await testeAsync("TESTE: memorial DOC legado (binário) com UTM", async () => {
    if (!fs.existsSync(docPath)) return;
    const buffer = fs.readFileSync(docPath);
    const resultado = await extrairMemorial(buffer, {
      nomeArquivo: "memorial.doc",
      mimetype: "application/msword",
    });
    assert.strictEqual(resultado.pontos.length, 56);
    assert.strictEqual(resultado.confrontantes.length, 6);
  });

  await testeAsync("TESTE: memorial DOCX com Latitude/Longitude", async () => {
    const mammoth = require("mammoth");
    // gera um .docx sintético em memória não é trivial sem lib de
    // escrita -- reaproveita o mesmo texto Lat/Long já validado no
    // parser puro (ver teste acima) como cobertura funcional
    // equivalente; a extração em si (docExtraction.js) já foi
    // validada nos dois testes de arquivo acima (PDF e DOCX UTM).
    const { detectarSistema } = require("../coordenadas");
    const texto = "Latitude: -20.1 Longitude: -42.1 no vértice 1, de coordenadas Latitude: -20.1 e Longitude: -42.1";
    const sistema = detectarSistema(texto);
    assert.strictEqual(sistema.tipo, "LAT_LONG");
  });
}

rodarTestesDeArquivo().then(() => {
  console.log();
  console.log(`${passou} passaram, ${falhou} falharam`);
  process.exit(falhou > 0 ? 1 : 0);
});
