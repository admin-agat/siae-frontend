// Enrutador principal del SIAE con rutas protegidas
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginPage from '../pages/auth/LoginPage';
import Layout from '../components/Layout';
import DashboardPage from '../pages/dashboard/DashboardPage';

//call pages
import TercerosPage from '../pages/terceros/TercerosPage';
import FincasPage from '../pages/fincas/fincasPage';
import WarehousesPage from '../pages/inventario/WarehousesPage';

import SupplyCategoriesPage from '../pages/inventario/SupplyCategoriesPage';
import MovementReasonsPage from "../pages/inventario/MovementReasonsPage";
import SuppliesPage from '../pages/inventario/SuppliesPage';
import InventoryStockPage from "../pages/inventario/InventoryStockPage";

import InventoryMovementFormPage from "../pages/inventario/InventoryMovementFormPage";

import SuppliesMasterDetailPage from "../pages/inventario/SuppliesMasterDetailPage";




// Componente que protege rutas privadas
function RutaPrivada({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas privadas — dentro del Layout */}
        <Route path="/" element={
          <RutaPrivada>
            <Layout />
          </RutaPrivada>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Módulo Terceros */}
          <Route path="terceros" element={<TercerosPage />} />

          {/* Módulo Fincas */}
          <Route path="fincas" element={<FincasPage />} />

          {/* Módulo Inventario */}
          <Route path="bodegas" element={<WarehousesPage />} />
        
          <Route path="categorias-insumo" element={<SupplyCategoriesPage />} />
          <Route path="insumos" element={<SuppliesPage />} />

          <Route path="/inventario/motivos-movimiento" element={<MovementReasonsPage />} />

          <Route path="/motivos-movimiento" element={<MovementReasonsPage />} />

          <Route path="/stock" element={<InventoryStockPage />} />

          <Route path="/movimientos/nuevo" element={<InventoryMovementFormPage />} />

          <Route path="/insumos-categorias" element={<SuppliesMasterDetailPage />} />

        </Route>

        {/* Ruta no encontrada */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}