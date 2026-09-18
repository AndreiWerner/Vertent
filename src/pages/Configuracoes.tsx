import { useState, type FormEvent } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { formatMoeda } from "../lib/format";
import { obterPrecoPorTerreno, salvarPrecoPorTerreno, PRECO_POR_TERRENO_PADRAO } from "../lib/pricing";

export function Configuracoes() {
  const { admin } = useAuth();

  // ETAPA TOPÓGRAFOS -- preço por terreno/mês usado no cálculo da
  // mensalidade (Topografos.tsx, TopografoDetalhe.tsx e no resumo do
  // Dashboard). Guardado no navegador (ver lib/pricing.ts) porque o
  // Backend ainda não tem um endpoint para isso -- não foi criado
  // nesta etapa por instrução explícita ("não altere o Backend").
  const [preco, setPreco] = useState(() => String(obterPrecoPorTerreno()));
  const [salvo, setSalvo] = useState(false);

  function handleSalvarPreco(e: FormEvent) {
    e.preventDefault();
    const numero = Number(preco.replace(",", "."));
    if (!Number.isFinite(numero) || numero < 0) return;
    salvarPrecoPorTerreno(numero);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-vertente-dark">Configurações</h1>

      <div className="mt-6 max-w-md rounded-xl2 bg-white p-6 shadow-card">
        <p className="text-sm text-vertente-medium">Administrador logado</p>
        <p className="mt-1 font-medium text-vertente-ink">{admin?.nome}</p>
        <p className="text-sm text-vertente-medium">{admin?.email}</p>
      </div>

      <p className="mt-6 max-w-md text-sm text-vertente-medium">
        Novos administradores são criados pelo terminal do servidor com o
        script <code className="rounded bg-vertente-bg px-1.5 py-0.5">createAdmin.cjs</code>,
        por segurança — não existe cadastro público de admin neste painel.
      </p>

      <form
        onSubmit={handleSalvarPreco}
        className="mt-6 max-w-md rounded-xl2 bg-white p-6 shadow-card"
      >
        <h2 className="mb-1 text-base font-semibold text-vertente-dark">Preço por terreno</h2>
        <p className="mb-4 text-sm text-vertente-medium">
          Usado para calcular a mensalidade de cada Topógrafo (quantidade de
          terrenos × preço). Padrão: {formatMoeda(PRECO_POR_TERRENO_PADRAO)}.
        </p>

        <label className="mb-1 block max-w-[10rem]">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">
            Preço por terreno (R$)
          </span>
          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            inputMode="decimal"
            className="input"
          />
        </label>

        <p className="mb-4 text-xs text-vertente-medium">
          Salvo neste navegador -- o Backend ainda não tem um endpoint para
          guardar essa configuração no servidor (ver relatório desta etapa).
        </p>

        <button
          type="submit"
          className="rounded-lg bg-vertente px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vertente-dark"
        >
          Salvar
        </button>
        {salvo && (
          <span className="ml-3 text-sm text-vertente-dark">Preço atualizado.</span>
        )}
      </form>
    </Layout>
  );
}
