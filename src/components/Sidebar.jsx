import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FileBarChart2, FileText, Users, ShoppingCart,
  Anchor, Ship, Scissors, Truck, Warehouse, Star, DollarSign,
  UserCog, UserCircle, ClipboardList, LogOut
} from "lucide-react";

const menuItems = [
  {
    seccion: "PRINCIPAL",
    items: [
      { label: "Dashboard", ruta: "/dashboard", icono: LayoutDashboard },
      { label: "Reportes ejecutivos", ruta: "/reportes", icono: FileBarChart2 },
    ],
  },
  {
    seccion: "COMERCIAL",
    items: [
      { label: "Contratos", ruta: "/contratos", icono: FileText },
      { label: "Compradores", ruta: "/compradores", icono: Users },
      { label: "Pedidos", ruta: "/pedidos", icono: ShoppingCart },
    ],
  },
  {
    seccion: "EXPORTACIÓN",
    items: [
      { label: "Bookings", ruta: "/bookings", icono: Anchor },
      { label: "Buques", ruta: "/buques", icono: Ship },
      { label: "Órdenes de corte", ruta: "/ordenes-corte", icono: Scissors },
      { label: "Traslado y guías", ruta: "/traslados", icono: Truck },
    ],
  },
  {
    seccion: "OPERACIONES",
    items: [
      { label: "Bodega", ruta: "/bodega", icono: Warehouse },
      { label: "Calidad", ruta: "/calidad", icono: Star },
      { label: "Finanzas", ruta: "/finanzas", icono: DollarSign },
    ],
  },
  {
    seccion: "GESTIÓN",
    items: [
      { label: "Managers", ruta: "/managers", icono: UserCog },
      { label: "RRHH", ruta: "/rrhh", icono: UserCircle },
      { label: "Auditoría", ruta: "/auditoria", icono: ClipboardList },
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

  return (
    <div className="w-56 min-h-screen flex flex-col bg-white" style={{ borderRight: "1px solid #e5e7eb" }}>

      {/* Logo */}
      <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <span className="font-bold text-lg" style={{ color: "#0F6E56" }}>AGAT · SIAE</span>
      </div>

      {/* Menú */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {menuItems.map((grupo) => (
          <div key={grupo.seccion}>
            <p className="text-xs font-semibold text-gray-400 mb-1 px-2">{grupo.seccion}</p>
            {grupo.items.map((item) => {
              const Icono = item.icono;
              const activo = location.pathname === item.ruta;
              return (
                <button
                  key={item.ruta}
                  onClick={() => navigate(item.ruta)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
                    activo
                      ? "bg-green-50 text-[#0F6E56] font-semibold"
                      : "text-gray-600 hover:bg-green-50 hover:text-[#0F6E56]"
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