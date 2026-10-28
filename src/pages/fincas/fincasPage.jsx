// Página principal del módulo Fincas
// Ubicación: src/pages/fincas/FincasPage.jsx   (F mayúscula — PascalCase, igual que el componente)
//
// 27/10/2026 — migrada a los componentes comunes (mismo patrón que TercerosPage.jsx):
//   - EncabezadoPagina → título, subtítulo y botón "+ Nueva finca" en AZUL
//   - TablaEstandar    → buscador, pestañas ACTIVOS/INACTIVOS/TODOS, encabezado morado,
//                        filas alternadas, resaltado al clic y paginación
//   - EstadoBadge      → ACTIVO / INACTIVO
//   - AccionesFila     → ✏️ verde, 🚫 rojo, 🔄 azul (ya no Trash2)
// Además:
//   - Se ELIMINÓ el confirm() nativo (Chrome lo bloquea en silencio) → modal propio
//   - Se agregó REACTIVAR (antes una finca desactivada no podía volver)
//   - Toast de éxito/error con toastMessages ('finca' ya estaba registrada)
//   - Patrón defensivo al cargar (evita el error ".filter is not a function")
import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { getFarms, deactivateFarm, reactivateFarm } from '../../api/farms';
import FarmModal from '../../components/FarmModal';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

export default function FincasPage() {
    const [fincas, setFincas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [fincaEdit, setFincaEdit] = useState(null);

    // Modal de confirmación propio (nunca confirm() nativo)
    // confirmacion = null (cerrado) o { finca, accion: 'desactivar' | 'reactivar' }
    const [confirmacion, setConfirmacion] = useState(null);

    // toast = null (oculto) o { tipo: 'exito'|'error', mensaje: string }
    const [toast, setToast] = useState(null);

    useEffect(() => {
        cargarFincas();
    }, []);

    // Oculta el toast automáticamente después de un momento
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

    const cargarFincas = async () => {
        try {
            setLoading(true);
            const res = await getFarms();
            // Patrón defensivo: acepta array directo o { data: [...] }
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setFincas(data);
        } catch (error) {
            console.error('Error cargando fincas:', error);
            setFincas([]);
        } finally {
            setLoading(false);
        }
    };

    // Ejecuta la acción confirmada: desactivar o reactivar
    const ejecutarConfirmacion = async () => {
        if (!confirmacion) return;
        const { finca, accion } = confirmacion;
        try {
            if (accion === 'desactivar') {
                await deactivateFarm(finca.id);
            } else {
                await reactivateFarm(finca.id);
            }
            cargarFincas();
            // toastMessages arma el texto: "Finca desactivada/reactivada correctamente"
            setToast({ tipo: 'exito', mensaje: getMensajeExito('finca', accion) });
        } catch (error) {
            console.error(`Error al ${accion} finca:`, error);
            setToast({ tipo: 'error', mensaje: getMensajeError('finca', accion) });
        } finally {
            setConfirmacion(null);
        }
    };

    const handleEditar = (finca) => {
        setFincaEdit(finca);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setFincaEdit(null);
        setShowModal(true);
    };

    // Columnas: título + qué dato mostrar. El productor viene anidado
    // (FarmController carga with('thirdParty') → en JSON llega como third_party).
    const columnas = [
        { titulo: 'Finca', render: (f) => f.name, className: 'font-medium' },
        { titulo: 'Productor', render: (f) => f.third_party?.name },
        { titulo: 'Código MAGAP', render: (f) => f.magap_code },
        { titulo: 'Zona', render: (f) => f.zone },
        { titulo: 'Estado', render: (f) => <EstadoBadge activo={f.status} /> },
        {
            titulo: 'Acciones',
            render: (f) => (
                <AccionesFila
                    activo={f.status}
                    onEditar={() => handleEditar(f)}
                    onDesactivar={() => setConfirmacion({ finca: f, accion: 'desactivar' })}
                    onReactivar={() => setConfirmacion({ finca: f, accion: 'reactivar' })}
                />
            ),
        },
    ];

    const esDesactivar = confirmacion?.accion === 'desactivar';

    return (
        <div className="p-6">
            {/* Toast de éxito/error */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-[70] ${
                    toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
                }`}>
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            {/* Encabezado estándar */}
            <EncabezadoPagina
                titulo="Fincas"
                subtitulo="Fincas registradas por productor"
                textoBoton="Nueva finca"
                onNuevo={handleNuevo}
            />

            {/* Tabla estándar: buscador + pestañas + paginación incluidos */}
            <TablaEstandar
                columnas={columnas}
                datos={fincas}
                cargando={loading}
                nombreRegistros="fincas"
                placeholderBusqueda="Buscar por finca, código MAGAP o productor..."
                textosBusqueda={(f) => [f.name, f.magap_code, f.third_party?.name, f.zone]}
            />

            {/* Modal crear/editar (FarmModal ya estaba estandarizado) */}
            {showModal && (
                <FarmModal
                    farm={fincaEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarFincas}
                />
            )}

            {/* Modal de confirmación — sirve para desactivar y reactivar */}
            {confirmacion && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                esDesactivar ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                                {esDesactivar
                                    ? <AlertTriangle size={20} className="text-red-600" />
                                    : <CheckCircle size={20} className="text-green-600" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {esDesactivar ? 'Desactivar finca' : 'Reactivar finca'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'}{' '}
                                    <strong>{confirmacion.finca.name}</strong>?
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmacion(null)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={ejecutarConfirmacion}
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${
                                    esDesactivar
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}