import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
    ChevronDown, Menu, X, LayoutDashboard, Ship, ShoppingBasket, Boxes, Calculator, Wallet, Settings, Circle,
} from "lucide-react";
// 30/10/2026: el menú y los permisos por pantalla están en routes/menu.js (los usa también AppRouter)
import { menuDe } from "../routes/menu";

// 03/11/2026: el menú quedó como una barra angosta de iconos (una por sección) para que la
// pantalla de trabajo sea más ancha. Al hacer clic en un icono, la lista de opciones se abre
// encima del contenido; con ☰ se abre el menú completo.

// Llave de localStorage donde se recuerdan las secciones abiertas (menú completo)
const LLAVE_SECCIONES = "siae.sidebar.seccionesAbiertas";

// Secciones que NO se pliegan (una sola opción, no vale la pena)
const SECCIONES_FIJAS = ["PRINCIPAL"];

// Icono de cada sección en la barra angosta
const ICONO_SECCION = {
    PRINCIPAL: LayoutDashboard,
    EXPORTACIONES: Ship,
    COMERCIAL: ShoppingBasket,
    INVENTARIO: Boxes,
    "LIQUIDACIÓN": Calculator,
    FINANZAS: Wallet,
    "CONFIGURACIÓN": Settings,
};

// Panel "menú completo" (todas las secciones)
const TODO = "__TODO__";

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
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // 30/10/2026: cada persona ve las pantallas de su perfil + sus excepciones (antes: filtro fijo por rol)
    const menuVisible = menuDe(user);

    // Ítem y sección que corresponden a la página actual
    const rutaActiva = obtenerRutaActiva(location.pathname, menuVisible);
    const seccionActiva = menuVisible.find((grupo) =>
        grupo.items.some((item) => item.ruta === rutaActiva)
    )?.seccion;

    // Panel abierto encima del contenido: null, una sección o TODO
    const [panel, setPanel] = useState(null);

    // Secciones abiertas en el menú completo (arranca con lo guardado en localStorage)
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

    // Esc cierra el panel
    useEffect(() => {
        if (!panel) return undefined;
        const alPresionar = (e) => e.key === "Escape" && setPanel(null);
        window.addEventListener("keydown", alPresionar);
        return () => window.removeEventListener("keydown", alPresionar);
    }, [panel]);

    // Abre o cierra una sección al hacer clic en su encabezado (menú completo)
    const alternarSeccion = (seccion) => {
        setAbiertas((prev) =>
            prev.includes(seccion) ? prev.filter((s) => s !== seccion) : [...prev, seccion]
        );
    };

    // Clic en el icono de una sección: si tiene una sola opción va directo; si no, abre/cierra su lista
    const clicSeccion = (grupo) => {
        const opciones = grupo.items.filter((item) => item.ruta && !item.proximamente);
        if (grupo.items.length === 1 && opciones.length === 1) {
            setPanel(null);
            navigate(opciones[0].ruta);
            return;
        }
        setPanel((actual) => (actual === grupo.seccion ? null : grupo.seccion));
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
                onClick={() => {
                    // al elegir una opción se cierra el panel
                    setPanel(null);
                    navigate(item.ruta);
                }}
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

    // Menú completo: todas las secciones, plegables como antes
    const renderTodo = () =>
        menuVisible.map((grupo) => {
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
                                {/* Punto si la página actual está dentro de una sección cerrada */}
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
        });

    const grupoPanel = panel && panel !== TODO ? menuVisible.find((g) => g.seccion === panel) : null;

    return (
        <>
            {/* Barra angosta: solo iconos */}
            <div className="w-16 h-screen sticky top-0 z-40 flex flex-col items-center bg-white shrink-0" style={{ borderRight: "1px solid #e5e7eb" }}>
                <button
                    type="button"
                    onClick={() => setPanel((actual) => (actual === TODO ? null : TODO))}
                    title="Menú completo"
                    aria-label="Menú completo"
                    className={`w-full h-14 flex items-center justify-center transition ${panel === TODO ? "text-primario bg-primario-claro" : "text-primario hover:bg-green-50"}`}
                    style={{ borderBottom: "1px solid #e5e7eb" }}
                >
                    <Menu size={22} />
                </button>
                <nav className="flex-1 w-full py-3 flex flex-col items-center gap-1 overflow-y-auto">
                    {menuVisible.map((grupo) => {
                        const Icono = ICONO_SECCION[grupo.seccion] || Circle;
                        const esActiva = grupo.seccion === seccionActiva;
                        const abierta = panel === grupo.seccion;
                        return (
                            <button
                                key={grupo.seccion}
                                type="button"
                                onClick={() => clicSeccion(grupo)}
                                title={grupo.seccion}
                                aria-label={grupo.seccion}
                                aria-expanded={abierta}
                                className={`w-11 h-11 rounded-lg flex items-center justify-center transition border-l-4 ${abierta || esActiva
                                    ? "bg-primario-claro text-primario border-primario"
                                    : "text-gray-500 hover:bg-green-50 hover:text-primario border-transparent"
                                    }`}
                            >
                                <Icono size={20} />
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Lista de opciones encima del contenido (clic afuera o Esc la cierra) */}
            {panel && (
                <>
                    <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setPanel(null)} />
                    <div className="fixed top-0 left-16 z-40 h-screen w-72 flex flex-col bg-white shadow-2xl" style={{ borderRight: "1px solid #e5e7eb" }}>
                        <div className="h-14 px-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <span className="font-bold text-primario">{grupoPanel ? grupoPanel.seccion : "AGAT · SIAE"}</span>
                            <button type="button" onClick={() => setPanel(null)} aria-label="Cerrar menú" className="text-gray-400 hover:text-gray-700">
                                <X size={18} />
                            </button>
                        </div>
                        <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
                            {grupoPanel ? grupoPanel.items.map(renderItem) : renderTodo()}
                        </nav>
                    </div>
                </>
            )}
        </>
    );
}
