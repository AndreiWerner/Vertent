import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ContourLines } from "../components/ContourLines";
import { ApiError } from "../lib/api";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    try {
      await login(email, senha);
      navigate("/");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-vertente-dark px-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl2 bg-white p-8 shadow-soft">
        <ContourLines className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 text-vertente-light/40" />

        <div className="relative">
          <p className="font-display text-2xl font-semibold text-vertente-dark">
            Vertente
          </p>
          <p className="mb-8 text-sm text-vertente-medium">Painel administrativo</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-vertente-ink">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-vertente-medium/30 px-4 py-2.5 text-sm outline-none focus:border-vertente"
                placeholder="voce@vertente.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-vertente-ink">
                Senha
              </label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-vertente-medium/30 px-4 py-2.5 text-sm outline-none focus:border-vertente"
                placeholder="••••••••"
              />
            </div>

            {erro && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-vertente py-2.5 text-sm font-medium text-white transition-colors hover:bg-vertente-dark disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
