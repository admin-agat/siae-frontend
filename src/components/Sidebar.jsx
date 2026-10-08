import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard, Users, LogOut, Sprout, Warehouse, Boxes,
    ArrowLeftRight, ClipboardList, FileText, ShoppingCart,
    FileSignature, Clock, Building2, Tag, Wallet, Ship, Container,
    CircleDollarSign, History, Download, BarChart3, Percent,
    MapPin, Globe, CheckCircle2, Truck, ChevronDown
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
            { label: "Navieras", ruta: "/navieras", icono: Ship },
            { label: "Bookings", ruta: "/bookings", icono: Clock },
            { label: "Puertos", ruta: "/exportaciones/puertos", icono: Container },
            { label: "Destinos", ruta: "/exportaciones/destinos", icono: MapPin },
            { label: "Clientes", ruta: "/exportaciones/clientes", icono: Globe },
            { label: "Embarques", ruta: null, icono: FileText, proximamente: true },
            { label: "SKU / Recetas", ruta: null, icono: Boxes, proximamente: true },
            { label: "Marca BL", ruta: null, icono: FileSignature, proximamente: true },
            { label: "Invoice", ruta: null, icono: CircleDollarSign, proximamente: true },
            { label: "Marcas", ruta: "/exportaciones/marcas", icono: FileSignature },
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
    // --- Módulos en desarrollo: visuales por ahora, sin rutas funcionales ---
    
    {
        seccion: "COMERCIAL",
        items: [
            { label: "Productores / Comercializadoras", ruta: "/terceros", icono: Users },
            { label: "Comercializadoras", ruta: null, icono: Building2, proximamente: true },
            { label: "Fincas", ruta: "/fincas", icono: Sprout },
            { label: "Marcas", ruta: null, icono: Tag, proximamente: true },
        ],
    },
    {
        seccion: "LIQUIDACIÓN",
        items: [
            { label: "Nueva liquidación", ruta: null, icono: FileText, proximamente: true },
            { label: "Pendientes pago", ruta: null, icono: Clock, proximamente: true },
            { label: "Pago 80%", ruta: null, icono: Percent, proximamente: true },
            { label: "Pago 20%", ruta: null, icono: CircleDollarSign, proximamente: true },
            { label: "Historial pagos", ruta: null, icono: History, proximamente: true },
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

// NUEVO: llave de localStorage donde se recuerdan las secciones abiertas
const LLAVE_SECCIONES = "siae.sidebar.seccionesAbiertas";

// NUEVO: secciones que NO se pliegan (una sola opción, no vale la pena)
const SECCIONES_FIJAS = ["PRINCIPAL"];

// NUEVO: lee las secciones guardadas. Si localStorage falla o está vacío,
// arranca con todo cerrado (la sección activa se abre sola igual).
const leerSeccionesGuardadas = () => {
    try {
        const guardado = JSON.parse(localStorage.getItem(LLAVE_SECCIONES));
        return Array.isArray(guardado) ? guardado : [];
    } catch {
        return [];
    }
};

// NUEVO: encuentra qué ítem del menú corresponde a la URL actual.
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
    // (Terceros y Fincas quedan reservados solo para ADMIN)
    const esRolBodega = user?.role === "JEFE_BODEGA" || user?.role === "COORDINADOR_INVENTARIO";
    // El Bodeguero es más restringido: solo las rutas de RUTAS_BODEGUERO
    const esBodeguero = user?.role === "BODEGUERO";
    // Ítems marcados con soloCoordinador: exclusivos de COORDINADOR_INVENTARIO/ADMIN
    const esCoordinadorOAdmin = ["COORDINADOR_INVENTARIO", "ADMIN"].includes(user?.role);

    let menuVisible;
    if (esBodeguero) {
        menuVisible = menuItems
            .filter((grupo) => grupo.seccion === "INVENTARIO")
            .map((grupo) => ({
                ...grupo,
                items: grupo.items.filter((item) => RUTAS_BODEGUERO.includes(item.ruta)),
            }));
    } else if (esRolBodega) {
        menuVisible = menuItems
            .filter((grupo) => grupo.seccion === "INVENTARIO")
            .map((grupo) => ({
                ...grupo,
                items: grupo.items.filter((item) => !item.soloCoordinador || esCoordinadorOAdmin),
            }));
    } else {
        menuVisible = menuItems;
    }

    // NUEVO: ítem y sección que corresponden a la página actual
    const rutaActiva = obtenerRutaActiva(location.pathname, menuVisible);
    const seccionActiva = menuVisible.find((grupo) =>
        grupo.items.some((item) => item.ruta === rutaActiva)
    )?.seccion;

    // NUEVO: secciones abiertas (arranca con lo guardado en localStorage)
    const [abiertas, setAbiertas] = useState(leerSeccionesGuardadas);

    // NUEVO: cada vez que cambia la página, se abre la sección donde está.
    // No cierra las demás: solo agrega la activa si faltaba.
    useEffect(() => {
        if (seccionActiva && !abiertas.includes(seccionActiva)) {
            setAbiertas((prev) => [...prev, seccionActiva]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seccionActiva]);

    // NUEVO: guarda en localStorage cada vez que cambian las secciones abiertas
    useEffect(() => {
        try {
            localStorage.setItem(LLAVE_SECCIONES, JSON.stringify(abiertas));
        } catch {
            // Si el navegador bloquea localStorage, el menú funciona igual (sin memoria)
        }
    }, [abiertas]);

    // NUEVO: abre o cierra una sección al hacer clic en su encabezado
    const alternarSeccion = (seccion) => {
        setAbiertas((prev) =>
            prev.includes(seccion) ? prev.filter((s) => s !== seccion) : [...prev, seccion]
        );
    };

    // Dibuja un ítem del menú (igual que antes; solo cambia cómo se decide "activo")
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
                    ? "bg-green-50 text-[#3B5BDB] font-semibold border-[#4C6EF5]"
                    : "text-gray-600 hover:bg-green-50 hover:text-[#3B5BDB] border-transparent"
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
                <span className="font-bold text-lg" style={{ color: "#3B5BDB" }}>AGAT · SIAE</span>
            </div>
            {/* Menú */}
            <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
                {menuVisible.map((grupo) => {
                    // NUEVO: PRINCIPAL (o cualquier sección de una sola opción) queda fija
                    const esFija = SECCIONES_FIJAS.includes(grupo.seccion) || grupo.items.length <= 1;
                    const estaAbierta = esFija || abiertas.includes(grupo.seccion);
                    const contieneActiva = grupo.seccion === seccionActiva;

                    return (
                        <div key={grupo.seccion}>
                            {esFija ? (
                                <p className="text-xs font-semibold text-gray-400 mb-1 px-2">{grupo.seccion}</p>
                            ) : (
                                // NUEVO: encabezado clickeable con flecha
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
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#3B5BDB]" />
                                        )}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform duration-200 ${estaAbierta ? "rotate-0" : "-rotate-90"}`}
                                    />
                                </button>
                            )}

                            {/* NUEVO: los ítems solo se dibujan si la sección está abierta */}
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