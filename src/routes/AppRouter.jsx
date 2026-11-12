// Enrutador principal del SIAE con rutas protegidas
// 29/10/2026: las páginas se cargan con React.lazy (una parte del JS por pantalla) para que
// el primer ingreso sea más liviano. El Suspense está en Layout.jsx. Login y Layout se cargan siempre.
// Las rutas de cada pantalla están en paginas.js: Layout las precarga en segundo plano.
import { lazy } from 'react';
import { PAGINAS } from './paginas';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// 30/10/2026: permisos por persona — cada ruta pide su pantalla (misma clave que el menú y el backend)
import { puede, esAdmin, inicioDe } from './menu';
import LoginPage from '../pages/auth/LoginPage';
import CambiarClavePage from '../pages/auth/CambiarClavePage';
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
const InventoryMovementsPage = lazy(PAGINAS.InventoryMovementsPage);
const InventoryMovementReceiptPage = lazy(PAGINAS.InventoryMovementReceiptPage);
const SuppliesMasterDetailPage = lazy(PAGINAS.SuppliesMasterDetailPage);
const PurchaseOrderFormPage = lazy(PAGINAS.PurchaseOrderFormPage);
const PurchaseOrderDetailPage = lazy(PAGINAS.PurchaseOrderDetailPage);
const PendingTransfersPage = lazy(PAGINAS.PendingTransfersPage);
const ShippingLinesPage = lazy(PAGINAS.ShippingLinesPage);
const PortsMasterDetailPage = lazy(PAGINAS.PortsMasterDetailPage);
const DestinationsPage = lazy(PAGINAS.DestinationsPage);
// Contratos de CLIENTES — vigencia y precio por caja (no confundir con contratos MAGAP de productores)
const CustomerContractsPage = lazy(PAGINAS.CustomerContractsPage);
const VoyageCostsPage = lazy(PAGINAS.VoyageCostsPage);
const VoyageProfitPage = lazy(PAGINAS.VoyageProfitPage);
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
// 30/10/2026: perfiles de permisos por pantalla (CONFIGURACIÓN, solo ADMIN)
const ProfilesPage = lazy(PAGINAS.ProfilesPage);
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
// 06/11/2026: parámetros de la semana + tabla de retención, contratos y retención de productores
const SettlementParametersPage = lazy(PAGINAS.SettlementParametersPage);
const ProducerContractsPage = lazy(PAGINAS.ProducerContractsPage);
// Despacho de Materiales — cálculo de receta/BOM por cupo de productor + guardado del EGRESO
const MaterialDispatchPage = lazy(PAGINAS.MaterialDispatchPage);
// Historial de despachos (quién retiró, valor a descontar, reimprimir guía, anular)
const MaterialDispatchHistoryPage = lazy(PAGINAS.MaterialDispatchHistoryPage);
// 05/11/2026: bandeja "Por despachar" (compras de Comercial y lo que falta entregar)
const DispatchPendingPage = lazy(PAGINAS.DispatchPendingPage);

//ordenes de compras
const PurchaseOrdersPage = lazy(PAGINAS.PurchaseOrdersPage);
// 05/11/2026: OC por departamento, aprobación y pago (Contabilidad), cuentas bancarias de proveedores
const DepartmentOrdersPage = lazy(PAGINAS.DepartmentOrdersPage);
const AccountingOrdersPage = lazy(PAGINAS.AccountingOrdersPage);
const BankAccountsPage = lazy(PAGINAS.BankAccountsPage);

// Componente que protege rutas privadas
// 09/11/2026: si debe cambiar la contraseña (primer ingreso o vencida) solo ve "Cambia tu contraseña"
function RutaPrivada({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" />;
  return user?.cambiar_clave ? <Navigate to="/cambiar-clave" replace /> : children;
}
function RutaCambiarClave() {
  const { token } = useAuth();
  return token ? <CambiarClavePage /> : <Navigate to="/login" />;
}
// Mientras llegan las pantallas del usuario (/me, ver Layout.jsx) no se decide nada: así una sesión
// guardada antes de los permisos por persona no rebota a otra pantalla al recargar.
const ESPERANDO_PERMISOS = <div className="p-6 text-gray-400">Cargando...</div>;
// Solo ADMIN: Usuarios, Perfiles y Bitácora (no se delegan).
function RutaSoloAdmin({ children }) {
  const { user } = useAuth();
  if (!user?.pantallas) return ESPERANDO_PERMISOS;
  return esAdmin(user) ? children : <Navigate to={inicioDe(user)} replace />;
}
// Deja entrar si el usuario tiene alguna de las pantallas indicadas (perfil + excepciones);
// si no, lo manda a su pantalla de inicio.
function RutaPantalla({ p, children }) {
  const { user } = useAuth();
  if (!user?.pantallas) return ESPERANDO_PERMISOS;
  return puede(user, ...[].concat(p)) ? children : <Navigate to={inicioDe(user)} replace />;
}
// Inicio: la primera pantalla del menú que puede abrir
function Inicio() {
  const { user } = useAuth();
  if (!user?.pantallas) return ESPERANDO_PERMISOS;
  return <Navigate to={inicioDe(user)} replace />;
}
function SinAcceso() {
  return (
    <div className="bg-white rounded-xl shadow p-8 text-center text-gray-600">
      <p className="font-semibold text-gray-800 mb-1">Tu usuario todavía no tiene pantallas asignadas.</p>
      <p className="text-sm">Pide al administrador que te asigne un perfil en CONFIGURACIÓN → Usuarios.</p>
    </div>
  );
}
const P = (p, el) => <RutaPantalla p={p}>{el}</RutaPantalla>;
const A = (el) => <RutaSoloAdmin>{el}</RutaSoloAdmin>;
// El detalle de una liquidación se abre desde Liquidar, Pagos y Notas de crédito
const LIQ = ['liquidar', 'pagos', 'notas_credito'];

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<LoginPage />} />
        {/* 09/11/2026: fuera del Layout (sin menú): obligatoria al primer ingreso y cada 3 meses */}
        <Route path="/cambiar-clave" element={<RutaCambiarClave />} />
        {/* Rutas privadas — dentro del Layout */}
        <Route path="/" element={
          <RutaPrivada>
            <Layout />
          </RutaPrivada>
        }>
          <Route index element={<Inicio />} />
          <Route path="dashboard" element={P('dashboard', <DashboardPage />)} />

          {/* 29/10/2026: usuarios del sistema */}
          <Route path="usuarios" element={A(<UsersPage />)} />
          <Route path="perfiles" element={A(<ProfilesPage />)} />
          <Route path="sin-acceso" element={<SinAcceso />} />
          <Route path="bitacora" element={A(<AuditLogPage />)} />

          {/* ===== CONFIGURACIÓN — datos maestros, solo ADMIN ===== */}
          <Route path="terceros" element={P('terceros', <TercerosPage />)} />
          {/* 02/11/2026: la pantalla Comercializadoras se quitó (repetía Terceros): la ruta vieja abre Terceros filtrado */}
          <Route path="comercializadoras" element={<Navigate to="/terceros?tipo=COMERCIALIZADORA" replace />} />
          <Route path="fincas" element={P('fincas', <FincasPage />)} />
          {/* 27/10/2026: Clientes, Destinos y Contratos pasaron a CONFIGURACIÓN → RutaSoloAdmin
              (antes RutaNoBodeguero: un JEFE_BODEGA o COORDINADOR podía entrar por URL).
              La URL /exportaciones/... se mantiene para no romper enlaces. */}
          {/* 02/11/2026: la pantalla Clientes se quitó; los clientes se manejan en Terceros */}
          <Route path="/exportaciones/clientes" element={<Navigate to="/terceros" replace />} />
          <Route path="/exportaciones/destinos" element={P('destinos', <DestinationsPage />)} />
          <Route path="/exportaciones/contratos-clientes" element={P('contratos_clientes', <CustomerContractsPage />)} />
          {/* 28/10/2026: Marcas pasó a CONFIGURACIÓN → RutaSoloAdmin (antes RutaNoBodeguero) */}
          <Route path="/exportaciones/marcas" element={P('marcas', <BrandsPage />)} />

          {/* ===== Módulo Exportaciones (operación) ===== */}
          <Route path="/exportaciones/pedidos" element={P('pedido_semanal', <CustomerOrdersPage />)} />
          <Route path="/exportaciones/pedidos/nuevo" element={P('pedido_semanal', <CustomerOrderFormPage />)} />
          <Route path="/exportaciones/pedidos/:id" element={P('pedido_semanal', <CustomerOrderFormPage />)} />
          <Route path="/exportaciones/embarques" element={P('distribucion_barcos', <OrderDistributionsPage />)} />
          <Route path="/exportaciones/embarques/:id" element={P('distribucion_barcos', <OrderDistributionPage />)} />
          <Route path="/exportaciones/cierre" element={P('cierre_embarque', <ShipmentClosingsPage />)} />
          <Route path="/exportaciones/cierre/:id" element={P('cierre_embarque', <ShipmentClosingPage />)} />

          {/* ===== Módulo Comercial ===== */}
          <Route path="/comercial/compras" element={P('compra_fruta', <PurchasesPage />)} />
          {/* 02/11/2026: Finanzas — gastos de cada viaje y ganancia por viaje */}
          <Route path="/finanzas/gastos-viaje" element={P('gastos_viaje', <VoyageCostsPage />)} />
          <Route path="/finanzas/ganancia-viaje" element={P('ganancia_viaje', <VoyageProfitPage />)} />
          <Route path="/comercial/compras/:id" element={P('compra_fruta', <PurchaseAllocationPage />)} />
          <Route path="/comercial/precios-oficiales" element={P('precios_mag', <OfficialPricesPage />)} />

          {/* ===== Liquidación (dinero al productor) — solo ADMIN ===== */}
          <Route path="/liquidacion" element={P('liquidar', <SettlementsPage />)} />
          <Route path="/liquidacion/parametros" element={P('parametros_liquidacion', <SettlementParametersPage />)} />
          {/* 12/11/2026: Liquidación edita la retención; los contratos los registra LEGAL (misma pantalla, otro modo) */}
          <Route path="/liquidacion/contratos" element={P('contratos_productores', <ProducerContractsPage key="retencion" modo="retencion" />)} />
          <Route path="/legal/contratos" element={P('contratos_legal', <ProducerContractsPage key="legal" modo="legal" />)} />
          <Route path="/liquidacion/tarjas" element={P('tarjas', <TalliesPage />)} />
          <Route path="/liquidacion/tarjas/:id" element={P('tarjas', <TallySheetPage />)} />
          <Route path="/liquidacion/anticipos" element={P('anticipos', <ProducerAdvancesPage />)} />
          <Route path="/liquidacion/notas-credito" element={P('notas_credito', <CreditNotesPage />)} />
          <Route path="/liquidacion/pagos" element={P('pagos', <SettlementHistoryPage />)} />
          <Route path="/liquidacion/cupo/:quotaId" element={P('liquidar', <SettlementFormPage />)} />
          <Route path="/liquidacion/:id" element={P(LIQ, <SettlementDetailPage />)} />
          <Route path="navieras" element={P('navieras', <ShippingLinesPage />)} />
          {/* 29/10/2026: Puertos pasó a CONFIGURACIÓN → RutaSoloAdmin */}
          <Route path="/exportaciones/puertos" element={P('puertos', <PortsMasterDetailPage />)} />

          {/* ===== Módulo Inventario ===== */}
          <Route path="bodegas" element={P('bodegas', <WarehousesPage />)} />
          {/* Insumos: vista maestro-detalle (categorías + insumos combinados) */}
          <Route path="/insumos-categorias" element={P('insumos', <SuppliesMasterDetailPage />)} />
          <Route path="/motivos-movimiento" element={P('motivos', <MovementReasonsPage />)} />

          {/* Pantallas del BODEGUERO (stock, movimiento, despacho, historial).
              El recibo/guía se abre al guardar, pero también por URL directa para reimprimir. */}
          <Route path="/stock" element={P('stock', <InventoryStockPage />)} />
          <Route path="/movimientos/nuevo" element={P('nuevo_movimiento', <InventoryMovementFormPage />)} />
          <Route path="/movimientos" element={P('movimientos', <InventoryMovementsPage />)} />
          <Route path="/inventory-movements/:id/recibo" element={P(['nuevo_movimiento', 'despacho', 'historial_despachos', 'stock', 'movimientos'], <InventoryMovementReceiptPage />)} />
          <Route path="/despacho-materiales" element={P('despacho', <MaterialDispatchPage />)} />
          <Route path="/despacho-materiales/pendientes" element={P('despacho', <DispatchPendingPage />)} />
          {/* Historial — el backend le filtra al BODEGUERO solo su bodega */}
          <Route path="/despacho-materiales/historial" element={P('historial_despachos', <MaterialDispatchHistoryPage />)} />

          {/* Bandeja de transferencias pendientes — solo Coordinador de Inventario y Admin */}
          <Route path="/transferencias-pendientes" element={P('transferencias', <PendingTransfersPage />)} />
          {/* 31/10/2026: el bodeguero de destino confirma lo que le llega (el backend le muestra solo las de su bodega) */}
          <Route path="/recibir-transferencias" element={P('recibir_transferencias', <PendingTransfersPage soloRecibir />)} />

          <Route path="/ordenes-compra" element={P('ordenes_compra', <PurchaseOrdersPage />)} />
          <Route path="/ordenes-compra/nueva" element={P('ordenes_compra', <PurchaseOrderFormPage />)} />
          <Route path="/ordenes-compra/:id" element={P('ordenes_compra', <PurchaseOrderDetailPage />)} />

          <Route path="/compras/ordenes" element={P('oc_departamento', <DepartmentOrdersPage />)} />
          <Route path="/contabilidad/ordenes" element={P('aprobar_oc', <AccountingOrdersPage />)} />
          <Route path="/contabilidad/cuentas" element={P('cuentas_bancarias', <BankAccountsPage />)} />

        </Route>
        {/* Ruta no encontrada */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}