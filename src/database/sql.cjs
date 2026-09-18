// Todos os controllers foram escritos com placeholders no estilo
// SQLite (`?`). Para não precisar reescrever cada query do projeto na
// migração para PostgreSQL (que usa `$1, $2, ...`), esse helper
// converte automaticamente -- é a peça central que permite trocar o
// banco por baixo sem tocar nos controllers.
//
// Não interpreta `?` dentro de literais de string (ex.: '...?...') nem
// dentro de comentários -- nenhuma query deste projeto usa `?` dessa
// forma, então isso não é um problema aqui, mas fica registrado como
// limitação conhecida caso este helper seja reaproveitado em outro
// contexto no futuro.
function toPositionalParams(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

module.exports = { toPositionalParams };
