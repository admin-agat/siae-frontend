import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard, Users, LogOut, Sprout, Warehouse, Boxes,
    ArrowLeftRight, ClipboardList, FileText, ShoppingCart,
    FileSignature, Clock, Building2, Tag, Wallet, Ship,
    CircleDollarSign, History, Download, BarChart3, Percent
} from "lucide-react";

const menuItems = [
    {
        seccion: "PRINCIPAL",
        items: [
            { label: "Dashboard", ruta: "/dashboard", icono: LayoutDashboard },
        ],
    },
    {
        seccion: "PERSONAS",
        items: [
            { label: "Productores / Comercializadoras", ruta: "/terceros", icono: Users },
        ],
    },
    {
        seccion: "FINCAS",
        items: [
            { label: "Fincas", ruta: "/fincas", icono: Sprout },
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
            { label: "Órdenes de Compra", ruta: "/ordenes-compra", icono: ShoppingCart },
        ],
    },
    // --- Módulos en desarrollo: visuales por ahora, sin rutas funcionales ---    
    {
        seccion: "COMERCIAL",
        items: [
            { label: "Comercializadoras", ruta: null, icono: Building2, proximamente: true },
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

// Rutas que SÍ puede ver un BODEGUERO dentro de INVENTARIO (nada más)
const RUTAS_BODEGUERO = ["/stock", "/movimientos/nuevo"];

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
    // El Bodeguero es más restringido: solo Stock General y Nuevo Movimiento,
    // filtrado dentro de la misma sección INVENTARIO (no ve Bodegas, Insumos,
    // Motivos ni Órdenes de Compra)
    const esBodeguero = user?.role === "BODEGUERO";

    let menuVisible;
    if (esBodeguero) {
        menuVisible = menuItems
            .filter((grupo) => grupo.seccion === "INVENTARIO")
            .map((grupo) => ({
                ...grupo,
                items: grupo.items.filter((item) => RUTAS_BODEGUERO.includes(item.ruta)),
            }));
    } else if (esRolBodega) {
        menuVisible = menuItems.filter((grupo) => grupo.seccion === "INVENTARIO");
    } else {
        menuVisible = menuItems;
    }

    return (
        <div className="w-70 h-screen sticky top-0 flex flex-col bg-white" style={{ borderRight: "1px solid #e5e7eb" }}>
            {/* Logo */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
                <span className="font-bold text-lg" style={{ color: "#3B5BDB" }}>AGAT · SIAE</span>
            </div>
            {/* Menú */}
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
                {menuVisible.map((grupo) => (
                    <div key={grupo.seccion}>
                        <p className="text-xs font-semibold text-gray-400 mb-1 px-2">{grupo.seccion}</p>
                        {grupo.items.map((item) => {
                            const Icono = item.icono;
                            const activo = location.pathname === item.ruta;

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
                        })}
                    </div>
                ))}
            </nav>
            {/* Usuario y logout */}
            <div className="px-4 py-4" style={{ borderTop: "1px solid #e5e7eb" }}>
                <p className="text-sm font-semibold text-gray-700">{user?.name || "Usuario"}</p>
                <p className="text-xs text-gray-400 mb-3">{user?.email}</p>
                <button
                    onClick={handleLogout}
                    className="w-full text-sm py-2 rounded-lg text-red-500 hover:bg-red-50 transition flex items-center justify-center gap-2"
                >
                    <LogOut size={14} />
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}