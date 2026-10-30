// Enrutador principal del SIAE con rutas protegidas
// 29/10/2026: las páginas se cargan con React.lazy (una parte del JS por pantalla) para que
// el primer ingreso sea más liviano. El Suspense está en Layout.jsx. Login y Layout se cargan siempre.
// Las rutas de cada pantalla están en paginas.js: Layout las precarga en segundo plano.
import { lazy } from 'react';
import { PAGINAS } from './paginas';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES_INVENTARIO, ROLES_EXPORTACIONES, ROLES_COMERCIAL, inicioPorRol } from './roles';
import LoginPage from '../pages/auth/LoginPage';
import Layout from '../components/Layout';
const DashboardPage = lazy(PAGINAS.DashboardPage);
const BrandsPage = lazy(PAGINAS.BrandsPage);
//call pages
const TercerosPage = lazy(PAGINAS.TercerosPage);
// 27/10/2026: CORREGIDO — antes importaba '../pages/fincas/fincasPage' (f minúscula).
// En Windows funcionaba, pero en Linux (producción) rompe la pantalla si no coincide exacto.
const FincasPage = lazy(PAGINAS.FincasPage);
const WarehousesPage = lazy(PAGINAS.WarehousesPage);
const MovementReasonsPage = lazy(PAGINAS.MovementReasonsPage);
const InventoryStockPage = lazy(PAGINAS.InventoryStockPage);
const InventoryMovementFormPage = lazy(PAGINAS.InventoryMovementFormPage);
const InventoryMovementReceiptPage = lazy(PAGINAS.InventoryMovementReceiptPage);
const SuppliesMasterDetailPage = lazy(PAGINAS.SuppliesMasterDetailPage);
const PurchaseOrderFormPage = lazy(PAGINAS.PurchaseOrderFormPage);
const PurchaseOrderDetailPage = lazy(PAGINAS.PurchaseOrderDetailPage);
const PendingTransfersPage = lazy(PAGINAS.PendingTransfersPage);
const ShippingLinesPage = lazy(PAGINAS.ShippingLinesPage);
const BookingsPage = lazy(PAGINAS.BookingsPage);
const PortsMasterDetailPage = lazy(PAGINAS.PortsMasterDetailPage);
const DestinationsPage = lazy(PAGINAS.DestinationsPage);
const CustomersPage = lazy(PAGINAS.CustomersPage);
// Contratos de CLIENTES — vigencia y precio por caja (no confundir con contratos MAGAP de productores)
const CustomerContractsPage = lazy(PAGINAS.CustomerContractsPage);
// Pedido semanal de Rusia (listado + formulario de líneas)
const CustomerOrdersPage = lazy(PAGINAS.CustomerOrdersPage);
const CustomerOrderFormPage = lazy(PAGINAS.CustomerOrderFormPage);
// Fase 2: distribución del pedido en barcos (Logística)
const OrderDistributionsPage = lazy(PAGINAS.OrderDistributionsPage);
const OrderDistributionPage = lazy(PAGINAS.OrderDistributionPage);
// 29/10/2026: cierre de embarque por booking (lo realmente embarcado + documentos)
const ShipmentClosingsPage = lazy(PAGINAS.ShipmentClosingsPage);
const ShipmentClosingPage = lazy(PAGINAS.ShipmentClosingPage);
// 29/10/2026: usuarios (CONFIGURACIÓN)
const UsersPage = lazy(PAGINAS.UsersPage);
// 30/10/2026: bitácora de auditoría (CONFIGURACIÓN, solo ADMIN)
const AuditLogPage = lazy(PAGINAS.AuditLogPage);
// Fase 3: compra de fruta a productores (Comercial)
const PurchasesPage = lazy(PAGINAS.PurchasesPage);
const PurchaseAllocationPage = lazy(PAGINAS.PurchaseAllocationPage);
const OfficialPricesPage = lazy(PAGINAS.OfficialPricesPage);
const CreditNotesPage = lazy(PAGINAS.CreditNotesPage);
// Liquidación al productor: tarjas, anticipos, liquidar y pagos (solo ADMIN)
const TalliesPage = lazy(PAGINAS.TalliesPage);
const TallySheetPage = lazy(PAGINAS.TallySheetPage);
const ProducerAdvancesPage = lazy(PAGINAS.ProducerAdvancesPage);
const SettlementsPage = lazy(PAGINAS.SettlementsPage);
const SettlementFormPage = lazy(PAGINAS.SettlementFormPage);
const SettlementDetailPage = lazy(PAGINAS.SettlementDetailPage);
const SettlementHistoryPage = lazy(PAGINAS.SettlementHistoryPage);
// Despacho de Materiales — cálculo de receta/BOM por cupo de productor + guardado del EGRESO
const MaterialDispatchPage = lazy(PAGINAS.MaterialDispatchPage);
// Historial de despachos (quién retiró, valor a descontar, reimprimir guía, anular)
const MaterialDispatchHistoryPage = lazy(PAGINAS.MaterialDispatchHistoryPage);

//ordenes de compras
const PurchaseOrdersPage = lazy(PAGINAS.PurchaseOrdersPage);

// Componente que protege rutas privadas
function RutaPrivada({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}
// Componente que protege rutas exclusivas de ADMIN (sección CONFIGURACIÓN del menú:
// Terceros, Fincas, Clientes, Destinos, Contratos de clientes y Marcas).
// Si otro rol intenta entrar por URL directa, lo manda a /bodegas
function RutaSoloAdmin({ children }) {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? children : <Navigate to={inicioPorRol(user?.role)} />;
}
// 29/10/2026: deja entrar solo a los roles indicados; el resto va a su pantalla de inicio.
// (Antes RutaNoBodeguero: con los roles EXPORTACIONES y COMERCIAL ya no basta con excluir al
// BODEGUERO — cada área ve solo lo suyo.)
function RutaRoles({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user?.role) ? children : <Navigate to={inicioPorRol(user?.role)} />;
}
const RutaInventario = ({ children }) => <RutaRoles roles={ROLES_INVENTARIO}>{children}</RutaRoles>;
const RutaExportaciones = ({ children }) => <RutaRoles roles={ROLES_EXPORTACIONES}>{children}</RutaRoles>;
const RutaComercial = ({ children }) => <RutaRoles roles={ROLES_COMERCIAL}>{children}</RutaRoles>;
// Pantallas de bodega que también usa el BODEGUERO (stock, movimiento, despacho, historial, guía)
const RutaBodega = ({ children }) => <RutaRoles roles={[...ROLES_INVENTARIO, "BODEGUERO"]}>{children}</RutaRoles>;
// Protege la confirmación de transferencias — solo COORDINADOR_INVENTARIO y
// ADMIN (mismo criterio del backend en pendingTransfers()/confirmTransfer()).
function RutaSoloCoordinador({ children }) {
  const { user } = useAuth();
  return ["COORDINADOR_INVENTARIO", "ADMIN"].includes(user?.role)
    ? children
    : <Navigate to={inicioPorRol(user?.role)} />;
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
          <Route index element={<RutaInventario><DashboardPage /></RutaInventario>} />
          <Route path="dashboard" element={<RutaInventario><DashboardPage /></RutaInventario>} />

          {/* 29/10/2026: usuarios del sistema */}
          <Route path="usuarios" element={<RutaSoloAdmin><UsersPage /></RutaSoloAdmin>} />
          <Route path="bitacora" element={<RutaSoloAdmin><AuditLogPage /></RutaSoloAdmin>} />

          {/* ===== CONFIGURACIÓN — datos maestros, solo ADMIN ===== */}
          <Route path="terceros" element={<RutaSoloAdmin><TercerosPage /></RutaSoloAdmin>} />
          {/* 29/10/2026: misma pantalla de Terceros filtrada a COMERCIALIZADORA */}
          <Route path="comercializadoras" element={<RutaSoloAdmin><TercerosPage key="comercializadoras" tipoFijo="COMERCIALIZADORA" /></RutaSoloAdmin>} />
          <Route path="fincas" element={<RutaSoloAdmin><FincasPage /></RutaSoloAdmin>} />
          {/* 27/10/2026: Clientes, Destinos y Contratos pasaron a CONFIGURACIÓN → RutaSoloAdmin
              (antes RutaNoBodeguero: un JEFE_BODEGA o COORDINADOR podía entrar por URL).
              La URL /exportaciones/... se mantiene para no romper enlaces. */}
          <Route path="/exportaciones/clientes" element={<RutaSoloAdmin><CustomersPage /></RutaSoloAdmin>} />
          <Route path="/exportaciones/destinos" element={<RutaSoloAdmin><DestinationsPage /></RutaSoloAdmin>} />
          <Route path="/exportaciones/contratos-clientes" element={<RutaSoloAdmin><CustomerContractsPage /></RutaSoloAdmin>} />
          {/* 28/10/2026: Marcas pasó a CONFIGURACIÓN → RutaSoloAdmin (antes RutaNoBodeguero) */}
          <Route path="/exportaciones/marcas" element={<RutaSoloAdmin><BrandsPage /></RutaSoloAdmin>} />

          {/* ===== Módulo Exportaciones (operación) ===== */}
          <Route path="/exportaciones/pedidos" element={<RutaExportaciones><CustomerOrdersPage /></RutaExportaciones>} />
          <Route path="/exportaciones/pedidos/nuevo" element={<RutaExportaciones><CustomerOrderFormPage /></RutaExportaciones>} />
          <Route path="/exportaciones/pedidos/:id" element={<RutaExportaciones><CustomerOrderFormPage /></RutaExportaciones>} />
          <Route path="/exportaciones/embarques" element={<RutaExportaciones><OrderDistributionsPage /></RutaExportaciones>} />
          <Route path="/exportaciones/embarques/:id" element={<RutaExportaciones><OrderDistributionPage /></RutaExportaciones>} />
          <Route path="/exportaciones/cierre" element={<RutaExportaciones><ShipmentClosingsPage /></RutaExportaciones>} />
          <Route path="/exportaciones/cierre/:id" element={<RutaExportaciones><ShipmentClosingPage /></RutaExportaciones>} />

          {/* ===== Módulo Comercial ===== */}
          <Route path="/comercial/compras" element={<RutaComercial><PurchasesPage /></RutaComercial>} />
          <Route path="/comercial/compras/:id" element={<RutaComercial><PurchaseAllocationPage /></RutaComercial>} />
          <Route path="/comercial/precios-oficiales" element={<RutaComercial><OfficialPricesPage /></RutaComercial>} />

          {/* ===== Liquidación (dinero al productor) — solo ADMIN ===== */}
          <Route path="/liquidacion" element={<RutaSoloAdmin><SettlementsPage /></RutaSoloAdmin>} />
          <Route path="/liquidacion/tarjas" element={<RutaSoloAdmin><TalliesPage /></RutaSoloAdmin>} />
          <Route path="/liquidacion/tarjas/:id" element={<RutaSoloAdmin><TallySheetPage /></RutaSoloAdmin>} />
          <Route path="/liquidacion/anticipos" element={<RutaSoloAdmin><ProducerAdvancesPage /></RutaSoloAdmin>} />
          <Route path="/liquidacion/notas-credito" element={<RutaSoloAdmin><CreditNotesPage /></RutaSoloAdmin>} />
          <Route path="/liquidacion/pagos" element={<RutaSoloAdmin><SettlementHistoryPage /></RutaSoloAdmin>} />
          <Route path="/liquidacion/cupo/:quotaId" element={<RutaSoloAdmin><SettlementFormPage /></RutaSoloAdmin>} />
          <Route path="/liquidacion/:id" element={<RutaSoloAdmin><SettlementDetailPage /></RutaSoloAdmin>} />
          <Route path="navieras" element={<RutaExportaciones><ShippingLinesPage /></RutaExportaciones>} />
          <Route path="bookings" element={<RutaExportaciones><BookingsPage /></RutaExportaciones>} />
          {/* 29/10/2026: Puertos pasó a CONFIGURACIÓN → RutaSoloAdmin */}
          <Route path="/exportaciones/puertos" element={<RutaSoloAdmin><PortsMasterDetailPage /></RutaSoloAdmin>} />

          {/* ===== Módulo Inventario ===== */}
          <Route path="bodegas" element={<RutaInventario><WarehousesPage /></RutaInventario>} />
          {/* Insumos: vista maestro-detalle (categorías + insumos combinados) */}
          <Route path="/insumos-categorias" element={<RutaInventario><SuppliesMasterDetailPage /></RutaInventario>} />
          <Route path="/motivos-movimiento" element={<RutaInventario><MovementReasonsPage /></RutaInventario>} />

          {/* Rutas que SÍ puede ver un BODEGUERO (RutaBodega: inventario + BODEGUERO).
              El recibo/guía se abre al guardar, pero también por URL directa para reimprimir. */}
          <Route path="/stock" element={<RutaBodega><InventoryStockPage /></RutaBodega>} />
          <Route path="/movimientos/nuevo" element={<RutaBodega><InventoryMovementFormPage /></RutaBodega>} />
          <Route path="/inventory-movements/:id/recibo" element={<RutaBodega><InventoryMovementReceiptPage /></RutaBodega>} />
          <Route path="/despacho-materiales" element={<RutaBodega><MaterialDispatchPage /></RutaBodega>} />
          {/* Historial — el backend le filtra al BODEGUERO solo su bodega */}
          <Route path="/despacho-materiales/historial" element={<RutaBodega><MaterialDispatchHistoryPage /></RutaBodega>} />

          {/* Bandeja de transferencias pendientes — solo Coordinador de Inventario y Admin */}
          <Route path="/transferencias-pendientes" element={<RutaSoloCoordinador><PendingTransfersPage /></RutaSoloCoordinador>} />

          <Route path="/ordenes-compra" element={<RutaInventario><PurchaseOrdersPage /></RutaInventario>} />
          <Route path="/ordenes-compra/nueva" element={<RutaInventario><PurchaseOrderFormPage /></RutaInventario>} />
          <Route path="/ordenes-compra/:id" element={<RutaInventario><PurchaseOrderDetailPage /></RutaInventario>} />

        </Route>
        {/* Ruta no encontrada */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}