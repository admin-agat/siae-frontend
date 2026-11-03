// Menú del sistema y permisos por pantalla — src/routes/menu.js
// 30/10/2026: permisos por persona. Cada opción lleva su "pantalla" (misma clave que
// config/pantallas.php del backend). El usuario ve las pantallas que trae del login o de /me
// (perfil + excepciones). soloAdmin: no se delega (Usuarios, Perfiles, Bitácora).
// El backend (middleware pantalla:) es la protección real; esto solo arma el menú y las rutas.
import {
    LayoutDashboard, Users, Sprout, Warehouse, Boxes,
    ArrowLeftRight, ClipboardList, FileText, ShoppingCart,
    FileSignature, Clock, Tag, Ship, Container,
    CircleDollarSign, History, ClipboardCheck, HandCoins, Calculator,
    MapPin, CheckCircle2, Truck, Anchor, ShoppingBasket, UserCog, Landmark, Receipt, ScrollText, ShieldCheck, PackageCheck, ListOrdered, Wallet, TrendingUp
} from "lucide-react";

export const menuItems = [
    {
        seccion: "PRINCIPAL",
        items: [
            { label: "Dashboard", ruta: "/dashboard", icono: LayoutDashboard, pantalla: "dashboard" },
        ],
    },
    {
        seccion: "EXPORTACIONES",
        items: [
            // 27/10/2026: Destinos, Clientes y Contratos clientes se movieron a CONFIGURACIÓN
            // Pedido semanal de Rusia (primer paso del flujo: pedido → barcos → productores)
            { label: "Pedido semanal", ruta: "/exportaciones/pedidos", icono: ClipboardList, pantalla: "pedido_semanal" },
            // Fase 2: Logística reparte el pedido en barcos
            { label: "Distribución en barcos", ruta: "/exportaciones/embarques", icono: Anchor, pantalla: "distribucion_barcos" },
            // 29/10/2026: lo realmente embarcado por booking (DAE, B/L, tarja del puerto)
            { label: "Cierre de embarque", ruta: "/exportaciones/cierre", icono: ClipboardCheck, pantalla: "cierre_embarque" },
            { label: "Navieras", ruta: "/navieras", icono: Ship, pantalla: "navieras" },
            { label: "Bookings", ruta: "/bookings", icono: Clock, pantalla: "bookings" },
            { label: "Marca BL", ruta: null, icono: FileSignature, proximamente: true },
            { label: "Invoice", ruta: null, icono: CircleDollarSign, proximamente: true },
        ],
    },
    {
        seccion: "COMERCIAL",
        items: [
            // Fase 3: Comercial compra la fruta (productor + marca + cajas + precio oficial y real)
            { label: "Compra de fruta", ruta: "/comercial/compras", icono: ShoppingBasket, pantalla: "compra_fruta" },
            // 30/10/2026: precio oficial por caja del MAG (oficial − real = nota de crédito)
            { label: "Precios oficiales MAG", ruta: "/comercial/precios-oficiales", icono: Landmark, pantalla: "precios_mag" },
        ],
    },
    {
        seccion: "INVENTARIO",
        items: [
            { label: "Bodegas", ruta: "/bodegas", icono: Warehouse, pantalla: "bodegas" },
            { label: "Insumos por Categoría", ruta: "/insumos-categorias", icono: Boxes, pantalla: "insumos" },
            { label: "Motivos de Movimiento", ruta: "/motivos-movimiento", icono: ArrowLeftRight, pantalla: "motivos" },
            { label: "Stock General", ruta: "/stock", icono: ClipboardList, pantalla: "stock" },
            { label: "Nuevo Movimiento", ruta: "/movimientos/nuevo", icono: FileText, pantalla: "nuevo_movimiento" },
            // 31/10/2026: historial de movimientos y kárdex (corregir/anular: Coordinador)
            { label: "Movimientos y Kárdex", ruta: "/movimientos", icono: ListOrdered, pantalla: "movimientos" },
            // Despacho a productor (receta/BOM por marca, cupo asignado)
            { label: "Despacho de Materiales", ruta: "/despacho-materiales", icono: Truck, pantalla: "despacho" },
            // Historial de despachos (quién retiró, valor, reimprimir guía, anular)
            { label: "Historial de Despachos", ruta: "/despacho-materiales/historial", icono: History, pantalla: "historial_despachos" },
            { label: "Transferencias Pendientes", ruta: "/transferencias-pendientes", icono: CheckCircle2, pantalla: "transferencias" },
            // 31/10/2026: el bodeguero confirma lo que llega a su bodega (misma pantalla, solo las suyas)
            { label: "Recibir transferencias", ruta: "/recibir-transferencias", icono: PackageCheck, pantalla: "recibir_transferencias" },
            { label: "Órdenes de Compra", ruta: "/ordenes-compra", icono: ShoppingCart, pantalla: "ordenes_compra" },
        ],
    },
    {
        seccion: "LIQUIDACIÓN",
        // 29/10/2026: tarjas (lo recibido en puerto) → liquidar → registrar pagos 80/20 o 100 %
        items: [
            { label: "Tarjas", ruta: "/liquidacion/tarjas", icono: ClipboardCheck, pantalla: "tarjas" },
            { label: "Anticipos y préstamos", ruta: "/liquidacion/anticipos", icono: HandCoins, pantalla: "anticipos" },
            { label: "Liquidar", ruta: "/liquidacion", icono: Calculator, pantalla: "liquidar" },
            { label: "Pagos e historial", ruta: "/liquidacion/pagos", icono: CircleDollarSign, pantalla: "pagos" },
            // 30/10/2026: notas de crédito por recibir de productores/comercializadoras
            { label: "Notas de crédito", ruta: "/liquidacion/notas-credito", icono: Receipt, pantalla: "notas_credito" },
        ],
    },
    {
        seccion: "FINANZAS",
        // 02/11/2026: lo que cobra cada nave y los gastos de la exportación → ganancia por viaje
        items: [
            { label: "Gastos del viaje", ruta: "/finanzas/gastos-viaje", icono: Wallet, pantalla: "gastos_viaje" },
            { label: "Ganancia por viaje", ruta: "/finanzas/ganancia-viaje", icono: TrendingUp, pantalla: "ganancia_viaje" },
        ],
    },
    // CONFIGURACIÓN — datos maestros. Usuarios, Perfiles y Bitácora son solo del ADMIN.
    {
        seccion: "CONFIGURACIÓN",
        items: [
            // 29/10/2026: usuarios del sistema; 30/10/2026: perfiles de permisos por pantalla
            { label: "Usuarios", ruta: "/usuarios", icono: UserCog, soloAdmin: true },
            { label: "Perfiles y permisos", ruta: "/perfiles", icono: ShieldCheck, soloAdmin: true },
            // 30/10/2026: quién registró o cambió qué, con fecha y hora
            { label: "Bitácora", ruta: "/bitacora", icono: ScrollText, soloAdmin: true },
            { label: "Terceros (maestro)", ruta: "/terceros", icono: Users, pantalla: "terceros" },
            { label: "Fincas", ruta: "/fincas", icono: Sprout, pantalla: "fincas" },
            // 27/10/2026: movidos desde EXPORTACIONES (las rutas /exportaciones/... no cambian)
            { label: "Destinos", ruta: "/exportaciones/destinos", icono: MapPin, pantalla: "destinos" },
            { label: "Contratos de clientes", ruta: "/exportaciones/contratos-clientes", icono: FileSignature, pantalla: "contratos_clientes" },
            // Marcas y su receta de materiales (BOM)
            { label: "Marcas y recetas", ruta: "/exportaciones/marcas", icono: Tag, pantalla: "marcas" },
            { label: "Puertos", ruta: "/exportaciones/puertos", icono: Container, pantalla: "puertos" },
        ],
    },
];

export const esAdmin = (user) => user?.role === "ADMIN";

// 03/11/2026: bodegas que el usuario puede operar (user.bodegas viene del login y de /me; null = todas).
// Solo arma las listas: el backend es el que valida.
export const bodegasPermitidas = (user, lista) =>
    (Array.isArray(user?.bodegas) ? lista.filter((b) => user.bodegas.includes(b.id)) : lista);

// true si el usuario tiene al menos una de las pantallas (el ADMIN, todas)
export const puede = (user, ...pantallas) =>
    esAdmin(user) || pantallas.some((p) => user?.pantallas?.includes(p));

// Un ítem del menú es visible si: es soloAdmin y el usuario es ADMIN, o tiene su pantalla
const itemVisible = (user, item) => (item.soloAdmin ? esAdmin(user) : puede(user, item.pantalla));

// Menú filtrado para el usuario: sin secciones vacías; los "Próximamente" solo en secciones que ya ve
export const menuDe = (user) =>
    menuItems
        .map((grupo) => {
            const reales = grupo.items.filter((item) => !item.proximamente && itemVisible(user, item));
            return { ...grupo, items: reales.length ? grupo.items.filter((item) => item.proximamente || reales.includes(item)) : [] };
        })
        .filter((grupo) => grupo.items.length > 0);

// Pantalla de inicio: la primera del menú que puede abrir (sin ninguna: /sin-acceso)
export const inicioDe = (user) => {
    for (const grupo of menuDe(user)) {
        const item = grupo.items.find((i) => i.ruta);
        if (item) return item.ruta;
    }
    return "/sin-acceso";
};

// 02/11/2026: pantallas que un tipo base puede tener (las 'solo' de otros tipos no se ofrecen; ej. Dashboard = GERENCIA)
export const pantallasDelTipo = (catalogo, tipo) => (tipo === 'ADMIN' ? catalogo : catalogo.filter((p) => !p.solo || p.solo.includes(tipo)));
