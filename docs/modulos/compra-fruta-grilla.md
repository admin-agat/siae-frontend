# Compra de fruta como grilla (tipo SAP) y alta rápida de vendedor

Diseño de `siae-architect`, 18/11/2026. **Estado: PROPUESTA, actualizada con dos rondas de respuestas de Peter (18/11/2026). Falta su aprobación final.**

Decisiones de Peter ya incorporadas:

| # | Decisión | Dónde |
|---|---|---|
| D1 | El alta rápida tiene 3 campos: TIPO (PRODUCTOR/COMERCIALIZADORA), NOMBRE (APELLIDOS NOMBRES) y CÉDULA/RUC. **Solo** la usan los comerciales (pantalla `compra_fruta`). | §B1, §B7 |
| D2 | Terceros → **Nuevo** tercero muestra solo NOMBRES, TIPO (hay que elegirlo), CÉDULA/RUC y ZONA. Los demás campos **no se quitan**: los completa después LIQUIDACIONES, con un permiso propio y sin la pantalla Terceros completa. | §B9 |
| D3 | Las cuentas bancarias las **ingresa LIQUIDACIONES** con un botón "+": al lado de cada vendedor en el listado y al final de la lista que sale al buscar el nombre. Luego solo las ve enmascaradas (`****1234`). Contabilidad y ADMIN las ven completas. El endpoint nunca devuelve el número completo a ese rol y la bitácora no lo guarda. | §B6 |
| D4' | **Se permite** un tercero **sin cédula ni RUC**, pero debe verse en **ROJO / PENDIENTE** en la grilla de compras, en Terceros y en Liquidaciones. **Cambia la regla D4 del 03/11/2026.** | §B3, §B10 |
| D5 | Pegar desde Excel queda **para una fase futura**. | §A6 |
| D6 | La grilla lleva una **primera columna con el número de fila** (1, 2, 3…). | §A3 |

Insumos de los otros agentes:
- **siae-datos** (`docs/datos/vendedores-alta-rapida-2026-11-18.md`):
  - primero "¿es alguno de estos?", con búsqueda por palabras sin importar el orden;
  - lo creado al vuelo queda con DATOS PENDIENTES;
  - no se paga sin cuenta bancaria.
- **siae-qa:** `store` ya valida cédula/RUC y duplicados exactos, y COMERCIAL recibe 403 en `POST /third-parties`.

El diseño tiene dos partes:
- **Parte A, la grilla.** Es solo de pantalla, cambio mediano. No toca la base ni el guardado.
- **Parte B, el alta rápida, la ficha y la cuenta del vendedor.** Es un **cambio grande**:
  - agrega columnas a `third_parties`, 1 pantalla nueva y varios endpoints;
  - toca permisos, la regla D4 y el pago sin cuenta.

Insumos revisados:
- `CLAUDE.md`, `DESARROLLO.md`: compra de fruta del 12/11 y del 13/11, envío a bodega, D4 cédula/RUC, control de versión y roles. También las memorias de terceros (APELLIDOS NOMBRES, un solo PRODUCTOR por persona) y de permisos por persona.
- Frontend: `PurchaseAllocationPage.jsx` (1.629 líneas), `SelectBuscable.jsx`, `CampoNumero.jsx`, `cuadroDespacho.js`, `ProducerContractsPage.jsx`, `api/customerOrders.js` y `api/liquidacionBase.js`.
- Backend: `PurchaseAllocationController` (`update`, `crearFinca`), `ThirdPartyController` (`store`, `errorIdentificacion`, `buscarDuplicado`, `sinIdentificacion`), `LiquidationSetupController` (`producers`, `saveRetention`), `AccountingController` (`bankAccounts`, `saveBankAccount`), `App\Support\IdentificacionEcuador`, los modelos `ThirdParty` y `ThirdPartyBankAccount`, `config/pantallas.php` y `Profile::TIPOS_BASE`.
- La base local `SIAE`, consultada solo con lecturas (`information_schema`, `pg_indexes`, `pg_constraint`, `pg_extension`):
  - `third_parties` no tiene índice único por identificación. Hoy hay **0** identificaciones repetidas.
  - No está instalada la extensión `pg_trgm`.
  - De 274 PRODUCTOR activos, **ninguno** tiene cédula. Las 130 COMERCIALIZADORA sí la tienen.

No se incluyen RUC, cédulas, cuentas ni montos reales.

---

## 0. Resumen para Peter (en simple)

**Grilla de compras.** Funciona como Excel o como la grilla de SAP:
- La primera columna es el **número de fila** (1, 2, 3…).
- Te mueves con **Tab, Enter y las flechas**.
- En vendedor, productor, finca, bodega y puerto **escribes y con Tab queda elegido**. La búsqueda es **por palabras en cualquier orden**: "MAYRA OBANDO" encuentra a "OBANDO RIERA MAYRA VANESSA".
- **Ctrl+D** copia la celda de arriba, Enter en la última fila crea otra compra y **Ctrl+S** guarda.
- Bono, transporte, notas, oficial propio, contrato, división y envío pasan a un **panel al costado** (F2 o ⋯).
- Una compra típica baja de **unos 10 clics a 0 o 1**.
- Pegar desde Excel queda para después.

**Alta rápida de vendedor** (solo comerciales):
- Si no aparece, el sistema muestra primero **"¿ES ALGUNO DE ESTOS?"**.
- Si no es ninguno, **"+ CREAR"** pide 3 datos: tipo, nombre y cédula/RUC.
- La cédula **puede quedar vacía**, pero el vendedor sale en **ROJO con "SIN CÉDULA"** hasta que alguien la complete.
- Todo lo creado al vuelo queda **DATOS PENDIENTES** para Liquidaciones.

**Terceros → Nuevo:** al crear solo pide NOMBRES, TIPO (sin valor por defecto), CÉDULA/RUC y ZONA. Teléfono, correo, dirección y contacto **siguen existiendo**. Los completa Liquidaciones con un permiso nuevo, **"Ficha de vendedores"**, que le deja editar solo esos datos de productores y comercializadoras, sin entrar a Terceros.

**Cuenta bancaria:**
- Liquidaciones la ingresa con **"+"**, al lado de cada vendedor de su listado o al final de la lista del buscador.
- Después solo ve `****1234`; Contabilidad y ADMIN la ven completa.
- **Sin cuenta, no se paga.**

> Hay que actualizar 2 reglas de `CLAUDE.md` y `DESARROLLO.md` (no las toca el arquitecto):
> - "Las cuentas bancarias solo las ven Contabilidad y ADMIN" pasa a decir "**las ven completas** solo Contabilidad y ADMIN; Liquidaciones las **ingresa** y las ve enmascaradas".
> - D4, "cédula/RUC obligatoria para PRODUCTOR y COMERCIALIZADORA nuevos", pasa a decir "**opcional**, y sin ella el tercero queda en ROJO / PENDIENTE".

**Reglas de negocio que toca:**
- **D4:** la cédula pasa a ser opcional y se marca en rojo.
- **Pagos:** no se paga sin cuenta bancaria.
- **Liquidación:** aviso de DATOS PENDIENTES o SIN CÉDULA. Queda abierto si sin cédula se puede liquidar (P3): la retención y la factura la necesitan.
- El resto **no cambia**:
  - la semana de compra;
  - el anticipo del 80 %;
  - la retención por tramos;
  - la nota de crédito;
  - el contrato por marca × presentación;
  - SPOT sin contrato;
  - el flete;
  - las órdenes de compra.

---

# PARTE A — Grilla editable

## A1. Proceso de negocio (cómo se usa)

1. **Abrir el bloque.** Comercial abre el bloque del barco y la marca. Arriba sigue lo mismo de hoy: meta, comprado, falta, P. OFICIAL del bloque y "Enviar bloque a bodega".
2. **Nueva compra.** Desde la última fila, Enter o ↓ crea una compra nueva, que copia lo mismo que copia hoy `compraVacia`: comerciales, corte, semana, entrega, bodega y oficial. También sirve el botón "+ Agregar compra".
3. **Escribir sin abrir listas.** En "Se le compra a", Comercial escribe "ASCUP" y aparece la coincidencia. **Tab** la confirma y pasa a Productor real; ahí "PEREZ JU" + Tab, y Finca, donde Tab confirma si hay una sola. Le siguen **Cajas** 1200 + Tab y **P. real** 6,50 + Enter.
4. **Copiar de arriba.** Si esta compra se parece a la anterior, **Ctrl+D** copia la celda de arriba (vendedor, bodega, precio…). Con **Ctrl+Shift+D** se duplica la fila entera: es el "Duplicar" de hoy.
5. **Lo poco usado en el panel.** Si hay bono, transporte reconocido, una nota o un oficial distinto, **F2** (o el botón ⋯) abre el **panel de la compra** a la derecha. El panel también tiene el detalle de contratos, el envío a bodega, Dividir y Quitar.
6. **Guardar.** **Ctrl+S** o el botón Guardar de la barra fija. Los errores salen como hoy en la barra, con "Ir a la fila", y la celda con error queda en rojo.
7. **Enviar a bodega.** Se usa el botón de la columna Bodega, el de "Enviar bloque" o, si Peter lo aprueba, la casilla **"Guardar y enviar a bodega"** (P2).

## A2. Qué existe hoy y qué se reutiliza

| Hoy | Qué pasa |
|---|---|
| Fila de tabla con 17 columnas y unas 20 paradas de Tab por fila (fecha en 3 partes, selector de semana, chips de comerciales con su ✕, botones CONTRATO/SPOT y 80/20, casillas de transporte y bono, notas, botones de bodega, duplicar, dividir y quitar) | Pasa a **11 columnas** con **9 celdas** en el orden de Tab. Lo demás se va al panel. |
| `SelectBuscable` se abre **al enfocar** y Tab **cierra sin elegir** | Recibe 3 props opcionales: `abrirAlEnfocar`, `tabElige` y `opcionCrear`. El comportamiento por defecto no cambia en el resto del sistema. |
| `enterBaja` solo en cajas, real y bono; en la última fila va al botón "Agregar compra" | Lo reemplaza la navegación de la grilla: Enter baja en **cualquier** columna y en la última fila crea otra. |
| `compraVacia`, `compraDuplicada`, `cambiarCompra`, `conContrato`, `conFinca` y `handleGuardar` (validaciones y payload) | **Se reutilizan tal cual.** La grilla solo cambia la forma de editar. El `PUT /customer-orders/{id}/purchases` y su `version` **no cambian**. |
| Popovers de oficial por fila (`editOfFila`), contratos (i) (`verContratosFila`) y bono ÷ cajas (`bonoTotal`) | Pasan al panel de la compra. |
| `cuadroDespacho.js` (`normalizar` y `buscarPorNombre`) | Se reutiliza para reconocer nombres al **pegar desde Excel** (fase futura). |
| `DividirCompraModal`, alta de finca (`createPurchaseFarm`), `ComercialesModal` y `DialogoConfirmacion` | Sin cambios. Se abren desde el panel o desde la grilla. |

## A3. Columnas de la grilla

En el orden de Tab (✎ = editable si la fila no está bloqueada):

| # | Columna | Tipo de celda | Editable cuando | Notas |
|---|---|---|---|---|
| 0 | **N°** (1, 2, 3…) | solo lectura, fija a la izquierda | — | **Pedido de Peter.** Es el número de la compra dentro del bloque, el mismo de los errores "BLOQUE 1, COMPRA 3". Se vuelve a numerar al quitar o duplicar. Al lado: el candado si hay `bloqueo`, un punto ámbar si hay cambios sin guardar y ⋯, que abre el panel. |
| 1 | Se le compra a * | lista ✎ (con **+ CREAR**) | `!bloqueo` | Grupos COMERCIALIZADORAS / PRODUCTORES como hoy. Insignia **roja SIN CÉDULA** o ámbar **DATOS PENDIENTES** (§B10). |
| 2 | Productor real (insignia roja SIN CÉDULA, §B10) | lista ✎ (con **+ CREAR**) | vendedor COMERCIALIZADORA y `!liquidada` | La opción POR DIVIDIR se mantiene. Con un PRODUCTOR muestra "COMPRA DIRECTA" y Tab la salta. |
| 3 | Finca | lista ✎ (con **+ NUEVA FINCA**) | `!liquidada`, con dueño y sin `pending_split` | Debajo, MAG x (como hoy). |
| 4 | Cajas * | número ✎ | `!liquidada` | |
| 5 | P. real | número ✎ | `!liquidada` | Debajo, OF. $ x si es distinto al del bloque. |
| 6 | Negociación | lista corta ✎ | `!liquidada` | Escribir C = CONTRATO, S = SPOT; Espacio alterna 100 % y 80/20. Con varios contratos, la lista de "$ precio · usadas/cupo" de hoy. PACKED queda fijo en SPOT. |
| 7 | Retira materiales en * | lista ✎ | `!bloqueo` | Se propone la última bodega del vendedor, como hoy. |
| 8 | Comerciales | lista múltiple ✎ | `!liquidada` | Escribir + Enter agrega y Retroceso quita el último. Se copia de arriba como hoy. |
| 9 | Corte · Semana · Entrega | fecha ✎ / lista ✎ / lista ✎ | corte y entrega con `!liquidada`; semana con `!bloqueo` | Tres sub-celdas de la misma columna, en el orden de Tab. La semana solo aparece si hay dos semanas de compra. |
| 10 | Total real · NC $ | solo lectura | — | Las dos cifras en una celda (arriba el total y abajo la NC). |
| 11 | Bodega | estado + botón | — | ✔ ENVIADA / CAMBIÓ / Enviar. **No** entra en el orden de Tab: se llega con el mouse o desde el panel. |

**Salen de la tabla y van al panel:**
- Transporte (casilla RECONOCER, $/caja y la X de DESCONTAR heredado).
- Bono / extra (casilla BONO, $/caja, ÷ CAJAS, motivo y detalle).
- Notas.
- Oficial propio de la compra.
- Detalle (i) de contratos y la PARTE x.y heredada (solo lectura).
- Traza de la división ("DE LA COMPRA #…").
- Botones Duplicar, Dividir, Quitar envío y Quitar compra.

**Para que no se olviden:** si la compra tiene bono o transporte, la celda `#` muestra una insignia **B** o **T**, y Total real ya los incluye. Así se ve sin abrir el panel.

> Ancho estimado: unos 1.700 px, frente a los unos 2.900 de hoy. A 1366 px se ven hasta "Retira materiales en" sin desplazarse; las columnas 0 y 1 quedan fijas a la izquierda, como hoy.

## A4. Teclado (la "regla de la hoja")

Cada celda tiene **dos estados**, como en Excel:
- **Seleccionada:** borde azul; muestra el texto.
- **En edición:** muestra el input.

| Tecla | Celda seleccionada | Celda en edición |
|---|---|---|
| Letra o número | Entra a editar **reemplazando** lo que había. En una lista, empieza a buscar con esa letra. | Escribe. |
| **F2** | Edita sin borrar (cursor al final). En la columna `#`, abre el panel. | — |
| **Enter** | Edita. | Confirma y **baja** a la misma columna. En la última fila **crea una compra nueva** (P1). |
| **Tab / Shift+Tab** | Pasa a la celda siguiente o a la anterior de la fila. Al final de la fila, la primera de la fila siguiente. | En una lista **elige la opción resaltada** y avanza. En un número, confirma y avanza. |
| **Flechas** | Mueven la selección. | ↑↓ recorren la lista abierta; ←→ mueven el cursor del texto. |
| **Esc** | Cierra el panel si está abierto. | Cancela la edición y devuelve el valor anterior. |
| **Supr** | Vacía la celda si es editable y no obligatoria con id (no borra el vendedor de una compra guardada). | — |
| **Ctrl+D** | Copia la celda de la fila de arriba. Con varias celdas seleccionadas hacia abajo, rellena todas. | — |
| **Ctrl+Shift+D** | Duplica la fila (`compraDuplicada`, igual que el botón de hoy). | — |
| **Ctrl+S** | Guarda (`handleGuardar`). | Confirma la celda y guarda. |
| **Ctrl+V** | (Pegar varias filas desde Excel: fase futura, §A6.) | Pega texto dentro de la celda. |
| **Ctrl+Z** | Deshace el último cambio de celda o el último pegado (un nivel por bloque). | Deshacer del input. |

**Reglas de las celdas de lista** (vendedor, productor, finca, bodega, puerto, comerciales):
- **No se abren al llegar con Tab.** Se abren al escribir, con Alt+↓ o con un clic.
- **Búsqueda por palabras en cualquier orden** (pedido de siae-datos). Lo escrito se parte en palabras y una opción coincide si **cada palabra** empieza alguna palabra de la opción. Ejemplos: "MAYRA OBANDO" encuentra "OBANDO RIERA MAYRA VANESSA" y "ASOPROR" encuentra "…ASOPRORITEROS". Hoy solo se busca el texto seguido (`includes`) y por eso no la encuentra.
- Las coincidencias se ordenan así: primero la exacta, luego la que **empieza** con lo escrito, luego la que tiene todas las palabras y al final la que **contiene** el texto. Se busca sin tildes, sin mayúsculas y sin puntos (S.A., ASOC.).
- **Tab o Enter eligen la resaltada** solo si hay texto escrito y al menos una coincidencia. Con una sola coincidencia se elige directo.
- Si no hay coincidencia, Tab **no avanza**: la celda queda en rojo con "SIN RESULTADOS". Así no se elige un vendedor equivocado por apuro.
- Al final de la lista de vendedor y de productor sale **"+ CREAR '<lo escrito>'"** (parte B), solo si el usuario puede crear.

**Bloqueos:** una celda que no se puede editar se puede seleccionar, pero no editar.
- Al escribir encima sale un aviso corto en la barra: "NO SE CAMBIA: CUPO LIQUIDADO / YA TIENE TARJAS / YA RETIRÓ MATERIALES" (el mismo texto de `bloqueo`).
- Tab **salta** las celdas que no aplican a esa fila (productor real en una compra directa y finca en POR DIVIDIR), para no gastar teclas.

**Fila fantasma.** Una fila nueva **sin vendedor y sin cajas** que solo tiene lo copiado de la anterior se **descarta al guardar** sin dar error. Hoy da "FALTA A QUIÉN SE LE COMPRA". Así no estorba la fila que se crea al bajar con Enter. Es un cambio de comportamiento; lo confirmas en P1.

**Cómo encaja con las reglas que ya existen:**

| Regla | En la grilla |
|---|---|
| Liquidada, tarjas o materiales retirados | Igual que hoy: mismas condiciones `fijo` / `liquidada` por celda. Ctrl+D, Supr y el pegado **no escriben** en esas celdas y avisan cuántas saltaron. |
| Sobre-pedido con aviso | Sin cambios: la meta, comprado y falta del encabezado y la barra fija siguen con el aviso ámbar. |
| Oficial por bloque | Sigue en el encabezado ("P. OFICIAL $ x ✎"). El oficial propio de una compra se edita en el panel. |
| Contrato propuesto al elegir vendedor (`conContrato`) | Sin cambios: corre en `cambiarCompra`, también con Ctrl+D y al pegar. |
| División de compra | En el panel ("Dividir compra"), con las mismas condiciones (sin LIQUIDADO y sin tarjas). |
| Enviar a bodega | En la columna Bodega y en el panel. Con cambios sin guardar sigue pidiendo guardar primero. |
| Control de versión (409) | Sin cambios: el guardado es el mismo `PUT` con `version`. |
| Aviso de salir sin guardar | Sin cambios (`useAvisoSalida`). Ctrl+S no choca con él. |

## A5. Clics: hoy contra la propuesta

Compra típica: vendedor COMERCIALIZADORA, productor real, finca (el productor tiene 2), cajas, precio real escrito a mano, comerciales, corte y bodega iguales a la fila anterior. Al final, guardar y enviar a bodega.

| Paso | Hoy (clics) | Grilla (clics) | Grilla (teclas aparte de lo escrito) |
|---|---|---|---|
| Nueva compra | 1 ("Agregar compra") | 0 | Enter en la última fila |
| Vendedor | 1 (elegir la opción con el mouse) | 0 | Tab |
| Productor real | 2 (abrir + elegir) | 0 | Tab |
| Finca | 2 | 0 | Tab |
| Cajas | 1 | 0 | Tab |
| P. real | 1 | 0 | Enter |
| Guardar | 1 | 0 | Ctrl+S |
| Enviar a bodega | 1 | 1 (o 0 con "Guardar y enviar", P2) | — |
| **Total** | **10** | **0 a 1** | unas 7 teclas |

- **Con variaciones** (otro comercial, otra bodega, otro corte y bono): hoy suman entre 6 y 10 clics más (de 16 a 20 en total, igual que en la revisión del 12/11). En la grilla son teclas: escribir + Tab en cada celda, y el bono con F2 → escribir → Tab → motivo → Esc. Dan **0 clics** y unas 6 teclas más.
- **Solo con teclado:** hoy una fila tiene unas **20 paradas de Tab**; la grilla tiene **9**.
- **Diez compras del mismo vendedor con cajas distintas:**
  - Hoy son unos 30 clics: Duplicar ×9, más clic en cajas, más escribir.
  - En la grilla: Ctrl+Shift+D, escribir las cajas y Enter, repetido 9 veces. **0 clics.** (En la fase futura, también pegando las 10 filas desde Excel.)

## A6. Pegar desde Excel (FASE FUTURA, decisión de Peter)

> Queda para después. Se deja el diseño para no perderlo; **no** entra en las fases 1 y 2.

- **Dónde:** con una celda **seleccionada** (no en edición), Ctrl+V lee el texto del portapapeles. Excel copia con tabuladores y saltos de línea.
- **Cómo se reparte:** cada columna pegada cae en la columna de la grilla **desde la celda seleccionada hacia la derecha**, en el orden de A3 (solo las celdas del orden de Tab). Si sobran filas, se crean compras nuevas con `compraVacia`.
- **Cómo reconoce los nombres:**
  - Las listas usan `normalizar` / `buscarPorNombre` de `cuadroDespacho.js`. Toma una coincidencia **exacta**, o **única** que empieza igual.
  - Si no la encuentra, la celda queda **en rojo** con el texto original ("NO RECONOCIDO: JUAN PERES") hasta que se elija a mano o se use + CREAR.
  - Los números usan la limpieza de `CampoNumero` (`1.234,50`).
- **Antes de aplicar:** si se pega más de una fila, sale un `DialogoConfirmacion` con este resumen: "SE PEGARÁN 12 COMPRAS (8 NUEVAS), 3 CELDAS SIN RECONOCER, 2 CELDAS BLOQUEADAS NO SE TOCAN". Con Aplicar o Cancelar. Ctrl+Z deshace el pegado entero.
- **Qué no hace:**
  - no crea vendedores ni fincas;
  - no envía a bodega;
  - no pega sobre las columnas de solo lectura;
  - no pega en filas bloqueadas.
- **Viabilidad:** alta. `navigator.clipboard` no hace falta, porque el evento `paste` trae el texto. Funciona en Chrome y Edge sin pedir permiso. Tiene un riesgo: el SEGUIMIENTO usa **nombres libres**, así que habrá bastantes celdas en rojo al principio. Eso es esperado.

## A7. Componente reutilizable `GrillaEditable.jsx`

**Sí conviene**: Tarjas, Pedido semanal, Distribución en barcos y Anticipos tienen el mismo problema. Pero se construye **con Compra de fruta como primer y único uso** en la fase 1. Se generaliza solo lo que se repite.

`src/components/common/GrillaEditable.jsx` (nuevo):

```jsx
<GrillaEditable
  filas={b.purchases}                 // arreglo; cada fila tiene _key
  columnas={COLUMNAS_COMPRA}          // [{ clave, titulo, ancho, fija, tipo: 'lista'|'numero'|'fecha'|'texto'|'solo_lectura'|'custom',
                                      //    opciones(fila), decimales, editable(fila) → true | 'MOTIVO', saltar(fila),
                                      //    render(fila), editor(fila, props) para 'custom', crear: { etiqueta, onCrear(texto, fila) } }]
  onCambiar={(fila, clave, valor) => cambiarCompra(b._key, fila._key, clave, valor)}
  onNuevaFila={() => agregarCompra(b._key)}          // Enter/↓ en la última fila
  onDuplicarFila={(fila) => duplicarCompra(b._key, fila)}
  onPegar={(celdas, desde) => …}                     // fase futura
  onAbrirPanel={(fila) => setPanel(fila._key)}       // F2 en # o botón ⋯
  onGuardar={handleGuardar}                          // Ctrl+S
  filaMarcada={filaMarcada}                          // error "Ir a la fila"
  celdaError={(fila, clave) => …}                    // celda en rojo
  aria-label={`Compras del bloque ${i + 1}`}
/>
```

- **Accesibilidad:** `role="grid"`, `aria-rowindex` y `aria-colindex`, *roving tabindex* (solo la celda activa tiene `tabIndex=0`). Al editar, el input recibe el foco, y los lectores de pantalla leen "Compra 3, Cajas".
- **Rendimiento:** cada fila va en `React.memo` y la edición vive en el estado local de la celda hasta confirmar. Hoy cada tecla repinta todo el bloque. Hasta unas 60 filas por bloque no necesita virtualizar.
- **Celdas de lista:** reutilizan `SelectBuscable` con las 3 props nuevas, así no hay un segundo buscador.
- **Teclas del navegador:** Ctrl+D (marcador), Ctrl+S (guardar página) y F2 se capturan **solo cuando el foco está dentro de la grilla** (`preventDefault`). Fuera de ella el navegador funciona normal.
- **Estándar de UI:**
  - inputs `bg-gray-100 rounded-2xl` en edición;
  - MAYÚSCULAS al escribir;
  - icono `Ban` para desactivar y `Trash2` solo para quitar una fila que no está guardada;
  - mensajes con `toastMessages.js`.

`src/components/PanelCompra.jsx` (nuevo; es de Compra de fruta, no va en `common`):
- Panel fijo a la derecha, de unos 380 px. **No** es un modal: la grilla sigue visible y el panel muestra la fila activa. Si se baja de fila con el panel abierto, el panel cambia de compra.
- **Secciones:**
  - **Pagos aparte:** Transporte y Bono / extra.
  - **Precio:** oficial propio y MAG vigente.
  - **Contrato:** detalle (i) y aviso.
  - **Notas.**
  - **Bodega:** enviar o quitar el envío, con fecha y quién.
  - **Historia:** dividida de, POR DIVIDIR y avisos.
  - **Acciones:** Duplicar, Dividir y Quitar compra.
- Reutiliza los mismos `cambiarCompra`, `enviarABodega`, `abrirDividir` y `quitarCompra`. Las validaciones no cambian.

## A8. Archivos de la parte A (solo frontend)

| Archivo | Cambio |
|---|---|
| `src/components/common/GrillaEditable.jsx` | **Nuevo** (§A7). |
| `src/components/PanelCompra.jsx` | **Nuevo**. Toma el JSX de transporte, bono, notas, oficial por fila, contratos (i), envío, dividir y quitar que hoy está en las líneas ~1265 a 1510 de la página. |
| `src/components/common/SelectBuscable.jsx` | Props opcionales: `abrirAlEnfocar` (por defecto `true`), `tabElige` (por defecto `false`) y `opcionCrear` (`{ etiqueta(texto), onCrear(texto) }`). Cambia la búsqueda a **por palabras en cualquier orden**, con el orden de §A4. Afecta a todos los selectores del sistema, pero solo encuentra más y ordena mejor. La prop `opcionCrear` puede ser una lista: la usan "+ CREAR" en Compra y "+ CUENTA BANCARIA" en Liquidaciones. El resto del sistema no cambia. |
| `src/pages/comercial/PurchaseAllocationPage.jsx` | La `<table>` de compras pasa a `<GrillaEditable>` con `COLUMNAS_COMPRA`. Se quitan `enterBaja`, `editOfFila`, `verContratosFila` y `bonoTotal` (pasan al panel). Se agregan el estado `panel` y el descarte de la fila fantasma en `handleGuardar`. Validaciones y payload **iguales**. El archivo debería bajar a unas 1.200 líneas. |
| `src/utils/pegarTabla.js` | **Nuevo, fase futura.** Lee el TSV del portapapeles y cruza listas con `cuadroDespacho.js`. |
| `DESARROLLO.md` | Entrada en la sección 7. |

Backend: **ninguno** en la parte A.

---

# PARTE B — Alta rápida de vendedor desde la fila

## B1. Proceso de negocio

1. **El vendedor no aparece.** Comercial escribe "MAYRA OBANDO" en "Se le compra a" o en "Productor real". Como la búsqueda es por palabras, si existe "OBANDO RIERA MAYRA VANESSA" ya sale en la lista y se elige con Tab.
2. **¿Es alguno de estos?** Si no hay coincidencia de palabras, la lista muestra **"¿ES ALGUNO DE ESTOS?"** con hasta 5 parecidos (§B4): el nombre, el tipo y la cédula enmascarada `######4567` o **SIN CÉDULA** en rojo. Abajo va **"+ CREAR 'MAYRA OBANDO'"**, y solo lo ve quien tiene `compra_fruta`.
3. **Formulario corto.** Se abre un recuadro (`ModalShell`) con 3 campos:
   - **Tipo:** PRODUCTOR o COMERCIALIZADORA, **sin valor por defecto**. En "Productor real" viene fijo en PRODUCTOR.
   - **Nombre:** APELLIDOS NOMBRES, en mayúsculas; viene con lo escrito y el aviso "ESCRIBE PRIMERO LOS APELLIDOS".
   - **Cédula / RUC:** **opcional**. Si se escribe, se revisa el dígito verificador. Si se deja vacía, sale el aviso rojo "QUEDARÁ PENDIENTE: SIN CÉDULA NI RUC".
4. **Revisión al guardar.** El backend vuelve a revisar:
   - **Misma cédula/RUC:** "YA ESTÁ REGISTRADA A NOMBRE DE …", con **Usar este**.
   - **Mismo nombre y tipo:** lo mismo, con **Usar este**.
   - **Un parecido nuevo** (otra persona lo creó en ese momento): se vuelve a mostrar "¿ES ALGUNO DE ESTOS?".
5. **Queda creado y elegido.** El tercero se crea activo, con **DATOS PENDIENTES** y régimen de retención NORMAL **sin confirmar**, y queda en la celda. Si no tiene fincas, el cursor pasa a Finca con **+ NUEVA FINCA**.
6. **Bitácora.** La creación queda en la bitácora (`Auditable`), con el origen COMPRA_FRUTA y quién lo creó.
7. **Liquidaciones completa.** En LIQUIDACIÓN → Retención de productores, el filtro **PENDIENTES (N)** le muestra los nuevos y los que no tienen cédula. Con el permiso **Ficha de vendedores** completa:
   - la cédula/RUC;
   - el teléfono, el correo, la dirección, el contacto y la zona.
   Además confirma el régimen e ingresa la **cuenta** con **"+"** (§B6). Con todo eso se marca **COMPLETO**.
8. **Mientras siga pendiente:**
   - se ve en **ROJO / PENDIENTE** en la grilla, en Terceros y en Liquidaciones (§B10);
   - la compra no se bloquea;
   - al liquidar sale un aviso (P3);
   - el **pago se bloquea sin cuenta bancaria**.

## B2. Qué existe y qué se reutiliza

| Existe | Uso |
|---|---|
| `POST /third-parties` (`ThirdPartyController::store`), con la pantalla `terceros,fincas` | **No se reutiliza para Comercial.** Acepta los 4 tipos (también PROVEEDOR y CLIENTE) y todos los campos; abrirla a `compra_fruta` dejaría a Comercial crear clientes y proveedores. Se hace un endpoint angosto, igual que la finca. |
| `POST /customer-orders/{id}/purchases/farms` (`crearFinca`), con la pantalla `compra_fruta` | **Es el modelo a seguir**: endpoint propio, campos mínimos, mayúsculas y duplicados. |
| `ThirdPartyController::errorIdentificacion` y `buscarDuplicado` | **Se mueven** a una clase compartida (`App\Support\AltaTercero`) para que Terceros y la compra apliquen **la misma regla**. Terceros no cambia su comportamiento. |
| `App\Support\IdentificacionEcuador` | Se reutiliza tal cual (cédula módulo 10; RUC de sociedad solo por estructura). Se copia la misma lógica al frontend para avisar al escribir; **el backend valida siempre**. |
| `ThirdParty` con `Auditable` | Ya registra la creación. Solo se agregan columnas. |
| `LiquidationSetupController::producers` / `saveRetention` y la pantalla `contratos_productores` | Es donde Liquidaciones ya edita el régimen y el nombre corto de pago. Se amplía para completar datos. |
| `AccountingController::bankAccounts` / `saveBankAccount` (`cuentas_bancarias`, cuenta cifrada) | Se reutiliza la validación; Liquidaciones ingresa por un endpoint propio (§B6). |

## B3. Endpoint nuevo

`POST /customer-orders/{id}/purchases/third-parties`: middleware `pantalla:compra_fruta` y `throttle:20,1` (frena la creación masiva).

Entrada:
```json
{ "type": "PRODUCTOR|COMERCIALIZADORA", "name": "APELLIDOS NOMBRES", "identification": "##########", "confirmar_parecidos": false, "como": "VENDEDOR|PRODUCTOR_REAL" }
```

**Validación del backend:**

| Regla | Mensaje |
|---|---|
| `type` `in:PRODUCTOR,COMERCIALIZADORA` (y PRODUCTOR si `como = PRODUCTOR_REAL`) | `ELIGE SI ES PRODUCTOR O COMERCIALIZADORA.` / `EL PRODUCTOR REAL DEBE SER DE TIPO PRODUCTOR.` |
| `name` obligatorio, de 5 a 255 caracteres, mayúsculas, sin espacios dobles, solo letras, espacios y `. & -` | `ESCRIBE EL NOMBRE COMPLETO: APELLIDOS Y NOMBRES (EJ. PEREZ LOPEZ JUAN CARLOS).` |
| Persona natural (cédula, o RUC con tercer dígito < 6) o sin identificación: **al menos 2 palabras** | El mismo mensaje. |
| `identification` **opcional** (decisión D4'). Si viene, se valida con `IdentificacionEcuador::error()` | `CÉDULA O RUC NO VÁLIDO: EL DÍGITO VERIFICADOR DE LA CÉDULA NO COINCIDE: REVISA EL NÚMERO.` Si no viene, se crea igual y sale en rojo (§B10). |
| **Misma identificación** en cualquier tercero (activo o no). Busca también la cédula dentro de un RUC: los 10 primeros dígitos de un RUC de persona natural | 422 con `existente: { id, name, type, status }`: `LA CÉDULA O RUC YA ESTÁ REGISTRADA A NOMBRE DE {NOMBRE} ({TIPO}).` Si está inactivo: `… ESTÁ DESACTIVADO: PÍDELE AL ADMIN QUE LO REACTIVE.` (P5) |
| **Mismo nombre y tipo**, exacto | 422 con `existente`: `YA EXISTE UN {TIPO} CON EL NOMBRE {NOMBRE}.` |
| **Nombre parecido** (§B4) sin `confirmar_parecidos` | **409** `{ codigo: "PARECIDOS", parecidos: [{ id, name, type, status, identificacion: "######4567" }] }` (hasta 5) |

Respuesta 201:
```json
{ "id": 0, "name": "…", "type": "…", "status": true, "pending_data": true, "identification": "…" }
```
La página lo agrega a `vendedores` y lo pone en la celda, sin recargar la semana.
- **Carrera:** el alta va en `DB::transaction`. El índice único por identificación (§B5) impide que dos personas creen la misma cédula a la vez; si choca, responde el mismo 422 de "ya registrada".
- **Control de versión:** crear un tercero **no cambia** la `version` de la semana (la huella es de las compras), igual que `crearFinca`.

## B4. Nombres parecidos (sin extensiones de PostgreSQL)

Según siae-datos, del Excel desde la WK37:
- de 115 vendedores, solo 35 coinciden exacto;
- 26 son la misma persona escrita corta;
- las asociaciones aparecen con 3 a 6 grafías.

Como la cédula puede quedar vacía, **el control real es el nombre**.

`pg_trgm` no está instalada, y no conviene depender de una extensión en producción. Con unos 420 vendedores la comparación se hace en PHP en milisegundos (`App\Support\AltaTercero::parecidos()`).

1. **Normalizar.** Sin tildes, mayúsculas, sin puntuación. Quita las palabras vacías (DE, DEL, LA, LOS, LAS, Y, SA, S.A., CIA, LTDA, ASOCIACION, ASO) **solo para comparar**.
2. **Comparar** contra PRODUCTOR y COMERCIALIZADORA, activos e inactivos (los inactivos salen marcados). Es parecido si cumple alguna de estas:
   - **(a)** todas las palabras del nombre más corto están en el otro y comparten al menos 2. Ejemplo: "PEREZ JUAN" frente a "PEREZ LOPEZ JUAN CARLOS". Este es el caso típico de un nombre corto sin RUC frente al completo con RUC.
   - **(b)** las mismas palabras en otro orden ("JUAN PEREZ" frente a "PEREZ JUAN").
   - **(c)** una distancia Levenshtein de 2 o menos sobre el texto normalizado, si tiene 8 caracteres o más. Detecta errores de tipeo: PERES frente a PEREZ.
3. **Siglas de asociaciones:** si una palabra de 6 letras o más del nombre nuevo (ASOPRORITEROS) aparece dentro de un nombre existente, cuenta como parecido.
4. **Ordenar** por cuántas palabras comparten y devolver los 5 primeros.
5. **Dónde se usa:**
   - en la lista de la celda, al no haber coincidencia, con `GET /customer-orders/{id}/purchases/third-parties/similar?q=` (pantalla `compra_fruta`);
   - otra vez en el `POST`;
   - en Terceros → Nuevo (§B9).

**Antes de abrir el alta:** se unen los 3 pares de PRODUCTOR repetidos que encontró siae-datos (ids 158/159, 239/370 y 377/378), con un script con simulación.

## B5. Base de datos

`third_parties`: columnas nuevas.

- **SIN CÉDULA no es una columna:** sale de `identification IS NULL`.
- Para que las bodegas, a las que hoy se les manda la cédula vacía (`sinIdentificacion`), no vean un falso "SIN CÉDULA", el backend agrega el atributo calculado **`sin_identificacion`** (booleano) en `/third-parties` y en `producer-contracts`. Se calcula antes de vaciar la cédula.

| Columna | Tipo | Para qué |
|---|---|---|
| `pending_data` | boolean NOT NULL default `false` | **DATOS PENDIENTES**: lo pone el alta rápida y lo quita Liquidaciones (o ADMIN). Los terceros que ya existen quedan en `false`, sin cambio. |
| `created_from` | varchar(20) NULL, CHECK `IN ('COMPRA_FRUTA')` | Origen del alta. NULL = Terceros o carga. Se puede ampliar el CHECK más adelante. |
| `created_by` | FK `users` NULL, ON DELETE SET NULL | Quién lo creó, para listarlo en "POR COMPLETAR" sin leer la bitácora. |
| `completed_at` | timestamp NULL | Cuándo se marcó completo. |
| `completed_by` | FK `users` NULL, ON DELETE SET NULL | Quién lo marcó. |

- **CHECK** `tp_pending_type_check`: `NOT pending_data OR type IN ('PRODUCTOR','COMERCIALIZADORA')`.
- **Índice parcial** `tp_pending_idx`: `(type) WHERE pending_data`, para la bandeja POR COMPLETAR.
- **Índice único parcial** `tp_identification_unique`: `UPPER(TRIM(identification)) WHERE identification IS NOT NULL AND TRIM(identification) <> ''`. Hoy la duplicidad solo la frena el código; el índice la frena también entre dos personas a la vez.
  - En local hay **0** duplicados.
  - **En producción hay que revisarlo antes** con una consulta de solo lectura (siae-datos). Si hay duplicados, la migración se detiene con un mensaje claro y no deja nada a medias.

### Migración propuesta: `database/migrations/2026_11_18_000001_terceros_alta_rapida.php`

```php
<?php

// 18/11/2026: alta rápida de vendedor desde Compra de fruta (docs/modulos/compra-fruta-grilla.md, parte B).
// - pending_data: DATOS PENDIENTES (lo crea Comercial con 3 datos; Liquidaciones confirma régimen y completa).
// - created_from / created_by / completed_at / completed_by: origen y quién completó (además de la bitácora).
// - Índice único por identificación: hoy solo lo frena el código (ThirdPartyController::buscarDuplicado);
//   con el alta desde la compra pueden crear dos personas a la vez la misma cédula.
// No cambia datos: los terceros que ya existen quedan con pending_data = false.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Antes del índice único: si hay identificaciones repetidas, se detiene sin tocar nada
        // (se revisan y fusionan primero con siae-datos, como la limpieza de terceros del 10/11/2026).
        $repetidas = DB::selectOne("
            SELECT COUNT(*) AS n FROM (
                SELECT UPPER(TRIM(identification)) FROM third_parties
                WHERE identification IS NOT NULL AND TRIM(identification) <> ''
                GROUP BY 1 HAVING COUNT(*) > 1
            ) x
        ")->n;
        if ($repetidas > 0) {
            throw new RuntimeException("HAY {$repetidas} CÉDULAS/RUC REPETIDAS EN TERCEROS: FUSIÓNALAS ANTES DE ESTA MIGRACIÓN.");
        }

        Schema::table('third_parties', function (Blueprint $table) {
            $table->boolean('pending_data')->default(false);
            $table->string('created_from', 20)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
        });

        DB::statement("ALTER TABLE third_parties ADD CONSTRAINT tp_created_from_check
            CHECK (created_from IS NULL OR created_from IN ('COMPRA_FRUTA'))");
        // Solo los vendedores pueden quedar con datos pendientes
        DB::statement("ALTER TABLE third_parties ADD CONSTRAINT tp_pending_type_check
            CHECK (NOT pending_data OR type IN ('PRODUCTOR','COMERCIALIZADORA'))");

        // Bandeja POR COMPLETAR de Liquidaciones
        DB::statement('CREATE INDEX tp_pending_idx ON third_parties (type) WHERE pending_data');
        // Una cédula/RUC, un tercero (misma comparación que buscarDuplicado: sin mayúsculas ni espacios)
        DB::statement("CREATE UNIQUE INDEX tp_identification_unique ON third_parties (UPPER(TRIM(identification)))
            WHERE identification IS NOT NULL AND TRIM(identification) <> ''");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS tp_identification_unique');
        DB::statement('DROP INDEX IF EXISTS tp_pending_idx');
        DB::statement('ALTER TABLE third_parties DROP CONSTRAINT IF EXISTS tp_pending_type_check');
        DB::statement('ALTER TABLE third_parties DROP CONSTRAINT IF EXISTS tp_created_from_check');

        Schema::table('third_parties', function (Blueprint $table) {
            $table->dropConstrainedForeignId('completed_by');
            $table->dropColumn('completed_at');
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn(['created_from', 'pending_data']);
        });
    }
};
```

**Modelo `App\Models\ThirdParty`:**
- `$fillable`: agregar `'pending_data', 'created_from', 'created_by', 'completed_at', 'completed_by'`.
- `$casts`: agregar `'pending_data' => 'boolean'` y `'completed_at' => 'datetime'`.
- Constante `public const ORIGENES = ['COMPRA_FRUTA'];`.
- Ya tiene `Auditable`; no hacen falta tablas nuevas, así que no hay modelos nuevos.

**Solo si Peter pide la validación de Contabilidad (P10)**, se agrega en **otra migración** (no se adelanta):
- `third_party_bank_accounts.verified_at` (timestamp NULL);
- `verified_by` (FK `users` NULL);
- `registered_by` (FK `users` NULL).

Las cuentas de hoy quedarían **validadas** con su `updated_at`, para no frenar los pagos.

## B6. Cuentas bancarias que ingresa Liquidaciones (decisión D3)

**La decisión.** Liquidaciones ingresa la cuenta **completa** y después solo la ve **enmascarada** (`****1234`). Contabilidad y ADMIN la siguen viendo completa en `cuentas_bancarias`, como hoy.

**Dónde está el botón "+"** (los dos lugares que pidió Peter):
1. **Al lado de cada vendedor en el listado** de LIQUIDACIÓN → Retención de productores (`ProducerContractsPage`, modo `retencion`). La columna **CUENTA** muestra:
   - **"+"**, en rojo, si no tiene cuenta;
   - "PICHINCHA · AHORROS · ****1234" si tiene.
   El mismo "+" va junto al aviso "SIN CUENTA BANCARIA" de **Liquidar** y del **Detalle de la liquidación**.
2. **Al final de la lista desplegable del buscador.** En el buscador de vendedor de esas pantallas (`SelectBuscable` con `opcionCrear`), al escribir un nombre la última opción es **"+ CUENTA BANCARIA DE <vendedor resaltado>"**. Si hay varios, la de la opción marcada. Abre el mismo recuadro sin salir de la búsqueda.

Es un recuadro único: `src/components/CuentaBancariaVendedorModal.jsx` (nuevo).
- **Campos:** banco (`/banks`), AHORROS/CORRIENTE, número, titular (C/R/P, identificación y nombre) y correo. Son las mismas reglas de `saveBankAccount`.
- Si ya tiene cuenta, muestra solo `****1234`, el banco, el tipo y el titular con la cédula enmascarada, más "PARA CAMBIARLA, PÍDELO A CONTABILIDAD" (P9).

**Endpoints nuevos.** Nunca devuelven el número completo:

| Método y ruta | Pantalla | Qué hace |
|---|---|---|
| `GET /producer-bank-accounts/{thirdPartyId}` | `contratos_productores,liquidar` | `{ tiene_cuenta, banco, account_type, numero: "****1234", holder_name, holder_id: "######4567", registrada_por, registrada_el }`. Solo para PRODUCTOR/COMERCIALIZADORA. |
| `POST /producer-bank-accounts/{thirdPartyId}` | `contratos_productores,liquidar` | **Crea** la cuenta si no existe. Si ya hay una, responde 422: `ESTE VENDEDOR YA TIENE CUENTA BANCARIA: EL CAMBIO LO HACE CONTABILIDAD.` (P9). Responde igual que el GET. |
| `GET /producer-contracts` (existe) | `contratos_productores,contratos_legal` | Agrega por vendedor `cuenta: { tiene, ultimos4, banco }` para pintar la columna sin pedir cada una. |

- **La lógica vive en un solo lugar:** se extrae de `AccountingController::saveBankAccount` a `App\Support\CuentaBancaria` (`validar`, `guardar`, `enmascarada`).
- **El número completo nunca sale por estas rutas:** la respuesta se arma a mano y una prueba busca el número en el JSON.
- **Bitácora sin el número completo:**
  - `account_number` ya se guarda en la bitácora como `****1234` (`Auditable::$auditarEnmascarar`);
  - se agrega **`holder_id`**, la cédula del titular, que hoy se guardaría completa;
  - `updated_by` registra quién la ingresó.
- **Contabilidad** (`/bank-accounts`) amplía la lista a PRODUCTOR y COMERCIALIZADORA y sigue viendo y corrigiendo la cuenta completa.
- **Opcional (P10): validación de Contabilidad** antes del primer pago, con `verified_at` y `verified_by` en otra migración.

## B7. Permisos

**Pantalla nueva** en `config/pantallas.php`:
```php
// 18/11/2026: Liquidaciones completa la ficha de productores y comercializadoras (cédula si falta, teléfono,
// correo, dirección, contacto, zona) sin tener la pantalla Terceros (que es del ADMIN y abarca clientes y proveedores)
'ficha_vendedores' => ['seccion' => 'LIQUIDACIÓN', 'nombre' => 'Ficha de vendedores (completar datos)', 'roles' => ['LIQUIDACIONES']],
```
No es un ítem de menú: es un permiso que habilita el botón **"Editar ficha"** dentro de Retención de productores, como `ver_costos`. Va en `menu.js` solo como clave de permiso.

| Acción | Pantalla | Tipos base que la traen | Qué valida el backend |
|---|---|---|---|
| Buscar parecidos y crear vendedor o productor real al vuelo | `compra_fruta` (existe) | COMERCIAL (+ ADMIN). **Solo comerciales.** | `pantalla:compra_fruta`, `throttle:20,1`; tipo PRODUCTOR/COMERCIALIZADORA; cédula opcional, pero válida si viene; duplicados y parecidos. `POST /third-parties` sigue siendo solo de `terceros` (COMERCIAL recibe 403). |
| Completar la ficha del vendedor | **`ficha_vendedores` (nueva)** | LIQUIDACIONES (+ ADMIN) | `PUT /producer-profiles/{id}`: **solo** PRODUCTOR/COMERCIALIZADORA. Edita `identification` (solo si está vacía: la que existe no se cambia, igual que D4), `phone`, `email`, `address`, `contact_name` y `zone`. **No** cambia nombre, tipo ni estado; eso es de ADMIN en Terceros (P5). Mayúsculas y validaciones de `store` (`AltaTercero`). Bitácora por `Auditable`. |
| Confirmar el régimen y marcar COMPLETO | `contratos_productores` (existe) | LIQUIDACIONES | `saveRetention` + `marcar_completo`: exige el régimen elegido y la cuenta registrada; la cédula, según P3. |
| Ingresar la cuenta bancaria ("+") | `contratos_productores` o `liquidar` | LIQUIDACIONES | Solo crea; nunca devuelve el número completo; bitácora enmascarada. |
| Ver, corregir o validar la cuenta completa | `cuentas_bancarias` (existe) | CONTABILIDAD (+ ADMIN) | Igual que hoy. |
| Crear o editar terceros | `terceros` (existe) | ADMIN | Formulario corto al crear (§B9); editar con todos los campos, como hoy. |

- `Profile::TIPOS_BASE` no cambia.
- **Pago sin cuenta bancaria = bloqueado:** registrar un pago de una LQ cuyo vendedor no tiene cuenta responde 422, `EL VENDEDOR NO TIENE CUENTA BANCARIA: LIQUIDACIONES DEBE REGISTRARLA ANTES DE PAGAR.`. En la fase 1 de pagos, la cuota no pasa a lote ni a TXT. ¿Hay excepción para efectivo o cruce? (P11).
- **Liquidar:** el preview de `SettlementController` devuelve en `avisos` "EL VENDEDOR TIENE DATOS PENDIENTES…" y "EL VENDEDOR NO TIENE CÉDULA NI RUC…". Bloquear o solo avisar sin cédula es la P3.

## B8. Archivos de la parte B

**Backend** (`C:\Users\AGAT-ECU-ADM\siae-backend`):

| Archivo | Cambio |
|---|---|
| `database/migrations/2026_11_18_000001_terceros_alta_rapida.php` | **Nueva** (§B5). |
| `app/Models/ThirdParty.php` | `$fillable`, `$casts` y `ORIGENES`. |
| `app/Support/AltaTercero.php` | **Nuevo**. Tiene `normalizarNombre()`, `errorIdentificacion()` y `buscarDuplicado()` (movidos de ThirdPartyController sin cambiar el comportamiento), `parecidos()` (§B4) y `enmascarar()`. |
| `app/Http/Controllers/Api/ThirdPartyController.php` | Usa `AltaTercero`, sin cambio funcional. `update` acepta quitar `pending_data` (ADMIN). |
| `app/Http/Controllers/Api/PurchaseAllocationController.php` | Método nuevo `crearTercero()` (§B3), junto a `crearFinca`. |
| `routes/api.php` | `Route::post('/{id}/purchases/third-parties', …)->middleware(['pantalla:compra_fruta', 'throttle:20,1'])`. |
| `app/Http/Controllers/Api/LiquidationSetupController.php` | `producers()` agrega `pending_data`, `created_from`, `created_at`, `phone`, `zone`, `address` y `email`, y el creador. `saveRetention()` amplía los datos y `marcar_completo`. |
| `app/Http/Controllers/Api/SettlementController.php` | El aviso DATOS PENDIENTES en `avisos` del preview. |
| `config/pantallas.php` | Clave `ficha_vendedores`. |
| `app/Http/Controllers/Api/ProducerProfileController.php` | **Nuevo**. `update` de la ficha (§B7), con `pantalla:ficha_vendedores`. |
| `app/Support/CuentaBancaria.php` | **Nuevo**. `validar()`, `guardar()` y `enmascarada()`, extraídos de `AccountingController::saveBankAccount`. |
| `app/Http/Controllers/Api/ProducerBankAccountController.php` | **Nuevo**. `show` y `store` (§B6), con respuesta armada a mano. |
| `app/Http/Controllers/Api/AccountingController.php` | Usa `CuentaBancaria`. `bankAccounts()` agrega PRODUCTOR y COMERCIALIZADORA. |
| `app/Models/Concerns/Auditable.php` | `$auditarEnmascarar` agrega `holder_id`. |
| `app/Http/Controllers/Api/ThirdPartyController.php` (más) | `errorIdentificacion` deja la cédula **opcional** (D4'): si viene se valida igual, y la que ya existe no se borra. Agrega el atributo `sin_identificacion` (§B5). Mensaje `ELIGE EL TIPO DE TERCERO.` |
| `routes/api.php` (más) | `PUT /producer-profiles/{id}` (`pantalla:ficha_vendedores`), `GET`/`POST /producer-bank-accounts/{thirdPartyId}` (`pantalla:contratos_productores,liquidar`) y `GET /customer-orders/{id}/purchases/third-parties/similar` (`pantalla:compra_fruta`). |
| `tests/Feature/CuentaBancariaLiquidacionesTest.php` | **Nuevo** (siae-qa): crear → 201 enmascarado; el número no aparece en el JSON; segunda vez → 422; PROVEEDOR → 422; sin pantalla → 403; bitácora con `****` y sin `holder_id` completo; Contabilidad la ve completa; pago sin cuenta → 422. |
| `tests/Feature/FichaVendedoresTest.php` | **Nuevo**: con `ficha_vendedores` edita teléfono y cédula vacía; no puede cambiar nombre, tipo ni una cédula existente; PROVEEDOR/CLIENTE → 404; sin la pantalla → 403. |
| `tests/Feature/CompraAltaRapidaTerceroTest.php` | **Nuevo** (siae-qa): crear OK, cédula mala, RUC con tercer dígito 7, cédula repetida (también dentro de un RUC), mismo nombre, parecido → 409 y luego confirmar → 201, `PRODUCTOR_REAL` con COMERCIALIZADORA → 422, sin pantalla → 403, `throttle`, bitácora, `version` igual, completar en Liquidaciones y aviso en el preview. |

**Frontend:**

| Archivo | Cambio |
|---|---|
| `src/components/AltaRapidaTerceroModal.jsx` | **Nuevo**. Usa `ModalShell`, los 3 campos, la validación en vivo, la lista de parecidos con "Usar este" o "No, es otra persona: crear" y los botones Guardar verde y Cancelar rojo. |
| `src/utils/identificacionEcuador.js` | **Nuevo**. Es la misma regla que `IdentificacionEcuador.php` y solo sirve para avisar al escribir. |
| `src/api/customerOrders.js` | `createPurchaseThirdParty(id, data)`. |
| `src/pages/comercial/PurchaseAllocationPage.jsx` | `opcionCrear` en las columnas vendedor y productor real; agrega el creado a `vendedores` y lo elige; insignia DATOS PENDIENTES. |
| `src/pages/liquidacion/ProducerContractsPage.jsx` (modo `retencion`) | Filtro **POR COMPLETAR (N)**, datos de contacto, "Marcar como completo" y "Creado por X desde Compra de fruta". |
| `src/api/liquidacionBase.js` | `guardarRetencionProductor` envía `marcar_completo`; `guardarFichaVendedor`, `getCuentaVendedor` y `crearCuentaVendedor`. |
| `src/components/FichaVendedorModal.jsx` | **Nuevo**. Cédula/RUC (si falta), teléfono, correo, dirección, contacto y zona. Nombre y tipo de solo lectura. |
| `src/components/CuentaBancariaVendedorModal.jsx` | **Nuevo** (§B6). |
| `src/pages/liquidacion/SettlementFormPage.jsx` y `SettlementDetailPage.jsx` | "+" junto a SIN CUENTA BANCARIA; insignias SIN CÉDULA y PENDIENTE. |
| `src/components/ThirdPartyModal.jsx` | Formulario corto al crear (§B9). |
| `src/pages/configuracion/` (lista de Terceros) | Columna **PENDIENTE** en rojo y filtro "SOLO PENDIENTES" (§B10). Verificar el nombre exacto del archivo con Glob. |
| `src/routes/menu.js` | Clave de permiso `ficha_vendedores`. |

## B9. Terceros → Nuevo tercero: formulario corto (decisión D2)

Hoy `ThirdPartyModal.jsx` trae el tipo en PRODUCTOR por defecto y muestra teléfono, correo y dirección al crear.

**Al crear** (PRODUCTOR, COMERCIALIZADORA o PROVEEDOR) muestra **solo** estos campos:

| Campo | Regla |
|---|---|
| NOMBRES * | "APELLIDOS Y NOMBRES (EJ. PEREZ LOPEZ JUAN CARLOS)"; en mayúsculas. |
| TIPO * | **Sin valor por defecto**: "ELIGE EL TIPO". El backend responde `ELIGE EL TIPO DE TERCERO.` |
| CÉDULA / RUC | Opcional (D4'). Si viene, se valida en vivo y en el backend. Si queda vacía, el aviso rojo "QUEDARÁ PENDIENTE". |
| ZONA | Opcional. |

Lo demás:
- Al crear, el formulario busca **parecidos** (§B4) y muestra "¿ES ALGUNO DE ESTOS?".
- **Al editar** se ven **todos** los campos de hoy: teléfono, correo, dirección y contacto **no se quitan**.
- Esos datos los completa **Liquidaciones** desde su pantalla, con **Ficha de vendedores** (§B7), o ADMIN en Terceros.
- **CLIENTE (extranjero)** sigue pidiendo país y marcas al crear, porque `store` los necesita (P12).
- No se borran columnas ni datos.

## B10. "PENDIENTE" y "SIN CÉDULA" a la vista (decisión D4')

Hay **dos marcas**, que se calculan solas:

| Marca | Cuándo | Color |
|---|---|---|
| **SIN CÉDULA** | `identification` vacía (`sin_identificacion = true`) | **Rojo** (texto rojo + insignia `bg-red-100 text-red-700`) |
| **PENDIENTE** | `pending_data = true` (creado al vuelo y sin marcar COMPLETO), o sin cuenta bancaria (solo en Liquidaciones) | Ámbar |

Dónde se ven:
- **Grilla de compras:** insignia junto al nombre en "Se le compra a" y en "Productor real". En la lista desplegable el nombre va en rojo con "· SIN CÉDULA". **No bloquea** la compra.
- **Terceros** (ADMIN): columna **PENDIENTE** (SIN CÉDULA / DATOS PENDIENTES / —) y el filtro "SOLO PENDIENTES".
- **Liquidaciones** (Retención de productores, Liquidar y Detalle): columna **PENDIENTE** con lo que falta (CÉDULA · RÉGIMEN · CUENTA), el filtro "PENDIENTES (N)" y los botones **Editar ficha** y **"+"** al lado.

Hoy los 274 PRODUCTOR están sin cédula, así que al subir **todos** saldrán en rojo. Es lo esperado: es la lista de trabajo. Pero conviene que Liquidaciones empiece por los **vendedores** que liquida y no por los productores reales de trazabilidad (P7).

---

## C. Impacto en datos existentes

- **Parte A:** ninguno. Mismo endpoint y mismo payload.
- **Parte B:**
  - La migración **no cambia datos**: todos los terceros quedan `pending_data = false`.
  - **Antes de subir:** la revisión de solo lectura en producción (siae-datos), "¿hay cédulas/RUC repetidas?". Si hay, se fusionan primero con el procedimiento de siempre (script con `CARGA_BD` y `CARGA_SIMULAR=1`, mover fincas y desactivar). Luego respaldo y migración.
  - **Opcional, a decidir (P7):** marcar como DATOS PENDIENTES a los vendedores que hoy tienen **compras** y no tienen cédula ni régimen revisado. Sería un script con simulación. No se recomienda sin que Liquidaciones lo pida, porque llenaría la bandeja de golpe: los 274 productores no tienen cédula.
  - **Antes de abrir el alta:** unir los 3 pares de PRODUCTOR repetidos (§B4) con un script de siae-datos (simulación → respaldo → real).
  - **Cuentas:** no se migran. En local no hay ninguna de vendedores; confirmar en producción con una lectura.
  - **SIN CÉDULA:** no necesita datos; sale de `identification IS NULL`.
- **Al subir la grilla**, quien tenga abierta Compra de fruta debe recargar. El aviso de versión nueva ya lo pide.

## D. Riesgos

| Riesgo | Mitigación |
|---|---|
| Con Tab se elige un vendedor equivocado por escribir rápido, y afecta el pago, la NC y el contrato. | Orden "empieza con" primero; con 0 coincidencias Tab no avanza; el nombre elegido se ve completo enseguida; el contrato propuesto avisa como hoy. |
| Se crean vendedores ficticios o duplicados desde la compra (fraude o descuido). | Solo los comerciales crean; búsqueda por palabras y "¿es alguno de estos?" primero; `throttle`; bitácora; marca roja SIN CÉDULA; bandeja de Liquidaciones; y **ningún pago sin cuenta bancaria**. |
| Régimen de retención mal puesto en un vendedor nuevo (por defecto NORMAL). | Aviso en Liquidar (P8). Liquidaciones lo confirma antes. |
| Atajos del navegador (Ctrl+D marcador, Ctrl+S guardar la página). | Se capturan solo con el foco en la grilla; si no, se comportan normal. |
| Un componente genérico grande y difícil de mantener. | Se arma solo para Compra de fruta en la fase 1 y se extiende cuando haya un segundo uso real. |
| El índice único falla en producción por duplicados viejos. | Revisión previa y la migración se detiene con un mensaje claro, sin dejar nada a medias. |
| La regla D4 se relaja (decisión de Peter) y se pueden crear duplicados sin cédula. | Parecidos por palabras, marca roja y la bandeja de Liquidaciones. El índice único sigue protegiendo a los que sí tienen cédula. |
| Liquidaciones ingresa una cuenta falsa (separación de funciones). | Solo puede **crear**, no cambiar; bitácora con quién; Contabilidad la ve completa; validación opcional (P10). |
| El número completo se escapa por la API o por la bitácora. | Respuesta armada a mano, prueba que lo busca en el JSON, y `holder_id` enmascarado. |

## E. Fases propuestas

| Fase | Qué entra | Tipo | Migración |
|---|---|---|---|
| **1. Grilla** | `GrillaEditable` con la columna N°, `PanelCompra`, `SelectBuscable` (búsqueda por palabras y props nuevas), teclado (Tab/Enter/flechas/F2/Esc), Ctrl+D, Ctrl+Shift+D, Ctrl+S, fila nueva al bajar, fila fantasma, insignias B/T. | Solo frontend, cambio mediano | No |
| **2. Alta rápida + Terceros corto + marcas** | Unir los 3 pares repetidos (datos); parecidos y `crearTercero`; modal de 3 campos con cédula opcional; DATOS PENDIENTES / SIN CÉDULA en la grilla, en Terceros y en Liquidaciones; formulario corto de Terceros; aviso en Liquidar. | Cambio grande | `2026_11_18_000001_terceros_alta_rapida` |
| **2b. Ficha y cuenta desde Liquidaciones** | Pantalla `ficha_vendedores` + `ProducerProfileController`; `CuentaBancaria` + `ProducerBankAccountController`; botones "+" (listado y buscador) y "Editar ficha"; `holder_id` enmascarado; pago bloqueado sin cuenta. | Cambio grande (permisos y pagos) | No (P10 agregaría `verified_*`) |
| **Futura. Pegar desde Excel** | `pegarTabla.js` (§A6). | Solo frontend | No |

- Las fases 1 y 2 son independientes.
- Las fases **2 y 2b** se suben **juntas**: lo creado al vuelo tiene desde el primer día cómo completarse y no se le paga sin cuenta.

## F. Preguntas abiertas para Peter

**Ya respondidas el 18/11/2026:**
- los campos del alta y quién la usa;
- el formulario corto de Terceros, sin quitar campos;
- quién ingresa la cuenta y dónde va el "+";
- la cédula opcional en rojo;
- pegar desde Excel (fase futura);
- la columna N°.

**Respondidas el 18/11/2026 (fase 2b, "OK con tus propuestas"):** P3 sin cédula se liquida con aviso y el pago se bloquea; P7 la lista PENDIENTES muestra solo vendedores con compras; P8 solo aviso; P9 Liquidaciones solo crea la cuenta; P10 sin validación de Contabilidad por ahora; P11 sin excepción: no se paga sin cuenta.

**Siguen abiertas:**
1. **Fila nueva al bajar:** ¿Enter en la última fila crea otra compra, y la fila vacía (sin vendedor ni cajas) se descarta sola al guardar? Hoy da error.
2. **Guardar y enviar:** ¿agregamos la casilla "Guardar y enviar a bodega" o el envío sigue siendo un paso aparte?
3. **Sin cédula, ¿se puede liquidar y pagar al VENDEDOR?** La retención y la factura necesitan RUC. Propongo: compra sí, liquidar con aviso, **pago bloqueado** sin cédula, como sin cuenta. Al productor real de trazabilidad no le afecta.
4. **Tercero desactivado con la misma cédula:** ¿Comercial lo reactiva ahí o se le pide al ADMIN (propuesto)?
5. **¿Quién corrige** el nombre o el tipo mal creados: solo ADMIN (propuesto) o también Liquidaciones con Ficha de vendedores?
6. **Vendedor con dos personas** ("WILSON VERGARA / GLENDA GUERRA" en el Excel): ¿una que factura o cada una aparte?
7. **Lista PENDIENTES de Liquidaciones:** ¿muestra los 274 productores sin cédula o solo los **vendedores** que liquida (propuesto)? En la grilla y en Terceros se marcan todos en rojo igual.
8. **Liquidar con DATOS PENDIENTES:** ¿solo aviso (propuesto) o bloqueo hasta confirmar el régimen?
9. **Cambiar una cuenta ya registrada:** ¿Liquidaciones solo puede **crear** (propuesto; cambiarla es de Contabilidad, contra el fraude) o también cambiarla?
10. **Validación de Contabilidad:** ¿Contabilidad debe **validar** la cuenta que ingresó Liquidaciones antes del primer pago?
11. **Pago sin cuenta:** ¿hay excepción para pagos en efectivo o por cruce?
12. **CLIENTE en Terceros → Nuevo:** ¿sigue pidiendo país y marcas al crear (propuesto, porque los necesita)?
13. **Orden de columnas de la grilla:** ¿el de §A3 o el del SEGUIMIENTO de Excel?
14. **Fases:** ¿empezamos por la grilla (1) o por el alta con ficha y cuenta (2 + 2b)?
