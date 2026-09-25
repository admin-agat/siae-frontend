// src/utils/toastMessages.js
//
// Estándar único de mensajes toast para las acciones de Ingresar,
// Actualizar, Desactivar y Reactivar en toda la app.
// Objetivo: eliminar la inconsistencia de tener el texto del toast
// escrito a mano y distinto en cada modal/página.

// Mapa de entidades: nombre en singular + género (para la concordancia
// del participio: "creado" vs "creada").
// Agrega aquí cualquier entidad nueva del sistema.
const ENTIDADES = {
  bodega: { nombre: "Bodega", genero: "f" },
  insumo: { nombre: "Insumo", genero: "m" },
  categoria: { nombre: "Categoría", genero: "f" },
  motivo: { nombre: "Motivo", genero: "m" },
  ordenCompra: { nombre: "Orden de compra", genero: "f" },
  movimiento: { nombre: "Movimiento", genero: "m" },
  tercero: { nombre: "Tercero", genero: "m" },
  finca: { nombre: "Finca", genero: "f" },
  receta: { nombre: "Receta", genero: "f" }, // NUEVO: recetas de materiales (BOM por marca)
  marca: { nombre: "Marca", genero: "f" }, // NUEVO: marcas de despacho (GLOBAL VILLAGE, PALM BANANA, etc.)
};

// Participios base por acción, en masculino singular.
// La "a" final se ajusta automáticamente si la entidad es femenina.
const PARTICIPIOS = {
  crear: "creado",
  actualizar: "actualizado",
  desactivar: "desactivado",
  reactivar: "reactivado",
};

// Infinitivos usados solo en el mensaje de error ("Error al crear...").
const INFINITIVOS = {
  crear: "crear",
  actualizar: "actualizar",
  desactivar: "desactivar",
  reactivar: "reactivar",
};

/**
 * Devuelve el mensaje de ÉXITO estándar para una entidad + acción.
 * @param {keyof ENTIDADES} entidadKey - clave de la entidad (ej: 'bodega')
 * @param {keyof PARTICIPIOS} accion - 'crear' | 'actualizar' | 'desactivar' | 'reactivar'
 * @returns {string} ej: "Bodega creada correctamente"
 */
export function getMensajeExito(entidadKey, accion) {
  const entidad = ENTIDADES[entidadKey];
  if (!entidad) {
    console.warn(`toastMessages: entidad "${entidadKey}" no registrada`);
    return "Operación realizada correctamente";
  }

  const participioBase = PARTICIPIOS[accion];
  const participio =
    entidad.genero === "f" ? `${participioBase}a` : participioBase;

  return `${entidad.nombre} ${participio} correctamente`;
}

/**
 * Devuelve el mensaje de ERROR estándar para una entidad + acción.
 * @param {keyof ENTIDADES} entidadKey
 * @param {keyof INFINITIVOS} accion
 * @returns {string} ej: "Error al crear la bodega"
 */
export function getMensajeError(entidadKey, accion) {
  const entidad = ENTIDADES[entidadKey];
  if (!entidad) {
    return "Ocurrió un error al procesar la operación";
  }

  const articulo = entidad.genero === "f" ? "la" : "el";
  return `Error al ${INFINITIVOS[accion]} ${articulo} ${entidad.nombre.toLowerCase()}`;
}

// ---------------------------------------------------------------------
// EJEMPLO DE USO en un modal (ej: WarehouseModal.jsx):
//
// import { getMensajeExito, getMensajeError } from "../../utils/toastMessages";
// import toast from "react-hot-toast"; // o la lib que ya estés usando
//
// try {
//   await createWarehouse(data);
//   toast.success(getMensajeExito("bodega", "crear"));
// } catch (error) {
//   toast.error(getMensajeError("bodega", "crear"));
// }
//
// Para desactivar/reactivar es igual, solo cambia la acción:
// toast.success(getMensajeExito("bodega", "desactivar"));
// toast.success(getMensajeExito("bodega", "reactivar"));
// ---------------------------------------------------------------------