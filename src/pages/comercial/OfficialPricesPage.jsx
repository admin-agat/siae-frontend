// Precios oficiales MAG por tipo de caja (COMERCIAL → Precios oficiales MAG)
// Ubicación: src/pages/comercial/OfficialPricesPage.jsx
//
// 30/10/2026: el precio oficial por caja lo fija el MAG por acuerdo ministerial. La compra de fruta
// lo propone según el tipo de caja de la marca; la diferencia con el precio real es la nota de
// crédito que entrega el vendedor. Al cambiar el precio, se cierra el anterior con fecha "hasta".
import { useState, useEffect } from 'react';
import {
  getBoxTypes, getOfficialPrices, createOfficialPrice, updateOfficialPrice,
  deactivateOfficialPrice, reactivateOfficialPrice,
} from '../../api/officialPrices';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import ModalShell from '../../components/common/ModalShell';
import SelectBuscable from '../../components/common/SelectBuscable';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';
import CampoNumero from '../../components/common/CampoNumero';
import { dinero } from '../../utils/formato';
import { hoyISO } from '../../utils/fecha';

const fecha = (f) => (f ? f.split('-').reverse().join('/') : '');
const hoy = () => hoyISO();

function PrecioModal({ precio, tiposCaja, onClose, onGuardado }) {
  const esEdicion = Boolean(precio?.id);
  const [form, setForm] = useState(() => ({
    box_type_id: precio?.box_type_id ? String(precio.box_type_id) : (tiposCaja.length === 1 ? String(tiposCaja[0].id) : ''),
    valid_from: precio?.valid_from || `${new Date().getFullYear()}-01-01`,
    valid_to: precio?.valid_to || '',
    price: precio?.price ?? '',
    agreement_number: precio?.agreement_number || '',
    notes: precio?.notes || '',
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cambiar = (campo, mayus = false) => (e) => setForm((f) => ({ ...f, [campo]: mayus ? e.target.value.toUpperCase() : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.box_type_id) return setError('ELIGE EL TIPO DE CAJA.');
    if (!(Number(form.price) > 0)) return setError('ESCRIBE EL PRECIO OFICIAL.');
    if (form.valid_to && form.valid_to < form.valid_from) return setError('LA FECHA "HASTA" NO PUEDE SER ANTERIOR A "DESDE".');

    setGuardando(true);
    const accion = esEdicion ? 'actualizar' : 'crear';
    try {
      const data = { ...form, box_type_id: Number(form.box_type_id), price: Number(form.price), valid_to: form.valid_to || null };
      if (esEdicion) await updateOfficialPrice(precio.id, data);
      else await createOfficialPrice(data);
      setExito(getMensajeExito('precioOficial', accion));
      setTimeout(() => { onGuardado(); onClose(); }, 900);
    } catch (err) {
      console.error('ERROR AL GUARDAR EL PRECIO OFICIAL:', err);
      const errores = err.response?.data?.errors;
      setError(errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || getMensajeError('precioOficial', accion)));
    } finally {
      setGuardando(false);
    }
  };

  const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';

  return (
    <ModalShell
      title={esEdicion ? 'Editar precio oficial' : 'Nuevo precio oficial'}
      onClose={onClose}
      onSubmit={handleSubmit}
      esEdicion={esEdicion}
      guardando={guardando}
      error={error}
      toast={exito}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Tipo de caja *</label>
          <SelectBuscable value={form.box_type_id} onChange={cambiar('box_type_id')} required className={input}>
            <option value="">SELECCIONAR...</option>
            {tiposCaja.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={label}>Precio oficial por caja (US$) *</label>
          <CampoNumero decimales={2} value={form.price} onChange={cambiar('price')} placeholder="EJ. 7.25" className={`${input} text-right`} />
        </div>
        <div>
          <label className={label}>Rige desde *</label>
          <input type="date" value={form.valid_from} onChange={cambiar('valid_from')} className={input} />
        </div>
        <div>
          <label className={label}>Hasta</label>
          <input type="date" value={form.valid_to} onChange={cambiar('valid_to')} className={input} />
        </div>
        <div className="col-span-2">
          <label className={label}>N° de acuerdo ministerial</label>
          <input value={form.agreement_number} onChange={cambiar('agreement_number', true)} maxLength={60} placeholder="EJ. MAG-2026-0XX-A" className={input} />
        </div>
        <div className="col-span-2">
          <label className={label}>Notas</label>
          <input value={form.notes} onChange={cambiar('notes', true)} maxLength={255} className={input} />
        </div>
        <p className="col-span-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          Sin fecha "hasta", el precio rige hasta que se registre otro. Para un precio nuevo, ponle fecha "hasta" al anterior.
          Las compras ya hechas conservan el precio con que se registraron.
        </p>
      </div>
    </ModalShell>
  );
}

export default function OfficialPricesPage() {
  const [precios, setPrecios] = useState([]);
  const [tiposCaja, setTiposCaja] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null); // null | { precio }
  const [confirmacion, setConfirmacion] = useState(null); // { precio, accion }
  const [toast, setToast] = useState(null);

  // El primer "Cargando..." sale del estado inicial; al recargar tras guardar, la tabla queda visible
  const cargar = () => Promise.all([getOfficialPrices(), getBoxTypes()])
    .then(([resPrecios, resTipos]) => {
      setPrecios(Array.isArray(resPrecios.data) ? resPrecios.data : []);
      setTiposCaja((Array.isArray(resTipos.data) ? resTipos.data : []).filter((t) => t.status));
    })
    .catch((err) => {
      console.error('ERROR AL CARGAR PRECIOS OFICIALES:', err);
      setPrecios([]);
    })
    .finally(() => setCargando(false));

  useEffect(() => { cargar(); }, []);

  const handleConfirmarAccion = async () => {
    const { precio, accion } = confirmacion;
    try {
      if (accion === 'desactivar') await deactivateOfficialPrice(precio.id);
      else await reactivateOfficialPrice(precio.id);
      await cargar();
      setToast({ tipo: 'exito', mensaje: getMensajeExito('precioOficial', accion) });
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL PRECIO OFICIAL:', err);
      setToast({ tipo: 'error', mensaje: err.response?.data?.message || getMensajeError('precioOficial', accion) });
    } finally {
      setConfirmacion(null);
    }
  };

  const vigenteHoy = (p) => p.status && p.valid_from <= hoy() && (!p.valid_to || p.valid_to >= hoy());

  const columnas = [
    { titulo: 'Tipo de caja', render: (p) => p.box_type?.name, className: 'font-medium' },
    { titulo: 'Precio', render: (p) => <span className="font-semibold">$ {dinero(p.price)}</span> },
    { titulo: 'Desde', render: (p) => fecha(p.valid_from) },
    { titulo: 'Hasta', render: (p) => (p.valid_to ? fecha(p.valid_to) : <span className="text-gray-400">SIN FECHA DE FIN</span>) },
    { titulo: 'Acuerdo ministerial', render: (p) => p.agreement_number || <span className="text-gray-400">—</span> },
    { titulo: 'Vigencia', render: (p) => (vigenteHoy(p) ? <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">VIGENTE HOY</span> : <span className="text-gray-400">—</span>) },
    { titulo: 'Estado', render: (p) => <EstadoBadge activo={p.status} /> },
    {
      titulo: 'Acciones',
      render: (p) => (
        <AccionesFila
          activo={p.status}
          onEditar={() => setModal({ precio: p })}
          onDesactivar={() => setConfirmacion({ precio: p, accion: 'desactivar' })}
          onReactivar={() => setConfirmacion({ precio: p, accion: 'reactivar' })}
        />
      ),
    },
  ];

  const esDesactivar = confirmacion?.accion === 'desactivar';

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      <EncabezadoPagina
        titulo="Precios oficiales MAG"
        subtitulo="Precio mínimo por caja según acuerdo ministerial. Oficial − real = nota de crédito del vendedor"
        textoBoton="Nuevo precio"
        onNuevo={() => setModal({ precio: null })}
      />

      <TablaEstandar
        columnas={columnas}
        datos={precios}
        cargando={cargando}
        nombreRegistros="precios"
        placeholderBusqueda="Buscar por tipo de caja o acuerdo..."
        textosBusqueda={(p) => [p.box_type?.name, p.agreement_number, p.notes]}
      />

      {modal && (
        <PrecioModal precio={modal.precio} tiposCaja={tiposCaja} onClose={() => setModal(null)} onGuardado={cargar} />
      )}

      {confirmacion && (
        <DialogoConfirmacion
          titulo={esDesactivar ? 'Desactivar precio oficial' : 'Reactivar precio oficial'}
          peligro={esDesactivar}
          onCancelar={() => setConfirmacion(null)}
          onAceptar={handleConfirmarAccion}
        >
          ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'} el precio de <strong>{confirmacion.precio.box_type?.name} $ {dinero(confirmacion.precio.price)}</strong>?
          {esDesactivar && ' Las compras nuevas ya no lo propondrán.'}
        </DialogoConfirmacion>
      )}
    </div>
  );
}
