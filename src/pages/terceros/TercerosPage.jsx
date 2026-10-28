// Página principal del módulo Terceros (maestro de productores, comercializadoras, proveedores y clientes)
// Ubicación: src/pages/terceros/TercerosPage.jsx
//
// CAMBIOS 27/10/2026:
//  - TIPO y ESTADO se muestran en MAYÚSCULAS (política de datos del SIAE)
//  - Columna ZONA → ZONA / PAÍS: para CLIENTE muestra el país (t.customer.country)
//  - El buscador también encuentra por país (ej. "RUSIA")
//  - Botones de la fila con el componente común AccionesFila (✏️ verde, 🚫 rojo, 🔄 azul),
//    igual que el resto del sistema. Ya no se usa Trash2.
//  - Desactivar / Reactivar con PATCH (deactivateThirdParty / reactivateThirdParty).
//    Antes no existía reactivar: un tercero inactivo no podía volver.
//  - Clic en una fila la resalta (mismo patrón de WarehousesPage.jsx)
import { useState, useEffect } from 'react';
import { getThirdParties, deactivateThirdParty, reactivateThirdParty } from '../../api/thirdParties';
import { Plus, Search, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import ThirdPartyModal from '../../components/ThirdPartyModal';
import AccionesFila from '../../components/common/AccionesFila';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

const POR_PAGINA = 10;

// El país del cliente NO está en third_parties: vive en su ficha de customers.
// El backend ya la envía anidada (index() carga with('customer')), así que se lee
// como t.customer.country. El "?." evita error si el tercero no tiene ficha (productores).
const paisDe = (t) => t.customer?.country || '';

// Devuelve lo que va en la columna ZONA / PAÍS según el tipo de tercero.
// - CLIENTE (extranjero): su país (ej. RUSIA). Si no tiene ficha, cae a la zona.
// - Resto (PRODUCTOR, COMERCIALIZADORA, PROVEEDOR): su zona, como antes.
const zonaOPais = (t) => {
    if (t.type === 'CLIENTE') return paisDe(t) || t.zone || '—';
    return t.zone || '—';
};

export default function TercerosPage() {
    const [terceros, setTerceros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [terceroEdit, setTerceroEdit] = useState(null);
    const [paginaActual, setPaginaActual] = useState(1);

    // Fila resaltada al hacer clic (id del tercero o null)
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // Modal de confirmación propio, reemplaza el confirm() nativo
    // confirmacion = null (cerrado) o { tercero, accion: 'desactivar' | 'reactivar' }
    const [confirmacion, setConfirmacion] = useState(null);

    // toast = null (oculto) o { tipo: 'exito'|'error', mensaje: string }
    const [toast, setToast] = useState(null);

    useEffect(() => {
        cargarTerceros();
    }, []);

    // Cada vez que cambia la búsqueda, volvemos a la página 1
    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda]);

    // Oculta el toast automáticamente después de un momento
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

    const cargarTerceros = async () => {
        try {
            setLoading(true);
            const res = await getThirdParties();
            // Patrón defensivo: acepta array directo o { data: [...] }
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setTerceros(data);
        } catch (error) {
            console.error('Error cargando terceros:', error);
            setTerceros([]);
        } finally {
            setLoading(false);
        }
    };

    // Abre el modal de confirmación indicando QUÉ acción se va a hacer
    const pedirConfirmacion = (tercero, accion) => {
        setConfirmacion({ tercero, accion });
    };

    // Ejecuta la acción confirmada: desactivar o reactivar
    const ejecutarConfirmacion = async () => {
        if (!confirmacion) return;
        const { tercero, accion } = confirmacion;
        try {
            if (accion === 'desactivar') {
                await deactivateThirdParty(tercero.id);
            } else {
                await reactivateThirdParty(tercero.id);
            }
            cargarTerceros();
            // toastMessages arma el texto: "Tercero desactivado/reactivado correctamente"
            setToast({ tipo: 'exito', mensaje: getMensajeExito('tercero', accion) });
        } catch (error) {
            console.error(`Error al ${accion} tercero:`, error);
            setToast({ tipo: 'error', mensaje: getMensajeError('tercero', accion) });
        } finally {
            setConfirmacion(null);
        }
    };

    const handleEditar = (tercero) => {
        setTerceroEdit(tercero);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setTerceroEdit(null);
        setShowModal(true);
    };

    // Filtro del buscador: nombre, identificación, zona y país.
    // Se compara en minúsculas para que "rusia" encuentre "RUSIA".
    const texto = busqueda.toLowerCase();
    const tercerosFiltrados = terceros.filter(t =>
        (t.name || '').toLowerCase().includes(texto) ||
        (t.identification || '').toLowerCase().includes(texto) ||
        (t.zone || '').toLowerCase().includes(texto) ||
        paisDe(t).toLowerCase().includes(texto)
    );

    // Cálculo de paginación
    const totalPaginas = Math.max(1, Math.ceil(tercerosFiltrados.length / POR_PAGINA));
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const tercerosPagina = tercerosFiltrados.slice(inicio, inicio + POR_PAGINA);

    const irPaginaAnterior = () => setPaginaActual(p => Math.max(1, p - 1));
    const irPaginaSiguiente = () => setPaginaActual(p => Math.min(totalPaginas, p + 1));

    // Datos del modal de confirmación según la acción (clases completas, no dinámicas)
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

            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Terceros</h1>
                    <p className="text-gray-500 text-sm">Productores, comercializadoras y clientes</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                >
                    <Plus size={18} />
                    Nuevo tercero
                </button>
            </div>

            {/* Buscador */}
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, RUC, zona o país..."
                    className="outline-none w-full text-sm"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    {/* Encabezados en MAYÚSCULAS */}
                    <thead className="bg-[#3B5BDB] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">NOMBRE</th>
                            <th className="text-left px-4 py-3">TIPO</th>
                            <th className="text-left px-4 py-3">RUC / ID</th>
                            <th className="text-left px-4 py-3">ZONA / PAÍS</th>
                            <th className="text-left px-4 py-3">ESTADO</th>
                            <th className="text-left px-4 py-3">ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-400">
                                    Cargando terceros...
                                </td>
                            </tr>
                        ) : tercerosPagina.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-400">
                                    No hay terceros registrados
                                </td>
                            </tr>
                        ) : (
                            tercerosPagina.map((t, i) => (
                                <tr
                                    key={t.id}
                                    onClick={() => setFilaSeleccionada(t.id)}
                                    className={`cursor-pointer transition ${
                                        filaSeleccionada === t.id
                                            ? 'bg-blue-100'
                                            : (i % 2 === 0 ? 'bg-gray-50' : 'bg-white')
                                    }`}
                                >
                                    <td className="px-4 py-3 font-medium">{t.name}</td>
                                    {/* TIPO tal cual viene de la base: PRODUCTOR, CLIENTE, etc. */}
                                    <td className="px-4 py-3">{t.type}</td>
                                    <td className="px-4 py-3">{t.identification || '—'}</td>
                                    <td className="px-4 py-3">{zonaOPais(t)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            t.status
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {t.status ? 'ACTIVO' : 'INACTIVO'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {/* Componente común: decide solo qué botones mostrar según t.status */}
                                        <AccionesFila
                                            activo={t.status}
                                            onEditar={() => handleEditar(t)}
                                            onDesactivar={() => pedirConfirmacion(t, 'desactivar')}
                                            onReactivar={() => pedirConfirmacion(t, 'reactivar')}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Controles de paginación */}
                {!loading && tercerosFiltrados.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, tercerosFiltrados.length)} de {tercerosFiltrados.length} terceros
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={irPaginaAnterior}
                                disabled={paginaActual === 1}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                <ChevronLeft size={16} />
                                Anterior
                            </button>
                            <span className="text-sm text-gray-600 px-2">
                                Página {paginaActual} de {totalPaginas}
                            </span>
                            <button
                                onClick={irPaginaSiguiente}
                                disabled={paginaActual === totalPaginas}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal crear/editar */}
            {showModal && (
                <ThirdPartyModal
                    thirdParty={terceroEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarTerceros}
                />
            )}

            {/* Modal de confirmación propio — sirve para desactivar y reactivar */}
            {confirmacion && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-3 mb-4">
                            {/* Ícono rojo al desactivar, verde al reactivar */}
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                esDesactivar ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                                {esDesactivar
                                    ? <AlertTriangle size={20} className="text-red-600" />
                                    : <CheckCircle size={20} className="text-green-600" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {esDesactivar ? 'Desactivar tercero' : 'Reactivar tercero'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'}{' '}
                                    <strong>{confirmacion.tercero.name}</strong>?
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
                            {/* Aceptar rojo al desactivar, verde al reactivar (clases completas) */}
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