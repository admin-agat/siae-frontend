import React, { useState, useEffect } from "react";
import { Plus, Search, Pencil, Ban, RotateCcw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { getMensajeExito, getMensajeError } from "../../utils/toastMessages";
import {
  getShippingLines,
  deactivateShippingLine,
  reactivateShippingLine,
} from "../../api/shippingLines";
import ShippingLineModal from "../../components/ShippingLineModal";

export default function ShippingLinesPage() {
  const [shippingLines, setShippingLines] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [seleccionada, setSeleccionada] = useState(null);
  const [filaActiva, setFilaActiva] = useState(null);
  const [confirmAccion, setConfirmAccion] = useState(null);
  const [toast, setToast] = useState(null);

  const mostrarToast = (tipo, mensaje) => {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 2500);
  };

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await getShippingLines();
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setShippingLines(data);
    } catch (error) {
      mostrarToast("error", getMensajeError("naviera", "cargar"));
      setShippingLines([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const navierasFiltradas = shippingLines.filter((item) =>
    item.name?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleNueva = () => {
    setSeleccionada(null);
    setModalAbierto(true);
  };

  const handleEditar = (item) => {
    setSeleccionada(item);
    setModalAbierto(true);
  };

  const handleGuardado = () => {
    mostrarToast("exito", getMensajeExito("naviera", seleccionada ? "actualizar" : "crear"));
    cargar();
  };

  const ejecutarCambioEstado = async () => {
    if (!confirmAccion) return;
    const { item, tipo } = confirmAccion;
    const id = item.id;
    try {
      if (tipo === "anular") {
        await deactivateShippingLine(id);
      } else {
        await reactivateShippingLine(id);
      }
      mostrarToast("exito", getMensajeExito("naviera", tipo === "anular" ? "anular" : "reactivar"));
      cargar();
    } catch (error) {
      mostrarToast("error", getMensajeError("naviera", tipo === "anular" ? "anular" : "reactivar"));
    } finally {
      setConfirmAccion(null);
    }
  };

  return (
    <div className="p-6">
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-[70] ${
            toast.tipo === "exito" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.tipo === "exito" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {toast.mensaje}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Navieras</h1>
          <p className="text-gray-500 text-sm">Líneas navieras para bookings y embarques</p>
        </div>
        <button
          onClick={handleNueva}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          <Plus size={18} />
          Nueva naviera
        </button>
      </div>

      <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
        <Search size={18} className="text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre..."
          className="outline-none w-full text-sm"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#3B5BDB] text-white">
            <tr>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="text-left px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="3" className="text-center py-8 text-gray-400">
                  Cargando navieras...
                </td>
              </tr>
            ) : navierasFiltradas.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center py-8 text-gray-400">
                  No se encontraron navieras
                </td>
              </tr>
            ) : (
              navierasFiltradas.map((item, i) => (
                <tr
                  key={item.id}
                  onClick={() => setFilaActiva(item.id)}
                  className={`cursor-pointer transition ${
                    filaActiva === item.id
                      ? "bg-blue-50"
                      : i % 2 === 0 ? "bg-gray-50" : "bg-white"
                  } hover:bg-blue-50/60`}
                >
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.status ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEditar(item)} className="text-blue-500 hover:text-blue-700">
                      <Pencil size={16} />
                    </button>
                    {item.status ? (
                      <button
                        onClick={() => setConfirmAccion({ item, tipo: "anular" })}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Ban size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmAccion({ item, tipo: "reactivar" })}
                        className="text-green-600 hover:text-green-700"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ShippingLineModal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onGuardado={handleGuardado}
        shippingLine={seleccionada}
      />

      {confirmAccion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                confirmAccion.tipo === "anular" ? "bg-red-100" : "bg-green-100"
              }`}>
                <AlertTriangle
                  size={20}
                  className={confirmAccion.tipo === "anular" ? "text-red-600" : "text-green-600"}
                />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">
                  {confirmAccion.tipo === "anular" ? "Anular naviera" : "Reactivar naviera"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {confirmAccion.tipo === "anular"
                    ? <>¿Seguro que deseas anular <strong>{confirmAccion.item.name}</strong>? No aparecerá disponible en nuevos bookings ni embarques.</>
                    : <>¿Seguro que deseas reactivar <strong>{confirmAccion.item.name}</strong>?</>}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAccion(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarCambioEstado}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${
                  confirmAccion.tipo === "anular"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
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