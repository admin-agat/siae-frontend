// Página principal del módulo Terceros (maestro de productores, comercializadoras, proveedores y clientes)
// Ubicación: src/pages/terceros/TercerosPage.jsx
//
// CAMBIOS 27/10/2026:
//  - TIPO y ESTADO se muestran en MAYÚSCULAS (política de datos del SIAE)
//  - Columna ZONA → ZONA / PAÍS: para CLIENTE muestra el país (t.customer.country)
//  - El buscador también encuentra por país (ej. "RUSIA")
//  - Desactivar / Reactivar con PATCH (deactivateThirdParty / reactivateThirdParty).
//    Antes no existía reactivar: un tercero inactivo no podía volver.
// CAMBIOS 28/10/2026:
//  - Migrada por completo a los componentes comunes (EncabezadoPagina, TablaEstandar,
//    EstadoBadge, AccionesFila, DialogoConfirmacion, ToastFlotante) con la paleta oficial.
//  - Ahora tiene pestañas ACTIVOS / INACTIVOS / TODOS (vienen con TablaEstandar).
// CAMBIOS 02/11/2026:
//  - Se quitó la pantalla Comercializadoras (repetía esta): ahora hay un filtro por tipo con cantidades.
//    /terceros?tipo=COMERCIALIZADORA abre ya filtrado (a eso redirige la ruta vieja /comercializadoras).
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getThirdParties, deactivateThirdParty, reactivateThirdParty } from '../../api/thirdParties';
import ThirdPartyModal from '../../components/ThirdPartyModal';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

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

// Filtro por tipo (02/11/2026). Las cantidades cuentan solo los activos.
const TIPOS = [
    { clave: '', etiqueta: 'Todos' },
    { clave: 'PRODUCTOR', etiqueta: 'Productores' },
    { clave: 'COMERCIALIZADORA', etiqueta: 'Comercializadoras' },
    { clave: 'PROVEEDOR', etiqueta: 'Proveedores' },
    { clave: 'CLIENTE', etiqueta: 'Clientes' },
];

export default function TercerosPage() {
    const [params, setParams] = useSearchParams();
    const tipo = TIPOS.some((t) => t.clave === params.get('tipo')) ? params.get('tipo') : '';
    const cambiarTipo = (clave) => setParams(clave ? { tipo: clave } : {}, { replace: true });
    const [terceros, setTerceros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [terceroEdit, setTerceroEdit] = useState(null);

    // confirmacion = null (cerrado) o { tercero, accion: 'desactivar' | 'reactivar' }
    const [confirmacion, setConfirmacion] = useState(null);

    // toast = null (oculto) o { tipo: 'exito'|'error', mensaje: string }
    const [toast, setToast] = useState(null);

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

    useEffect(() => {
        cargarTerceros();
    }, []);

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
        // Con un tipo elegido en el filtro, el nuevo tercero ya viene con ese tipo
        setTerceroEdit(tipo ? { type: tipo } : null);
        setShowModal(true);
    };

    const tercerosVisibles = tipo ? terceros.filter((t) => t.type === tipo) : terceros;
    const activosDe = (clave) => terceros.filter((t) => t.status && (!clave || t.type === clave)).length;

    const columnas = [
        { titulo: 'Nombre', render: (t) => t.name, className: 'font-medium' },
        // TIPO tal cual viene de la base: PRODUCTOR, CLIENTE, etc.
        { titulo: 'Tipo', render: (t) => t.type },
        { titulo: 'RUC / ID', render: (t) => t.identification },
        { titulo: 'Zona / País', render: (t) => zonaOPais(t) },
        // 02/11/2026: marcas del cliente (antes en la pantalla Clientes, que se quitó)
        {
            titulo: 'Marcas',
            render: (t) => (t.customer?.brands?.length ? (
                <div className="flex flex-wrap gap-1">
                    {t.customer.brands.map((b) => (
                        <span key={b.id} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{b.name}</span>
                    ))}
                </div>
            ) : null),
        },
        { titulo: 'Estado', render: (t) => <EstadoBadge activo={t.status} /> },
        {
            titulo: 'Acciones',
            render: (t) => (
                <AccionesFila
                    activo={t.status}
                    onEditar={() => handleEditar(t)}
                    onDesactivar={() => setConfirmacion({ tercero: t, accion: 'desactivar' })}
                    onReactivar={() => setConfirmacion({ tercero: t, accion: 'reactivar' })}
                />
            ),
        },
    ];

    const esDesactivar = confirmacion?.accion === 'desactivar';

    return (
        <div className="p-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

            <EncabezadoPagina
                titulo="Terceros"
                subtitulo="Productores, comercializadoras, proveedores y clientes"
                textoBoton="Nuevo tercero"
                onNuevo={handleNuevo}
            />

            <div className="flex flex-wrap gap-2 mb-4">
                {TIPOS.map((t) => (
                    <button
                        key={t.clave || 'todos'}
                        type="button"
                        onClick={() => cambiarTipo(t.clave)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
                            tipo === t.clave ? 'bg-primario text-white border-primario' : 'bg-white text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {t.etiqueta} <span className={tipo === t.clave ? 'opacity-80' : 'text-gray-400'}>({activosDe(t.clave)})</span>
                    </button>
                ))}
            </div>

            <TablaEstandar
                columnas={columnas}
                datos={tercerosVisibles}
                cargando={loading}
                nombreRegistros={tipo ? TIPOS.find((t) => t.clave === tipo).etiqueta.toLowerCase() : 'terceros'}
                placeholderBusqueda="Buscar por nombre, RUC, zona o país..."
                textosBusqueda={(t) => [t.name, t.identification, t.zone, paisDe(t), ...(t.customer?.brands || []).map((b) => b.name)]}
            />

            {/* Modal crear/editar */}
            {showModal && (
                <ThirdPartyModal
                    thirdParty={terceroEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarTerceros}
                />
            )}

            {confirmacion && (
                <DialogoConfirmacion
                    titulo={esDesactivar ? 'Desactivar tercero' : 'Reactivar tercero'}
                    peligro={esDesactivar}
                    onCancelar={() => setConfirmacion(null)}
                    onAceptar={ejecutarConfirmacion}
                >
                    ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'}{' '}
                    <strong>{confirmacion.tercero.name}</strong>?
                </DialogoConfirmacion>
            )}
        </div>
    );
}
