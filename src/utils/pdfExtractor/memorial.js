// utils/pdfExtractor/memorial.js
//
// Parser de memoriais descritivos. O memorial é a fonte principal
// para pontos e confrontantes. Como existem vários modelos de
// redação e sistemas de coordenadas, usamos padrões semânticos e
// deixamos a conferência final para o Admin.
//
// FLUXO (ver `parseMemorialTexto`):
//
//   texto (+ items, se vier de PDF)
//        |
//   detectarSistema(texto)  -- UTM ou LAT_LONG? datum/EPSG conhecido?
//        |
//   formatoNarrativo.tentar(texto, sistema)  -- perímetro contínuo,
//   funciona igual para PDF, DOCX e DOC (não depende de posição x/y)
//        |
//   (se achou confrontantes) -> normaliza pontos (converte Lat/Long
//   para UTM quando o sistema é conhecido com segurança) -> retorna
//        |
//   (senão, e só quando há `items` -- ou seja, é PDF) -> formato
//   legado: tabela em posição (parseItems) + confrontantes por regex
//   de intervalo explícito ("do ponto X ao Y, confronta com...")
//        |
//   retorna { pontos, confrontantes, aviso, sistemaCoordenadas, formatoReconhecido }
//
// Nenhuma lógica do formato legado foi alterada -- ele só deixou de
// ser o único caminho.

const { parseItems } = require("./parse");
const memorialNarrativo = require("./formatos/memorialNarrativo");
const { detectarSistema, latLongParaUtm } = require("./coordenadas");
const { extrairMetadadosMemorial } = require("./metadados");

const INTERVALOS = [
  /(?:do|de)\s+(?:v[ée]rtice|ponto)\s*(?:n[ºo°]?\s*)?(\d{1,4})\s+(?:ao|até|a)\s+(?:v[ée]rtice|ponto)?\s*(?:n[ºo°]?\s*)?(\d{1,4})/gi,
  /(?:entre|partindo\s+do)\s+(?:v[ée]rtice|ponto)\s*(?:n[ºo°]?\s*)?(\d{1,4})\s+(?:e|até)\s+(?:v[ée]rtice|ponto)?\s*(?:n[ºo°]?\s*)?(\d{1,4})/gi,
];

const MATRICULA_RE = /matr[ií]cula(?:\s*n[ºo°]?)?\s*[:\-]?\s*([A-Z0-9./-]{1,30})/i;

function normalizar(texto) {
  return String(texto || "")
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limparNome(nome) {
  return String(nome || "")
    .replace(/^\s*(?:com|a|o|à|ao)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/[,;:]\s*$/, "")
    .trim();
}

function numero(texto) {
  const n = Number(String(texto).replace(/^0+/, "") || "0");
  return Number.isInteger(n) && n > 0 ? n : null;
}

function extrairConfrontantes(texto) {
  const s = normalizar(texto);
  const intervalos = [];

  for (const re of INTERVALOS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(s))) {
      const inicio = numero(match[1]);
      const fim = numero(match[2]);
      if (inicio && fim && inicio !== fim) {
        intervalos.push({
          index: match.index,
          end: re.lastIndex,
          inicio,
          fim,
        });
      }
    }
  }

  intervalos.sort((a, b) => a.index - b.index);
  const encontrados = [];

  for (let i = 0; i < intervalos.length; i++) {
    const it = intervalos[i];
    const proximo = intervalos[i + 1];
    const anterior = intervalos[i - 1];

    // Primeiro procuramos depois do intervalo. Esse é o formato mais
    // comum: "do ponto 2 ao ponto 13, confronta com Fulano..."
    const depois = s.slice(
      it.end,
      Math.min(proximo ? proximo.index : s.length, it.end + 320)
    );

    // Também aceitamos o formato inverso: "confronta com Fulano...
    // do ponto 2 ao ponto 13".
    const antes = s.slice(
      Math.max(anterior ? anterior.end : 0, it.index - 320),
      it.index
    );

    const candidatos = [depois, antes];
    let nome = null;
    let matricula = null;

    for (const janela of candidatos) {
      const conf = janela.match(
        /(?:confronta(?:ndo)?(?:-se)?|confrontante|confrontando-se|divisa(?:ndo)?(?:-se)?|limitando(?:-se)?|fazendo\s+divisa)\s+(?:com\s+)?(.{2,180}?)(?=\s*(?:,\s*)?(?:matr[ií]cula|inscri[cç][aã]o|im[oó]vel|propriedade|do\s+(?:ponto|v[ée]rtice)|partindo|;|$))/i
      );

      if (conf) {
        nome = limparNome(conf[1]);
        const matriculaMatch = janela.match(MATRICULA_RE);
        matricula = matriculaMatch
          ? matriculaMatch[1].replace(/[.,;]$/, "")
          : null;
        if (nome) break;
      }

      // Formato curto: "com NOME, matrícula X".
      const simples = janela.match(
        /\bcom\s+([A-ZÀ-Ú][^.;]{2,120}?)(?=\s*,?\s*(?:matr[ií]cula|inscri[cç][aã]o)\b)/i
      );
      if (simples) {
        nome = limparNome(simples[1]);
        const matriculaMatch = janela.match(MATRICULA_RE);
        matricula = matriculaMatch
          ? matriculaMatch[1].replace(/[.,;]$/, "")
          : null;
        if (nome) break;
      }
    }

    if (!nome) continue;

    const chave = `${it.inicio}-${it.fim}-${nome.toLowerCase()}-${matricula || "\u0000"}`;
    if (encontrados.some((x) => x._chave === chave)) continue;

    encontrados.push({
      nome,
      matricula,
      ponto_inicio: it.inicio,
      ponto_fim: it.fim,
      ordem: encontrados.length,
      _chave: chave,
    });
  }

  return encontrados.map(({ _chave, ...c }) => c);
}

// Converte os pontos crus do formato narrativo (que, em memoriais
// Lat/Long, vêm como {numero, identificador, lat, lon, ...original})
// para a estrutura final que o resto do sistema (banco, Admin,
// Vertente Web) espera -- sempre com {numero, x, y} no topo (contrato
// existente, intocado), acrescido de campos extras preservando a
// informação original (identificador do vértice, lat/lon decimais e
// como escritos no memorial, tipo de coordenada). Esses campos extras
// são só para conferência no Admin -- o banco continua gravando
// apenas numero/x/y (ver confirmarConfrontantes), então não exigem
// nenhuma mudança de schema.
//
// Só converte lat/lon pra x/y de verdade quando o sistema de
// referência é CONHECIDO COM SEGURANÇA (`sistema.confiavel`) -- nunca
// "encaixa" o perímetro usando datum/zona chutados. Sem isso, devolve
// os pontos com x/y em branco (numeração e sequência continuam
// válidas, só as coordenadas ficam pendentes de confirmação manual no
// Admin, que pode recalcular depois -- ver
// confrontantes.controller.js -> recalcularCoordenadas).
function normalizarPontos(pontosBrutos, sistema) {
  if (!pontosBrutos.length) return [];

  if (sistema.tipo !== "LAT_LONG") {
    // UTM: já são {numero,x,y,identificador?,northingOriginal?,eastingOriginal?}
    return pontosBrutos.map((p) => ({ ...p, tipoCoordenada: "UTM" }));
  }

  return pontosBrutos.map((p) => {
    const base = {
      numero: p.numero,
      identificador: p.identificador,
      tipoCoordenada: "LAT_LONG",
      // `lat`/`lon`: nomes curtos já consumidos pelo recálculo manual
      // de datum no Admin (RecalcularDatum.tsx). `latitudeDecimal`/
      // `longitudeDecimal`: nomes mais descritivos, mesmo valor --
      // mantidos os dois pra não quebrar o que já existe.
      lat: p.lat,
      lon: p.lon,
      latitudeDecimal: p.lat,
      longitudeDecimal: p.lon,
      latitudeOriginal: p.latitudeOriginal,
      longitudeOriginal: p.longitudeOriginal,
    };

    if (sistema.confiavel && sistema.datum) {
      try {
        const { x, y } = latLongParaUtm(p.lat, p.lon, sistema.datum);
        return { ...base, x, y };
      } catch (err) {
        console.error("Erro ao converter Lat/Long para UTM:", err);
      }
    }
    // Sem datum confiável, não inventamos x/y -- mas mantemos lat/lon
    // (em `base`, acima) pra permitir ao Admin confirmar o datum
    // manualmente depois e recalcular sem reenviar o arquivo original.
    return { ...base, x: null, y: null };
  });
}

/**
 * @param {{ items?: Array, texto?: string }} entrada
 *   `items` (com posição x/y) quando vem de PDF; `texto` puro quando
 *   vem de DOCX/DOC (nesse caso, só o formato narrativo se aplica --
 *   não há como montar uma tabela por posição sem coordenada de
 *   página). Se os dois vierem, `items` tem prioridade pra montar o
 *   texto (mantém compatibilidade com quem já chamava só com items).
 */
function parseMemorialTexto(entrada) {
  const items = entrada && entrada.items;
  const texto = items ? (items || []).map((i) => i.text).join(" ") : String((entrada && entrada.texto) || "");

  const sistema = detectarSistema(texto);

  // Camada ADITIVA de metadados (área, unidade, perímetro, cotas).
  // Lê o mesmo texto, de forma totalmente independente: não recebe nem
  // devolve pontos/confrontantes e não influencia nenhuma decisão
  // abaixo -- o resultado só é anexado aos objetos de retorno.
  const metadados = extrairMetadadosMemorial(texto);

  // Tenta primeiro o formato narrativo (perímetro contínuo, funciona
  // pra PDF/DOCX/DOC igual). Só é considerado "reconhecido" quando
  // encontra confrontantes de verdade -- é essa a parte que o formato
  // legado abaixo não consegue resolver nesse tipo de memorial (o
  // legado exige os dois pontos do intervalo na mesma frase, o que o
  // narrativo nunca escreve). Pontos sozinhos (sem confrontante) não
  // bastam pra preferir o narrativo, pra não descartar por engano um
  // memorial legado que só não tinha coordenadas em tabela.
  const narrativo = memorialNarrativo.tentar(texto, sistema);
  if (narrativo && narrativo.confrontantes.length > 0) {
    const pontos = normalizarPontos(narrativo.pontos, sistema);
    const semCoordenadas = pontos.length === 0 || pontos.every((p) => p.x === null || p.y === null);

    let aviso = sistema.aviso || null;
    if (semCoordenadas && narrativo.pontos.length > 0) {
      aviso =
        (aviso ? aviso + " " : "") +
        "Os confrontantes e a numeração dos pontos foram identificados, mas as coordenadas não " +
        "puderam ser calculadas com segurança. Revise/confirme o sistema de referência e as " +
        "coordenadas antes de salvar.";
    } else if (!narrativo.pontos.length) {
      aviso =
        (aviso ? aviso + " " : "") +
        "Os confrontantes foram identificados, mas as coordenadas dos pontos não foram encontradas. " +
        "Revise os pontos antes de salvar.";
    }

    return {
      pontos,
      confrontantes: narrativo.confrontantes,
      // Metadados aditivos -- não afetam pontos/confrontantes acima.
      area: metadados.area,
      area_unidade: metadados.area_unidade,
      perimetro: metadados.perimetro,
      altura_max: metadados.altura_max,
      altura_min: metadados.altura_min,
      aviso,
      sistemaCoordenadas: sistema,
      formatoReconhecido: "memorial-narrativo",
      // Usado pelo controller pra decidir a mensagem de retorno (ver
      // enviarMemorial): achar pontos/confrontantes não é a mesma
      // coisa que ter coordenadas UTILIZÁVEIS -- não dá pra chamar de
      // "processado com sucesso" se X/Y ainda estão pendentes.
      coordenadasCompletas: !semCoordenadas,
    };
  }

  // ---- formato legado (inalterado) ----
  // Só se aplica a PDF: depende de posição x/y (quadro de coordenadas
  // em tabela), que DOCX/DOC não têm.
  const pontosLegado = items ? parseItems(items).pontos || [] : [];
  const confrontantes = extrairConfrontantes(texto);

  let aviso = sistema.aviso || null;
  if (!pontosLegado.length && !confrontantes.length) {
    aviso =
      (aviso ? aviso + " " : "") +
      "Não foi possível identificar automaticamente pontos e confrontantes no memorial. " +
      "Revise o documento manualmente.";
  } else if (!confrontantes.length) {
    aviso =
      (aviso ? aviso + " " : "") +
      "Os pontos foram identificados, mas nenhum confrontante foi reconhecido automaticamente. " +
      "Revise os confrontantes antes de salvar.";
  } else if (!pontosLegado.length) {
    aviso =
      (aviso ? aviso + " " : "") +
      "Os confrontantes foram identificados, mas as coordenadas dos pontos não foram encontradas. " +
      "Revise os pontos antes de salvar.";
  }

  return {
    pontos: pontosLegado,
    confrontantes,
    // Metadados aditivos -- não afetam pontos/confrontantes acima.
    area: metadados.area,
    area_unidade: metadados.area_unidade,
    perimetro: metadados.perimetro,
    altura_max: metadados.altura_max,
    altura_min: metadados.altura_min,
    aviso,
    sistemaCoordenadas: sistema,
    formatoReconhecido: "memorial-descritivo",
    coordenadasCompletas: pontosLegado.length > 0,
  };
}

// Compatibilidade: quem já chamava `parseMemorialItems(items)`
// continua funcionando exatamente igual (é só um atalho pra
// `parseMemorialTexto({ items })`).
function parseMemorialItems(items) {
  return parseMemorialTexto({ items });
}

module.exports = { parseMemorialTexto, parseMemorialItems, extrairConfrontantes };
