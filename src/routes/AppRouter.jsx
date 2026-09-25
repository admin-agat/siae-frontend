// Enrutador principal del SIAE con rutas protegidas
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginPage from '../pages/auth/LoginPage';
import Layout from '../components/Layout';
import DashboardPage from '../pages/dashboard/DashboardPage';
import BrandsPage from "../pages/exportaciones/BrandsPage";
//call pages
import TercerosPage from '../pages/terceros/TercerosPage';
import FincasPage from '../pages/fincas/fincasPage';
import WarehousesPage from '../pages/inventario/WarehousesPage';
import MovementReasonsPage from "../pages/inventario/MovementReasonsPage";
import InventoryStockPage from "../pages/inventario/InventoryStockPage";
import InventoryMovementFormPage from "../pages/inventario/InventoryMovementFormPage";
import InventoryMovementReceiptPage from "../pages/inventario/InventoryMovementReceiptPage";
import SuppliesMasterDetailPage from "../pages/inventario/SuppliesMasterDetailPage";
import PurchaseOrderFormPage from "../pages/inventario/PurchaseOrderFormPage";
import PurchaseOrderDetailPage from "../pages/inventario/PurchaseOrderDetailPage";
import PendingTransfersPage from "../pages/inventario/PendingTransfersPage";
import ShippingLinesPage from "../pages/exportaciones/ShippingLinesPage";
import BookingsPage from "../pages/exportaciones/BookingsPage";
import PortsMasterDetailPage from "../pages/exportaciones/PortsMasterDetailPage";
import DestinationsPage from "../pages/exportaciones/DestinationsPage";
import CustomersPage from "../pages/exportaciones/CustomersPage";
// Despacho de Materiales — cálculo de receta/BOM por cupo de productor + guardado del EGRESO
import MaterialDispatchPage from "../pages/inventario/MaterialDispatchPage";
// NUEVO: Historial de despachos (quién retiró, valor a descontar, reimprimir guía, anular)
import MaterialDispatchHistoryPage from "../pages/inventario/MaterialDispatchHistoryPage";

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
// BLOQUEA a un BODEGUERO de entrar por URL directa a páginas que no le
// corresponden. Solo puede ver: Stock General, Nuevo Movimiento, Despacho de
// Materiales, su Historial y el recibo/guía. Si intenta otra, va a /stock.
function RutaNoBodeguero({ children }) {
  const { user } = useAuth();
  return user?.role === "BODEGUERO" ? <Navigate to="/stock" /> : children;
}
// Protege la confirmación de transferencias — solo COORDINADOR_INVENTARIO y
// ADMIN (mismo criterio del backend en pendingTransfers()/confirmTransfer()).
function RutaSoloCoordinador({ children }) {
  const { user } = useAuth();
  return ["COORDINADOR_INVENTARIO", "ADMIN"].includes(user?.role)
    ? children
    : <Navigate to="/stock" />;
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
          {/* Módulo Terceros — solo ADMIN */}
          <Route path="terceros" element={<RutaSoloAdmin><TercerosPage /></RutaSoloAdmin>} />
          {/* Módulo Fincas — solo ADMIN */}
          <Route path="fincas" element={<RutaSoloAdmin><FincasPage /></RutaSoloAdmin>} />

          {/* Módulo Exportaciones — CORREGIDO: antes no tenían RutaNoBodeguero,
              un BODEGUERO podía entrar escribiendo la URL a mano */}
          <Route path="navieras" element={<RutaNoBodeguero><ShippingLinesPage /></RutaNoBodeguero>} />
          <Route path="bookings" element={<RutaNoBodeguero><BookingsPage /></RutaNoBodeguero>} />
          <Route path="/exportaciones/puertos" element={<RutaNoBodeguero><PortsMasterDetailPage /></RutaNoBodeguero>} />
          <Route path="/exportaciones/destinos" element={<RutaNoBodeguero><DestinationsPage /></RutaNoBodeguero>} />
          <Route path="/exportaciones/clientes" element={<RutaNoBodeguero><CustomersPage /></RutaNoBodeguero>} />
          <Route path="/exportaciones/marcas" element={<RutaNoBodeguero><BrandsPage /></RutaNoBodeguero>} />

          {/* Módulo Inventario */}
          <Route path="bodegas" element={<RutaNoBodeguero><WarehousesPage /></RutaNoBodeguero>} />
          {/* Insumos: vista maestro-detalle (categorías + insumos combinados) */}
          <Route path="/insumos-categorias" element={<RutaNoBodeguero><SuppliesMasterDetailPage /></RutaNoBodeguero>} />
          <Route path="/motivos-movimiento" element={<RutaNoBodeguero><MovementReasonsPage /></RutaNoBodeguero>} />

          {/* Rutas que SÍ puede ver un BODEGUERO (por eso no llevan RutaNoBodeguero).
              El recibo/guía se abre al guardar, pero también por URL directa para reimprimir. */}
          <Route path="/stock" element={<InventoryStockPage />} />
          <Route path="/movimientos/nuevo" element={<InventoryMovementFormPage />} />
          <Route path="/inventory-movements/:id/recibo" element={<InventoryMovementReceiptPage />} />
          <Route path="/despacho-materiales" element={<MaterialDispatchPage />} />
          {/* NUEVO: historial — el backend le filtra al BODEGUERO solo su bodega */}
          <Route path="/despacho-materiales/historial" element={<MaterialDispatchHistoryPage />} />

          {/* Bandeja de transferencias pendientes — solo Coordinador de Inventario y Admin */}
          <Route path="/transferencias-pendientes" element={<RutaSoloCoordinador><PendingTransfersPage /></RutaSoloCoordinador>} />

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