import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useIrA } from './AvisoSalida';

// 09/11/2026: avisa cuando se subió una versión nueva del sistema (sin Ctrl+F5).
// Cada build lleva el archivo principal con un nombre distinto (/assets/index-XXXX.js). Cada 5 minutos,
// y al volver a la pestaña, se baja index.html del servidor (sin caché) y se compara ese nombre con el
// que está cargado. Si cambió, aparece la franja; NO recarga sola para no perder un formulario a medias.
const CADA_MS = 5 * 60 * 1000;

const scriptPrincipal = (doc) =>
  [...doc.querySelectorAll('script[type="module"][src]')].map((s) => new URL(s.getAttribute('src'), window.location.origin).pathname)
    .find((src) => /\/assets\/index-[^/]+\.js$/.test(src)) || null;

export default function AvisoVersion() {
  const [nueva, setNueva] = useState(false);
  const irA = useIrA();

  useEffect(() => {
    const actual = scriptPrincipal(document);
    // En desarrollo (npm run dev) no hay archivo con nombre de versión: no se revisa
    if (!actual) return undefined;
    let vivo = true;
    const revisar = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const remoto = scriptPrincipal(new DOMParser().parseFromString(await res.text(), 'text/html'));
        if (vivo && remoto && remoto !== actual) setNueva(true);
      } catch {
        // sin red: se vuelve a intentar en la próxima revisión
      }
    };
    const t = setInterval(revisar, CADA_MS);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, []);

  if (!nueva) return null;
  // 13/11/2026: con cambios sin guardar pregunta con el diálogo estándar (no el aviso del navegador)
  return (
    <div role="status" className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
      <span>Hay una versión nueva del sistema. Guarda lo que estés haciendo y actualiza.</span>
      <button
        type="button"
        onClick={() => irA(() => window.location.reload())}
        className="flex items-center gap-2 font-semibold bg-amber-600 text-white rounded-lg px-3 py-1.5 hover:bg-amber-700 transition shrink-0"
      >
        <RefreshCw size={15} />
        Actualizar
      </button>
    </div>
  );
}
