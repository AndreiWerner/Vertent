// Extrai um número (para uma coluna `double precision`) de textos como
// os que aparecem nos campos de área/perímetro/altura do formulário do
// admin -- que podem vir com a unidade colada (ex.: "12 ha", "1.633,50
// m") em vez de só o número puro que o Postgres espera. Sem isso, o
// INSERT/UPDATE quebra com "invalid input syntax for type double
// precision: \"12 ha\"".
//
// Convenção adotada (a mesma que já aparece nas telas do próprio app,
// em "Informações Técnicas"): quando aparecem OS DOIS separadores, '.'
// e ',', o último é o decimal e o outro é separador de milhar (ex.:
// "2.451,50" -> 2451.50). Quando só aparece ',', ela é o decimal (ex.:
// "22,89" -> 22.89). Quando só aparece '.', ele já é o decimal (ex.:
// "12.87" -> 12.87) -- é assim que o app mostra os números sem milhar.
function parseNumero(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const texto = String(valor).trim();
  if (!texto) return null;

  const match = texto.match(/-?\d[\d.,]*/);
  if (!match) return null;

  let numero = match[0];
  const temVirgula = numero.includes(",");
  const temPonto = numero.includes(".");

  if (temVirgula && temPonto) {
    numero = numero.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    numero = numero.replace(",", ".");
  }
  // se só tem ponto (ou nenhum separador), mantém como está

  const resultado = parseFloat(numero);
  return Number.isFinite(resultado) ? resultado : null;
}

module.exports = { parseNumero };
