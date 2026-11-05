import { Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from "./Sidebar";
import AvisoInactividad from './common/AvisoInactividad';
import { precargarPaginas } from '../routes/paginas';
import { useAuth } from '../context/AuthContext';
import { semanaISO } from '../utils/semana';
import api from '../api/axios';

// 05/11/2026: semana bananera, día y hora en la barra de arriba (se actualiza cada 20 s)
function RelojSemana() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  const { semana } = semanaISO(ahora);
  const dia = ahora.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = ahora.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="hidden md:flex items-center gap-3 text-white text-sm" title="Semana bananera (ISO): de lunes a domingo">
      <span className="font-bold bg-white/15 rounded-md px-2 py-0.5">SEMANA {semana}</span>
      <span className="capitalize opacity-90">{dia}</span>
      <span className="font-semibold tabular-nums">{hora}</span>
    </div>
  );
}

// Layout principal — envuelve todas las páginas privadas
export default function Layout() {
  const { user, logout, actualizarUsuario } = useAuth();
  const navigate = useNavigate();
  const cerrarSesion = () => {
    logout();
    navigate('/login');
  };
  // Recarga completa (no navigate): al borrar el token la ruta privada ya redirige a /login sin el aviso
  const cerrarPorInactividad = useCallback(() => {
    logout();
    window.location.assign('/login?inactividad=1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <AvisoInactividad onCerrar={cerrarPorInactividad} />

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
          <RelojSemana />
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
