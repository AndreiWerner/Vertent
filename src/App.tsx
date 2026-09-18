import { Routes, Route } from "react-router-dom";
import { ProtectedRoute, AdminRoute, TopografoRoute } from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Terrenos } from "./pages/Terrenos";
import { NovoTerreno } from "./pages/NovoTerreno";
import { EditarTerreno } from "./pages/EditarTerreno";
import { Usuarios } from "./pages/Usuarios";
import { Topografos } from "./pages/Topografos";
import { TopografoDetalhe } from "./pages/TopografoDetalhe";
import { Configuracoes } from "./pages/Configuracoes";
import { PainelTopografo } from "./pages/topografo/Painel";
import { MeusClientes } from "./pages/topografo/MeusClientes";
import { ClienteDetalhe } from "./pages/topografo/ClienteDetalhe";

// "/" mostra telas diferentes dependendo de quem logou -- o admin
// continua caindo no Dashboard de sempre, o topógrafo cai no painel
// dele. Ambos os lados já são um `papel` válido aqui dentro (ver
// ProtectedRoute em App abaixo, que garante isso antes de renderizar
// <Home />), então não precisa checar `loading` de novo.
function Home() {
  const { papel } = useAuth();
  return papel === "admin" ? <Dashboard /> : <PainelTopografo />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* ---- Área exclusiva do administrador ---- */}
      <Route
        path="/terrenos"
        element={
          <AdminRoute>
            <Terrenos />
          </AdminRoute>
        }
      />
      <Route
        path="/terrenos/novo"
        element={
          <AdminRoute>
            <NovoTerreno />
          </AdminRoute>
        }
      />
      <Route
        path="/terrenos/:id/editar"
        element={
          <AdminRoute>
            <EditarTerreno />
          </AdminRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <AdminRoute>
            <Usuarios />
          </AdminRoute>
        }
      />
      <Route
        path="/topografos"
        element={
          <AdminRoute>
            <Topografos />
          </AdminRoute>
        }
      />
      <Route
        path="/topografos/:id"
        element={
          <AdminRoute>
            <TopografoDetalhe />
          </AdminRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <AdminRoute>
            <Configuracoes />
          </AdminRoute>
        }
      />

      {/* ---- Área exclusiva do topógrafo ---- */}
      <Route
        path="/meus-clientes"
        element={
          <TopografoRoute>
            <MeusClientes />
          </TopografoRoute>
        }
      />
      <Route
        path="/meus-clientes/:clienteId"
        element={
          <TopografoRoute>
            <ClienteDetalhe />
          </TopografoRoute>
        }
      />
    </Routes>
  );
}
