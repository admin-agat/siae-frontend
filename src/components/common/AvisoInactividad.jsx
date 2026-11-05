// 05/11/2026: cierre de sesión por inactividad (60 min sin mover el mouse, escribir ni hacer clic).
// - 2 minutos antes avisa con una cuenta regresiva; cualquier movimiento o "Seguir conectado" lo cancela.
// - La última actividad se guarda en localStorage: varias pestañas abiertas cuentan como una sola persona.
// - Mientras hay actividad se avisa al servidor cada 5 min (GET /me): el backend también cierra el token que
//   lleva más de SANCTUM_INACTIVIDAD minutos sin usarse (65 = 60 + margen), aunque el navegador quede apagado.
// El máximo absoluto de 12 h desde el login (SANCTUM_EXPIRATION) sigue igual.
import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import api from '../../api/axios';

const MINUTO = 60 * 1000;
const LIMITE = 60 * MINUTO;
const AVISO = 2 * MINUTO;
const LATIDO = 5 * MINUTO;
const CLAVE = 'ultimaActividad';

const leerActividad = () => {
  try { return Number(localStorage.getItem(CLAVE)) || 0; } catch { return 0; }
};
const guardarActividad = (t) => {
  try { localStorage.setItem(CLAVE, String(t)); } catch { /* sin localStorage: vale la de esta pestaña */ }
};

export default function AvisoInactividad({ onCerrar }) {
  const ultima = useRef(0);
  const ultimoLatido = useRef(0);
  const [restante, setRestante] = useState(null); // ms que faltan; null = sin aviso

  useEffect(() => {
    // Entrar o recargar cuenta como actividad (si el token ya venció, el servidor responde 401 y va al login)
    ultima.current = Date.now();
    ultimoLatido.current = ultima.current;
    guardarActividad(ultima.current);
    const actividad = () => {
      const ahora = Date.now();
      if (ahora - ultima.current < 15000) return; // no escribir en localStorage en cada movimiento
      ultima.current = ahora;
      guardarActividad(ahora);
    };
    const eventos = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    eventos.forEach((e) => window.addEventListener(e, actividad, { passive: true }));

    const revisar = () => {
      const ahora = Date.now();
      const ultimaVez = leerActividad() || ultima.current; // la última que escribió cualquier pestaña
      const inactivo = ahora - ultimaVez;
      if (inactivo >= LIMITE) {
        onCerrar();
        return;
      }
      setRestante(inactivo >= LIMITE - AVISO ? LIMITE - inactivo : null);
      if (inactivo < LATIDO && ahora - ultimoLatido.current >= LATIDO) {
        ultimoLatido.current = ahora;
        api.get('/me').catch(() => {});
      }
    };
    const intervalo = setInterval(revisar, 1000);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, actividad));
      clearInterval(intervalo);
    };
  }, [onCerrar]);

  const seguir = () => {
    const ahora = Date.now();
    ultima.current = ahora;
    ultimoLatido.current = ahora;
    guardarActividad(ahora);
    setRestante(null);
    api.get('/me').catch(() => {});
  };

  if (restante === null) return null;
  const seg = Math.max(0, Math.ceil(restante / 1000));
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div role="alertdialog" aria-labelledby="aviso-inactividad" className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Clock className="text-amber-500" size={28} />
          <h2 id="aviso-inactividad" className="text-lg font-bold text-gray-800">¿Sigues ahí?</h2>
        </div>
        <p className="text-sm text-gray-700">
          Tu sesión se cerrará por inactividad en <b className="tabular-nums">{Math.floor(seg / 60)}:{String(seg % 60).padStart(2, '0')}</b>.
          Si tienes cambios sin guardar, guárdalos antes.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            Cerrar sesión
          </button>
          <button type="button" onClick={seguir} autoFocus className="px-4 py-2 text-sm rounded-lg bg-primario text-white font-semibold hover:opacity-90">
            Seguir conectado
          </button>
        </div>
      </div>
    </div>
  );
}
