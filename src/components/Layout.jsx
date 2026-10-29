import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from "./Sidebar";
import { precargarPaginas } from '../routes/paginas';

// Layout principal — envuelve todas las páginas privadas
export default function Layout() {
  // Descarga el resto de pantallas en segundo plano: cambiar de menú queda instantáneo
  useEffect(() => {
    precargarPaginas();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* Sidebar fijo a la izquierda */}
      <Sidebar />

      {/* Contenido principal. min-w-0: sin esto, una tabla ancha (ej. líneas del pedido)
          estira toda la página y corta botones/campos; con esto la tabla hace scroll en su caja */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Navbar superior */}
        <header className="px-6 py-4 flex items-center justify-between shadow-sm bg-primario">
          <span className="text-white font-semibold text-sm">Sistema Integral AGAT-ECUAGREEN</span>
          <span className="text-white text-sm opacity-80">v1.0</span>
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
