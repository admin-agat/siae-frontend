// Toast flotante estándar (arriba al centro) para TODAS las páginas del SIAE.
// Ubicación: src/components/common/ToastFlotante.jsx
//
// Estándar (28/10/2026): éxito → verde (green-600) · error → rojo (red-600).
// Se oculta solo a los 2.5 s llamando a onCerrar.
//
// Uso:
//   const [toast, setToast] = useState(null);   // null o { tipo: 'exito'|'error', mensaje }
//   <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function ToastFlotante({ toast, onCerrar, duracion = 2500 }) {
    // Se guarda onCerrar en un ref: así la página puede pasar una función inline
    // sin que el temporizador se reinicie en cada render
    const onCerrarRef = useRef(onCerrar);
    useEffect(() => { onCerrarRef.current = onCerrar; });

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => onCerrarRef.current(), duracion);
        return () => clearTimeout(timer);
    }, [toast, duracion]);

    if (!toast) return null;

    return (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-[70] ${
            toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
        }`}>
            {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {toast.mensaje}
        </div>
    );
}
