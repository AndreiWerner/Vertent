export type Ponto = {
  numero: number | string;
  x: number | string;
  y: number | string;
  // Presentes só quando o backend identificou Lat/Long mas não pôde
  // converter pra UTM sozinho (sem datum confiável) -- usados pelo
  // recálculo manual de datum na tela de conferência (ver
  // EditarTerreno.tsx / NovoTerreno.tsx). Nunca editados diretamente
  // aqui, só passados adiante quando outro campo do mesmo ponto muda.
  lat?: number;
  lon?: number;
};
export type Confrontante = {
  nome: string;
  matricula: string | null;
  ponto_inicio: number | string;
  ponto_fim: number | string;
  ordem: number;
};

type Props = {
  pontos: Ponto[];
  confrontantes: Confrontante[];
  aviso?: string | null;
  onChange: (pontos: Ponto[], confrontantes: Confrontante[]) => void;
};

// Tela de conferência: nada aqui é persistido sozinho -- o admin edita
// livremente (adicionar/remover linha, corrigir qualquer campo) e só
// quando clicar em "Confirmar e salvar" (fora deste componente, ver
// EditarTerreno.tsx) é que os dados vão pro backend. Extração
// automática é só um ponto de partida, nunca o resultado final.
export function ConfrontantesReview({ pontos, confrontantes, aviso, onChange }: Props) {
  function atualizarPonto(index: number, campo: keyof Ponto, valor: string) {
    const novos = pontos.map((p, i) => (i === index ? { ...p, [campo]: valor } : p));
    onChange(novos, confrontantes);
  }

  function removerPonto(index: number) {
    onChange(pontos.filter((_, i) => i !== index), confrontantes);
  }

  function adicionarPonto() {
    const proximoNumero = pontos.length
      ? Math.max(...pontos.map((p) => Number(p.numero) || 0)) + 1
      : 1;
    onChange([...pontos, { numero: proximoNumero, x: "", y: "" }], confrontantes);
  }

  function atualizarConfrontante(index: number, campo: keyof Confrontante, valor: string) {
    const novos = confrontantes.map((c, i) => (i === index ? { ...c, [campo]: valor } : c));
    onChange(pontos, novos);
  }

  function removerConfrontante(index: number) {
    onChange(
      pontos,
      confrontantes.filter((_, i) => i !== index)
    );
  }

  function adicionarConfrontante() {
    onChange(pontos, [
      ...confrontantes,
      { nome: "", matricula: "", ponto_inicio: "", ponto_fim: "", ordem: confrontantes.length },
    ]);
  }

  return (
    <div className="space-y-6">
      {aviso && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-vertente-ink">Pontos do levantamento</h3>
          <button
            type="button"
            onClick={adicionarPonto}
            className="text-xs font-medium text-vertente hover:text-vertente-dark"
          >
            + Adicionar ponto
          </button>
        </div>

        {pontos.length === 0 ? (
          <p className="text-sm text-vertente-medium">Nenhum ponto cadastrado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-vertente-medium/20">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-vertente-bg bg-vertente-bg/60 text-vertente-medium">
                  <th className="px-3 py-2 font-medium">Nº</th>
                  <th className="px-3 py-2 font-medium">X (E)</th>
                  <th className="px-3 py-2 font-medium">Y (N)</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pontos.map((p, i) => (
                  <tr key={i} className="border-b border-vertente-bg/60 last:border-0">
                    <td className="px-2 py-1.5">
                      <input
                        value={p.numero}
                        onChange={(e) => atualizarPonto(i, "numero", e.target.value)}
                        className="input-cell w-16"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={p.x}
                        onChange={(e) => atualizarPonto(i, "x", e.target.value)}
                        className="input-cell"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={p.y}
                        onChange={(e) => atualizarPonto(i, "y", e.target.value)}
                        className="input-cell"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removerPonto(i)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-vertente-ink">Confrontantes encontrados</h3>
          <button
            type="button"
            onClick={adicionarConfrontante}
            className="text-xs font-medium text-vertente hover:text-vertente-dark"
          >
            + Adicionar confrontante
          </button>
        </div>

        {confrontantes.length === 0 ? (
          <p className="text-sm text-vertente-medium">
            Nenhum confrontante identificado. Você pode adicionar manualmente.
          </p>
        ) : (
          <div className="space-y-3">
            {confrontantes.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-vertente-medium/20 bg-white p-4"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-vertente-medium">Nome</span>
                    <input
                      value={c.nome}
                      onChange={(e) => atualizarConfrontante(i, "nome", e.target.value)}
                      className="input-cell w-full"
                      placeholder="Nome do confrontante"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-vertente-medium">Matrícula</span>
                    <input
                      value={c.matricula ?? ""}
                      onChange={(e) => atualizarConfrontante(i, "matricula", e.target.value)}
                      className="input-cell w-full"
                      placeholder="Opcional"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removerConfrontante(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-vertente-medium">
                      Ponto inicial
                    </span>
                    <input
                      value={c.ponto_inicio}
                      onChange={(e) => atualizarConfrontante(i, "ponto_inicio", e.target.value)}
                      className="input-cell w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-vertente-medium">
                      Ponto final
                    </span>
                    <input
                      value={c.ponto_fim}
                      onChange={(e) => atualizarConfrontante(i, "ponto_fim", e.target.value)}
                      className="input-cell w-full"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
