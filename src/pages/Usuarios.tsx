import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/ui";
import { api, ApiError } from "../lib/api";

type Usuario = {
  id: number;
  nome: string;
  matricula: string;
  status: "ativo" | "inativo";
  cpf: string | null;
};

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);

  function carregar() {
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);

    api
      .get(`/admin/usuarios?${params.toString()}`)
      .then(setUsuarios)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar usuários")
      );
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  async function alternarStatus(usuario: Usuario) {
    const novoStatus = usuario.status === "ativo" ? "inativo" : "ativo";
    const acao = novoStatus === "ativo" ? "ativar" : "desativar";

    if (!confirm(`Deseja ${acao} ${usuario.nome}?`)) return;

    try {
      await api.patch(`/admin/usuarios/${usuario.id}/status`, { status: novoStatus });
      carregar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Erro ao atualizar status");
    }
  }

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-vertente-dark">Usuários</h1>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou matrícula..."
        className="input mt-6 max-w-sm"
      />

      {erro && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl2 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-vertente-bg text-vertente-medium">
              <th className="px-6 py-3 font-medium">Nome</th>
              <th className="px-6 py-3 font-medium">CPF</th>
              <th className="px-6 py-3 font-medium">Matrícula</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-vertente-medium">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}

            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-vertente-bg/60 last:border-0">
                <td className="px-6 py-3">{u.nome}</td>
                <td className="px-6 py-3">{u.cpf ?? "—"}</td>
                <td className="px-6 py-3">{u.matricula}</td>
                <td className="px-6 py-3">
                  <StatusBadge status={u.status} />
                </td>
                <td className="px-6 py-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditando(u)}
                      className="text-vertente-medium hover:text-vertente-dark"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => alternarStatus(u)}
                      className={u.status === "ativo" ? "text-red-500 hover:text-red-700" : "text-vertente hover:text-vertente-dark"}
                    >
                      {u.status === "ativo" ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditarUsuarioModal
          usuario={editando}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </Layout>
  );
}

function EditarUsuarioModal({
  usuario,
  onClose,
  onSaved,
}: {
  usuario: Usuario;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(usuario.nome);
  const [matricula, setMatricula] = useState(usuario.matricula);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await api.put(`/admin/usuarios/${usuario.id}`, { nome, matricula });
      onSaved();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao salvar usuário");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl2 bg-white p-6 shadow-soft">
        <h2 className="mb-4 text-base font-semibold text-vertente-dark">Editar usuário</h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">Matrícula</span>
          <input
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            className="input"
          />
        </label>

        {erro && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-vertente-medium hover:bg-vertente-bg"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-lg bg-vertente px-4 py-2 text-sm font-medium text-white hover:bg-vertente-dark disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
