import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

export function Configuracoes() {
  const { admin } = useAuth();

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
    </Layout>
  );
}
