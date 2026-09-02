import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard, Users, LogOut, Sprout, Warehouse, Boxes,
    ArrowLeftRight, ClipboardList, FileText, ShoppingCart
} from "lucide-react";
const menuItems = [
    {
        seccion: "PRINCIPAL",
        items: [
            { label: "Dashboard", ruta: "/dashboard", icono: LayoutDashboard },
        ],
    },
    {
        seccion: "TERCEROS",
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
];
export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // Jefe de Bodega y Coordinador de Inventario solo ven el módulo de Inventario
    // (Terceros y Fincas quedan reservados solo para ADMIN)
    const esRolBodega = user?.role === "JEFE_BODEGA" || user?.role === "COORDINADOR_INVENTARIO";
    const menuVisible = esRolBodega
        ? menuItems.filter((grupo) => grupo.seccion === "INVENTARIO")
        : menuItems;

    return (
        <div className="w-70 h-screen sticky top-0 flex flex-col bg-white" style={{ borderRight: "1px solid #e5e7eb" }}>
            {/* Logo */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
                <span className="font-bold text-lg" style={{ color: "#0F6E56" }}>AGAT · SIAE</span>
            </div>
            {/* Menú */}
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
                {menuVisible.map((grupo) => (
                    <div key={grupo.seccion}>
                        <p className="text-xs font-semibold text-gray-400 mb-1 px-2">{grupo.seccion}</p>
                        {grupo.items.map((item) => {
                            const Icono = item.icono;
                            const activo = location.pathname === item.ruta;
                            return (
                                <button
                                    key={item.ruta}
                                    onClick={() => navigate(item.ruta)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition border-l-4 ${activo
                                        ? "bg-green-50 text-[#0F6E56] font-semibold border-[#22C55E]"
                                        : "text-gray-600 hover:bg-green-50 hover:text-[#0F6E56] border-transparent"
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