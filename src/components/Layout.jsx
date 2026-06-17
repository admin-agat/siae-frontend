import { Outlet } from 'react-router-dom';
import Sidebar from "./Sidebar";

// Layout principal — envuelve todas las páginas privadas
export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* Sidebar fijo a la izquierda */}
      <Sidebar />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col">

        {/* Navbar superior */}
        <header className="px-6 py-4 flex items-center justify-between shadow-sm" style={{ backgroundColor: "#0F6E56" }}>
          <span className="text-white font-semibold text-sm">Sistema Integral AGAT-ECUAGREEN</span>
          <span className="text-white text-sm opacity-80">v1.0</span>
        </header>

        {/* Página activa — Outlet renderiza la ruta hija */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>

      </div>
    </div>
  );
}