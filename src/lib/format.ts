/**
 * src/lib/format.ts
 *
 * Formatação pt-BR (via Intl.NumberFormat nativo do navegador -- sem
 * biblioteca nova) para os campos numéricos extraídos do memorial
 * (ETAPA 2): área, perímetro, cota máxima/mínima. Usado por
 * NovoTerreno.tsx, EditarTerreno.tsx e Terrenos.tsx.
 *
 * Só formata para EXIBIÇÃO -- nunca altera o valor numérico recebido
 * do Backend (ver ETAPA 2, seção 3: "Usar formatação brasileira
 * apenas na apresentação. NÃO alterar o valor numérico recebido").
 * `paraNumeroBackend` faz o caminho inverso (texto digitado -> número
 * pro Backend) só no momento de salvar.
 */

const ROTULOS_UNIDADE_AREA: Record<string, string> = {
  ha: "ha",
  m2: "m²",
  "m²": "m²",
  km2: "km²",
  "km²": "km²",
};

/** Unidades oferecidas no seletor de edição -- a lista de exemplos dados na especificação. Uma unidade diferente vinda do Backend não é perdida (ver `opcoesUnidadeArea`), só não aparece aqui como sugestão padrão. */
export const UNIDADES_AREA_PADRAO = ["ha", "m²"] as const;

export function rotuloUnidadeArea(unidade: string | null | undefined): string {
  if (!unidade) return "";
  return ROTULOS_UNIDADE_AREA[unidade] ?? unidade;
}

/** Opções do <select>: as padrão + a unidade atual, caso seja uma que não está na lista padrão (nunca esconde/descarta o valor que já veio do Backend). */
export function opcoesUnidadeArea(unidadeAtual: string | null | undefined): string[] {
  if (!unidadeAtual || (UNIDADES_AREA_PADRAO as readonly string[]).includes(unidadeAtual)) {
    return [...UNIDADES_AREA_PADRAO];
  }
  return [...UNIDADES_AREA_PADRAO, unidadeAtual];
}

function paraNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = typeof valor === "string" ? Number(valor.replace(",", ".")) : valor;
  return Number.isFinite(numero) ? numero : null;
}

/**
 * "5.7985" -> "5,7985" / "14.15" -> "14,15" (sem zeros à toa -- os
 * dois exemplos exatos da especificação). `null`/vazio/inválido ->
 * "—" (nunca null/undefined/NaN na tela, ver seção 2).
 */
export function formatNumeroPtBr(valor: number | string | null | undefined, casasMaximas = 2): string {
  const numero = paraNumero(valor);
  if (numero === null) return "—";
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casasMaximas });
}

/** "5.7985" + "ha" -> "5,7985 ha". Área permite até 4 casas (ver exemplos da especificação). */
export function formatArea(area: number | string | null | undefined, unidade: string | null | undefined): string {
  const numeroFormatado = formatNumeroPtBr(area, 4);
  if (numeroFormatado === "—") return "—";
  const rotulo = rotuloUnidadeArea(unidade);
  return rotulo ? `${numeroFormatado} ${rotulo}` : numeroFormatado;
}

/** "965.65" -> "965,65 m". Mesma função serve pra perímetro e cota máxima/mínima (todos em metros). */
export function formatMetros(valor: number | string | null | undefined): string {
  const numeroFormatado = formatNumeroPtBr(valor, 2);
  return numeroFormatado === "—" ? "—" : `${numeroFormatado} m`;
}

/** Texto digitado (aceita vírgula OU ponto) -> número pro Backend. String vazia/inválida -> null (nunca NaN/undefined). */
export function paraNumeroBackend(texto: string): number | null {
  return paraNumero(texto);
}
