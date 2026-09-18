import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "../lib/api";

export type Papel = "admin" | "topografo";

export type Admin = { id: number; nome: string; email: string };
export type Topografo = {
  id: number;
  nome: string;
  email: string;
  telefone?: string | null;
  status?: "ativo" | "inativo";
  plano?: string | null;
  limite_terrenos?: number | null;
};

type AuthContextValue = {
  papel: Papel | null;
  admin: Admin | null;
  topografo: Topografo | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Mesma chave de sempre para o token (evita invalidar sessões já
// salvas no navegador do admin) -- só ganhou uma irmã para o papel.
const TOKEN_KEY = "vertente_admin_token";
const PAPEL_KEY = "vertente_papel";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [papel, setPapel] = useState<Papel | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [topografo, setTopografo] = useState<Topografo | null>(null);
  const [loading, setLoading] = useState(true);

  function limparSessao() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PAPEL_KEY);
    setPapel(null);
    setAdmin(null);
    setTopografo(null);
  }

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const papelSalvo = localStorage.getItem(PAPEL_KEY) as Papel | null;

    if (!token || !papelSalvo) {
      setLoading(false);
      return;
    }

    const rota = papelSalvo === "admin" ? "/admin/me" : "/topografo/me";

    api
      .get(rota)
      .then((data) => {
        if (papelSalvo === "admin") {
          setAdmin(data);
        } else {
          setTopografo(data);
        }
        setPapel(papelSalvo);
      })
      .catch(() => limparSessao())
      .finally(() => setLoading(false));
  }, []);

  // Um único formulário de login (ver Login.tsx) serve tanto o admin
  // quanto o topógrafo -- eles têm tabelas/endpoints próprios
  // (POST /admin/login e POST /topografo/login), então primeiro
  // tenta como admin; só tenta como topógrafo se as credenciais
  // realmente não baterem como admin (401), nunca em caso de erro de
  // rede/servidor (esses já sobem direto pra quem chamou).
  async function login(email: string, senha: string) {
    try {
      const data = await api.post("/admin/login", { email, senha });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(PAPEL_KEY, "admin");
      setPapel("admin");
      setAdmin(data.admin);
      setTopografo(null);
      return;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) {
        throw err;
      }
      // Não é admin (ou senha errada como admin) -- tenta como
      // topógrafo antes de desistir.
    }

    const data = await api.post("/topografo/login", { email, senha });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(PAPEL_KEY, "topografo");
    setPapel("topografo");
    setTopografo(data.topografo);
    setAdmin(null);
  }

  function logout() {
    limparSessao();
  }

  return (
    <AuthContext.Provider value={{ papel, admin, topografo, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
