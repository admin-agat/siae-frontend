// Botones de acción estándar para las filas de TODAS las tablas del SIAE.
// Ubicación: src/components/common/AccionesFila.jsx  (junto a ModalShell.jsx)
//
// Estándar acordado (AGAT 28, referencia: WarehousesPage.jsx):
//   - Botones cuadrados, solo ícono, sin texto; el texto va en el tooltip (title)
//   - EDITAR      → verde (bg-green-600) con Pencil
//   - DESACTIVAR  → rojo  (bg-red-600)   con Ban      — NUNCA Trash2: no se borra físico
//   - REACTIVAR   → azul  (bg-blue-600)  con RotateCcw — solo aparece si el registro está inactivo
//
// Uso en cualquier página (dentro del <td> de ACCIONES):
//   <AccionesFila
//       activo={t.status}
//       onEditar={() => handleEditar(t)}
//       onDesactivar={() => pedirConfirmacion(t, 'desactivar')}
//       onReactivar={() => pedirConfirmacion(t, 'reactivar')}
//   />
//
// Si mañana cambia un color o un ícono, se edita SOLO aquí y cambia en todo el sistema.
// Las clases de Tailwind están escritas COMPLETAS (no armadas con variables), porque
// en Tailwind v4 las clases construidas dinámicamente no se generan y fallan en silencio.
import { Pencil, Ban, RotateCcw } from 'lucide-react';

// Base común a los 3 botones: cuadrado, esquinas redondeadas, sombra suave
const BASE = 'text-white p-1.5 rounded-lg shadow-sm transition';

export default function AccionesFila({ activo, onEditar, onDesactivar, onReactivar }) {
    return (
        // stopPropagation: si la fila tiene onClick (resaltar fila seleccionada),
        // hacer clic en un botón no debe disparar también el clic de la fila
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {activo ? (
                <>
                    {/* EDITAR — solo se edita un registro activo */}
                    {onEditar && (
                        <button
                            type="button"
                            onClick={onEditar}
                            title="Editar"
                            className={`${BASE} bg-green-600 hover:bg-green-700`}
                        >
                            <Pencil size={16} />
                        </button>
                    )}

                    {/* DESACTIVAR — baja lógica (status = false), reversible */}
                    {onDesactivar && (
                        <button
                            type="button"
                            onClick={onDesactivar}
                            title="Desactivar"
                            className={`${BASE} bg-red-600 hover:bg-red-700`}
                        >
                            <Ban size={16} />
                        </button>
                    )}
                </>
            ) : (
                /* REACTIVAR — único botón visible cuando el registro está inactivo */
                onReactivar && (
                    <button
                        type="button"
                        onClick={onReactivar}
                        title="Reactivar"
                        className={`${BASE} bg-blue-600 hover:bg-blue-700`}
                    >
                        <RotateCcw size={16} />
                    </button>
                )
            )}
        </div>
    );
}













