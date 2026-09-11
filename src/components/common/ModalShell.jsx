// Wrapper estándar para todos los modales de formulario de SIAE.
// Unifica: header (título azul + X), grid de 2 columnas, banner de error,
// toast de éxito, y footer con botones Cancelar (coral) / Guardar (azul).
import { X, Save, CheckCircle } from 'lucide-react';

const COLOR_PRIMARY = '#2563eb';
const COLOR_PRIMARY_HOVER = '#1d4ed8';
const COLOR_CANCEL = '#e2593f';
const COLOR_CANCEL_HOVER = '#c94a32';

export default function ModalShell({
    isOpen = true,
    title,
    onClose,
    onSubmit,
    children,
    esEdicion = false,
    guardando = false,
    // Deshabilita el botón de guardar SIN cambiar el texto a "Guardando...".
    // Úsalo para estados de carga que no son un guardado real (ej. mientras
    // se calcula un código automático).
    deshabilitado = false,
    error = '',
    toast = '',
    size = 'md',
}) {
    if (!isOpen) return null;

    const anchoModal = {
        sm: 'max-w-sm',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
    }[size];

    const botonDeshabilitado = guardando || deshabilitado;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${anchoModal} max-h-[90vh] overflow-y-auto relative`}>

                {toast && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-10">
                        <CheckCircle size={18} />
                        {toast}
                    </div>
                )}

                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold" style={{ color: COLOR_PRIMARY }}>{title}</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="px-7 py-6 space-y-5">

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    {children}

                    <div className="flex justify-end gap-3 items-center pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-lg shadow-sm transition font-medium"
                            style={{ backgroundColor: COLOR_CANCEL }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLOR_CANCEL_HOVER; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = COLOR_CANCEL; }}
                        >
                            <X size={16} />
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={botonDeshabilitado}
                            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50"
                            style={{ backgroundColor: COLOR_PRIMARY }}
                            onMouseEnter={(e) => { if (!botonDeshabilitado) e.currentTarget.style.backgroundColor = COLOR_PRIMARY_HOVER; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = COLOR_PRIMARY; }}
                        >
                            <Save size={18} />
                            {guardando ? 'Guardando...' : (esEdicion ? 'Actualizar' : 'Guardar')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}