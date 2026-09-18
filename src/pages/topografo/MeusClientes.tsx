/**
 * src/pages/topografo/MeusClientes.tsx
 *
 * Mesmo padrão estrutural de Topografos.tsx (busca com debounce,
 * tabela, modal de criação) -- aqui escopado ao topógrafo logado.
 *
 * Endpoints usados (já existem no Backend, ver
 * controllers/topografo/clientes.controller.js):
 *   GET  /topografo/me/clientes?busca=
 *   POST /topografo/me/clientes   { nome, cpf?, email?, telefone? }
 */
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { api, ApiError } from "../../lib/api";

type Cliente = {
  id: number;
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
};

export function MeusClientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);

  function carregar() {
    setCarregando(true);
    setErro(null);

    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);

    api
      .get(`/topografo/me/clientes?${params.toString()}`)
      .then((data) => setClientes(Array.isArray(data) ? data : []))
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Erro ao carregar clientes"))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-vertente-dark">Meus Clientes</h1>
          <p className="mt-1 text-sm text-vertente-medium">
            Clientes cadastrados por você e os terrenos vinculados a cada um.
          </p>
        </div>
        <button
          onClick={() => setMostrarNovo(true)}
          className="rounded-lg bg-vertente px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vertente-dark"
        >
          + Novo Cliente
        </button>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome..."
        className="input mt-6 max-w-sm"
      />

      {erro && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      {carregando && !erro && (
        <p className="mt-6 text-sm text-vertente-medium">Carregando...</p>
      )}

      {!carregando && !erro && (
        <div className="mt-6 overflow-hidden rounded-xl2 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-vertente-bg text-vertente-medium">
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-6 py-3 font-medium">CPF</th>
                <th className="px-6 py-3 font-medium">E-mail</th>
                <th className="px-6 py-3 font-medium">Telefone</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-vertente-medium">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              )}

              {clientes.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/meus-clientes/${c.id}`)}
                  className="cursor-pointer border-b border-vertente-bg/60 last:border-0 hover:bg-vertente-bg/40"
                >
                  <td className="px-6 py-3 font-medium text-vertente-ink">{c.nome}</td>
                  <td className="px-6 py-3">{c.cpf ?? "—"}</td>
                  <td className="px-6 py-3">{c.email ?? "—"}</td>
                  <td className="px-6 py-3">{c.telefone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarNovo && (
        <NovoClienteModal onClose={() => setMostrarNovo(false)} onCriado={carregar} />
      )}
    </Layout>
  );
}

function NovoClienteModal({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro("Nome é obrigatório.");
      return;
    }

    setSalvando(true);
    try {
      await api.post("/topografo/me/clientes", {
        nome: nome.trim(),
        cpf: cpf.trim() || undefined,
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
      });
      onCriado();
      onClose();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao salvar cliente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={salvar}
        className="w-full max-w-md rounded-xl2 bg-white p-6 shadow-soft"
      >
        <h2 className="mb-4 text-base font-semibold text-vertente-dark">Novo Cliente</h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">
            CPF <span className="font-normal text-vertente-medium">(opcional)</span>
          </span>
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} className="input" />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">
            E-mail <span className="font-normal text-vertente-medium">(opcional)</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">
            Telefone <span className="font-normal text-vertente-medium">(opcional)</span>
          </span>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="input"
          />
        </label>

        {erro && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-vertente-medium hover:bg-vertente-bg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-vertente px-4 py-2 text-sm font-medium text-white hover:bg-vertente-dark disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
