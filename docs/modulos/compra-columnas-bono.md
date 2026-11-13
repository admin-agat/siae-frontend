# Compra de fruta: precio oficial en el bloque, columna Tipo · Pago más clara y columna BONO / EXTRA

Diseño de `siae-architect`, 13/11/2026. **Estado: APROBADO por Peter el 13/11/2026** con estas decisiones:
1. **El bono es un PAGO APARTE (opción B):** no toca la nota de crédito (NC = oficial − real), no entra en la base de retención y se paga completo en el 1er pago, como el transporte reconocido.
2. Catálogo CINTA / EMPAQUE ESPECIAL / FRUTA ADICIONAL / OTRO (con detalle); **CINTA solo en bloques PACKED**.
3. Solo **$/caja** (con ayuda "÷ CAJAS").
4. Se quita la parte del contrato de la celda; la columna se llama **"Negociación"**.
5. "0,20–0,40 A BOLÍVAR" es transporte reconocido de la compra; **no se propone el parámetro de Pto. Bolívar** porque el lugar puede cambiar (también Guayaquil).
6. NC = máx(0, oficial − real).
Es un **cambio grande** porque agrega columnas en `producer_quota_lines`, `settlement_lines` y `settlements` y **cambia el cálculo de la liquidación** (sección 4).

Pedido de Peter (13/11/2026):
> "Mira, el precio oficial puede ir arriba a una esquina, por favor, porque en el recuadro se repite mucho. En el tipo pago está demás el tema del número; podemos mejorar la columna tipo.pago porque está media confusa. Tener una columna transporte, que está bien, y agregar una que diga bono o extra, que es para el tema de cuando es cinta y así."

Insumos revisados:
- `DESARROLLO.md` §7: compra de fruta (29/10, 06/11, 11/11, 12/11 y 13/11), PACKED siempre SPOT (02/11), precio oficial y nota de crédito (30/10), liquidación como el Excel (06/11) y transporte reconocido (11/11).
- Memoria del proyecto: `liquidacion-formato-excel`, `precio-oficial-nota-credito`, `contratos-transporte-pago-tercero` y `precio-marca-presentacion`.
- Código:
  - Backend: `PurchaseAllocationController` (`update`, `dividir`, `cargar`), `SettlementController::calcular` y `pagos`, `VoyageCostController`, `TallySheetController`, `TableroOperaciones`, `LiquidationSetupController` y los modelos `ProducerQuotaLine`, `PurchaseBlock`, `SettlementLine`, `Settlement` y `SettlementWeekParameter`.
  - Frontend: `PurchaseAllocationPage.jsx`, sobre todo las líneas 1020 a 1260, y `DividirCompraModal.jsx`.
- La base local `SIAE`, consultada solo con lecturas en `information_schema`.

Este documento no incluye RUC, cédulas, cuentas ni montos reales de liquidación.

---

## 0. Respuesta corta

| Punto | Propuesta | ¿Migración? |
|---|---|---|
| 1. Precio oficial | Sale de la tabla y pasa a la **esquina del encabezado del bloque** ("P. OFICIAL $ x,xx · MAG 22XU"). Al cambiarlo, se aplica a todas las compras **no liquidadas** del bloque. Cada compra **sigue guardando su propio** `official_price`, así que la nota de crédito no cambia. Una compra con otro oficial muestra una marca pequeña junto al precio real. | **No**: es solo pantalla, más un candado en el backend. |
| 2. Tipo · Pago | La celda queda en **2 renglones**: `[CONTRATO|SPOT]` + `PAGO 100 %` y, debajo, `$ 7,00 · 1.200 / 1.500 CAJAS`. **Sin número de contrato** (solo aparece si dos contratos tienen el mismo precio) y **sin selector de parte**. El recuadro con todos los contratos pasa a un **popover** y al panel "Contratos WKxx" de arriba. | **No** |
| 3. Transporte | Se queda como está: DESCUENTA (monto) + RECONOCER $/CAJA. Solo se ordenan las etiquetas. | No |
| 4. BONO / EXTRA | Columna nueva: **$/caja + motivo (CINTA, EMPAQUE ESPECIAL, FRUTA ADICIONAL u OTRO + detalle)**. Se paga por las cajas de la tarja, como la fruta. **Recomiendo** tratarlo como **parte del precio de la fruta**: suma a la base de retención, baja la nota de crédito y sigue el esquema 80/20 de la compra. | **Sí**: 3 columnas en `producer_quota_lines`, 3 en `settlement_lines` y 1 en `settlements`. |

**Reglas de negocio que toca este diseño** (como lo pide `CLAUDE.md`):
- **Liquidación**: aparece un concepto nuevo (bono). La nota de crédito pasa de `oficial − real` a `oficial − (real + bono)`. Lo que no cambia: el anticipo del 80 %, que se paguen solo las compras embarcadas y la retención por tramos. Lo único nuevo en la retención es su base, si Peter acepta la recomendación de la pregunta 1.
- **Nota de crédito = oficial MAG − precio real**: se **amplía**, porque el "precio real" pasa a ser *real + bono*. Ver la pregunta 1.
- **Ganancia por viaje**: el costo de la fruta incluye el bono.
- **No se tocan** la semana de compra, los contratos por marca × presentación, PACKED siempre SPOT, el flete CFR/CIF ni las órdenes de compra.

---

## 1. Proceso de negocio (cómo queda para Comercial)

1. **Abre el bloque** (barco + marca + presentación). Arriba a la derecha, junto a META / COMPRADO / FALTA, ve **P. OFICIAL $ 7,50**. El sistema lo propone con el precio MAG vigente del tipo de caja de la marca.
2. **Si el MAG cambió** o el oficial de ese bloque es otro, pulsa el precio de la esquina, escribe el nuevo y elige **Aplicar a las N compras**. Las compras liquidadas no cambian.
3. **Registra las compras** como siempre: vendedor, finca, cajas y precio real. Ya no escribe el oficial en cada fila, porque cada compra nueva toma el del bloque.
4. **Elige el tipo** con un clic, CONTRATO o SPOT. Si es CONTRATO, ve el precio del contrato y cuánto lleva del cupo semanal. Con 2 o más contratos, elige por precio. Para ver todos los contratos del vendedor, pulsa el ícono (i).
5. **Transporte**: si nosotros pusimos el transporte, escribe el monto a DESCONTAR. Si lo puso el productor, marca RECONOCER $/CAJA (por ejemplo, los $ 0,40 a Bolívar).
6. **Bono / extra**: si al productor se le paga algo más por caja (por ejemplo, la cinta en PACKED), escribe el **$/caja** y el motivo: **CINTA**, u **OTRO** con su detalle.
7. **Liquidaciones** paga el bono solo por las cajas que llegaron según la tarja. El bono aparece en su propia columna del detalle y del LG, y el vendedor emite la nota de crédito por la diferencia contra el oficial ya descontado el bono.

---

## 2. Qué ya existe y qué se reutiliza

| Pieza | Estado actual | Qué se hace |
|---|---|---|
| `producer_quota_lines.official_price` `numeric(10,2)` | Lo propone `precioMagDe(bloque, compra)` según el tipo de caja de la marca y el día de corte (o el lunes de la semana). Es editable por fila. | **Se queda tal cual**: es el valor congelado por compra. Solo cambia la forma de editarlo. |
| `official_box_prices` (tipo de caja, desde, hasta, precio) | Fuente del MAG. La envía `cargar()` como `official_prices`. | Se reutiliza para el valor que se propone en el encabezado. |
| `settlement_week_parameters.minimum_price` y `pto_bolivar_bonus` | Pantalla Parámetros de la semana. **Todavía no se usan** en `SettlementController` (son de la parte 3, LQ/LG). | No se tocan. Ver la observación de la sección 7. |
| `contract_id` + `contract_part` `smallint` (default 0) | `contract_part` solo se guarda y se valida (0 a 9). **Ningún cálculo lo usa**: ni `SettlementController` ni reportes, porque el LQ por contrato es la parte 3, que no está hecha. En la base local no hay ninguna compra con parte > 0. | La columna **se queda** y el selector **sale de la celda** (ver la sección 3.2). |
| `transport_deduction` (monto) + `transport_recognized_rate` ($/caja, por tarja) | Funcionan desde el 29/10 y el 11/11. | Sin cambios de lógica. |
| `SettlementController::calcular()` | Fruta = pagadas × real. NC = pagadas × oficial − fruta. Transporte reconocido = pagadas × tarifa. | Se agrega el bono (sección 4.3). |
| `SettlementController::pagos()` | Las compras "100" se pagan completas en el 1er pago; las "80_20", el 80 % en el 1er pago y el 20 % en el 2do. | Al monto de la línea se le suma el bono antes de repartir. |
| `VoyageCostController` (ganancia por viaje) | Fruta = cajas × real. | Fruta = cajas × (real + bono). |
| `DividirCompraModal` + `dividir()` | Copia precios, tipo, pago y contrato. El transporte negociado se queda solo en la original y la tarifa reconocida se copia. | El bono **se copia** como la tarifa reconocida (es por caja). |
| Duplicar compra (frontend) | Copia los precios y el contrato, pero no el transporte. | Copia también el bono. |
| Pantallas y permisos | `compra_fruta` (COMERCIAL) y las pantallas de LIQUIDACIÓN. | **Sin pantallas nuevas.** |

---

## 3. Diseño de pantalla (solo frontend, sin migración)

### 3.1 Precio oficial en el encabezado del bloque

**Dónde va:** en la cabecera de color del bloque, a la derecha de META / COMPRADO / FALTA, como cuarto indicador:

```
META 13.200   COMPRADO 12.000   FALTA 1.200   P. OFICIAL $ 7,50 ✎
                                              MAG 22XU
```

**Qué número muestra** (se calcula, no se guarda):
- Si el bloque **no tiene compras**, muestra el MAG vigente: `precioMagDe(b, null)`.
- Si las tiene, muestra **el oficial que más se repite** entre sus compras.
  - Si todas tienen el mismo, se ve solo el número.
  - Si hay distintos, se ve `$ 7,50 · 2 CON OTRO` en ámbar, y al pulsarlo lista esas compras.
- Si ese número no coincide con el MAG vigente, debajo dice `MAG $ 7,60` en ámbar, con un botón **Usar MAG**, igual que el aviso que hoy está en cada fila.

**Cómo se cambia (✎):** se abre un popover con un `CampoNumero` de 2 decimales y dos botones:
- **Aplicar a las N compras del bloque.** Cambia `official_price` en todas las compras **no liquidadas**. Las liquidadas se cuentan aparte ("2 LIQUIDADAS NO CAMBIAN"). Si alguna tiene tarjas, se usa `DialogoConfirmacion` con el aviso "N COMPRAS YA TIENEN TARJAS: SU NOTA DE CRÉDITO CAMBIA".
- **Solo para compras nuevas.** Queda en el estado del bloque y lo toman las compras que se agreguen, duplicadas o no. Las compras guardadas no cambian.

**Excepciones por compra**, para no perder el dato:
- La columna **P. oficial desaparece** de la tabla.
- Cuando una compra tiene un oficial distinto del encabezado, debajo del **P. real** aparece una etiqueta pequeña `OF. $ 7,60` en ámbar. Al pulsarla se abre un mini popover para cambiar el oficial **solo de esa compra** o volver al del bloque.
- **Compras históricas** (por ejemplo, las de la WK40 cargadas con $ 7,50): no se tocan. Si el MAG de hoy es otro, el bloque muestra la diferencia, pero nada cambia hasta que alguien pulse "Aplicar".
- **Cambio de MAG a mitad de semana** (por el día de corte): al agregar una compra, el oficial que se propone sigue siendo `precioMagDe(b, compra)` con su día de corte. Si es distinto del encabezado, la compra nace con la etiqueta `OF.`. Así nada se pierde: la regla de hoy se mantiene y solo se ve de otra forma.
- La columna **Nota créd. $** se queda **por fila**: cajas × (oficial de esa compra − real − bono).

**¿Hace falta una columna en `purchase_blocks`?** **No.** El oficial del bloque es solo una forma de mostrar y editar en bloque el `official_price` de cada compra:
- Guardarlo dos veces haría que el bloque y las compras se desincronicen. Además, la liquidación ya congela el oficial de cada compra en `settlement_lines.official_price`.
- El valor "solo para compras nuevas" vive en el estado de la pantalla. Si se recarga sin compras, vuelve al MAG, que es lo correcto.

**Candado en el backend (cambio chico, sin migración):** hoy `update()` **no** compara `official_price` en las compras liquidadas: compara cajas, real, transporte, finca, tipo, pago y contrato, pero no el oficial. Con el botón "Aplicar a todas" es más fácil cambiarlo sin querer. Se agrega `official_price` (y `bonus_rate` y `bonus_reason`, ver la sección 4) a la condición `$liquidada && (...)` que da "NO SE PUEDE MODIFICAR LA COMPRA DE X: SU CUPO YA FUE LIQUIDADO."

### 3.2 Columna "Tipo · Pago" rediseñada

**Problema actual**: en una celda de unos 170 px se apilan hasta 7 elementos: el selector de tipo, el de pago, el de contrato "N° · $precio", el de parte (N°, N°.1…), el contador de cupo, el aviso de vigencia y el recuadro con todos los contratos. El número sale tres veces: en el selector de contrato, en el de parte y en el recuadro.

**Propuesta: la celda tiene como máximo 2 renglones y 1 aviso.** Se llama **"Negociación"** (o se queda "Tipo · Pago"; ver la pregunta 4).

Renglón 1 (siempre):
- Un **interruptor de dos botones** `[CONTRATO | SPOT]`, que se cambia con un clic, en lugar del select.
- A la derecha, la **insignia de pago** `100 %` o `80/20`. Se elige sola según el tipo (`PAGO_POR_TIPO`) y se cambia con un clic, para el caso raro.
- **PACKED**: muestra el texto fijo `SPOT · 80/20` en gris, con el tooltip "La fruta packed se compra siempre SPOT". No hay controles.

Renglón 2 (solo CONTRATO):
- **1 contrato vigente**: solo texto, `$ 7,00 · 1.200 / 1.500 CAJAS`, en verde, gris o rojo según el cupo. **No hay selector ni número.**
- **2 o más contratos**: un `SelectBuscable` con opciones **por precio y saldo**: `$ 7,00 · SALDO 300` y `$ 6,80 · SALDO 1.500`. **El número de contrato solo aparece si dos contratos tienen el mismo precio** (`$ 7,00 · N° 2 · SALDO 300`), porque la regla del 11/11 dice "si puede ir a dos contratos con el mismo precio, preguntar".
- **Sin contrato vigente**: el aviso ámbar `SIN CONTRATO VIGENTE`, igual que hoy.
- Ícono **(i)** al final: abre un **popover** con el recuadro de hoy (todos los contratos del vendedor en la WK, comprado / cupo / saldo y el total), más el número, la vigencia y el código bananero. **El recuadro deja de estar dentro de la celda.**

Aviso (un solo renglón, solo el más grave):
1. `NO VIGENTE EN WKnn` (rojo).
2. `EXCEDE CUPO` (rojo).
3. `ELIGE EL CONTRATO` (ámbar).
4. Para SPOT con vendedor que tiene contrato: `TIENE CONTRATO` (azul), igual que hoy.

**Panel "Contratos WKxx" de arriba** (ya existe; es la tabla Vendedor / Cupo / Comprado / Faltan): cada vendedor se puede **abrir** para ver sus contratos (precio, cupo, comprado y saldo). Allí va el detalle completo, a nivel semana, en vez de repetirlo en cada fila.

**Parte del contrato (`contract_part`): se oculta de la celda.**
- Para qué sirve, según `DESARROLLO.md` (06/11) y la memoria `liquidacion-formato-excel`: en el Excel de liquidaciones, un contrato "partido" genera los documentos (1.1) y (1.2), con una parte pagada y otra pendiente. Es **una decisión de Liquidaciones al liquidar**, no de Comercial al comprar.
- Hoy **ningún cálculo la usa**: el LQ por contrato es la parte 3 y no está hecho. Comercial no tiene con qué saber si un contrato se liquidará partido.
- Propuesta:
  - **Se quita el selector** de la celda.
  - Las compras nuevas guardan `contract_part = 0`.
  - Si una compra ya tiene una parte mayor que 0, la celda muestra una etiqueta de solo lectura `PARTE 1.1`. En el popover (i) hay un selector "Liquidar partido" para cambiarla o volver a 0. Así se maneja el caso raro sin estorbar en el caso normal.
  - En la parte 3 (LQ/LG), Liquidaciones decidirá la parte en su pantalla. La columna ya existe y no se pierde nada.
  - Backend: **sin cambios**. Si no llega `contract_part`, sigue tomando 0 en CONTRATO. Para que no se borre una parte que ya existía, la pantalla debe seguir **enviando el valor que tenía la compra**.
- **Antes de programar**, `siae-datos` debe confirmar con una consulta de solo lectura en producción cuántas compras tienen `contract_part > 0`. Si son 0, la etiqueta casi nunca se verá.

### 3.3 Columna Transporte

Se queda como está. Solo cambian las etiquetas:
- El campo de arriba se llama **DESCONTAR $** (hoy no tiene etiqueta, solo el `placeholder="0"`).
- La casilla se llama **RECONOCER $/CAJA**.
- El encabezado pasa de "Transp. $" a **"Transporte"**.

Mejora opcional (pregunta 5): si el puerto de entrega de la compra es **PUERTO BOLÍVAR**, al marcar RECONOCER se propone `settlement_week_parameters.pto_bolivar_bonus` de la semana de compra en lugar de dejar el campo vacío.

### 3.4 Columna nueva "Bono / extra"

Va entre **Transporte** y **Total real**, y mide unos 120 px:
- `CampoNumero` de 4 decimales, con máximo 5 y `placeholder="0,00"`, para el **$/caja**.
- Al escribir un valor mayor que 0 aparece un `SelectBuscable` para el **motivo**: `CINTA`, `EMPAQUE ESPECIAL`, `FRUTA ADICIONAL` u `OTRO`. En un bloque PACKED se propone CINTA. Con OTRO aparece un input de **detalle** en mayúsculas, obligatorio, de hasta 100 caracteres (por ejemplo, "CALIDAD WK45").
- Debajo, igual que en el transporte reconocido: `≈ + $ 480,00` (cajas compradas × bono), con el tooltip "Se paga por las cajas que lleguen según tarja".
- Con la compra liquidada, el campo queda deshabilitado.

**Total real** de la fila = cajas × (real + bono). El tooltip lo desglosa: "FRUTA $ x · BONO $ y". La **barra fija** y la barra superior (`totalReal`) suman lo mismo.
**Nota créd. $** = cajas × (oficial − real − bono). Si da negativo, se mantiene el aviso que ya existe: `REAL + BONO > OFICIAL` (ver la pregunta 6).
**Duplicar compra** copia el bono y el motivo.
**Enter baja**: el campo de bono entra en la navegación con Enter (`data-campo="bono"`), como cajas y precios.

---

## 4. BONO / EXTRA: modelo de datos y liquidación

### 4.1 Bono frente a transporte reconocido (la regla para decidir dónde va cada cosa)

| | TRANSPORTE RECONOCIDO (ya existe) | BONO / EXTRA (nuevo) |
|---|---|---|
| Qué paga | Le **devuelve un gasto** al productor: él puso el camión o llevó la fruta a otro puerto. | Paga **más por la fruta**: la cinta (PACKED), la calidad u otro incentivo. |
| Pregunta para decidir | "¿Es por **mover** la fruta?" | "¿Es por la **fruta en sí** o por cómo viene?" |
| Unidad | $/caja | $/caja |
| Cajas que se pagan | Las que llegaron según tarja (embarcadas + caídas) | Las mismas |
| Nota de crédito | No la toca | **La baja** (recomendado: es parte del precio) |
| Base de retención (parte 3) | No entra (no es venta de banano) | **Entra** (recomendado) |
| 80/20 | Va en el 1er pago, como descuento negativo | **Sigue el esquema de la compra**, como la fruta |
| Ganancia por viaje | Va en la columna "± Transporte" | Va en el **costo de fruta** |

**Caso real "$ 8,15 con el comentario 0,40 CTVS A BOLIVAR":** se trata como **transporte reconocido** (0,40 $/caja). Es por llevar la fruta a Puerto Bolívar, así que no es bono. **No cambia.** Si Peter dice que ese 0,40 en realidad es el "reconocimiento Pto. Bolívar" del Excel (parámetro semanal), ver la pregunta 5.

### 4.2 Tablas y columnas

**`producer_quota_lines`** (la compra):

| Columna | Tipo | Nulo | Para qué |
|---|---|---|---|
| `bonus_rate` | `decimal(12,4)` | sí | $/caja extra que se le paga. NULL = sin bono. |
| `bonus_reason` | `varchar(20)` | sí | Catálogo cerrado: `CINTA` (banda), `EMPAQUE_ESPECIAL`, `FRUTA_ADICIONAL` u `OTRO`. |
| `bonus_detail` | `varchar(100)` | sí | Detalle libre en MAYÚSCULAS. Obligatorio con OTRO. |

CHECK:
- `producer_quota_lines_bonus_reason_check`: `bonus_reason IS NULL OR bonus_reason IN ('CINTA','EMPAQUE_ESPECIAL','FRUTA_ADICIONAL','OTRO')`.
- `producer_quota_lines_bonus_pair_check`: `(bonus_rate IS NULL) = (bonus_reason IS NULL)`, es decir, tarifa y motivo van juntos o no van.
- `producer_quota_lines_bonus_rate_check`: `bonus_rate IS NULL OR (bonus_rate > 0 AND bonus_rate <= 5)`.
- `producer_quota_lines_bonus_detail_check`: `bonus_reason IS DISTINCT FROM 'OTRO' OR bonus_detail IS NOT NULL`.

Sin índices: nadie busca por bono. Los reportes leen por cupo o bloque, que ya tienen FK.

**`settlement_lines`** (lo que se congela al liquidar):

| Columna | Tipo | Para qué |
|---|---|---|
| `bonus_rate` | `decimal(12,4)` NULL | Tarifa usada, congelada. |
| `bonus_reason` | `varchar(20)` NULL | Motivo congelado (CATÁLOGO DE MOTIVOS). |
| `bonus_amount` | `decimal(12,2)` NOT NULL DEFAULT 0 | Pagadas × tarifa. |

**`settlements`**: `bonus_amount decimal(12,2) NOT NULL DEFAULT 0`, que es la suma de las líneas.

> `bonus_detail` no se copia a `settlement_lines`: el detalle se lee de la compra, que no cambia una vez liquidada gracias al candado de la sección 3.1.
> El tipo `decimal(12,4)` sigue la convención para precios con fracción de centavo. El `transport_recognized_rate` que ya existe es `decimal(8,4)`; no hace falta cambiarlo.

### 4.3 Cálculo de la liquidación (`SettlementController::calcular` y `pagos`)

Por cada compra, con `pagadas = embarcadas + caídas`:
```
fruta     = pagadas × real                      (igual que hoy)
bono      = pagadas × bonus_rate                (nuevo; 0 si es NULL)
factura   = pagadas × oficial                   (igual que hoy)
NC        = factura − fruta − bono              (antes: factura − fruta)   ← cambia una regla, ver la pregunta 1
```
Por cupo:
```
Neto = fruta + bono − materiales − transporte descontado + transporte reconocido − anticipos
```
- **Esquema 80/20**: en `pagos()`, el monto de cada línea que se reparte pasa a ser `amount + bonus_amount`. El bono de una compra "80_20" se paga 80 % en el 1er pago y 20 % en el 2do. El de una compra "100" va completo en el 1er pago.
- **Anticipo del 80 %** (parte 2, que se paga antes de liquidar): su base es el valor de la fruta embarcada. **Recomiendo que incluya el bono**, porque es precio. La regla "anticipo 80 % antes, y la liquidación lo descuenta" no cambia; solo crece su base.
- **Retención** (parte 3, todavía no programada): base = fruta + bono. Hoy la base es "el total de la fruta al precio liquidado", y el bono es parte de ese precio.
- **Solo embarcadas**: el bono se paga sobre las mismas cajas que la fruta (embarcadas + caídas, como hoy). No cambia.
- **Validación**: una compra con bono y sin `real_price` ya está bloqueada por "FALTA EL PRECIO REAL". No hace falta un error nuevo.
- La "validación de que los descuentos no superen la fruta" pasa a comparar con `fruta + bono`.
- `SettlementDetailPage` / `SettlementFormPage`: una columna **Bono** por línea y un renglón **+ Bono** en el resumen, debajo de "+ Transporte reconocido".
- **Notas de crédito** (pantalla y bandeja): no cambian, porque leen `credit_note_amount`, que ya llega calculado con el bono.
- Si Peter elige la **opción B** en la pregunta 1 (el bono es un pago aparte), el NC sigue siendo `factura − fruta`, el bono no entra en la retención y se suma como el transporte reconocido: `$fijos = materiales + transporte − reconocido − bono`, todo en el 1er pago.

### 4.4 Otros lugares que leen el precio

| Dónde | Cambio |
|---|---|
| `VoyageCostController` (ganancia por viaje, línea ~393) | `fruta = cajas × (real + bono)`. El `select` agrega `l.bonus_rate`. |
| `TallySheetController` (línea ~159) | Devuelve `bonus_rate` para mostrar "+ BONO $ x" junto al precio en la tarja, solo informativo. |
| `TableroOperaciones` | Sin cambios: la alerta de compras sin precio sigue mirando `real_price`. |
| `PurchaseAllocationController::cargar()` | Devuelve `bonus_rate`, `bonus_reason` y `bonus_detail`. |
| `PurchaseAllocationController::update()` | Valida y guarda los 3 campos. Los agrega al candado de compras liquidadas. |
| `PurchaseAllocationController::dividir()` | Las filas nuevas y el saldo POR DIVIDIR copian `bonus_rate`, `bonus_reason` y `bonus_detail` de la original. Las filas BANDA que van a PACKED copian el bono **solo si la original es PACKED**; si no, van sin bono y Comercial lo pone en la tabla. |
| Barra fija y barra superior (`totalReal`) | Suman cajas × (real + bono). |

### 4.5 Validaciones del backend (`update()`, con mensajes en MAYÚSCULAS)

```php
// 13/11/2026: bono / extra al productor ($/caja, se paga por tarja como la fruta)
'blocks.*.purchases.*.bonus_rate'   => 'nullable|numeric|gt:0|max:5',
'blocks.*.purchases.*.bonus_reason' => 'nullable|required_with:blocks.*.purchases.*.bonus_rate|in:' . implode(',', ProducerQuotaLine::MOTIVOS_BONO),
'blocks.*.purchases.*.bonus_detail' => 'nullable|string|max:100',
```
Mensajes (en el arreglo de mensajes y en el ciclo por compra):
- `bonus_rate.gt` / `max`: "BLOQUE n, COMPRA m: EL BONO DEBE SER MAYOR A 0 Y HASTA $ 5,00 POR CAJA."
- `bonus_reason.required_with`: "BLOQUE n, COMPRA m: ELIGE EL MOTIVO DEL BONO (CINTA, EMPAQUE ESPECIAL, FRUTA ADICIONAL U OTRO)."
- Con motivo y sin tarifa: "BLOQUE n, COMPRA m: ESCRIBE EL BONO POR CAJA O QUITA EL MOTIVO."
- OTRO sin detalle: "BLOQUE n, COMPRA m: ESCRIBE EL DETALLE DEL BONO (MOTIVO OTRO)."
- CINTA fuera de PACKED (si Peter lo aprueba en la pregunta 2): "BLOQUE n, COMPRA m: EL BONO POR CINTA SOLO VA EN BLOQUES PACKED." Solo se valida en compras nuevas o cuando cambia el bono, para no trabar compras viejas.

Al guardar: `bonus_detail` se pasa a `mb_strtoupper` y se recorta. Si `bonus_rate` llega vacío, los tres campos quedan en NULL.

Constante en el modelo: `public const MOTIVOS_BONO = ['CINTA', 'EMPAQUE_ESPECIAL', 'FRUTA_ADICIONAL', 'OTRO'];`

---

## 5. Migración de Laravel propuesta

Archivo: `database/migrations/2026_11_13_000002_compra_bono_extra.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 13/11/2026 (pedido de Peter, Compra de fruta):
//   BONO / EXTRA al productor: $/caja que se le paga además del precio real, sobre todo por la CINTA
//   (fruta PACKED) u OTRO motivo con su detalle. Se paga solo por las cajas que llegaron según tarja
//   (embarcadas + caídas), igual que la fruta. Es distinto del transporte reconocido, que devuelve un
//   gasto de transporte. Al liquidar se congela la tarifa, el motivo y el monto en settlement_lines.
//   Las compras y liquidaciones existentes quedan sin bono (NULL / 0): no cambia ningún dato.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('producer_quota_lines', function (Blueprint $table) {
            $table->decimal('bonus_rate', 12, 4)->nullable();    // $/caja extra; NULL = sin bono
            $table->string('bonus_reason', 20)->nullable();      // CINTA / EMPAQUE_ESPECIAL / FRUTA_ADICIONAL / OTRO
            $table->string('bonus_detail', 100)->nullable();     // detalle en MAYÚSCULAS (obligatorio con OTRO)
        });

        // Catálogo cerrado y coherencia: la tarifa y el motivo van juntos; OTRO exige el detalle
        DB::statement("ALTER TABLE producer_quota_lines ADD CONSTRAINT producer_quota_lines_bonus_reason_check
            CHECK (bonus_reason IS NULL OR bonus_reason IN ('CINTA','EMPAQUE_ESPECIAL','FRUTA_ADICIONAL','OTRO'))");
        DB::statement('ALTER TABLE producer_quota_lines ADD CONSTRAINT producer_quota_lines_bonus_pair_check
            CHECK ((bonus_rate IS NULL) = (bonus_reason IS NULL))');
        DB::statement('ALTER TABLE producer_quota_lines ADD CONSTRAINT producer_quota_lines_bonus_rate_check
            CHECK (bonus_rate IS NULL OR (bonus_rate > 0 AND bonus_rate <= 5))');
        DB::statement("ALTER TABLE producer_quota_lines ADD CONSTRAINT producer_quota_lines_bonus_detail_check
            CHECK (bonus_reason IS DISTINCT FROM 'OTRO' OR bonus_detail IS NOT NULL)");

        Schema::table('settlement_lines', function (Blueprint $table) {
            $table->decimal('bonus_rate', 12, 4)->nullable();     // tarifa usada al liquidar (congelada)
            $table->string('bonus_reason', 20)->nullable();       // motivo congelado
            $table->decimal('bonus_amount', 12, 2)->default(0);   // pagadas × tarifa
        });

        Schema::table('settlements', function (Blueprint $table) {
            $table->decimal('bonus_amount', 12, 2)->default(0);   // suma del bono de sus líneas
        });
    }

    public function down(): void
    {
        Schema::table('settlements', fn (Blueprint $t) => $t->dropColumn('bonus_amount'));
        Schema::table('settlement_lines', fn (Blueprint $t) => $t->dropColumn(['bonus_rate', 'bonus_reason', 'bonus_amount']));

        DB::statement('ALTER TABLE producer_quota_lines DROP CONSTRAINT IF EXISTS producer_quota_lines_bonus_detail_check');
        DB::statement('ALTER TABLE producer_quota_lines DROP CONSTRAINT IF EXISTS producer_quota_lines_bonus_rate_check');
        DB::statement('ALTER TABLE producer_quota_lines DROP CONSTRAINT IF EXISTS producer_quota_lines_bonus_pair_check');
        DB::statement('ALTER TABLE producer_quota_lines DROP CONSTRAINT IF EXISTS producer_quota_lines_bonus_reason_check');
        Schema::table('producer_quota_lines', fn (Blueprint $t) => $t->dropColumn(['bonus_rate', 'bonus_reason', 'bonus_detail']));
    }
};
```

**Modelos que hay que actualizar:**

| Modelo | `$fillable` | `$casts` |
|---|---|---|
| `ProducerQuotaLine` | `'bonus_rate'`, `'bonus_reason'`, `'bonus_detail'` (comentario `// 13/11/2026: bono / extra…`) y la constante `MOTIVOS_BONO` | `'bonus_rate' => 'decimal:4'` |
| `SettlementLine` | `'bonus_rate'`, `'bonus_reason'`, `'bonus_amount'` | `'bonus_rate' => 'decimal:4'`, `'bonus_amount' => 'decimal:2'` |
| `Settlement` | `'bonus_amount'` | `'bonus_amount' => 'decimal:2'` |

Los tres modelos ya usan `Auditable`. No hay tablas nuevas.
En `SettlementController::store`, la lista de columnas que se copian de `$calculo['lines']` a `settlement_lines` (línea ~229) suma `bonus_rate`, `bonus_reason` y `bonus_amount`. `settlements` suma `bonus_amount`.

La migración se aplica solo en local (`SIAE` y `siae_test`), y `down()` se prueba.

---

## 6. Permisos

| Acción | Pantalla (`config/pantallas.php`) | Tipo base | Qué valida el backend |
|---|---|---|---|
| Ver y editar el oficial del bloque, el tipo, el contrato, el transporte y el bono | `compra_fruta` | COMERCIAL (y ADMIN) | La misma ruta `PUT /customer-orders/{id}/purchases` con `pantalla:compra_fruta`. Se agregan las validaciones de la sección 4.5 y el candado de las liquidadas (oficial y bono). |
| Dividir compra (copia el bono) | `compra_fruta` | COMERCIAL | `dividir()` igual que hoy. |
| Ver el bono en la liquidación y liquidar | Pantallas de LIQUIDACIÓN que ya existen | LIQUIDACIONES (y ADMIN) | El bono se calcula en el servidor: no llega desde la pantalla de liquidación. |
| Ver el bono en la ganancia por viaje | La pantalla de gastos y ganancia que ya existe | FINANZAS / CONTABILIDAD | Lo calcula el servidor. |

No hay pantallas ni tipos base nuevos. El popover "Liquidar partido" (parte del contrato) se queda dentro de `compra_fruta`, como hoy (ver la pregunta 4).

---

## 7. Impacto en datos existentes

- **Migración sin datos**: las columnas nuevas quedan en NULL / 0. Las liquidaciones hechas no cambian, porque `bonus_amount` vale 0 y su NC ya está congelada.
- **Precio oficial**: no se mueve ningún dato. El encabezado lee lo que ya tiene cada compra.
- **`contract_part`**: no cambia. `siae-datos` revisa en producción, solo con lectura, cuántas compras tienen `contract_part > 0`.
- **Bonos escritos en las notas**: es opcional, y solo si Peter lo pide. `siae-datos` puede buscar en producción, solo con lectura, las notas con "CINTA", "BONO", "EXTRA" o "CTVS" (en la base local no hay ninguna) y armar una lista. Cada caso lo decide Comercial: **transporte reconocido** (como el de 0,40 a Bolívar, que se queda donde está) o **bono**. Si hay que mover datos, se hace con un script que:
  - exija `CARGA_BD`;
  - pase primero por la simulación (`CARGA_SIMULAR=1`);
  - use el mismo `PUT /customer-orders/{id}/purchases` de la pantalla;
  - deje fuera las compras liquidadas.

  El orden es: simulación, aprobación de Peter, respaldo y real.
- **Observación (no bloquea)**: hay **dos fuentes del "oficial"**:
  - `official_box_prices`, por tipo de caja y fechas, que usa la compra y la NC;
  - `settlement_week_parameters.minimum_price`, por semana, que viene del Excel PARAMETROS y todavía no se usa en ningún cálculo.

  Cuando se programe la parte 3 (LQ/LG), conviene que el mínimo de la semana **salga** de `official_box_prices` o que se valide que coincidan. Si no, el encabezado del bloque y el LG podrían mostrar números distintos.

---

## 8. Pruebas que debe cubrir `siae-qa`

1. Aplicar el oficial del bloque: cambian las no liquidadas; la liquidada da 422 si se intenta por la API.
2. El bono se guarda con motivo y su detalle queda en mayúsculas. La API rechaza tarifa sin motivo, motivo sin tarifa, OTRO sin detalle y una tarifa mayor que 5. El CHECK de la base también los rechaza.
3. CINTA fuera de PACKED da 422, si se aprueba la pregunta 2.
4. Liquidación con tarjas (embarcadas + caídas + rechazadas): bono = pagadas × tarifa, NC = factura − fruta − bono, neto y pagos 80/20 con el bono repartido. Una liquidación anterior queda intacta.
5. Dividir compra: las filas copian el bono. Las BANDA hacia PACKED desde una compra convencional van sin bono.
6. Ganancia por viaje: el costo de fruta incluye el bono.
7. Compra liquidada: cambiar el bono o el oficial da "NO SE PUEDE MODIFICAR LA COMPRA…".
8. Una compra con `contract_part = 1` guardada desde la pantalla nueva conserva su parte.

---

## 9. Datos reales que respaldan el diseño (cruce de `siae-datos`, 13/11/2026)

Fuente: el Excel anual de Comercial (6.862 filas, WK13 a WK45) y las liquidaciones de la WK42 y la WK43. Detalle en el scratchpad `bonos\resumen.md`. Sin montos de liquidación.
- **No hay columna de bono**: los extras se escriben en los comentarios.
- **Bonos reales con monto: 3 casos.** Por ejemplo, "0,20 CTVS ADICIONALES POR BANDA" (WK37, a una asociación) y "RECONOCER EN FRUTA ADIC." (WK36). Este último vino como **monto total** y equivale a unos $ 0,54/caja.
- **Sin monto**: "EMPAQUE ESPECIAL" (6 filas) y "AUTORIZADO POR GERENCIA" (4 filas).
- El bono es para el **productor real**, aunque se liquide al vendedor. En el diseño queda en la compra, que ya tiene el productor real.
- **Banda frente a convencional**: no hay una prima fija en el precio (la diferencia va de −2,66 a +2,95). Esto confirma que el bono es un **premio puntual** y no un recargo automático por PACKED. Por eso el bono es **opcional** y no se propone solo.
- **Transporte es lo frecuente**: unas 130 filas dicen "$ 0,30 TRANSPORTE" y 38 dicen "0,20 a 0,40 A BOLÍVAR". Siguen como **transporte reconocido**, no como bono.
- **Liquidaciones WK42 y WK43**: tampoco tienen campo de bono.
  - Fruta = cajas × precio + $ 0,30/caja de reconocimiento Pto. Bolívar.
  - LG = diferencia de precio + evaluadores + estibas + transporte + otros.
  - **No hay una regla sobre la retención del bono**: hay que decidirla (pregunta 1).
- Por estos datos, el catálogo de motivos queda así: **CINTA** (banda), **EMPAQUE ESPECIAL**, **FRUTA ADICIONAL** y **OTRO** (con detalle; por ejemplo, "AUTORIZADO POR GERENCIA").

**Aclaración de Peter sobre "el número"**: se refería al **selector de la PARTE del contrato** (N°1, N°1.1, N°1.2 = `contract_part`). Sale de la celda tal como se describe en la sección 3.2:
- queda en 0 automáticamente;
- si ya existe una parte, se ve una etiqueta de solo lectura;
- para el caso raro hay un selector en el popover (i);
- más adelante, lo decide Liquidaciones en el LQ por contrato.

Quitar el número del selector de contrato (mostrar solo precio y saldo) es una mejora aparte, que se puede hacer o no.

---

## 10. Preguntas para Peter

1. **¿El bono es parte del precio de la fruta o un pago aparte?** No hay ningún antecedente: el Excel nunca tuvo bono.
   - **(A) Precio de la fruta.** Suma a la base de retención, baja la nota de crédito (NC = oficial − real − bono) y se paga con el 80/20 de la compra.
   - **(B) Pago aparte**, como el reconocimiento Pto. Bolívar del Excel. No toca la NC, va completo en el 1er pago y se muestra separado.
   - **Recomiendo A**, porque es lo que se paga por esa fruta. `siae-datos` prefiere B, para no tocar la NC.
   - Con cualquiera de las dos, la **retención** necesita una regla explícita. Con A, el bono entra en la base.
2. **Motivos del bono y CINTA solo en PACKED.**
   - **Recomiendo** el catálogo CINTA, EMPAQUE ESPECIAL, FRUTA ADICIONAL y OTRO (con detalle obligatorio).
   - También recomiendo que **CINTA solo se acepte en bloques PACKED**, porque la banda es PACKED.
3. **¿El bono es siempre por caja, o a veces es un monto fijo?** Un caso real vino como monto total.
   - **Recomiendo solo $/caja**, pagado por las cajas de la tarja.
   - Si Comercial tiene un monto total, la pantalla puede ayudar con un botón "÷ CAJAS" que calcule la tarifa. Un monto fijo no se ajusta si llegan menos cajas.
4. **Parte del contrato: ¿la sacamos de Compra, como dijiste?**
   - **Recomiendo que sí**: queda en 0, con una etiqueta de solo lectura si ya existe, un selector en el popover (i) para el caso raro y, más adelante, la decide Liquidaciones.
   - ¿El encabezado de la columna puede llamarse **"Negociación"**?
5. **"0,20 a 0,40 A BOLÍVAR": ¿es transporte de la compra o el "reconocimiento Pto. Bolívar" del Excel (parámetro semanal)?**
   - **Recomiendo** dejarlo como **transporte reconocido por compra**, que ya funciona y se paga por tarja.
   - Además, que la pantalla **proponga** el parámetro de la semana cuando el puerto de entrega es Puerto Bolívar.
6. **Si real + bono pasa el oficial, ¿la NC queda en 0 y el productor factura al precio efectivo?**
   - **Recomiendo que sí**: NC = máx(0, oficial − real − bono). Coincide con la regla del Excel: "precio liquidado = el mayor entre el pactado y el mínimo".
