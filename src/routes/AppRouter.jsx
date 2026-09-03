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
import MovementReasonsPage from "../pages/inventario/MovementReasonsPage";
import InventoryStockPage from "../pages/inventario/InventoryStockPage";
import InventoryMovementFormPage from "../pages/inventario/InventoryMovementFormPage";
import SuppliesMasterDetailPage from "../pages/inventario/SuppliesMasterDetailPage";
import PurchaseOrderFormPage from "../pages/inventario/PurchaseOrderFormPage";
import PurchaseOrderDetailPage from "../pages/inventario/PurchaseOrderDetailPage";

//ordenes de compras
import PurchaseOrdersPage from "../pages/inventario/PurchaseOrdersPage";

// Componente que protege rutas privadas
function RutaPrivada({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}
// Componente que protege rutas exclusivas de ADMIN (Terceros, Fincas)
// Si un usuario de rol bodega intenta entrar por URL directa, lo manda a /bodegas
function RutaSoloAdmin({ children }) {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? children : <Navigate to="/bodegas" />;
}
// Componente que BLOQUEA a un BODEGUERO de entrar por URL directa a páginas
// que no le corresponden (todo excepto Stock General y Nuevo Movimiento).
// Un BODEGUERO que intente entrar aquí es redirigido a /stock.
function RutaNoBodeguero({ children }) {
  const { user } = useAuth();
  return user?.role === "BODEGUERO" ? <Navigate to="/stock" /> : children;
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
          <Route index element={<RutaNoBodeguero><DashboardPage /></RutaNoBodeguero>} />
          <Route path="dashboard" element={<RutaNoBodeguero><DashboardPage /></RutaNoBodeguero>} />
          {/* Módulo Terceros — solo ADMIN (ya bloquea BODEGUERO igual que los demás roles) */}
          <Route path="terceros" element={<RutaSoloAdmin><TercerosPage /></RutaSoloAdmin>} />
          {/* Módulo Fincas — solo ADMIN */}
          <Route path="fincas" element={<RutaSoloAdmin><FincasPage /></RutaSoloAdmin>} />
          {/* Módulo Inventario */}
          <Route path="bodegas" element={<RutaNoBodeguero><WarehousesPage /></RutaNoBodeguero>} />

          {/* Insumos: solo la vista maestro-detalle (categorías + insumos combinados).
              Las páginas viejas por separado (/categorias-insumo, /insumos) se eliminaron
              — ya no se usan, confirmado con el usuario. */}
          <Route path="/insumos-categorias" element={<RutaNoBodeguero><SuppliesMasterDetailPage /></RutaNoBodeguero>} />

          <Route path="/motivos-movimiento" element={<RutaNoBodeguero><MovementReasonsPage /></RutaNoBodeguero>} />

          {/* Stock General y Nuevo Movimiento — las únicas dos que un BODEGUERO
              puede ver, por eso no llevan RutaNoBodeguero */}
          <Route path="/stock" element={<InventoryStockPage />} />
          <Route path="/movimientos/nuevo" element={<InventoryMovementFormPage />} />

          <Route path="/ordenes-compra" element={<RutaNoBodeguero><PurchaseOrdersPage /></RutaNoBodeguero>} />
          <Route path="/ordenes-compra/nueva" element={<RutaNoBodeguero><PurchaseOrderFormPage /></RutaNoBodeguero>} />
          <Route path="/ordenes-compra/:id" element={<RutaNoBodeguero><PurchaseOrderDetailPage /></RutaNoBodeguero>} />

        </Route>
        {/* Ruta no encontrada */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}