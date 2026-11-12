import { Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, RefreshCw } from 'lucide-react';
import Sidebar from "./Sidebar";
import AvisoInactividad from './common/AvisoInactividad';
import AvisoVersion from './common/AvisoVersion';
import Campanita from './common/Campanita';
import { ProveedorAvisoSalida, useIrA, useSoltarAviso } from './common/AvisoSalida';
import { precargarPaginas } from '../routes/paginas';
import { useAuth } from '../context/AuthContext';
import { semanaISO } from '../utils/semana';
import api from '../api/axios';

// 12/11/2026: la campanita (envíos a bodega de Comercial) la ven el bodeguero y el coordinador de inventario
const ROLES_CAMPANITA = ['BODEGUERO', 'COORDINADOR_INVENTARIO'];

// 05/11/2026: semana bananera, día y hora en la barra de arriba.
// 09/11/2026: con segundos (se actualiza cada segundo; solo se vuelve a dibujar el reloj, no la página)
function RelojSemana() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const { semana } = semanaISO(ahora);
  const dia = ahora.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = ahora.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  // 05/11/2026: en celular solo "SEM 45" (sin día ni hora) para que la barra no se apriete
  return (
    <div className="flex items-center gap-3 text-white text-sm" title="Semana bananera (ISO): de lunes a domingo">
      <span className="font-bold bg-white/15 rounded-md px-2 py-0.5 whitespace-nowrap">
        <span className="md:hidden">SEM {semana}</span>
        <span className="hidden md:inline">SEMANA {semana}</span>
      </span>
      <span className="hidden md:inline capitalize opacity-90">{dia}</span>
      <span className="hidden md:inline font-semibold tabular-nums">{hora}</span>
    </div>
  );
}

// Layout principal — envuelve todas las páginas privadas
// 11/11/2026: el aviso de cambios sin guardar envuelve todo (menú, barra de arriba y la página activa)
export default function Layout() {
  return (
    <ProveedorAvisoSalida>
      <LayoutContenido />
    </ProveedorAvisoSalida>
  );
}

function LayoutContenido() {
  const { user, logout, actualizarUsuario } = useAuth();
  const navigate = useNavigate();
  const irA = useIrA(); // 11/11/2026: pregunta antes de salir si la pantalla tiene cambios sin guardar
  const soltarAviso = useSoltarAviso();
  const cerrarSesion = () => {
    logout();
    navigate('/login');
  };
  // Recarga completa (no navigate): al borrar el token la ruta privada ya redirige a /login sin el aviso
  const cerrarPorInactividad = useCallback(() => {
    logout();
    soltarAviso(); // 11/11/2026: la sesión ya terminó: sin el aviso de "¿salir del sitio?" del navegador
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
        {/* 06/11/2026: fija arriba al bajar en la página (semana, fecha, hora y usuario siempre a la vista).
            z-20: queda debajo del menú desplegado (z-30/40) y de los modales.
            09/11/2026: lo fijo es este contenedor, que lleva la barra y, debajo, el aviso de versión nueva */}
        <div className="sticky top-0 z-20">
        <header className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sm:gap-4 shadow-sm bg-primario">
          <span className="text-white font-semibold text-sm whitespace-nowrap flex items-center gap-2">
            {/* 06/11/2026: ícono del sistema (hojas verdes) en un círculo blanco para que se vea sobre el azul */}
            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
              <img src="/icono-64.png" alt="" className="w-6 h-6" />
            </span>
            <span className="sm:hidden">SIAE</span>
            <span className="hidden sm:inline">Sistema Integral AGAT-ECUAGREEN <span className="font-normal opacity-70">v1.1</span></span>
            {/* 09/11/2026: recarga el sistema (trae la última versión y los datos al día) sin buscar F5.
                Junto a la versión (no junto a Cerrar sesión, para no tocar Salir por error) */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              title="Actualizar sistema"
              aria-label="Actualizar sistema"
              className="flex items-center text-white border border-white/50 rounded-lg px-2 py-1 hover:bg-white hover:text-primario transition shrink-0"
            >
              <RefreshCw size={14} />
            </button>
          </span>
          <RelojSemana />
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="text-right leading-tight min-w-0 truncate">
              <p className="text-white text-sm font-semibold">{user?.name || 'Usuario'}</p>
              <p className="text-white text-[11px] opacity-80">{user?.profile_name || user?.role?.replace('_', ' ')}</p>
            </div>
            {ROLES_CAMPANITA.includes(user?.role) && <Campanita />}
            {/* 09/11/2026: cambiar la propia contraseña cuando quiera (es obligatorio al primer ingreso y cada 3 meses) */}
            <button
              type="button"
              onClick={() => irA(() => navigate('/cambiar-clave'))}
              title="Cambiar contraseña"
              aria-label="Cambiar contraseña"
              className="flex items-center text-white border border-white/50 rounded-lg px-2.5 py-1.5 hover:bg-white hover:text-primario transition shrink-0"
            >
              <KeyRound size={15} />
            </button>
            <button
              type="button"
              onClick={() => irA(cerrarSesion)}
              title={user?.email ? `Salir de ${user.email}` : 'Cerrar sesión'}
              aria-label="Cerrar sesión"
              className="flex items-center gap-2 text-sm font-semibold text-white border border-white/50 rounded-lg px-2.5 sm:px-3 py-1.5 hover:bg-white hover:text-primario transition shrink-0"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>
        <AvisoVersion />
        </div>

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
