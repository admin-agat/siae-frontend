// 13/11/2026: lee el "CUADRO DE DESPACHO" que manda una comercializadora (ASCUPOESPE…) pegado desde
// Excel (tabulaciones) o WhatsApp (tabulaciones, ";" o 2+ espacios) para dividir su compra global.
// Columnas reconocidas por el encabezado (en cualquier orden): ZONA, MARCA, PRODUCTOR, CANTIDAD/CAJAS,
// FINCA, MAGAP/MAG/CÓDIGO, UBICACIÓN. Sin encabezado se usa el orden del cuadro real.
// Las celdas combinadas de Excel (zona, marca, MAGAP, ubicación) llegan vacías: se repite la de arriba.
// Solo arma filas de texto; el cruce con productores, fincas y bloques lo hace el diálogo y el backend valida.

// Mayúsculas, sin tildes, sin puntuación y con un solo espacio entre palabras
export const normalizar = (t) => String(t ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9Ñ ]/g, ' ').replace(/\s+/g, ' ').trim();

const ORDEN_SIN_ENCABEZADO = ['zona', 'marca', 'productor', 'cajas', 'finca', 'magap', 'ubicacion'];

const columnaDe = (titulo) => {
  const t = normalizar(titulo);
  if (t.startsWith('ZONA')) return 'zona';
  if (t.startsWith('MARCA')) return 'marca';
  if (t.startsWith('PRODUCTOR')) return 'productor';
  if (t.startsWith('CANTIDAD') || t.startsWith('CAJAS')) return 'cajas';
  if (t.includes('FINCA')) return 'finca';
  if (t.startsWith('MAG') || t.startsWith('CODIGO')) return 'magap';
  if (t.startsWith('UBICACION')) return 'ubicacion';
  return null;
};

const separar = (linea) => {
  if (linea.includes('\t')) return linea.split('\t');
  if (linea.includes(';')) return linea.split(';');
  return linea.split(/\s{2,}/);
};

// "1.100" / "1,100" / "1100" → 1100 (las cajas son enteras)
const cajasDe = (t) => {
  const limpio = String(t ?? '').replace(/[.,\s]/g, '');
  return /^\d+$/.test(limpio) ? Number(limpio) : null;
};

/** Texto pegado → [{ zona, marca, productor, cajas, finca, magap, ubicacion }] (sin encabezados ni totales). */
export function leerCuadro(texto) {
  const lineas = String(texto ?? '').split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '');
  let columnas = null;
  const arriba = {}; // última zona/marca/magap/ubicación vista (celdas combinadas)
  const filas = [];
  for (const linea of lineas) {
    const celdas = separar(linea).map((c) => c.trim());
    const titulos = celdas.map(columnaDe);
    if (titulos.includes('productor') && (titulos.includes('cajas') || titulos.includes('finca'))) {
      columnas = titulos; // encabezado (puede repetirse)
      continue;
    }
    const cols = columnas || ORDEN_SIN_ENCABEZADO;
    const fila = {};
    cols.forEach((c, i) => { if (c) fila[c] = celdas[i] ?? ''; });
    ['zona', 'marca', 'magap', 'ubicacion'].forEach((c) => {
      if (fila[c]) arriba[c] = fila[c]; else fila[c] = arriba[c] || '';
    });
    const cajas = cajasDe(fila.cajas);
    // Sin productor o sin cajas (total, título "CUADRO DE DESPACHO", fila vacía): se ignora
    if (!normalizar(fila.productor) || !cajas) continue;
    filas.push({ ...fila, productor: fila.productor.trim(), finca: (fila.finca || '').trim(), cajas });
  }
  return filas;
}

/** Busca un tercero por nombre: igual, o con todas las palabras del cuadro dentro del nombre (APELLIDOS NOMBRES). */
export function buscarPorNombre(lista, nombre) {
  const buscado = normalizar(nombre);
  if (!buscado) return null;
  const iguales = lista.filter((x) => normalizar(x.name) === buscado);
  if (iguales.length === 1) return iguales[0];
  const palabras = buscado.split(' ');
  const contienen = lista.filter((x) => {
    const suyas = normalizar(x.name).split(' ');
    return palabras.every((p) => suyas.includes(p));
  });
  return contienen.length === 1 ? contienen[0] : null;
}
