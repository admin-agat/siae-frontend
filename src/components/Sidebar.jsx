import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronDown } from "lucide-react";
// 30/10/2026: el menú y los permisos por pantalla están en routes/menu.js (los usa también AppRouter)
import { menuDe } from "../routes/menu";

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

    // 30/10/2026: cada persona ve las pantallas de su perfil + sus excepciones (antes: filtro fijo por rol)
    const menuVisible = menuDe(user);

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
                <p className="text-xs text-gray-400">{user?.email}</p>
                {/* 30/10/2026: perfil de permisos */}
                <p className="text-[11px] font-semibold text-primario mb-3">{user?.profile_name || user?.role?.replace("_", " ")}</p>
                <button onClick={handleLogout} className="w-full text-sm py-2 rounded-lg text-red-500 hover:bg-red-50 transition flex items-center justify-center gap-2"
                >
                    <LogOut size={14} />
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}