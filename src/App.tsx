import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Terrenos } from "./pages/Terrenos";
import { NovoTerreno } from "./pages/NovoTerreno";
import { EditarTerreno } from "./pages/EditarTerreno";
import { Usuarios } from "./pages/Usuarios";
import { Configuracoes } from "./pages/Configuracoes";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/terrenos"
        element={
          <ProtectedRoute>
            <Terrenos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/terrenos/novo"
        element={
          <ProtectedRoute>
            <NovoTerreno />
          </ProtectedRoute>
        }
      />
      <Route
        path="/terrenos/:id/editar"
        element={
          <ProtectedRoute>
            <EditarTerreno />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <Usuarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <Configuracoes />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
