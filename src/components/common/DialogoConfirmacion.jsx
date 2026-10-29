// Diálogo de confirmación estándar para TODAS las páginas del SIAE (nunca confirm() nativo:
// Chrome lo bloquea en silencio).
// Ubicación: src/components/common/DialogoConfirmacion.jsx
//
// Estándar (28/10/2026, paleta de index.css):
//   - peligro (desactivar, anular, cancelar) → ícono y botón Aceptar en ROJO (red-600)
//   - resto (reactivar, confirmar)           → ícono y botón Aceptar en PRIMARIO (#3B5BDB)
//   - Cancelar → botón secundario gris (igual que ModalShell)
//
// Uso:
//   {confirmacion && (
//       <DialogoConfirmacion
//           titulo="Desactivar tercero"
//           peligro={confirmacion.accion === 'desactivar'}
//           onCancelar={() => setConfirmacion(null)}
//           onAceptar={ejecutarConfirmacion}
//       >
//           ¿Estás seguro de desactivar <strong>{confirmacion.tercero.name}</strong>?
//       </DialogoConfirmacion>
//   )}
// Las clases están escritas COMPLETAS (Tailwind v4 no genera clases armadas con variables).
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function DialogoConfirmacion({
    titulo,
    children,
    peligro = true,
    textoAceptar = 'Aceptar',
    textoCancelar = 'Cancelar',
    onAceptar,
    onCancelar,
    procesando = false,
}) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-start gap-3 mb-4">
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        peligro ? 'bg-red-100' : 'bg-primario-claro'
                    }`}>
                        {peligro
                            ? <AlertTriangle size={20} className="text-red-600" />
                            : <RotateCcw size={20} className="text-primario" />}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800">{titulo}</h3>
                        <p className="text-sm text-gray-500 mt-1">{children}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancelar}
                        disabled={procesando}
                        className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        {textoCancelar}
                    </button>
                    <button
                        type="button"
                        onClick={onAceptar}
                        disabled={procesando}
                        className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${
                            peligro
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-primario hover:bg-primario-hover'
                        }`}
                    >
                        {procesando ? 'Procesando...' : textoAceptar}
                    </button>
                </div>
            </div>
        </div>
    );
}
