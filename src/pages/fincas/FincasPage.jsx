// Página principal del módulo Fincas
// Ubicación: src/pages/fincas/FincasPage.jsx   (F mayúscula — PascalCase, igual que el componente)
//
// 27/10/2026 — migrada a los componentes comunes (mismo patrón que TercerosPage.jsx):
//   - EncabezadoPagina → título, subtítulo y botón "+ Nueva finca" en color primario
//   - TablaEstandar    → buscador, pestañas ACTIVOS/INACTIVOS/TODOS, encabezado primario,
//                        filas alternadas, resaltado al clic y paginación
//   - EstadoBadge      → ACTIVO / INACTIVO
//   - AccionesFila     → ✏️ verde, 🚫 rojo, 🔄 primario (ya no Trash2)
//   - DialogoConfirmacion / ToastFlotante (28/10/2026) → confirmación y toast comunes
// Además:
//   - Se ELIMINÓ el confirm() nativo (Chrome lo bloquea en silencio) → modal propio
//   - Se agregó REACTIVAR (antes una finca desactivada no podía volver)
//   - Toast de éxito/error con toastMessages ('finca' ya estaba registrada)
//   - Patrón defensivo al cargar (evita el error ".filter is not a function")
import { useState, useEffect } from 'react';
import { getFarms, deactivateFarm, reactivateFarm } from '../../api/farms';
import FarmModal from '../../components/FarmModal';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
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

    useEffect(() => {
        cargarFincas();
    }, []);

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
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

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
                <DialogoConfirmacion
                    titulo={esDesactivar ? 'Desactivar finca' : 'Reactivar finca'}
                    peligro={esDesactivar}
                    onCancelar={() => setConfirmacion(null)}
                    onAceptar={ejecutarConfirmacion}
                >
                    ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'}{' '}
                    <strong>{confirmacion.finca.name}</strong>?
                </DialogoConfirmacion>
            )}
        </div>
    );
}
