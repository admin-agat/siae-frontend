// Casillas de pantallas agrupadas por sección del menú (30/10/2026)
// Ubicación: src/components/common/SelectorPantallas.jsx
//
// Lo usan Perfiles (qué pantallas tiene el perfil) y Usuarios (excepciones de una persona).
// catalogo: [{ key, seccion, nombre }] · marcadas: [claves] · onAlternar(key)
// etiqueta(key): texto opcional junto a la pantalla (ej. "EXTRA", "QUITADA")
export default function SelectorPantallas({ catalogo, marcadas, onAlternar, etiqueta, deshabilitado = false }) {
  const secciones = [...new Set(catalogo.map((p) => p.seccion))];

  const alternarSeccion = (seccion) => {
    const claves = catalogo.filter((p) => p.seccion === seccion).map((p) => p.key);
    const todas = claves.every((k) => marcadas.includes(k));
    // Si están todas, se quitan todas; si falta alguna, se marcan las que faltan
    claves.filter((k) => marcadas.includes(k) === todas).forEach(onAlternar);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {secciones.map((seccion) => {
        const pantallas = catalogo.filter((p) => p.seccion === seccion);
        const cuantas = pantallas.filter((p) => marcadas.includes(p.key)).length;
        return (
          <div key={seccion} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">{seccion}</span>
              {!deshabilitado && (
                <button type="button" onClick={() => alternarSeccion(seccion)} className="text-[11px] font-semibold text-primario hover:underline">
                  {cuantas === pantallas.length ? 'Quitar todas' : 'Marcar todas'}
                </button>
              )}
            </div>
            <div className="space-y-1">
              {pantallas.map((p) => {
                const extra = etiqueta?.(p.key);
                return (
                  <label key={p.key} className={`flex items-center gap-2 text-sm ${deshabilitado ? 'text-gray-500' : 'text-gray-700 cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={marcadas.includes(p.key)}
                      onChange={() => onAlternar(p.key)}
                      disabled={deshabilitado}
                      className="accent-primario w-4 h-4"
                    />
                    <span className="flex-1">{p.nombre}</span>
                    {extra && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${extra.clase}`}>{extra.texto}</span>}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
