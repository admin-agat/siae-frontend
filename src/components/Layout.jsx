import { Suspense, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from "./Sidebar";
import { precargarPaginas } from '../routes/paginas';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// Layout principal — envuelve todas las páginas privadas
export default function Layout() {
  const { user, logout, actualizarUsuario } = useAuth();
  const navigate = useNavigate();
  const cerrarSesion = () => {
    logout();
    navigate('/login');
  };

  // Descarga el resto de pantallas en segundo plano: cambiar de menú queda instantáneo
  useEffect(() => {
    precargarPaginas();
  }, []);

  // 30/10/2026: al abrir o recargar el sistema se piden las pantallas actuales del usuario
  // (si el ADMIN le cambió el perfil o las excepciones, se ven sin volver a iniciar sesión)
  useEffect(() => {
    api.get('/me').then((res) => actualizarUsuario(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* Sidebar fijo a la izquierda */}
      <Sidebar />

      {/* Contenido principal. min-w-0: sin esto, una tabla ancha (ej. líneas del pedido)
          estira toda la página y corta botones/campos; con esto la tabla hace scroll en su caja */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Navbar superior. 02/11/2026: usuario, perfil y "Cerrar sesión" arriba a la derecha (antes al pie del menú) */}
        <header className="px-6 py-3 flex items-center justify-between gap-4 shadow-sm bg-primario">
          <span className="text-white font-semibold text-sm">
            Sistema Integral AGAT-ECUAGREEN <span className="font-normal opacity-70">v1.0</span>
          </span>
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <p className="text-white text-sm font-semibold">{user?.name || 'Usuario'}</p>
              <p className="text-white text-[11px] opacity-80">{user?.profile_name || user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              title={user?.email ? `Salir de ${user.email}` : 'Cerrar sesión'}
              className="flex items-center gap-2 text-sm font-semibold text-white border border-white/50 rounded-lg px-3 py-1.5 hover:bg-white hover:text-primario transition"
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Página activa — Outlet renderiza la ruta hija */}
        <main className="flex-1 p-6">
          {/* Las páginas se cargan por partes (React.lazy en AppRouter): mientras llega una, se ve este aviso */}
          <Suspense fallback={<div className="p-6 text-gray-400">Cargando...</div>}>
            <Outlet />
          </Suspense>
        </main>

      </div>
    </div>
  );
}
