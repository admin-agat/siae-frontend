import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard, Users, LogOut, Sprout, Warehouse, Boxes,
    ArrowLeftRight, ClipboardList, FileText, ShoppingCart,
    FileSignature, Clock, Building2, Tag, Ship, Container,
    CircleDollarSign, History, ClipboardCheck, HandCoins, Calculator,
    MapPin, Globe, CheckCircle2, Truck, ChevronDown, Anchor, ShoppingBasket, UserCog, Landmark, Receipt, ScrollText
} from "lucide-react";


const menuItems = [
    {
        seccion: "PRINCIPAL",
        items: [
            { label: "Dashboard", ruta: "/dashboard", icono: LayoutDashboard },
        ],
    },
    {
        seccion: "EXPORTACIONES",
        items: [
            // 27/10/2026: Destinos, Clientes y Contratos clientes se movieron a CONFIGURACIÓN
            // (son datos maestros que solo configura el ADMIN). Aquí queda la operación.
            // Pedido semanal de Rusia (primer paso del flujo: pedido → barcos → productores)
            { label: "Pedido semanal", ruta: "/exportaciones/pedidos", icono: ClipboardList },
            // Fase 2: Logística reparte el pedido en barcos (antes "Embarques — Próximamente")
            { label: "Distribución en barcos", ruta: "/exportaciones/embarques", icono: Anchor },
            // 29/10/2026: lo realmente embarcado por booking (DAE, B/L, tarja del puerto)
            { label: "Cierre de embarque", ruta: "/exportaciones/cierre", icono: ClipboardCheck },
            { label: "Navieras", ruta: "/navieras", icono: Ship },
            { label: "Bookings", ruta: "/bookings", icono: Clock },
            { label: "Marca BL", ruta: null, icono: FileSignature, proximamente: true },
            { label: "Invoice", ruta: null, icono: CircleDollarSign, proximamente: true },
            // 28/10/2026: Marcas se movió a CONFIGURACIÓN (dato maestro del ADMIN)
        ],
    },   
    // --- Módulos en desarrollo: visuales por ahora, sin rutas funcionales ---
    {
        seccion: "COMERCIAL",
        items: [
            // "Productores / Comercializadoras" y "Fincas" se movieron a CONFIGURACIÓN
            // (son datos maestros que solo ingresa el ADMIN, para evitar duplicados)
            // Fase 3: Comercial compra la fruta (productor + marca + cajas + precio oficial y real)
            { label: "Compra de fruta", ruta: "/comercial/compras", icono: ShoppingBasket },
            // 30/10/2026: precio oficial por caja del MAG (lo propone la compra; oficial − real = nota de crédito)
            { label: "Precios oficiales MAG", ruta: "/comercial/precios-oficiales", icono: Landmark },
            // "Marcas" (Próximamente) se quitó: las marcas ya se administran en CONFIGURACIÓN
        ],
    },
     {
        seccion: "INVENTARIO",
        items: [
            { label: "Bodegas", ruta: "/bodegas", icono: Warehouse },
            { label: "Insumos por Categoría", ruta: "/insumos-categorias", icono: Boxes },
            { label: "Motivos de Movimiento", ruta: "/motivos-movimiento", icono: ArrowLeftRight },
            { label: "Stock General", ruta: "/stock", icono: ClipboardList },
            { label: "Nuevo Movimiento", ruta: "/movimientos/nuevo", icono: FileText },
            // Despacho a productor (receta/BOM por marca, cupo asignado). El BODEGUERO
            // también lo ve: reemplaza el motivo "Entrega a Productor" del formulario libre.
            { label: "Despacho de Materiales", ruta: "/despacho-materiales", icono: Truck },
            // Historial de despachos (quién retiró, valor, reimprimir guía, anular)
            { label: "Historial de Despachos", ruta: "/despacho-materiales/historial", icono: History },
            // soloCoordinador: exclusivo de COORDINADOR_INVENTARIO/ADMIN — un
            // JEFE_BODEGA no debe verlo (el backend igual lo rechazaría con 403).
            { label: "Transferencias Pendientes", ruta: "/transferencias-pendientes", icono: CheckCircle2, soloCoordinador: true },
            { label: "Órdenes de Compra", ruta: "/ordenes-compra", icono: ShoppingCart },
        ],
    },
    {
        seccion: "LIQUIDACIÓN",
        // 29/10/2026: tarjas (lo recibido en puerto) → liquidar → registrar pagos 80/20 o 100 %.
        // soloAdmin: es dinero al productor (el backend también lo limita a ADMIN).
        soloAdmin: true,
        items: [
            { label: "Tarjas", ruta: "/liquidacion/tarjas", icono: ClipboardCheck },
            { label: "Anticipos y préstamos", ruta: "/liquidacion/anticipos", icono: HandCoins },
            { label: "Liquidar", ruta: "/liquidacion", icono: Calculator },
            { label: "Pagos e historial", ruta: "/liquidacion/pagos", icono: CircleDollarSign },
            // 30/10/2026: notas de crédito por recibir de productores/comercializadoras
            { label: "Notas de crédito", ruta: "/liquidacion/notas-credito", icono: Receipt },
        ],
    },
    // CONFIGURACIÓN — datos maestros que SOLO ingresa el ADMIN, para que no se
    // repita información. soloAdmin: la sección completa se oculta a cualquier otro rol.
    // Las rutas se protegen con RutaSoloAdmin en AppRouter.jsx (aunque escriban
    // la URL a mano, no entran); esto solo las ordena en el menú.
    {
        seccion: "CONFIGURACIÓN",
        soloAdmin: true,
        items: [
            // Un solo formulario para productores, comercializadoras, proveedores y clientes
            // 29/10/2026: usuarios del sistema y su rol
            { label: "Usuarios", ruta: "/usuarios", icono: UserCog },
            // 30/10/2026: quién registró o cambió qué, con fecha y hora
            { label: "Bitácora", ruta: "/bitacora", icono: ScrollText },
            { label: "Terceros (maestro)", ruta: "/terceros", icono: Users },
            // 29/10/2026: movida desde COMERCIAL ("Próximamente"). Es la misma pantalla de
            // Terceros, filtrada a COMERCIALIZADORA (un solo maestro, sin datos repetidos)
            { label: "Comercializadoras", ruta: "/comercializadoras", icono: Building2 },
            { label: "Fincas", ruta: "/fincas", icono: Sprout },
            // 27/10/2026: movidos desde EXPORTACIONES (las rutas /exportaciones/... no cambian)
            { label: "Clientes", ruta: "/exportaciones/clientes", icono: Globe },
            { label: "Destinos", ruta: "/exportaciones/destinos", icono: MapPin },
            { label: "Contratos de clientes", ruta: "/exportaciones/contratos-clientes", icono: FileSignature },
            // 28/10/2026: movida desde EXPORTACIONES (la ruta /exportaciones/marcas no cambia)
            // 29/10/2026: "Marcas y recetas" — la receta de materiales (BOM) de cada marca se
            // administra en la misma pantalla; se quitó "SKU / Recetas — Próximamente" de EXPORTACIONES
            { label: "Marcas y recetas", ruta: "/exportaciones/marcas", icono: Tag },
            // 29/10/2026: movido desde EXPORTACIONES (la ruta /exportaciones/puertos no cambia)
            { label: "Puertos", ruta: "/exportaciones/puertos", icono: Container },
        ],
    },
];

// Rutas que SÍ puede -ver un BODEGUERO dentro de INVENTARIO (nada más).
// Debe coincidir con las rutas sin RutaNoBodeguero en AppRouter.jsx.
const RUTAS_BODEGUERO = [
    "/stock",
    "/movimientos/nuevo",
    "/despacho-materiales",
    "/despacho-materiales/historial", // para reimprimir guías de su bodega
];

// Llave de localStorage donde se recuerdan las secciones abiertas
const LLAVE_SECCIONES = "siae.sidebar.seccionesAbiertas";

// Secciones que NO se pliegan (una sola opción, no vale la pena)
const SECCIONES_FIJAS = ["PRINCIPAL"];

// Lee las secciones guardadas. Si localStorage falla o está vacío,
// arranca con todo cerrado (la sección activa se abre sola igual).
const leerSeccionesGuardadas = () => {
    try {
        const guardado = JSON.parse(localStorage.getItem(LLAVE_SECCIONES));
        return Array.isArray(guardado) ? guardado : [];
    } catch {
        return [];
    }
};

// Encuentra qué ítem del menú corresponde a la URL actual.
// Se usa la coincidencia MÁS LARGA para que:
//  - /ordenes-compra/5 marque "Órdenes de Compra" (detalle de una OC)
//  - /despacho-materiales/historial marque "Historial de Despachos"
//    y NO también "Despacho de Materiales"
const obtenerRutaActiva = (pathname, grupos) => {
    let mejor = null;
    grupos.forEach((grupo) =>
        grupo.items.forEach((item) => {
            if (!item.ruta) return;
            const coincide = pathname === item.ruta || pathname.startsWith(item.ruta + "/");
            if (coincide && (!mejor || item.ruta.length > mejor.length)) {
                mejor = item.ruta;
            }
        })
    );
    return mejor;
};

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // Jefe de Bodega y Coordinador de Inventario ven todo el módulo de Inventario
    // (CONFIGURACIÓN queda reservada solo para ADMIN)
    const esRolBodega = user?.role === "JEFE_BODEGA" || user?.role === "COORDINADOR_INVENTARIO";
    // El Bodeguero es más restringido: solo las rutas de RUTAS_BODEGUERO
    const esBodeguero = user?.role === "BODEGUERO";
    // Ítems marcados con soloCoordinador: exclusivos de COORDINADOR_INVENTARIO/ADMIN
    const esCoordinadorOAdmin = ["COORDINADOR_INVENTARIO", "ADMIN"].includes(user?.role);
    // Secciones marcadas con soloAdmin (CONFIGURACIÓN) solo las ve el ADMIN
    const esAdmin = user?.role === "ADMIN";

    let menuVisible;
    if (esBodeguero) {
        menuVisible = menuItems
            .filter((grupo) => grupo.seccion === "INVENTARIO")
            .map((grupo) => ({
                ...grupo,
                items: grupo.items.filter((item) => RUTAS_BODEGUERO.includes(item.ruta)),
            }));
    } else if (user?.role === "EXPORTACIONES" || user?.role === "COMERCIAL") {
        // 29/10/2026: cada área ve solo su sección (el Dashboard tiene datos de ejemplo)
        menuVisible = menuItems.filter((grupo) => grupo.seccion === user.role);
    } else if (esRolBodega) {
        menuVisible = menuItems
            .filter((grupo) => grupo.seccion === "INVENTARIO")
            .map((grupo) => ({
                ...grupo,
                items: grupo.items.filter((item) => !item.soloCoordinador || esCoordinadorOAdmin),
            }));
    } else {
        // Cualquier rol que no sea ADMIN no ve las secciones soloAdmin
        menuVisible = menuItems.filter((grupo) => !grupo.soloAdmin || esAdmin);
    }

    // Ítem y sección que corresponden a la página actual
    const rutaActiva = obtenerRutaActiva(location.pathname, menuVisible);
    const seccionActiva = menuVisible.find((grupo) =>
        grupo.items.some((item) => item.ruta === rutaActiva)
    )?.seccion;

    // Secciones abiertas (arranca con lo guardado en localStorage)
    const [abiertas, setAbiertas] = useState(leerSeccionesGuardadas);

    // Cada vez que cambia la página, se abre la sección donde está.
    // No cierra las demás: solo agrega la activa si faltaba.
    useEffect(() => {
        if (seccionActiva && !abiertas.includes(seccionActiva)) {
            setAbiertas((prev) => [...prev, seccionActiva]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seccionActiva]);

    // Guarda en localStorage cada vez que cambian las secciones abiertas
    useEffect(() => {
        try {
            localStorage.setItem(LLAVE_SECCIONES, JSON.stringify(abiertas));
        } catch {
            // Si el navegador bloquea localStorage, el menú funciona igual (sin memoria)
        }
    }, [abiertas]);

    // Abre o cierra una sección al hacer clic en su encabezado
    const alternarSeccion = (seccion) => {
        setAbiertas((prev) =>
            prev.includes(seccion) ? prev.filter((s) => s !== seccion) : [...prev, seccion]
        );
    };

    // Dibuja un ítem del menú
    const renderItem = (item) => {
        const Icono = item.icono;
        const activo = item.ruta === rutaActiva;

        if (item.proximamente) {
            return (
                <div
                    key={item.label}
                    title="Próximamente"
                    className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 border-l-4 border-transparent text-gray-400 cursor-not-allowed"
                >
                    <span className="flex items-center gap-2">
                        <Icono size={15} />
                        {item.label}
                    </span>
                    <span className="text-[10px] font-semibold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                        Pronto
                    </span>
                </div>
            );
        }

        return (
            <button
                key={item.ruta}
                onClick={() => navigate(item.ruta)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition border-l-4 ${activo
                    ? "bg-primario-claro text-primario font-semibold border-primario"
                    : "text-gray-600 hover:bg-green-50 hover:text-primario border-transparent"
                    }`}
            >
                <Icono size={15} />
                {item.label}
            </button>
        );
    };

    return (
        <div className="w-70 h-screen sticky top-0 flex flex-col bg-white" style={{ borderRight: "1px solid #e5e7eb" }}>
            {/* Logo */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
                <span className="font-bold text-lg text-primario">AGAT · SIAE</span>
            </div>
            {/* Menú */}
            <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
                {menuVisible.map((grupo) => {
                    // PRINCIPAL (o cualquier sección de una sola opción) queda fija
                    const esFija = SECCIONES_FIJAS.includes(grupo.seccion) || grupo.items.length <= 1;
                    const estaAbierta = esFija || abiertas.includes(grupo.seccion);
                    const contieneActiva = grupo.seccion === seccionActiva;

                    return (
                        <div key={grupo.seccion}>
                            {esFija ? (
                                <p className="text-xs font-semibold text-gray-400 mb-1 px-2">{grupo.seccion}</p>
                            ) : (
                                // Encabezado clickeable con flecha
                                <button
                                    type="button"
                                    onClick={() => alternarSeccion(grupo.seccion)}
                                    aria-expanded={estaAbierta}
                                    className="w-full flex items-center justify-between px-2 py-1 mb-1 rounded-md text-xs font-semibold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
                                >
                                    <span className="flex items-center gap-2">
                                        {grupo.seccion}
                                        {/* Punto azul si la página actual está dentro de una sección cerrada */}
                                        {!estaAbierta && contieneActiva && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-primario" />
                                        )}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform duration-200 ${estaAbierta ? "rotate-0" : "-rotate-90"}`}
                                    />
                                </button>
                            )}

                            {/* Los ítems solo se dibujan si la sección está abierta */}
                            {estaAbierta && grupo.items.map(renderItem)}
                        </div>
                    );
                })}
            </nav>
            {/* Usuario y logout */}
            <div className="px-4 py-4" style={{ borderTop: "1px solid #e5e7eb" }}>
                <p className="text-sm font-semibold text-gray-700">{user?.name || "Usuario"}</p>
                <p className="text-xs text-gray-400 mb-3">{user?.email}</p>
                <button onClick={handleLogout} className="w-full text-sm py-2 rounded-lg text-red-500 hover:bg-red-50 transition flex items-center justify-center gap-2"
                >
                    <LogOut size={14} />
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}