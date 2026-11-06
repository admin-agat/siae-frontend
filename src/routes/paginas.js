// Pantallas del sistema, cada una en su propio archivo JS (React.lazy en AppRouter.jsx).
// Ubicación: src/routes/paginas.js
//
// 29/10/2026: precargarPaginas() las descarga en segundo plano apenas el usuario entra
// (lo llama Layout.jsx). Así, al cambiar de menú (ej. de Navieras a Compra de fruta) la
// pantalla ya está descargada y abre al instante; la primera carga del sistema sigue liviana.
export const PAGINAS = {
  DashboardPage: () => import("../pages/dashboard/DashboardPage"),
  BrandsPage: () => import("../pages/exportaciones/BrandsPage"),
  TercerosPage: () => import("../pages/terceros/TercerosPage"),
  FincasPage: () => import("../pages/fincas/FincasPage"),
  WarehousesPage: () => import("../pages/inventario/WarehousesPage"),
  MovementReasonsPage: () => import("../pages/inventario/MovementReasonsPage"),
  InventoryStockPage: () => import("../pages/inventario/InventoryStockPage"),
  InventoryMovementFormPage: () => import("../pages/inventario/InventoryMovementFormPage"),
  InventoryMovementsPage: () => import("../pages/inventario/InventoryMovementsPage"),
  InventoryMovementReceiptPage: () => import("../pages/inventario/InventoryMovementReceiptPage"),
  DispatchPendingPage: () => import("../pages/inventario/DispatchPendingPage"),
  SuppliesMasterDetailPage: () => import("../pages/inventario/SuppliesMasterDetailPage"),
  PurchaseOrderFormPage: () => import("../pages/inventario/PurchaseOrderFormPage"),
  PurchaseOrderDetailPage: () => import("../pages/inventario/PurchaseOrderDetailPage"),
  PendingTransfersPage: () => import("../pages/inventario/PendingTransfersPage"),
  ShippingLinesPage: () => import("../pages/exportaciones/ShippingLinesPage"),
  PortsMasterDetailPage: () => import("../pages/exportaciones/PortsMasterDetailPage"),
  DestinationsPage: () => import("../pages/exportaciones/DestinationsPage"),
  CustomerContractsPage: () => import("../pages/exportaciones/CustomerContractsPage"),
  VoyageCostsPage: () => import("../pages/finanzas/VoyageCostsPage"),
  VoyageProfitPage: () => import("../pages/finanzas/VoyageProfitPage"),
  CustomerOrdersPage: () => import("../pages/exportaciones/CustomerOrdersPage"),
  CustomerOrderFormPage: () => import("../pages/exportaciones/CustomerOrderFormPage"),
  OrderDistributionsPage: () => import("../pages/exportaciones/OrderDistributionsPage"),
  OrderDistributionPage: () => import("../pages/exportaciones/OrderDistributionPage"),
  ShipmentClosingsPage: () => import("../pages/exportaciones/ShipmentClosingsPage"),
  ShipmentClosingPage: () => import("../pages/exportaciones/ShipmentClosingPage"),
  UsersPage: () => import("../pages/configuracion/UsersPage"),
  ProfilesPage: () => import("../pages/configuracion/ProfilesPage"),
  AuditLogPage: () => import("../pages/configuracion/AuditLogPage"),
  PurchasesPage: () => import("../pages/comercial/PurchasesPage"),
  PurchaseAllocationPage: () => import("../pages/comercial/PurchaseAllocationPage"),
  OfficialPricesPage: () => import("../pages/comercial/OfficialPricesPage"),
  CreditNotesPage: () => import("../pages/liquidacion/CreditNotesPage"),
  TalliesPage: () => import("../pages/liquidacion/TalliesPage"),
  TallySheetPage: () => import("../pages/liquidacion/TallySheetPage"),
  ProducerAdvancesPage: () => import("../pages/liquidacion/ProducerAdvancesPage"),
  SettlementsPage: () => import("../pages/liquidacion/SettlementsPage"),
  SettlementFormPage: () => import("../pages/liquidacion/SettlementFormPage"),
  SettlementDetailPage: () => import("../pages/liquidacion/SettlementDetailPage"),
  SettlementHistoryPage: () => import("../pages/liquidacion/SettlementHistoryPage"),
  MaterialDispatchPage: () => import("../pages/inventario/MaterialDispatchPage"),
  MaterialDispatchHistoryPage: () => import("../pages/inventario/MaterialDispatchHistoryPage"),
  PurchaseOrdersPage: () => import("../pages/inventario/PurchaseOrdersPage"),
  // 05/11/2026: OC de cada departamento → Contabilidad aprueba y paga (TXT de Banco Pichincha)
  DepartmentOrdersPage: () => import("../pages/compras/DepartmentOrdersPage"),
  AccountingOrdersPage: () => import("../pages/contabilidad/AccountingOrdersPage"),
  BankAccountsPage: () => import("../pages/contabilidad/BankAccountsPage"),
};

let precargadas = false;

export function precargarPaginas() {
  if (precargadas) return;
  precargadas = true;
  // Una por una y sin apuro: no compite con lo que el usuario está abriendo ahora
  const pendientes = Object.values(PAGINAS);
  const siguiente = () => {
    const cargar = pendientes.shift();
    if (!cargar) return;
    cargar().catch(() => {}).finally(() => setTimeout(siguiente, 50));
  };
  setTimeout(siguiente, 1500);
}
