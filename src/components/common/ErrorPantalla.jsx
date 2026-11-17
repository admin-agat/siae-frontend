// Atrapa los errores al dibujar una pantalla para que el sistema no quede en blanco.
// Ubicación: src/components/common/ErrorPantalla.jsx
//
// 17/11/2026 (pedido de Peter: "al iniciar sesión se queda en blanco, toca actualizar"): las pantallas se
// descargan por partes (React.lazy). Si la pestaña tenía una versión vieja y ya se subió otra, la parte
// pedida ya no existe en el servidor, el import() falla y, sin este componente, React borraba toda la página.
//   - Falla de descarga de una pantalla: se recarga sola UNA vez (trae la versión nueva). Si vuelve a fallar
//     enseguida (sin red, servidor caído) no se repite: se muestra el aviso, así nunca queda recargando en bucle.
//   - Cualquier otro error: aviso con botón "Actualizar"; el menú y la barra de arriba siguen visibles.
// En Layout va con key = ruta: al cambiar de pantalla en el menú el aviso se limpia.
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const CLAVE_RECARGA = 'siae:recarga-version';
const ESPERA_MS = 30 * 1000;

// Mensajes de Chrome/Edge, Firefox y Safari cuando no se pudo descargar una parte del sistema
const esFallaDeDescarga = (error) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Unable to preload/i
    .test(String(error?.message || error));

const recargarUnaVez = () => {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) || 0);
    if (Date.now() - ultima < ESPERA_MS) return false;
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    return false; // sin sessionStorage no se puede evitar el bucle: mejor el aviso
  }
  window.dispatchEvent(new Event('siae:soltar-aviso')); // sin el aviso de "¿salir del sitio?" del navegador
  window.location.reload();
  return true;
};

export default class ErrorPantalla extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, recargando: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('SIAE: error al mostrar la pantalla', error);
    if (esFallaDeDescarga(error) && recargarUnaVez()) this.setState({ recargando: true });
  }

  render() {
    const { error, recargando } = this.state;
    if (!error) return this.props.children;
    if (recargando) return <div className="p-6 text-gray-400">Cargando la versión nueva...</div>;
    const descarga = esFallaDeDescarga(error);
    return (
      <div className={this.props.paginaCompleta ? 'min-h-screen flex items-center justify-center bg-gray-100 p-4' : ''}>
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-600 max-w-lg mx-auto">
          <AlertTriangle size={32} className="mx-auto text-amber-500 mb-3" />
          <p className="font-semibold text-gray-800 mb-1">
            {descarga ? 'No se pudo cargar esta pantalla.' : 'Ocurrió un problema al mostrar esta pantalla.'}
          </p>
          <p className="text-sm mb-5">
            {descarga ? 'Revisa tu conexión a internet y actualiza.' : 'Actualiza el sistema. Si se repite, avisa al administrador.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primario text-white hover:bg-primario-hover"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>
    );
  }
}
