// Orquestrador dos formatos de plantas.
// Primeiro tenta um quadro de coordenadas com cabeçalho explícito.
// Se não reconhecer, mantém o parser legado 10.267.

const { parseTabela } = require("./formatos/tabelaComCabecalho");
const { parsePadrao10267 } = require("./formatos/padrao10267");

function textoCompleto(items) {
  return (items || [])
    .map((i) => i.text)
    .join(" ");
}

function extrairConfrontantesDoTexto(items) {
  // O parser legado já faz a extração de confrontantes. Usamos um
  // conjunto de pontos vazio somente quando a tabela nova foi
  // reconhecida, para reaproveitar exatamente a mesma heurística.
  const resultado = parsePadrao10267(items);
  return resultado.confrontantes || [];
}

function parseItems(items) {
  const tabela = parseTabela(items);

  if (tabela) {
    const confrontantes = extrairConfrontantesDoTexto(items);
    const pontos = tabela.pontos;

    let aviso = null;
    if (!confrontantes.length) {
      aviso =
        "Os pontos foram identificados, mas nenhum confrontante foi reconhecido automaticamente. " +
        "Revise os dados manualmente.";
    }

    return {
      pontos,
      confrontantes,
      aviso,
      formatoReconhecido: tabela.formatoReconhecido,
    };
  }

  return {
    ...parsePadrao10267(items),
    formatoReconhecido: "padrao-10.267",
  };
}

module.exports = { parseItems };
