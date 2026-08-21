import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/ui";
import { api, ApiError } from "../lib/api";

type Terreno = {
  id: number;
  matricula: string;
  proprietario: string;
  status_usuario: "ativo" | "inativo";
  area: string | null;
  perimetro: string | null;
  url_terreno: string;
};

export function Terrenos() {
  const [terrenos, setTerrenos] = useState<Terreno[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativo" | "inativo">("todos");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  function carregar() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (filtro !== "todos") params.set("status", filtro);

    api
      .get(`/admin/terrenos?${params.toString()}`)
      .then(setTerrenos)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar terrenos")
      )
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 250); // debounce da busca
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, filtro]);

  async function excluir(id: number) {
    if (!confirm("Excluir este terreno? Essa ação não pode ser desfeita.")) return;

    try {
      await api.delete(`/admin/terrenos/${id}`);
      carregar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Erro ao excluir terreno");
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-vertente-dark">Terrenos</h1>
        <Link
          to="/terrenos/novo"
          className="rounded-lg bg-vertente px-4 py-2 text-sm font-medium text-white hover:bg-vertente-dark"
        >
          Novo Terreno
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou matrícula..."
          className="flex-1 rounded-lg border border-vertente-medium/30 px-4 py-2.5 text-sm outline-none focus:border-vertente"
        />
        <div className="flex gap-2">
          {(["todos", "ativo", "inativo"] as const).map((opcao) => (
            <button
              key={opcao}
              onClick={() => setFiltro(opcao)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                filtro === opcao
                  ? "bg-vertente-dark text-white"
                  : "bg-white text-vertente-medium hover:bg-vertente-bg"
              }`}
            >
              {opcao}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl2 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-vertente-bg text-vertente-medium">
              <th className="px-6 py-3 font-medium">Proprietário</th>
              <th className="px-6 py-3 font-medium">Matrícula</th>
              <th className="px-6 py-3 font-medium">Área</th>
              <th className="px-6 py-3 font-medium">Perímetro</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Modelo 3D</th>
              <th className="px-6 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!carregando && terrenos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-vertente-medium">
                  Nenhum terreno encontrado.
                </td>
              </tr>
            )}

            {terrenos.map((t) => (
              <tr key={t.id} className="border-b border-vertente-bg/60 last:border-0">
                <td className="px-6 py-3">{t.proprietario}</td>
                <td className="px-6 py-3">{t.matricula}</td>
                <td className="px-6 py-3">{t.area ?? "—"}</td>
                <td className="px-6 py-3">{t.perimetro ?? "—"}</td>
                <td className="px-6 py-3">
                  <StatusBadge status={t.status_usuario} />
                </td>
                <td className="px-6 py-3">
                  <a
                    href={t.url_terreno}
                    target="_blank"
                    rel="noreferrer"
                    className="text-vertente underline underline-offset-2"
                  >
                    Visualizar
                  </a>
                </td>
                <td className="px-6 py-3">
                  <div className="flex gap-3">
                    <Link
                      to={`/terrenos/${t.id}/editar`}
                      className="text-vertente-medium hover:text-vertente-dark"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => excluir(t.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
