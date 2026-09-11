import React, { useState, useEffect } from "react";
import { X, Save, CheckCircle } from "lucide-react";
import { getMensajeExito, getMensajeError } from "../utils/toastMessages";
import { createShippingLine, updateShippingLine } from "../api/shippingLines";

export default function ShippingLineModal({ isOpen, onClose, onGuardado, shippingLine }) {
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mostrarExito, setMostrarExito] = useState(false);

  const esEdicion = Boolean(shippingLine && shippingLine.id);

   useEffect(() => {
    if (isOpen) {
      setNombre(shippingLine?.name || "");
      setError("");
      setMostrarExito(false);
      setLoading(false);
    }
  }, [isOpen, shippingLine]);

  const handleChange = (e) => {
    setNombre(e.target.value.toUpperCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const accion = esEdicion ? "actualizar" : "crear";

    try {
      if (esEdicion) {
        await updateShippingLine(shippingLine.id, { name: nombre });
      } else {
        await createShippingLine({ name: nombre });
      }

      setMostrarExito(true);
      setTimeout(() => {
        onGuardado();
        onClose();
      }, 1200);
    } catch (err) {
      if (err.response?.status === 422) {
        const primerError = Object.values(err.response.data.errors || {})[0]?.[0];
        setError(primerError || getMensajeError("naviera", accion));
      } else {
        setError(getMensajeError("naviera", accion));
      }
      console.error(err);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative">
        {mostrarExito && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-10">
            <CheckCircle size={18} />
            {getMensajeExito("naviera", esEdicion ? "actualizar" : "crear")}
          </div>
        )}

        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-green-800">
            {esEdicion ? "Editar Naviera" : "Nueva Naviera"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5">
            <label className="block font-semibold text-sm text-gray-700 mb-1">
              Nombre de la naviera
            </label>
            <input
              type="text"
              value={nombre}
              onChange={handleChange}
              placeholder="EJ. UNIREEFER"
              className="w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !nombre.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}