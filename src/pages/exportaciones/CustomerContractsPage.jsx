// Página de Contratos de CLIENTES — src/pages/exportaciones/CustomerContractsPage.jsx
// Lista de contratos por cliente con su vigencia y precio por caja.
//
// 28/10/2026 — migrada a los componentes comunes con la paleta oficial
// (EncabezadoPagina, TablaEstandar, AccionesFila, EstadoBadge, DialogoConfirmacion, ToastFlotante).
// Antes: encabezado indigo-600, botones con borde y toast a la derecha.
import { useState, useEffect } from 'react';
import { getCustomerContracts, deactivateCustomerContract, reactivateCustomerContract } from '../../api/customerContracts';
import CustomerContractModal from '../../components/CustomerContractModal';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';

// Calcula si el contrato está VIGENTE, VENCIDO o FUTURO según la fecha de hoy
const estadoVigencia = (c) => {
    const hoy = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    if (c.end_date < hoy) return { texto: 'VENCIDO', clase: 'bg-gray-100 text-gray-600' };
    if (c.start_date > hoy) return { texto: 'FUTURO', clase: 'bg-amber-100 text-amber-700' };
    return { texto: 'VIGENTE', clase: 'bg-green-100 text-green-700' };
};

// "2026-01-15" → "15/01/2026" (sin new Date para no correr la fecha por zona horaria)
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

export default function CustomerContractsPage() {
    const [contratos, setContratos] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Modal crear/editar: null = cerrado, {} = nuevo, objeto = edición
    const [contratoModal, setContratoModal] = useState(null);

    // Confirmación de anular/reactivar
    const [confirmacion, setConfirmacion] = useState(null); // { contrato, accion }
    const [toast, setToast] = useState(null); // { tipo, mensaje }

    // Carga la lista desde el backend
    const cargarContratos = async () => {
        setCargando(true);
        try {
            const res = await getCustomerContracts();
            setContratos(Array.isArray(res.data) ? res.data : []); // defensivo
        } catch (err) {
            console.error('ERROR AL CARGAR CONTRATOS:', err);
            setContratos([]);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargarContratos(); }, []);

    // Ejecuta anular o reactivar luego de confirmar
    const ejecutarCambioEstado = async () => {
        const { contrato, accion } = confirmacion;
        try {
            if (accion === 'anular') await deactivateCustomerContract(contrato.id);
            else await reactivateCustomerContract(contrato.id);
            setToast({ tipo: 'exito', mensaje: accion === 'anular' ? 'CONTRATO ANULADO' : 'CONTRATO REACTIVADO' });
            cargarContratos();
        } catch (err) {
            console.error(err);
            setToast({ tipo: 'error', mensaje: err?.response?.data?.message || 'NO SE PUDO CAMBIAR EL ESTADO DEL CONTRATO' });
        } finally {
            setConfirmacion(null);
        }
    };

    const columnas = [
        { titulo: 'N° Contrato', render: (c) => c.contract_number },
        { titulo: 'Cliente', render: (c) => c.customer?.third_party?.name, className: 'font-semibold' },
        { titulo: 'Incoterm', render: (c) => c.incoterm || 'TODOS' },
        { titulo: 'Inicio', render: (c) => formatoFecha(c.start_date) },
        { titulo: 'Fin', render: (c) => formatoFecha(c.end_date) },
        { titulo: 'Precio caja', render: (c) => `$${Number(c.box_price).toFixed(2)}`, className: 'text-right' },
        { titulo: 'Cajas/sem', render: (c) => (c.weekly_boxes ? Number(c.weekly_boxes).toLocaleString('es-EC') : null), className: 'text-right' },
        {
            titulo: 'Vigencia',
            render: (c) => {
                const vig = estadoVigencia(c);
                return <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${vig.clase}`}>{vig.texto}</span>;
            },
        },
        { titulo: 'Estado', render: (c) => <EstadoBadge activo={c.status} /> },
        {
            titulo: 'Acciones',
            render: (c) => (
                <AccionesFila
                    activo={c.status}
                    onEditar={() => setContratoModal(c)}
                    onDesactivar={() => setConfirmacion({ contrato: c, accion: 'anular' })}
                    onReactivar={() => setConfirmacion({ contrato: c, accion: 'reactivar' })}
                />
            ),
        },
    ];

    const esAnular = confirmacion?.accion === 'anular';

    return (
        <div className="p-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

            <EncabezadoPagina
                titulo="Contratos de clientes"
                subtitulo="Vigencia y precio por caja de cada cliente"
                textoBoton="Nuevo contrato"
                onNuevo={() => setContratoModal({})}
            />

            <TablaEstandar
                columnas={columnas}
                datos={contratos}
                cargando={cargando}
                nombreRegistros="contratos"
                placeholderBusqueda="Buscar por cliente o N° contrato..."
                textosBusqueda={(c) => [c.customer?.third_party?.name, c.contract_number]}
            />

            {/* Modal crear/editar (se monta solo cuando está abierto) */}
            {contratoModal && (
                <CustomerContractModal
                    contract={contratoModal}
                    onClose={() => setContratoModal(null)}
                    onGuardado={cargarContratos}
                />
            )}

            {confirmacion && (
                <DialogoConfirmacion
                    titulo={esAnular ? 'Anular contrato' : 'Reactivar contrato'}
                    peligro={esAnular}
                    onCancelar={() => setConfirmacion(null)}
                    onAceptar={ejecutarCambioEstado}
                >
                    {esAnular
                        ? '¿Seguro que deseas anular este contrato? Ya no se usará para tomar precios en nuevos pedidos.'
                        : '¿Seguro que deseas reactivar este contrato?'}
                </DialogoConfirmacion>
            )}
        </div>
    );
}
