/**
 * src/lib/pricing.ts
 *
 * ETAPA TOPÓGRAFOS -- regra de cobrança pedida: mensalidade = quantidade
 * de terrenos × preço por terreno/mês (padrão R$ 2,00, sem valor
 * mínimo). Nesta etapa é só cálculo administrativo (sem Stripe/Mercado
 * Pago/Pix/cartão/boleto -- ver especificação, seções 6 e 7).
 *
 * O Backend não tem (e esta etapa não cria, por instrução explícita:
 * "não altere o Backend") nenhuma tabela/endpoint para guardar esse
 * preço -- por isso ele fica salvo aqui no navegador do admin
 * (localStorage), igual ao token de sessão. Fica documentado no
 * relatório da etapa e na própria tela de Configurações que isso é um
 * ajuste local, não compartilhado entre admins/dispositivos -- para
 * persistir de verdade no servidor, precisaria de um endpoint novo
 * (ex.: GET/PUT /admin/configuracoes) que ainda não existe.
 */

const CHAVE_PRECO = "vertente_admin_preco_por_terreno";

export const PRECO_POR_TERRENO_PADRAO = 2;

export function obterPrecoPorTerreno(): number {
  const salvo = localStorage.getItem(CHAVE_PRECO);
  if (salvo === null) return PRECO_POR_TERRENO_PADRAO;
  const numero = Number(salvo);
  return Number.isFinite(numero) && numero >= 0 ? numero : PRECO_POR_TERRENO_PADRAO;
}

export function salvarPrecoPorTerreno(valor: number): void {
  localStorage.setItem(CHAVE_PRECO, String(valor));
}

/** mensalidade = quantidade_de_terrenos × preço_por_terreno (sem valor mínimo, ver seção 6 da especificação). */
export function calcularMensalidade(quantidadeTerrenos: number, precoPorTerreno: number): number {
  return quantidadeTerrenos * precoPorTerreno;
}
