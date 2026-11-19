# Pagos de liquidaciones → Contabilidad (diseño)

Fecha: 17/11/2026 · Autor: arquitecto (siae-architect)
**Estado:**
- **FASE 0: EN PRODUCCIÓN** (17/11, migración `2026_11_17_000001_liquidacion_fase0`).
- **FASE 1a (tarjas en el puerto): PROGRAMADA el 17/11** (migraciones `2026_11_17_000002_tipo_tarjador` y `2026_11_17_000003_tarjas_historial`; falta la vista de celular). Ver `DESARROLLO.md`.
- **FASE 1b (anticipos, aprobación y pagos al banco): AÚN NO PROGRAMADA.** Peter aprobó las recomendaciones el 17/11 (sección 11).
- **CAMBIOS DEL 19/11 (sección 13): DISEÑO, ESPERA APROBACIÓN DE PETER.** **A)** el anticipo 80 % nace en Compra de fruta con un botón **PAGAR** por compra SPOT, sobre las **cajas compradas** (reemplaza "se calcula al guardar la tarja"). **B)** **material sobrante** después de la tarja: la analista comercial decide DESCONTAR / DEVOLVER / PENDIENTE, y Liquidar queda bloqueado hasta que decida. Donde este documento diga otra cosa, **manda la sección 13**.

Pedido de Peter (17/11/2026): que el sistema calcule las cuotas a pagar de cada liquidación (CONTRATO 100 %, SPOT 80/20), que Liquidaciones las acepte con un check en un listado, que lo aceptado le llegue a Contabilidad para pagar por el banco, y saber cómo se manejan las **cuentas contables**. Ese mismo día agregó dos temas de tarjas: el **historial de cada tarja** y que las llene **una persona en el puerto desde el celular**.

> **En un minuto**
> - **Nada de pantallas paralelas.** Se reutilizan los pagos que ya tiene cada liquidación, los anticipos, los lotes al banco y el TXT del Pichincha. Las cuentas bancarias siguen cifradas y en su misma tabla.
> - **Tres momentos, una sola cola.** El sistema calcula la cuota. El jefe de Liquidaciones la **acepta** con un check, o la **devuelve** con un motivo. Contabilidad la **paga** en un lote al banco, o a mano con su comprobante.
> - **SPOT:** el 80 % se paga en la **semana de corte**. ⚠️ *19/11 (sección 13.A):* ya no es automático desde la tarja: Comercial pulsa **PAGAR** en cada compra SPOT ya enviada a bodega; monto = **cajas compradas** × precio pactado × 80 %. La LQ SPOT lo descuenta y paga el saldo (20 %).
> - **Material sobrante (19/11, sección 13.B):** lo retirado que no llegó en la tarja lo reparte la analista comercial en DESCONTAR, DEVOLVER o PENDIENTE; sin esa decisión no se liquida.
> - **CONTRATO:** un solo pago del 100 % al liquidar, en la semana siguiente a la de compra o una más, según el contrato.
> - **Anticipos y préstamos manuales** también pasan por aprobación y por el TXT (P14).
> - **Tarjas (fase 1a, va primero):** tipo base nuevo **TARJADOR** que solo ve Tarjas y no ve precios; pantalla para celular con **"Guardar camión"**; **historial de cada tarja** de punta a punta; las tarjas ya no se borran (baja lógica con motivo).
> - **Contabilidad:** dos permisos por persona: **preparar** el lote y el TXT, y **confirmar** lo que pagó el banco. Las OC siguen con su único aprobador.
> - **Cuentas contables:** **ahora no** se lleva contabilidad en el SIAE; se exporta (fase 2) y el plan de cuentas queda para la fase 3.
> - **Segregación de funciones:** quien liquida no aprueba su propia liquidación, y quien aprueba no paga. El banco nunca recibe un pago sin aprobación ni el mismo pago dos veces.

---

## 1. Proceso de negocio (en simple)

| # | Cuándo | Quién | Qué pasa |
|---|---|---|---|
| 1 | Semana de compra **N** | Comercial / Logística | Se compra la fruta y llega al puerto. |
| 2 | Semana N, en el puerto | **Tarjador** (celular) | Registra cada **camión**: embarcadas, caídas, rechazadas y faltantes. Cada cambio queda en el historial de la tarja. |
| 3 | Semana N, ~~al guardar cada camión~~ **con la compra ya enviada a bodega** | ~~Sistema~~ **Comercial (botón PAGAR)** | ⚠️ *Reemplazado el 19/11 (13.A):* Comercial pulsa **PAGAR** en la compra **SPOT** y el sistema crea la orden del **80 %** = cajas **compradas** × precio pactado × 80 %, POR APROBAR, para la **semana de corte**. |
| 4 | Semana N | Jefe de Liquidaciones | En **Tablero de anticipos y pagos** marca con un check los anticipos correctos (y los anticipos o préstamos manuales) y pulsa **Aprobar**, o devuelve uno con su motivo. |
| 5 | Cuando toca | Contabilidad (quien **prepara**) | En **CONTABILIDAD → Pagos al banco** ve juntas las OC aprobadas y las órdenes de Liquidaciones aprobadas. Marca las que va a pagar y **genera el TXT del Pichincha**. |
| 6 | Al confirmar el banco | Contabilidad (quien **confirma**) | Marca el lote como **PAGADO**. Si el banco rechazó alguna línea, la marca **FALLIDA** con el motivo, y esa orden vuelve a "por pagar". |
| 7 | Semana **N+1** | Liquidaciones | **Liquida** el cupo: una LQ por contrato y una SPOT (fase 0). La LQ SPOT descuenta el 80 % ya pagado y deja la cuota del **saldo**; la LQ CONTRATO deja la cuota del **100 %**. Las tarjas de ese cupo quedan **bloqueadas**. |
| 8 | Semana N+1 (o N+2) | Jefe de Liquidaciones → Contabilidad | Se aprueban las cuotas con el mismo check y se pagan como en los pasos 5 y 6. |

---

## 2. Reglas: lo que se dijo, lo que hay en el código y lo que queda

| Tema | Excel 06/11 y Peter 17/11 | **Código hoy (con la fase 0)** | **Fase 1** |
|---|---|---|---|
| CONTRATO | 100 % en la semana que transcurre o en la próxima | Cuota 1 = 100 % **al liquidar**, sin semana programada | 100 % al liquidar, **semana programada** = N+1 + `payment_week_offset` del contrato (0 o 1). El aprobador lo puede cambiar (P2). El esquema 80/20 no aplica a CONTRATO (P17). |
| SPOT | 80 % **antes** de liquidar, sobre embarcadas; la LQ lo descuenta | Cuotas 80 % y 20 % se crean **las dos al liquidar** | 80 % en **N** como anticipo automático por negociación; saldo en **N+1** como cuota de la LQ SPOT |
| Descuentos | Todos en la LQ | Materiales y anticipos en la LQ de **mayor valor de fruta**; retención en cada LQ, en el primer pago | Igual. El 80 % se descuenta **solo en la LQ SPOT** (es de sus compras). El 80 % sale **bruto**. |
| Cajas | RECIBIDAS = EMBARCADAS − CAÍDAS − RECHAZADAS − FALTANTES | **Ya implementado** (fase 0) | El 80 % usa EMBARCADAS; la LQ, RECIBIDAS |
| Retención IR | Por tramos | **Ya implementado** (fase 0): por LQ, base = recibidas × el mayor entre real y oficial (sin oficial, el mínimo de la semana) | Sin cambio |
| Quién registra el pago | Contabilidad, por bancos | Pantalla `pagos` (Liquidaciones) | **Contabilidad.** Liquidaciones solo aprueba (P12). |
| Anticipos manuales | — | Se entregan por fuera y se descuentan | Pasan por aprobación y TXT (P14) |

⚠️ **Reglas de negocio que cambian (señalado como pide `CLAUDE.md`):**
1. **Liquidación — anticipo del 80 %:** hoy el 80 % SPOT se paga **después** de liquidar; pasa a pagarse **antes**, como orden propia por negociación. Confirmado con el Excel real WK41 y el "REPORTE DE ANTICIPOS WK 40" (P1, P5). ⚠️ **19/11 (13.A):** la base cambia de EMBARCADAS a **CAJAS COMPRADAS**, y la orden la pide **Comercial** con PAGAR, no la tarja.
2. **Liquidación — CONTRATO con 80/20:** hoy una compra CONTRATO marcada 80_20 se paga 80/20. Desde la fase 1, toda LQ CONTRATO paga 100 % en una cuota (P17: "el anticipo 80 % es solo SPOT"). Ver 3.1.
3. **Liquidación — saldo negativo:** hoy, si los descuentos superan la fruta, la LQ no se graba. Desde la fase 1, si el exceso viene del 80 % ya pagado, se graba y el exceso queda como **SALDO A FAVOR DE AGAT** (P4). Si viene de anticipos manuales elegidos de más, sigue el error de hoy.
4. **Órdenes de compra:** el **único aprobador** de OC no cambia (`aprobar_oc`). Lo que cambia es dónde se arman los lotes al banco: pasan de "Aprobación y pago de OC" a **"Pagos al banco"**, con permisos propios (5.5). Andrea no pierde nada: la migración le da las pantallas nuevas a su perfil.
5. **Anticipos manuales:** dejan de entregarse por fuera; pasan por aprobación y TXT (P14). Solo se descuentan en una LQ si ya salieron al banco o se pagaron (3.4).

**Cómo lo lleva hoy el Excel** (hoja PAGOS): una fila por LQ, con referencia y fecha de pago.
- Estados **PENDIENTE / PAGADO / PARCIAL / PAGADO DE MES**. "PARCIAL" se cubre con el lote PAGADO_PARCIAL (P7). "PAGADO DE MES" = pago manual con forma **CRUCE** (P15).
- La hoja PENDIENTES POR PAGAR muestra el indicador **OK / FALTA CUENTA**: el diseño lo reproduce como el aviso "SIN CUENTA BANCARIA".

---

## 3. Cálculo automático de las cuotas

### 3.1 Qué órdenes de pago se generan

| Origen | Orden | Cuándo se crea | Monto | Semana programada |
|---|---|---|---|---|
| Compra **SPOT** con `payment_scheme = 80_20` | **ANTICIPO 80 %**, una por negociación (compra) | ⚠️ *19/11 (13.A):* cuando **Comercial pulsa PAGAR** (compra ya enviada a bodega) | ⚠️ *19/11:* **CAJAS COMPRADAS × PRECIO PACTADO × 0,80**, sin descuentos | Semana ISO del **día de corte** |
| LQ **SPOT** | **SALDO SPOT** (cuota única de la LQ) | Al liquidar | neto de la LQ − anticipos 80 % descontados | N+1 |
| LQ **CONTRATO n** | **PAGO ÚNICO 100 %** | Al liquidar | neto de la LQ | N+1 + `payment_week_offset` (0 o 1) |
| Liquidaciones (pantalla `anticipos`) | **ANTICIPO / PRÉSTAMO MANUAL** (P14) | Al registrarlo | el monto escrito | La semana en curso, editable antes de aprobar |

- **Fórmula del 80 %:** ~~cajas EMBARCADAS de la tarja~~ ⚠️ *19/11 (13.A):* **cajas compradas** (`quantity_cajas`) × precio pactado (`real_price` de la compra) × 0,80. Ejemplo inventado: 1.000 × $7,00 × 0,80 = **$5.600,00**. Los puntos de abajo sobre tarjas (recalcular por camión, SIN TARJA, EMBARCADAS como fuente) **ya no aplican al 80 %**; siguen valiendo para la LQ.
- **Una orden por negociación** (una compra = un vendedor, una marca y un precio). Si una compra embarca en varios días, la **misma** orden se recalcula mientras esté POR APROBAR (supuesto de P22, ver 11).
- **Solo SPOT** (P17): si una compra CONTRATO quedó marcada 80_20, no genera 80 %; en su LQ se paga al 100 %. Para evitar la confusión, `PurchaseAllocationController` guarda `payment_scheme = '100'` en toda compra CONTRATO nueva o editada (validación en el backend; no se migran datos).
- **SPOT al 100 %** (`payment_scheme = 100`): no genera 80 %; su fruta va completa en la cuota SALDO SPOT.
- **Cajas EMBARCADAS** (fuente única): `tally_sheets.boxes_shipped` de las tarjas **activas** (`status = true`, fase 1a). No se usan `shipment_bookings.shipped_boxes` ni las cajas compradas.
- ⚠️ **Sin tarja no hay 80 %.** El tablero muestra la compra como **SIN TARJA** (cajas 0, monto 0, casilla desactivada).
- **Sin precio real (R2) no hay 80 %.** La fila sale **SIN PRECIO**, no aprobable, con aviso para Comercial.
- **Neto de la LQ** = fruta (RECIBIDAS × precio pactado) + transporte reconocido + bono − materiales − transporte descontado − retención IR − anticipos manuales elegidos − **anticipos 80 % descontados** (solo LQ SPOT).
- **Número de orden:** cada anticipo y cada cuota llevan `ORD-AAAA-NNNNN` ("ID ORDEN ANTICIPO 80%" / "ID ORDEN SALDO 20%" del Excel), de una **secuencia de PostgreSQL** compartida (`payment_order_seq`), segura con dos personas a la vez.

### 3.2 Ejemplo con números inventados (SPOT)

La tarja trae 1.000 embarcadas, de las que 20 son caídas, 10 rechazadas y 10 faltantes: **960 recibidas**. Precio pactado $7,00, oficial $7,50, materiales $400, retención 1 %.

| Concepto | Valor |
|---|---|
| **Semana N: ANTICIPO 80 %** = 1.000 × 7,00 × 0,80 | **5.600,00** |
| Fruta en la LQ = 960 × 7,00 | 6.720,00 |
| − Materiales | −400,00 |
| − Retención (1 % de 960 × máx(7,00; 7,50) = 7.200) | −72,00 |
| = Neto antes del 80 % | 6.248,00 |
| − Anticipo 80 % ya pagado | −5.600,00 |
| **Semana N+1: SALDO SPOT** | **648,00** |

Si el 80 % no llegó a salir al banco, la LQ lo anula y la cuota es de 6.248,00 (3.4).

### 3.3 FASE 0 — EN PRODUCCIÓN (17/11/2026)

Lo que quedó programado (`DESARROLLO.md`, entrada del 17/11):

| Tema | Implementado | Diferencia con el borrador anterior |
|---|---|---|
| Migración | **`2026_11_17_000001_liquidacion_fase0`** | El borrador decía `2026_11_18_000000_tarjas_faltantes_recibidas`: **ese nombre ya no aplica**. |
| FALTANTES | `boxes_missing` en `tally_sheets`, `settlement_lines` y `settlements`; CHECK caídas + rechazadas + faltantes ≤ embarcadas; la migración se detiene si una tarja vieja no cumple | — |
| RECIBIDAS | Accesor `TallySheet::boxes_received`; en la LQ, `boxes_paid` = recibidas | — |
| Pago sobre recibidas | Fruta, factura al oficial, NC, transporte reconocido y bono. Transporte descontado solo si hay recibidas. Ganancia por viaje, Tablero financiero y Cierre de embarque usan recibidas (el cruce con el INGRESO del puerto sigue con embarcadas). | Las compras **sin tarja no entran** en la LQ. |
| LQ por contrato y SPOT | `settlements.negotiation_type`, `contract_id`, `group_label` ("CONTRATO n", "SPOT"); índice único por cupo y grupo; se crean y se anulan juntas | — |
| Descuentos | Materiales y anticipos en la LQ de **mayor valor de fruta** | Resuelve la P16 |
| Retención | `retention_regime`, `retention_base`, `retention_rate` (7,4), `retention_amount` en `settlements`; por LQ; tramo por recibidas | **Base = recibidas × el mayor entre real y oficial** (sin oficial, el mínimo de la semana). Se resta en el primer pago. |
| Bloqueos | No se liquida sin contrato en compra CONTRATO (R1), sin precio real (R2) ni sin parámetros de la semana (R3) | — |

**Tarja WK45 del 05/11 (id 1):** 500 embarcadas, 10 caídas, 20 rechazadas. **Es correcta** (Peter, 17/11): 500 son las del camión y se pagan **470 recibidas**. **No se corrige**; el script de corrección que se había previsto **se descarta**.

**Por eso la migración de la fase 1 (7.3) ya no crea las columnas de retención.**

### 3.4 Casos borde

| Caso | Qué hace el sistema |
|---|---|
| El 80 % (sobre embarcadas) supera el neto de la LQ SPOT (sobre recibidas) | La LQ se graba con cuota 0 y el exceso queda como **SALDO A FAVOR DE AGAT**: un anticipo `origin = SALDO` ligado a la LQ (`source_settlement_id`), que sale preseleccionado en la siguiente LQ del vendedor (P4). El tablero lo marca en rojo. |
| Los anticipos **manuales** elegidos superan el neto | Error como hoy: "DESCUENTA MENOS ANTICIPO". |
| Al liquidar, el 80 % está **POR APROBAR, APROBADO sin lote o RECHAZADO** | La LQ lo **ANULA** (`approval_status = ANULADA`, `status = false`) y paga todo en su cuota. Se bloquea con `lockForUpdate` para que Contabilidad no lo meta en un lote en ese mismo instante. |
| Al liquidar, el 80 % está **EN BANCO o PAGADO** | Se descuenta completo. Si después el banco lo rechaza, Contabilidad lo marca FALLIDO y vuelve a "por pagar" (no se anula: ya está descontado). |
| Anticipo **manual** sin salir al banco | **No se ofrece** para descontar: solo cuentan los ANTERIOR, EN BANCO o PAGADOS (`ProducerAdvance::saldo()`). |
| ~~Cambian las EMBARCADAS con el 80 % POR APROBAR / APROBADO / EN BANCO~~ | ⚠️ **Reemplazado el 19/11 (13.A.5):** el 80 % ya no depende de la tarja. **Se quita el candado de EMBARCADAS para el tarjador**: corrige todas las cifras hasta que se liquide el cupo. Lo que mueve el 80 % son las **cajas y el precio de la compra** (Comercial), con las reglas de 13.A.5. |
| Caídas, rechazadas o faltantes | No mueven el 80 %: el tarjador las corrige hasta que se liquide el cupo. |
| La compra ya tuvo una LQ (aunque esté anulada) | No se crea un 80 % nuevo: todo se paga en la LQ. |
| Se anula la liquidación | Exige que **ninguna cuota** esté APROBADA, EN BANCO o PAGADA (primero se rechaza la cuota o se anula el lote). Sus cuotas pasan a ANULADA, su SALDO a favor se desactiva y los 80 % descontados recuperan su saldo. Las tarjas del cupo se desbloquean (y queda en su historial). |
| Pago a otra persona (con carta) | La cuota lleva `payee_third_party_id` (por defecto el vendedor). Diseño aparte (fase 2b). |

### 3.5 FASE 1a — Tarjas en el puerto (pedido de Peter, 17/11)

**Por qué va antes que los pagos:** el 80 % nace de la tarja. Si la tarja se llena en el puerto y con historial, el 80 % sale bien desde el primer día. Además, hoy hay un **riesgo real**: el guardado reemplaza toda la semana (`PUT /customer-orders/{id}/tallies` borra las tarjas que no vienen en la lista). Si el tarjador agrega un camión desde el celular mientras Liquidaciones tiene la semana abierta en la laptop, al guardar la laptop **se borra el camión del celular**.

#### A) Historial de cada tarja

**Qué hay hoy:** `TallySheet` usa `Auditable`, así que `audit_logs` ya guarda CREAR, EDITAR (campo por campo, antes → después) y BORRAR, con usuario y fecha. Solo lo ve el ADMIN en Bitácora. La tarja id 1 tiene su historial desde el 05/11 (el trait existe desde el 30/10).

**Propuesta:**
1. **Las tarjas ya no se borran** (regla 5 de `CLAUDE.md`): baja lógica con `status` y `deactivation_reason` obligatorio. "Quitar" pasa a ser **"Quitar tarja"** con icono `Ban` y motivo; en un formulario sin guardar sigue `Trash2`. Así el id de la tarja nunca desaparece y el historial por compra es una consulta simple.
2. **Endpoint de historial acotado** (no se abre la Bitácora):
   - `GET /tallies/{id}/history` (una tarja) y `GET /tallies/history?producer_quota_line_id=` (todas las de una compra, incluidas las quitadas).
   - Middleware `pantalla:tarjas,liquidar`.
   - El backend lee **solo** `audit_logs` con `table_name = 'tally_sheets'` y `record_id` de tarjas de esa compra. **Nunca** acepta `table_name` del usuario.
   - Devuelve **solo** campos de una lista blanca: fecha, N° tarja, placa, contenedor, barco, compra, embarcadas, caídas, rechazadas, faltantes, notas, estado y motivo. **No** devuelve IP, ruta ni otros campos.
   - Traduce: `shipment_id` → nombre del barco; `producer_quota_line_id` → "VENDEDOR — MARCA (CLIENTE)"; `status false` → "QUITADA".
   - Agrega los eventos de la liquidación, **sin montos**: "LIQUIDADA EN LQ-#### (SPOT) EL dd/mm POR <usuario>" y "LQ ANULADA EL dd/mm POR <usuario>: <motivo>" (de `settlements` y de su bitácora).
   - Para las tarjas borradas antes de la fase 1a (solo existen en la bitácora como BORRAR), se buscan por `changes->>'producer_quota_line_id'`.
3. **Cómo se ve:**
   - En la hoja de tarjas: icono **Historial** (`History`) en cada camión y en cada compra del resumen. Abre un `ModalShell` con una línea de tiempo: **CREADA** por X el 05/11 10:32 (500 / 10 / 20 / 0) → **EDITADA**: RECHAZADAS 15 → 20 → **QUITADA**: motivo → **LIQUIDADA** en LQ-####.
   - En el detalle de la liquidación (`SettlementDetailPage`): enlace "Historial de tarjas" por compra.
   - Botón "Ver quitadas" en la hoja de tarjas para mostrarlas en gris.
4. **Bloqueo:** **sí**, la tarja queda bloqueada al liquidar el cupo (ya existe: "YA FUE LIQUIDADO"; se extiende a quitar y reactivar). La única forma de cambiarla es **anular la LQ** (Liquidaciones), y eso queda en el historial. ~~Además, desde la fase 1b, las EMBARCADAS se bloquean para el tarjador cuando el 80 % ya está aprobado (3.4).~~ *19/11 (13.A.5): ese candado ya no hace falta.*

#### B) Quién llena las tarjas: tipo base **TARJADOR** (recomendado)

| | **TARJADOR (tipo base nuevo)** ✅ | Perfil LIQUIDACIONES restringido |
|---|---|---|
| Qué puede recibir | **Solo `tarjas`**, por una lista blanca en `Profile::PANTALLAS_PERMITIDAS`. Ni el ADMIN puede darle por error `liquidar` o `pagos`: el backend lo rechaza al guardar el perfil, la excepción y en `User::pantallas()`. | Cualquier pantalla de LIQUIDACIÓN, con dinero; depende de que nadie se equivoque al armar el perfil. |
| Inicio | Automático: `inicioDe()` lleva a la primera pantalla del menú, que es Tarjas. No hace falta código. | Igual |
| Campanita, avisos de rol | Ninguno | Los de Liquidaciones |
| Costo | Una migración como la de LEGAL (CHECK de `users.role` y `profiles.base_role`) + el perfil | Ninguno |

**Recomiendo TARJADOR:** separa a la persona del puerto de todo el dinero por sistema, no por cuidado. `tarjas` sigue con rol por defecto LIQUIDACIONES (Liquidaciones la sigue usando) y se agrega al perfil TARJADOR.

**Lo que hoy expone la pantalla `tarjas` y hay que cerrar (lo ve cualquiera con esa pantalla):**
| Fuga | Arreglo |
|---|---|
| `GET /customer-orders/{id}/tallies` devuelve `real_price` y `payment_scheme` de cada compra (la pantalla no los usa) | Se quitan de la respuesta. |
| `tarjas` está en el grupo `$lectura` de `routes/api.php`: con solo esa pantalla se leen **tarifas portuarias con precios** (`port-tariff-items`, `price-history`), clientes, embarques y líneas de embarque | Se **saca `tarjas` de `$lectura`** y del middleware de `GET /customer-orders`. Liquidaciones no pierde nada: tiene otras pantallas del grupo. |
| El listado de semanas (`TalliesPage`) usa `GET /customer-orders` | Endpoint propio `GET /tallies/weeks` (`pantalla:tarjas`): semana, año, cajas compradas, cajas con tarja y camiones; sin dinero. |

El tarjador **no ve** precios, montos, anticipos ni el estado de pago. Solo ve "LIQUIDADO" (candado). *(19/11: se quita el mensaje del 80 % aprobado; ver 13.A.5.)*

#### C) Hoja de tarjas para celular (`src/pages/liquidacion/TallySheetPage.jsx`)

**Escritorio (≥ 768 px): la tabla de hoy no cambia**, salvo: icono Historial, "Quitar tarja" con motivo para las ya guardadas y el guardado nuevo (abajo).

**Celular (< 768 px), con `window.matchMedia('(min-width: 768px)')` dentro de la página** (se dibuja una sola vista, sin duplicar campos):
1. **Encabezado compacto:** "WK45 · 2026", buscador por vendedor, marca o placa, y filtro "Solo hoy".
2. **Resumen por compra en tarjetas plegables:** vendedor — marca (cliente), COMPRADO / EMBARCADAS / RECIBIDAS, candado si está liquidado.
3. **Lista de camiones en tarjetas:** placa, N° tarja, hora, compra, y las cuatro cifras + **RECIBIDAS** en grande. Al tocar, se edita.
4. **Botón verde fijo abajo "+ Nuevo camión"** (copia fecha y barco del último, como hoy).
5. **Formulario de un camión** a pantalla completa (`ModalShell`): compra (`SelectBuscable`), barco, fecha, N° tarja, placa, contenedor; **EMBARCADAS, CAÍDAS, RECHAZADAS y FALTANTES** con `CampoNumero decimales={0}` grandes (`text-2xl py-3`, teclado numérico: ya trae `inputMode="numeric"`), RECIBIDAS calculada en vivo. Botones de ancho completo: **"Guardar camión"** (verde) y "Cancelar" (rojo, texto blanco).
6. **Guardar por camión:** cada camión se guarda solo (`POST /tallies` o `PUT /tallies/{id}`). No se reenvía la semana.
7. **Sin señal:** si falla la red, el formulario **no se cierra ni se pierde** y dice "SIN CONEXIÓN: TUS DATOS SIGUEN AQUÍ. VUELVE A GUARDAR". El celular manda un `client_key` (UUID) por camión nuevo: si el primer envío sí llegó, el reenvío **no duplica** el camión.
8. Opcional, global: `Layout.jsx` usa `p-6` en `<main>`; en celular conviene `p-3 md:p-6` (en escritorio no cambia nada). Se pregunta (sección 12).

**Guardado seguro (celular y escritorio):**
- Cada tarja viaja con su `updated_at`. Si otra persona la cambió antes, el backend responde **409**: "LA TARJA <N°> LA CAMBIÓ <USUARIO> A LAS hh:mm. RECARGA PARA VER LO ÚLTIMO".
- El `PUT` de la semana (escritorio) **ya no borra** lo que no viene: manda solo las filas nuevas o cambiadas y una lista explícita `removed: [{id, reason}]`.

---

## 4. Liquidaciones: "Tablero de anticipos y pagos"

### 4.0 Tablero (fase 1b)
Copia en el sistema el Excel "REPORTE DE ANTICIPOS WK 40" de Peter: filtrado por NEGOCIACIÓN, con los indicadores CAJAS / ANTICIPO 80% / NEGOCIACIONES y filas agrupadas por DÍA DE CORTE → COMERCIALIZA. **Es la pantalla donde se aprueba.**

**Ruta:** LIQUIDACIÓN → **Tablero de anticipos y pagos** (`/liquidacion/tablero-pagos`), página nueva `SettlementPaymentsBoardPage.jsx`. "Pagos e historial" queda para el seguimiento.

**Filtros:**

| Filtro | Valores | Por defecto |
|---|---|---|
| AÑO / SEMANA | Semana ISO de compra | La semana actual |
| NEGOCIACIÓN | SPOT / CONTRATO / MANUAL / TODAS | SPOT, como el Excel |
| DÍA DE CORTE | Una fecha o todas (`producer_quota_lines.cut_date`) | Todas |
| ESTADO | SIN TARJA / SIN PRECIO / POR APROBAR / APROBADO / EN LOTE / PAGADO / RECHAZADO / FALLIDO | POR APROBAR |
| ORDEN | ANTICIPO 80 % / SALDO SPOT / 100 % CONTRATO / ANTICIPO O PRÉSTAMO MANUAL | Todas |
| Vendedor | `SelectBuscable` | Todos |

**Indicadores:** CAJAS EMBARCADAS, TOTAL A PAGAR y N° DE ÓRDENES.
- ⚠️ **Se calculan SIEMPRE sobre las filas que se ven** con los filtros puestos. En el Excel de Peter había 3 filas ocultas que sumaban al total; en el SIAE lo que no se ve está filtrado y no suma. El backend devuelve los totales con los mismos filtros y la pantalla los compara con su suma: si no coinciden, aviso rojo.

**Tabla agrupada** (`TablaEstandar`, MAYÚSCULAS):

| Columna | Qué muestra |
|---|---|
| ☐ | Casilla por fila, activa solo si está POR APROBAR y el usuario tiene `aprobar_pagos_liquidacion`. La del encabezado marca todo el día. |
| DÍA DE CORTE | Encabezado del grupo (`cut_date`). Cuota de LQ: el último `cut_date` de sus compras. Sin fecha: grupo "SIN FECHA DE CORTE" al final, aprobable con aviso ámbar. |
| COMERCIALIZA | Vendedor |
| N° ORDEN | `ORD-AAAA-NNNNN` |
| ORDEN | 80 % / SALDO SPOT / 100 % / MANUAL |
| CAJAS EMB. | Embarcadas de las tarjas activas |
| PRECIO PACT. | `real_price` |
| A PAGAR | Monto de la orden |
| SEMANA PAGO | Programada; editable solo en CONTRATO (+0/+1) y MANUAL, antes de aprobar |
| CUENTA | OK / FALTA CUENTA (sin número). **No sale** en la vista de solo lectura. |
| ESTADO | `EstadoBadge` y motivo si fue rechazado o fallido |

- **Subtotal por día** y **total general:** cajas, a pagar, N° de órdenes. **Precio = promedio ponderado por cajas** (no el máximo, como hacía el Excel).

**Acciones:**

| Botón | Quién | Qué hace |
|---|---|---|
| **Aprobar seleccionados** (verde) | `aprobar_pagos_liquidacion` | `DialogoConfirmacion` "VAS A APROBAR N ÓRDENES POR $X" y aprueba en lote. Si alguna cambió de estado, el backend la rechaza y dice cuál. |
| **Rechazar** (por fila, rojo) | `aprobar_pagos_liquidacion` | Motivo obligatorio |
| **Semana de pago** | `aprobar_pagos_liquidacion` | CONTRATO: +0/+1 sobre N+1; MANUAL: cualquier semana desde la actual |
| **Exportar Excel** / **Imprimir** | Quien ve la pantalla | Las filas filtradas con subtotales y total; A4 horizontal con los filtros en el encabezado |

**DÍA DE CORTE (P18):**
- Se usa `producer_quota_lines.cut_date`, que ya existe; se le agrega un índice.
- **Candado:** con el 80 % aprobado, Comercial ya no puede cambiar el `cut_date` de esa compra: "LA COMPRA YA TIENE ANTICIPO APROBADO: NO SE PUEDE CAMBIAR LA FECHA DE CORTE" (`PurchaseAllocationController`). Lo mismo para el `real_price` y el `payment_scheme`.
- **Supuesto (P23 sin respuesta):** se agrupa por la fecha de corte real de cada compra; el 06/11 del Excel se toma como la fecha en que se hizo el reporte.

### 4.1 Pestañas de seguimiento
En **LIQUIDACIÓN → Pagos e historial** (`SettlementHistoryPage.jsx`): **APROBADAS / EN BANCO / PAGADAS** (solo lectura), **DEVUELTAS** (rechazadas por el jefe o devueltas por Contabilidad, con motivo) e **HISTORIAL** (lo de hoy). Ya no se registran pagos aquí (P12).

### 4.2 Reglas que valida el backend al aprobar

| Acción | Regla |
|---|---|
| Aprobar | Solo POR APROBAR. **No aprueba quien creó la liquidación o el anticipo manual** (P3); el ADMIN queda fuera de la regla. No se aprueba SIN TARJA ni SIN PRECIO. Guarda quién y cuándo. |
| Semana programada | CONTRATO: N+1 o N+2. MANUAL: semana actual o posterior. 80 % y SALDO SPOT: fija. |
| Rechazar | Motivo obligatorio: "ESCRIBE EL MOTIVO DEL RECHAZO." |
| Corregir el monto | **Nadie.** Se corrige el origen (tarja, compra, anticipo manual) y se recalcula, o se anula y rehace la LQ. |

Avisos ámbar sin bloqueo: "SIN CUENTA BANCARIA: CONTABILIDAD NO PODRÁ PAGAR POR EL BANCO", "NC POR RECIBIR". El bloqueo por **cuenta cambiada** (3 días o después de aprobar, P11) es de la fase 2.

### 4.3 Quién la ve
- `aprobar_pagos_liquidacion`: **solo el jefe de Liquidaciones**, dada por **excepción por persona** (P3). La migración **no** la pone en el perfil LIQUIDACIONES. Si no hay jefe, aprueba el ADMIN.
- `pagos` (perfil LIQUIDACIONES): ve el tablero sin casillas.
- `tablero_pagos_lectura` (nueva, perfiles GERENCIA y FINANZAS, P19): ve el tablero **sin cuentas y sin botones** (solo exportar e imprimir).
- El TARJADOR no lo ve (lista blanca).

### 4.4 Pago a otra persona (gancho)
La cuota guarda `payee_third_party_id`. El diseño "pago a otra persona con carta" (fase 2b) lo llenará por compra; si una LQ tiene dos beneficiarios, la cuota se parte y los descuentos se prorratean (P8).

---

## 5. Contabilidad: "Pagos al banco"

### 5.1 Una sola bandeja y un solo TXT (P6)
Pantalla nueva **CONTABILIDAD → Pagos al banco** (`/contabilidad/pagos-banco`, `src/pages/contabilidad/BankPaymentsPage.jsx`). Los lotes salen de "Aprobación y pago de OC", que queda como **"Aprobación de OC"** (POR APROBAR y TODAS; la clave `aprobar_oc` no cambia).

| Pestaña | Contenido |
|---|---|
| **POR PAGAR** | OC aprobadas + órdenes de Liquidaciones aprobadas (80 %, saldo SPOT, 100 %, manuales) + FALLIDAS. Filtros **ORIGEN** (OC / LIQUIDACIÓN / ANTICIPO) y **semana programada**. |
| **LOTES AL BANCO** | Lotes mixtos con el detalle por línea y su estado |
| **PAGADAS** | Historial con forma de pago, referencia y comprobante |

### 5.2 Lote de pago y TXT
- Se marcan líneas → **Revisar** (como el `preview` de hoy: dice cuáles no se pueden pagar y por qué) → **Generar archivo Pichincha**.
- **Una línea del TXT por cada orden** (P20), para cruzar cada pago 1 a 1 con su `ORD-…`.
- Al generar, cada línea **congela una copia** del beneficiario y su cuenta (banco, tipo, número **cifrado**, titular, identificación **cifrada**). Volver a bajar el TXT da el mismo archivo.
- Referencia (40 caracteres): `NOMBRE CORTO LIQ <cajas> <marca> WKxx`; si no cabe, manda el `ORD-…`.
- `PichinchaPagos` lee **líneas de lote**. El formato sigue **PROVISIONAL** hasta tener un TXT real (R6).

### 5.3 Registro del pago, pago fallido y reverso

| Situación | Qué hace Contabilidad | Efecto |
|---|---|---|
| El banco pagó todo | Lote → **PAGADO** (fecha, referencia del banco) | Líneas → PAGADO; órdenes y OC → PAGADA |
| El banco rechazó algunas líneas | Marca cada una **FALLIDA** con motivo | Lote → **PAGADO_PARCIAL**; la orden fallida vuelve a POR PAGAR (estado FALLIDA) |
| Se generó por error o el banco rechazó todo | Lote → **ANULADO** con motivo | Todo vuelve a POR PAGAR |
| Pagó fuera del TXT | **Pago manual**: forma (TRANSFERENCIA, CHEQUE o **CRUCE**, P15), fecha, referencia, comprobante | Orden → PAGADA, sin lote |
| Registró por error | **Reversar** con motivo | Orden → POR PAGAR. No se reversa una línea de un lote PAGADO sin marcarla antes FALLIDA. |
| Encontró un problema (cuenta, monto) | **Devolver a Liquidaciones** con motivo | Orden → RECHAZADA (pestaña DEVUELTAS) |
| Pago parcial de una orden | **No se permite** (P7) | — |

### 5.4 Estados

```
                ┌────────── RECHAZADA (motivo) ◄───┐
                │                                   │ jefe de Liquidaciones / Contabilidad devuelve
CALCULADA ──► POR_APROBAR ──(check)──► APROBADA ──(lote TXT)──► EN_BANCO ──► PAGADA
   (sistema)       │                    ▲   │                        │
                   │                    │   └─(pago manual)──────────┼──► PAGADA
                   │                    └──────── FALLIDA ◄──────────┘ (banco rechazó la línea)
                   └──► ANULADA  (se anuló la LQ, o el 80 % no salió al banco antes de liquidar)
```

Dos columnas, como en las OC: **`approval_status`** (POR_APROBAR, APROBADA, RECHAZADA, ANULADA, ANTERIOR) y **`payment_status`** (vacío, EN_BANCO, PAGADA, FALLIDA).

### 5.5 Quién hace qué en Contabilidad (P21: pantallas por persona, no nombres fijos)

En Contabilidad hay varias personas (Andrea, una contadora y otras). Se separan **tres permisos**; Peter decide en **Perfiles y permisos** quién tiene cuál (perfil + excepciones por persona).

| Pantalla (clave) | `solo` | Quién (sugerido) | Qué puede hacer |
|---|---|---|---|
| `aprobar_oc` *(existe)* | — | La aprobadora única de OC (como hoy) | Aprobar o rechazar OC. **Ya no** arma lotes. |
| `pagos_banco` *(nueva)* | CONTABILIDAD | Quien **prepara** (contadora y la jefa) | Ver POR PAGAR, **Revisar**, **generar el lote y el TXT**, bajarlo de nuevo, **anular un lote GENERADO**, **devolver** una orden a Liquidaciones. Ve la cuenta enmascarada `****1234`. |
| `confirmar_pagos` *(nueva, permiso dentro de Pagos al banco)* | CONTABILIDAD | Quien **sube al banco y confirma** (la jefa) | Marcar lote **PAGADO / PAGADO_PARCIAL** con fallidas, **pago manual**, **reverso**. Necesita también `pagos_banco` para ver la pantalla. |
| `cuentas_bancarias` *(existe)* | — | Quien Peter diga | Cuentas completas (hoy incluye PROVEEDOR; se agregan PRODUCTOR y COMERCIALIZADORA) |
| `asientos_contables` *(fase 3)* | CONTABILIDAD | — | Exportar asientos |

- **Perfil por defecto CONTABILIDAD:** la migración le agrega `pagos_banco` y `confirmar_pagos`, así **nadie pierde lo que hace hoy** con los lotes de OC.
- **Para separar funciones:** Peter crea en Perfiles un perfil **"CONTABILIDAD ASISTENTE"** (tipo base CONTABILIDAD) con `pagos_banco` y, si aplica, `cuentas_bancarias`; o le quita `confirmar_pagos` a la persona con una excepción.
- **No se bloquea** que la misma persona genere y confirme: el portal del Pichincha ya pide la aprobación con el token de quien sube. Si Peter quiere bloquearlo en el SIAE, es una línea en `batchPaid` (sección 12).
- **Por qué `solo`:** ningún perfil de Liquidaciones puede recibir pantallas de pagar, ni Contabilidad la de aprobar liquidaciones. La segregación la garantiza el sistema.
- **El ADMIN** puede todo. **BODEGUERO** y **TARJADOR** no aplican.

---

## 6. Cuentas contables: qué son y qué hacer

### 6.1 En simple
- Una **cuenta bancaria** es de dónde sale y a dónde llega la plata (Pichincha de AGAT → cuenta del productor). El SIAE ya las tiene.
- Una **cuenta contable** es un "cajón" del plan de cuentas de la empresa donde el contador anota cada movimiento, para que cuadren el balance y los estados financieros.
  - Por ejemplo: *Compras de fruta*, *Proveedores productores por pagar*, *Retención IR por pagar*, *Anticipos a productores*, *Bancos*.
  - Cada pago se anota en al menos dos cajones (**asiento**): lo que sale de uno entra en otro (**Debe = Haber**).
- **Peter preguntó** si "esa cuenta" debe ser la contable. Respuesta: para **pagar** basta la cuenta bancaria; para **contabilizar** se necesita la contable. Son cosas distintas, y hoy la contabilidad oficial no está en el SIAE.

### 6.2 Opciones

| | (a) Solo cuentas bancarias + exportar | (b) Plan de cuentas mínimo y asientos en el SIAE |
|---|---|---|
| Qué guarda el SIAE | Banco de origen (cuenta de AGAT) y de destino (productor); un archivo con todo lo que el contador necesita | Tabla de cuentas contables, reglas "concepto → cuenta" y un asiento por liquidación y por pago |
| Trabajo de Andrea | Digita o importa en el sistema contable | Revisa y exporta asientos ya armados |
| Riesgo | Bajo | Dos contabilidades que se pueden descuadrar (SIAE vs Contífico) |
| Costo | Bajo | Medio-alto, y necesita el plan de cuentas real |

### 6.3 Ejemplo de asiento con el plan de cuentas real de AGAT (números inventados, el mismo caso de 3.2)
Los códigos salen del plan de cuentas de Contífico que mandó Peter. El mapeo es **PROPUESTA, CONFIRMA CONTABILIDAD** (sección 6.5).

**Semana N: pago del anticipo 80 %**

| Código | Cuenta | Debe | Haber |
|---|---|---|---|
| 1.1.4.1.1 | ANTICIPO PRODUCTORES | 5.600,00 | |
| 1.1.1.3.1 | BANCO PICHINCHA | | 5.600,00 |

**Semana N+1: liquidación** (factura del productor al precio oficial: 1.000 × 7,50)

| Código | Cuenta | Debe | Haber |
|---|---|---|---|
| 5.1.1.3.1 | COMPRA DE BANANO | 7.500,00 | |
| 2.1.7.2.15 | COMPRA LOCAL DE BANANO A PRODUCTOR COD 338 (retención IR) | | 75,00 |
| 2.1.3.1.1.1 | PRODUCTORES FRUTAS | | 7.425,00 |
| 2.1.3.1.1.1 | PRODUCTORES FRUTAS (nota de crédito) | 500,00 | |
| 5.1.1.3.1 | COMPRA DE BANANO (la NC reduce la compra; *alternativa:* 4.3.5 OTRAS RENTAS) | | 500,00 |
| 2.1.3.1.1.1 | PRODUCTORES FRUTAS (materiales descontados) | 400,00 | |
| 1.1.3.1.2 | CARTON | | 300,00 |
| 1.1.3.1.3 | FUNDA | | 100,00 |
| 2.1.3.1.1.1 | PRODUCTORES FRUTAS (cruce del anticipo) | 5.600,00 | |
| 1.1.4.1.1 | ANTICIPO PRODUCTORES | | 5.600,00 |
| | **Totales** | **14.000,00** | **14.000,00** |

Saldo en 2.1.3.1.1.1: 7.425 − 500 − 400 − 5.600 = **925,00**, igual que la cuota del 20 %.

**Semana N+1: pago del 20 %** (más la comisión del banco, que paga AGAT; valor inventado)

| Código | Cuenta | Debe | Haber |
|---|---|---|---|
| 2.1.3.1.1.1 | PRODUCTORES FRUTAS | 925,00 | |
| 5.2.1.3.2 | COMISIONES BANCARIAS | 0,50 | |
| 1.1.1.3.1 | BANCO PICHINCHA | | 925,50 |

**Variante con provisión al embarcar** (si Contabilidad la usa; pregunta 27):
- Al embarcar se registra Debe 5.1.1.3.1 COMPRA DE BANANO / Haber 2.1.5.1.1 PROVISIÓN DE FRUTA LC por el valor estimado.
- Al liquidar, la provisión se cancela: Debe 2.1.5.1.1, contra 2.1.7.2.15 y 2.1.3.1.1.1.
- Así el costo cae en la semana del embarque y no en la de la liquidación.

**Otros descuentos de la LG** (parte 3), con la misma lógica: Debe 2.1.3.1.1.1 PRODUCTORES FRUTAS y Haber la cuenta del costo que se recupera.
- **Evaluadores:** 5.1.4.11 SERVICIO EVALUADORES.
- **Estibas:** 5.1.4.19 ESTIBAS.
### 6.4 Recomendación
- **AHORA (fases 1 y 2): opción (a).** Se registra de qué **cuenta bancaria de AGAT** sale cada lote (tabla nueva `company_bank_accounts`; pregunta 9). Se agrega un **exportable** "PAGOS Y RETENCIONES" (Excel o CSV) por rango de fechas, con una fila por liquidación y por pago: fecha, vendedor, factura, NC, retención, materiales, anticipo, pagado y lote. Es lo mismo que hoy sacan las hojas PAGOS y RETENCIONES del Excel.
- **MÁS ADELANTE (fase 3, si Peter y Andrea lo deciden): opción (b) liviana.**
  - Una tabla de **cuentas contables** con el código del plan oficial (lo da Andrea o el contador) y una tabla de **reglas** (FRUTA → cuenta X, RETENCIÓN → Y…).
  - El SIAE arma el **asiento sugerido** de cada liquidación y de cada pago, y lo **exporta** con el formato de importación del sistema contable.
  - **No se lleva un libro mayor ni un balance en el SIAE.** El sistema oficial sigue siendo Contífico u otro. Así se deja la puerta abierta a Contífico sin integrarlo todavía.
- Los **códigos** del ejemplo ya son los del plan de cuentas real de AGAT (Contífico). El **mapeo** es una propuesta: lo confirma Contabilidad (6.5 y preguntas 24 a 30).

### 6.5 Tabla CONCEPTO → CUENTA CONTABLE · **PROPUESTA, CONFIRMA CONTABILIDAD**
Fuente: plan de cuentas de AGAT exportado de Contífico (617 cuentas; columnas Código / Cuenta / Tipo), enviado por Peter el 17/11.
- Solo hay **códigos y nombres de cuentas contables**, nunca números de cuentas bancarias.
- Las celdas **POR DEFINIR** son vacíos del plan que debe resolver Contabilidad.

| # | Concepto en el SIAE | Cuándo | Lado | Código propuesto | Cuenta | Alternativa / nota |
|---|---|---|---|---|---|---|
| C1 | COMPRA DE FRUTA (factura al precio oficial) | Al liquidar | DEBE | **5.1.1.3.1** | COMPRA DE BANANO | Si se lleva como inventario: 1.1.3.1.1 FRUTA (pregunta 24) |
| C1b | PROVISIÓN DE FRUTA (al embarcar, antes de la LC) | Al embarcar; se cancela al liquidar | HABER / DEBE | **2.1.5.1.1** | PROVISIÓN DE FRUTA LC | Solo si Contabilidad provisiona (pregunta 27) |
| C2 | NOTA DE CRÉDITO / DIFERENCIA DE PRECIO (oficial − pactado) | Al liquidar | HABER | POR DEFINIR (propuesta **5.1.1.3.1**, reduce la compra) | COMPRA DE BANANO | Alternativa 4.3.5 OTRAS RENTAS; **no hay cuenta específica** (pregunta 25) |
| C3 | POR PAGAR AL PRODUCTOR | Al liquidar (haber) y al pagar (debe) | AMBOS | **2.1.3.1.1.1** | PRODUCTORES FRUTAS | ¿También para comercializadoras? |
| C4 | RETENCIÓN IR BANANO | Al liquidar | HABER | **2.1.7.2.15** | COMPRA LOCAL DE BANANO A PRODUCTOR COD 338 | Alternativa genérica 2.1.7.2.16 RETENCIÓN IR POR PAGAR |
| C5 | ANTICIPO 80 % SPOT | Al pagar el 80 % (debe) y al liquidar (haber) | AMBOS | **1.1.4.1.1** | ANTICIPO PRODUCTORES | ⚠️ En el plan, la cuenta madre 1.1.4.1 "Anticipo proveedores" tiene el Tipo "Seguros pagados por anticipado": parece un error de Contífico (pregunta 29) |
| C6 | PRÉSTAMOS A PRODUCTORES | Al entregar y al descontar | AMBOS | POR DEFINIR (opción **1.1.4.4**) | OTROS ANTICIPOS ENTREGADOS | **No existe cuenta de préstamos a productores**; solo hay de empleados (pregunta 26) |
| C7 | MATERIALES DESCONTADOS AL PRODUCTOR | Al liquidar | HABER | **1.1.3.1.2** / **1.1.3.1.3** / **1.1.3.1.4** / **1.1.3.1.7** … | CARTON / FUNDA / QUIMICO / MATERIALES DE EMBARQUE | Una cuenta por categoría de insumo. **No existe "Cuentas por cobrar productores"** (pregunta 28) |
| C8 | TRANSPORTE DESCONTADO AL PRODUCTOR | Al liquidar | HABER | POR DEFINIR | — | Recupera el costo del flete (pregunta 30) |
| C9 | TRANSPORTE RECONOCIDO AL PRODUCTOR | Al liquidar | DEBE | POR DEFINIR (opción **5.1.4.9**) | TRANSPORTE DE CARTONES Y MATERIALES | **No hay cuenta de transporte de fruta**; usar esta o crear una (pregunta 30) |
| C10 | BONO / EXTRA AL PRODUCTOR | Al liquidar | DEBE | POR DEFINIR (propuesta **5.1.1.3.1**) | COMPRA DE BANANO | Es mayor costo de la fruta |
| C11a | EVALUADORES DESCONTADOS | Al liquidar (LG) | HABER | **5.1.4.11** | SERVICIO EVALUADORES | El descuento recupera el costo |
| C11b | ESTIBAS DESCONTADAS | Al liquidar (LG) | HABER | **5.1.4.19** | ESTIBAS | Ídem |
| C11c | COMISIÓN DE TRANSFERENCIA DESCONTADA AL PRODUCTOR | Al liquidar (LG) | HABER | POR DEFINIR (propuesta **5.2.1.3.2**) | COMISIONES BANCARIAS | Recupera lo que cobra el banco |
| C12 | SALDO A FAVOR DE AGAT (descuentos > cuota) | Al liquidar en negativo | DEBE | POR DEFINIR (opción **1.1.4.4**) | OTROS ANTICIPOS ENTREGADOS | Pregunta 4 |
| C13 | BANCOS (cuenta de origen del lote) | Al pagar | HABER | **1.1.1.3.1** / **1.1.1.3.2** / **1.1.1.3.3** / **1.1.1.3.4** | BANCO PICHINCHA / BANCO GUAYAQUIL / BANCO INTERNACIONAL / BANCO PICHINCHA AHORROS | El lote guarda de qué cuenta de AGAT sale (`company_bank_accounts`, fase 2) |
| C14 | COMISIÓN BANCARIA QUE PAGA AGAT | Al pagar | DEBE | **5.2.1.3.2** | COMISIONES BANCARIAS | |
| C15 | OC DE DEPARTAMENTO | Al pagar la OC | DEBE | POR DEFINIR por departamento | — | Fuera de este módulo, pero sale en el mismo TXT |

**Cómo se guarda (fase 3):**
- `accounting_accounts`: se carga **todo** el plan de Contífico (código, nombre, tipo, `status`) con un script `CARGA_BD` + simulación.
- `accounting_account_mappings`: concepto C1–C15 → cuenta; para C7, una por categoría de insumo; para C13, una por cuenta bancaria de AGAT.
- Ambas tablas con modelo `Auditable` y pantalla `asientos_contables` (solo CONTABILIDAD). La migración se diseña cuando Contabilidad confirme el mapeo.
- **Hasta entonces (fase 2),** el exportable "PAGOS Y RETENCIONES" ya sale con estos códigos propuestos en una columna "CUENTA SUGERIDA".

---

## 7. Base de datos y código: cambios sobre lo que ya existe

**Se reutiliza tal cual:** `settlements` (con lo de la fase 0), `settlement_lines`, `settlement_advances` (también para el 80 % descontado), `banks`, `third_party_bank_accounts` (cifrada), `bank_payment_batches`, `RetencionBanano`, `retention_brackets`, `settlement_week_parameters`, `audit_logs`, `notifications` (campanita), perfiles y `config/pantallas.php`.

**No se crea** una tabla paralela de "pagos": se **extienden** `settlement_payments` (cuotas) y `producer_advances` (80 %, manuales y saldo a favor). Solo es nueva la **línea del lote** (`bank_payment_batch_items`).

### 7.1 Tablas y columnas

**Fase 1a (tarjas):**

| Tabla | Cambio | Tipo / regla | Para qué |
|---|---|---|---|
| `users`, `profiles` | CHECK de `role` / `base_role` | + 'TARJADOR' | Tipo base de la persona del puerto |
| `profiles` | fila nueva | TARJADOR, `screens = ['tarjas']` | Perfil inicial |
| `tally_sheets` | + `status` | boolean, default true | Baja lógica: ya no se borran |
| | + `deactivation_reason` | varchar(255), null; CHECK `status OR deactivation_reason IS NOT NULL` | Motivo al quitar |
| | + `client_key` | uuid, null, **único** | El celular no duplica un camión al reenviar |
| | índice parcial | `(producer_quota_line_id) WHERE status` | Sumas de tarjas activas |

**Fase 1b (pagos):**

| Tabla | Cambio | Tipo / regla | Para qué |
|---|---|---|---|
| `contracts` | + `payment_week_offset` | smallint, default 0, CHECK IN (0,1) | CONTRATO: pagar en N+1 (0) o N+2 (1); lo pone LEGAL (P2) |
| `settlements` | + `advance_80_amount` | decimal(12,2), default 0, CHECK ≥ 0 | 80 % descontado en la LQ SPOT (columna "ANTICIPO 80%" del Excel) |
| `producer_advances` | + `producer_quota_id`, `producer_quota_line_id` | FK null | Cupo y **negociación** del 80 % |
| | + `source_settlement_id` | FK → settlements, null | LQ que generó un SALDO A FAVOR |
| | + `payment_order_code` | varchar(20), único, null | `ORD-AAAA-NNNNN` |
| | + `origin` | varchar(10), default 'MANUAL', CHECK IN ('MANUAL','SPOT_80','SALDO') | |
| | + `boxes` | integer, null | Embarcadas con que se calculó el 80 % |
| | + `scheduled_week`, `scheduled_year` | smallint, null | Semana ISO programada |
| | + `approval_status`, `approved_by`, `approved_at`, `rejection_reason` | como las OC | Aprobación |
| | + `payment_status`, `payment_method`, `paid_at`, `payment_reference`, `paid_by`, `voucher_path` | como las OC | Pago |
| | índice único parcial | `(producer_quota_line_id) WHERE origin='SPOT_80' AND status` | Un solo 80 % activo por negociación |
| `producer_quota_lines` | índice en `cut_date` | index | DÍA DE CORTE del tablero |
| `settlement_payments` | + `payment_order_code`, `approval_status`, `approved_by`, `approved_at`, `rejection_reason`, `scheduled_week`, `scheduled_year`, `payee_third_party_id`, `payment_status`, `payment_method`, `voucher_path` | como arriba | |
| **`bank_payment_batch_items`** *(nueva)* | lote, `source_type` (OC / LIQUIDACION / ANTICIPO), una FK por origen (CHECK: exactamente una), beneficiario, `amount` (> 0), copia de la cuenta (`account_number` y `holder_id` **cifrados**), `reference` (40), `status` (EN_BANCO / PAGADO / FALLIDO / ANULADO), `failure_reason`, `paid_at`, `bank_reference` | | Línea del TXT |
| | índices únicos parciales por origen `WHERE status IN ('EN_BANCO','PAGADO')` | | **Nada en dos lotes vivos: candado contra el doble pago** |
| `bank_payment_batches` | CHECK de `status` | + 'PAGADO_PARCIAL' | |
| secuencia `payment_order_seq` | nueva | | Correlativo de `ORD-…` compartido |
| `company_bank_accounts` | *(fase 2, otra migración)* | | Cuentas de AGAT de origen (P9) |

### 7.2 Migración FASE 1a

`database/migrations/2026_11_18_000001_tarjas_puerto_historial.php` (la fecha final es la del día en que se programe; debe ir **antes** que la de 1b).

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 18/11/2026: TARJAS EN EL PUERTO (fase 1a de docs/modulos/pagos-liquidaciones.md, sección 3.5).
//   1. Tipo base TARJADOR: la persona del puerto solo puede tener la pantalla 'tarjas'
//      (lista blanca en Profile::PANTALLAS_PERMITIDAS). Nunca ve precios ni montos.
//   2. Las tarjas ya no se borran: baja lógica con status y motivo, para que el historial
//      (audit_logs) quede completo desde que se crean hasta que se liquidan.
//   3. client_key: el celular manda una clave por camión nuevo; si la señal falla y reenvía, no se duplica.
return new class extends Migration
{
    private const ROLES_ANTES = "'ADMIN','JEFE_BODEGA','COORDINADOR_INVENTARIO','BODEGUERO','EXPORTACIONES','COMERCIAL','GERENCIA','FINANZAS','CONTABILIDAD','DEPARTAMENTO','LIQUIDACIONES','LEGAL'";

    public function up(): void
    {
        // 1) Tipo base TARJADOR (la base valida los tipos, como en 2026_11_12_000002_departamento_legal)
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (' . self::ROLES_ANTES . ",'TARJADOR'))");
        DB::statement('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_base_role_check');
        DB::statement('ALTER TABLE profiles ADD CONSTRAINT profiles_base_role_check CHECK (base_role IN (' . self::ROLES_ANTES . ",'TARJADOR'))");
        if (!DB::table('profiles')->where('name', 'TARJADOR')->exists()) {
            DB::table('profiles')->insert([
                'name' => 'TARJADOR', 'base_role' => 'TARJADOR',
                'description' => 'Personal de tarjas en el puerto: registra los camiones (embarcadas, caídas, rechazadas y faltantes) desde el celular. No ve precios ni montos.',
                'screens' => json_encode(['tarjas']),
                'status' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        // 2) y 3) Tarjas con baja lógica y clave del celular
        Schema::table('tally_sheets', function (Blueprint $table) {
            $table->boolean('status')->default(true);
            $table->string('deactivation_reason', 255)->nullable(); // motivo al quitar la tarja
            $table->uuid('client_key')->nullable()->unique();       // reenvío desde el celular sin duplicar
        });
        DB::statement('ALTER TABLE tally_sheets ADD CONSTRAINT tally_sheets_motivo_check CHECK (status OR deactivation_reason IS NOT NULL)');
        DB::statement('CREATE INDEX tally_sheets_compra_activa_idx ON tally_sheets (producer_quota_line_id) WHERE status');
    }

    public function down(): void
    {
        // Sin la columna status, las tarjas quitadas volverían a contar como activas: se detiene.
        if (DB::table('tally_sheets')->where('status', false)->exists()) {
            throw new RuntimeException('HAY TARJAS QUITADAS: NO SE PUEDE REVERTIR SIN QUE VUELVAN A SUMAR. REVÍSALAS ANTES.');
        }
        DB::statement('DROP INDEX IF EXISTS tally_sheets_compra_activa_idx');
        DB::statement('ALTER TABLE tally_sheets DROP CONSTRAINT IF EXISTS tally_sheets_motivo_check');
        Schema::table('tally_sheets', function (Blueprint $table) {
            $table->dropUnique(['client_key']);
            $table->dropColumn(['status', 'deactivation_reason', 'client_key']);
        });

        DB::table('profiles')->where('base_role', 'TARJADOR')->whereNotExists(
            fn ($q) => $q->select(DB::raw(1))->from('users')->whereColumn('users.profile_id', 'profiles.id')
        )->delete();
        if (!DB::table('users')->where('role', 'TARJADOR')->exists()) {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            DB::statement('ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (' . self::ROLES_ANTES . '))');
        }
        if (!DB::table('profiles')->where('base_role', 'TARJADOR')->exists()) {
            DB::statement('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_base_role_check');
            DB::statement('ALTER TABLE profiles ADD CONSTRAINT profiles_base_role_check CHECK (base_role IN (' . self::ROLES_ANTES . '))');
        }
    }
};
```

**Código de la fase 1a (lo programa la sesión principal):**

| Archivo | Cambio |
|---|---|
| `app/Models/Profile.php` | `TIPOS_BASE` + 'TARJADOR'. Constante `PANTALLAS_PERMITIDAS = ['TARJADOR' => ['tarjas']]`. `pantallasVedadas()`: si el tipo tiene lista blanca, veda todo lo que no esté en ella. Eso ya cubre perfil, excepciones y `User::pantallas()`. |
| `ProfileController::screens` + `src/routes/menu.js` (`pantallasDelTipo`) | Devolver y respetar la lista blanca, para que el selector de pantallas no ofrezca nada más al TARJADOR. Si la lista de tipos base está fija en el frontend (Usuarios, Perfiles), agregar TARJADOR. ⚠️ `menu.js` tiene cambios de espacios de Peter: no van en el commit. |
| `app/Models/TallySheet.php` | `$fillable` + `status`, `deactivation_reason`, `client_key`; `$casts` + `'status' => 'boolean'`. |
| `ProducerQuotaLine::tallies()` | `->where('status', true)`. Con eso se corrigen `SettlementController` (`withSum`/`withCount`) y `PurchaseAllocationController` línea ~597. |
| Consultas directas a `tally_sheets` | Agregar `where status`: `PurchaseAllocationController` (~283 y ~906), `ShipmentClosingController` (~254), `VoyageCostController` (~363-364). |
| `TallySheetController` | `cargar()`: solo activas (con `?quitadas=1`, también las quitadas) y **sin** `real_price` ni `payment_scheme`. `update()` (escritorio): sin borrado implícito; filas con `updated_at` (409 si cambió); `removed: [{id, reason}]` desactiva uno por uno. Métodos nuevos: `weeks`, `storeOne`, `updateOne`, `deactivate`, `reactivate`, `history`. Mismas validaciones de hoy (embarcadas > 0, partes ≤ embarcadas, cupo LIQUIDADO bloquea agregar, cambiar, quitar y reactivar). |
| `routes/api.php` | Sacar `tarjas` de `$lectura` y del middleware de `GET /customer-orders`. Rutas nuevas de 7.5. |
| Frontend | `TalliesPage.jsx` usa `GET /tallies/weeks`. `TallySheetPage.jsx`: vista celular (3.5 C), "Quitar tarja" con motivo, Historial, guardado nuevo. Modal de historial nuevo **solo si no cabe en la página** (por ejemplo `src/components/HistorialTarjaModal.jsx`, reutilizado por `SettlementDetailPage`). `src/api/settlements.js`: funciones nuevas. |

### 7.3 Migración FASE 1b

`database/migrations/2026_11_18_000002_pagos_liquidaciones.php` (revisada: ya **no** crea la retención, que vino en la fase 0). ⚠️ *19/11:* ese nombre **ya está usado** por `2026_11_18_000002_verificacion_cuentas_bancarias`; la fecha final es la del día en que se programe. Los cambios del 19/11 a esta migración están en **13.A.4**.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 18/11/2026: PAGOS DE LIQUIDACIONES → CONTABILIDAD (fase 1b de docs/modulos/pagos-liquidaciones.md).
//   - SPOT: el 80 % es un anticipo automático (origin SPOT_80) por negociación, sobre las EMBARCADAS;
//     la LQ SPOT lo descuenta (settlements.advance_80_amount). Si sobra, SALDO A FAVOR DE AGAT (origin SALDO).
//   - CONTRATO: una cuota del 100 %; semana de pago = N+1 + payment_week_offset (0/1).
//   - Anticipos y préstamos manuales también pasan por aprobación y TXT (P14).
//   - Aprobación (jefe de Liquidaciones) y pago (Contabilidad) como las OC; lotes con líneas y cuenta congelada.
//   - La retención IR ya está en settlements desde 2026_11_17_000001_liquidacion_fase0.
return new class extends Migration
{
    public function up(): void
    {
        // 1) Contrato: pagar en la semana siguiente a la compra (0) o una más (1). Lo pone LEGAL.
        Schema::table('contracts', function (Blueprint $table) {
            $table->smallInteger('payment_week_offset')->default(0);
        });
        DB::statement('ALTER TABLE contracts ADD CONSTRAINT contracts_payment_week_offset_check CHECK (payment_week_offset IN (0,1))');

        // 2) Correlativo de órdenes de pago ORD-AAAA-NNNNN (compartido por anticipos y cuotas; seguro con concurrencia)
        DB::statement('CREATE SEQUENCE IF NOT EXISTS payment_order_seq');

        // 3) LQ SPOT: 80 % descontado, a la vista como en el Excel
        Schema::table('settlements', function (Blueprint $table) {
            $table->decimal('advance_80_amount', 12, 2)->default(0)->after('advances_amount');
        });
        DB::statement('ALTER TABLE settlements ADD CONSTRAINT settlements_advance_80_check CHECK (advance_80_amount >= 0)');

        // 4) Anticipos: 80 % automático, saldo a favor y manuales, con aprobación y pago
        Schema::table('producer_advances', function (Blueprint $table) {
            $table->foreignId('producer_quota_id')->nullable()->constrained('producer_quotas');
            $table->foreignId('producer_quota_line_id')->nullable()->constrained('producer_quota_lines'); // negociación del 80 %
            $table->foreignId('source_settlement_id')->nullable()->constrained('settlements');           // LQ que dejó el SALDO
            $table->string('payment_order_code', 20)->nullable()->unique();
            $table->string('origin', 10)->default('MANUAL');      // MANUAL | SPOT_80 | SALDO
            $table->integer('boxes')->nullable();                 // embarcadas con que se calculó el 80 %
            $table->smallInteger('scheduled_week')->nullable();
            $table->smallInteger('scheduled_year')->nullable();
            $table->string('approval_status', 15)->default('POR_APROBAR');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('payment_status', 10)->nullable();     // null | EN_BANCO | PAGADA | FALLIDA
            $table->string('payment_method', 15)->nullable();     // LOTE_BANCO | TRANSFERENCIA | CHEQUE | CRUCE
            $table->date('paid_at')->nullable();
            $table->string('payment_reference', 60)->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users');
            $table->string('voucher_path', 255)->nullable();
            $table->index(['approval_status', 'payment_status']);
        });
        // Los anticipos que ya existían se entregaron por fuera: ANTERIOR + PAGADA (no entran a bandejas y se siguen descontando)
        DB::table('producer_advances')->update(['approval_status' => 'ANTERIOR', 'payment_status' => 'PAGADA']);
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_origin_check CHECK (origin IN ('MANUAL','SPOT_80','SALDO'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_approval_status_check CHECK (approval_status IN ('POR_APROBAR','APROBADA','RECHAZADA','ANULADA','ANTERIOR'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_payment_status_check CHECK (payment_status IS NULL OR payment_status IN ('EN_BANCO','PAGADA','FALLIDA'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('LOTE_BANCO','TRANSFERENCIA','CHEQUE','CRUCE'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_spot80_check CHECK (origin <> 'SPOT_80' OR (producer_quota_id IS NOT NULL AND producer_quota_line_id IS NOT NULL))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_saldo_check CHECK (origin <> 'SALDO' OR source_settlement_id IS NOT NULL)");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_pago_aprobado_check CHECK (payment_status IS NULL OR approval_status IN ('APROBADA','ANTERIOR'))");
        DB::statement("CREATE UNIQUE INDEX producer_advances_spot80_activo_unique ON producer_advances (producer_quota_line_id) WHERE origin = 'SPOT_80' AND status");
        Schema::table('producer_quota_lines', fn (Blueprint $table) => $table->index('cut_date'));

        // 5) Cuotas de liquidación: aprobación, semana programada, beneficiario y pago
        Schema::table('settlement_payments', function (Blueprint $table) {
            $table->string('payment_order_code', 20)->nullable()->unique();
            $table->string('approval_status', 15)->default('POR_APROBAR');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->smallInteger('scheduled_week')->nullable();
            $table->smallInteger('scheduled_year')->nullable();
            $table->foreignId('payee_third_party_id')->nullable()->constrained('third_parties'); // null = el vendedor
            $table->string('payment_status', 10)->nullable();
            $table->string('payment_method', 15)->nullable();
            $table->string('voucher_path', 255)->nullable();
            $table->index(['approval_status', 'payment_status']);
        });
        DB::table('settlement_payments')->whereNotNull('paid_at')
            ->update(['approval_status' => 'ANTERIOR', 'payment_status' => 'PAGADA', 'payment_method' => 'TRANSFERENCIA']);
        DB::statement("ALTER TABLE settlement_payments ADD CONSTRAINT sp_approval_status_check CHECK (approval_status IN ('POR_APROBAR','APROBADA','RECHAZADA','ANULADA','ANTERIOR'))");
        DB::statement("ALTER TABLE settlement_payments ADD CONSTRAINT sp_payment_status_check CHECK (payment_status IS NULL OR payment_status IN ('EN_BANCO','PAGADA','FALLIDA'))");
        DB::statement("ALTER TABLE settlement_payments ADD CONSTRAINT sp_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('LOTE_BANCO','TRANSFERENCIA','CHEQUE','CRUCE'))");
        DB::statement("ALTER TABLE settlement_payments ADD CONSTRAINT sp_pago_aprobado_check CHECK (payment_status IS NULL OR approval_status IN ('APROBADA','ANTERIOR'))");

        // 6) Líneas del lote al banco (una por orden, P20) con la cuenta congelada y cifrada
        Schema::create('bank_payment_batch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_payment_batch_id')->constrained('bank_payment_batches');
            $table->string('source_type', 12);                    // OC | LIQUIDACION | ANTICIPO
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders');
            $table->foreignId('settlement_payment_id')->nullable()->constrained('settlement_payments');
            $table->foreignId('producer_advance_id')->nullable()->constrained('producer_advances');
            $table->foreignId('payee_third_party_id')->nullable()->constrained('third_parties');
            $table->decimal('amount', 12, 2);
            $table->foreignId('bank_id')->nullable()->constrained('banks'); // null solo en líneas históricas de OC
            $table->string('account_type', 10)->nullable();
            $table->text('account_number')->nullable();           // cifrado (cast 'encrypted')
            $table->string('holder_id_type', 1)->nullable();
            $table->text('holder_id')->nullable();                // cifrado (cédula o RUC)
            $table->string('holder_name', 120)->nullable();
            $table->string('reference', 40)->nullable();
            $table->string('status', 10)->default('EN_BANCO');    // EN_BANCO | PAGADO | FALLIDO | ANULADO
            $table->text('failure_reason')->nullable();
            $table->date('paid_at')->nullable();
            $table->string('bank_reference', 60)->nullable();
            $table->timestamps();
            $table->index('bank_payment_batch_id');
        });
        DB::statement("ALTER TABLE bank_payment_batch_items ADD CONSTRAINT bpbi_status_check CHECK (status IN ('EN_BANCO','PAGADO','FALLIDO','ANULADO'))");
        DB::statement("ALTER TABLE bank_payment_batch_items ADD CONSTRAINT bpbi_source_type_check CHECK (source_type IN ('OC','LIQUIDACION','ANTICIPO'))");
        DB::statement("ALTER TABLE bank_payment_batch_items ADD CONSTRAINT bpbi_amount_check CHECK (amount > 0)");
        DB::statement("ALTER TABLE bank_payment_batch_items ADD CONSTRAINT bpbi_source_check CHECK (
            (source_type = 'OC'          AND purchase_order_id IS NOT NULL AND settlement_payment_id IS NULL AND producer_advance_id IS NULL) OR
            (source_type = 'LIQUIDACION' AND settlement_payment_id IS NOT NULL AND purchase_order_id IS NULL AND producer_advance_id IS NULL) OR
            (source_type = 'ANTICIPO'    AND producer_advance_id IS NOT NULL AND purchase_order_id IS NULL AND settlement_payment_id IS NULL))");
        // Candado contra el doble pago: un mismo origen no puede estar en dos líneas vivas
        foreach (['purchase_order_id', 'settlement_payment_id', 'producer_advance_id'] as $col) {
            DB::statement("CREATE UNIQUE INDEX bpbi_{$col}_vivo_unique ON bank_payment_batch_items ({$col}) WHERE status IN ('EN_BANCO','PAGADO')");
        }
        // Las OC que ya están en lotes pasan a líneas (sin copia de cuenta: no se descifra en una migración).
        // En producción hay 0 lotes (17/11); se deja por si cambia antes de subir.
        DB::statement("INSERT INTO bank_payment_batch_items (bank_payment_batch_id, source_type, purchase_order_id, payee_third_party_id, amount, status, created_at, updated_at)
            SELECT po.bank_payment_batch_id, 'OC', po.id, po.third_party_id,
                   GREATEST(COALESCE((SELECT SUM(l.total) FROM purchase_order_lines l WHERE l.purchase_order_id = po.id), 0), 0.01),
                   CASE b.status WHEN 'PAGADO' THEN 'PAGADO' WHEN 'ANULADO' THEN 'ANULADO' ELSE 'EN_BANCO' END, now(), now()
            FROM purchase_orders po JOIN bank_payment_batches b ON b.id = po.bank_payment_batch_id");

        // 7) Lote pagado en parte
        DB::statement('ALTER TABLE bank_payment_batches DROP CONSTRAINT IF EXISTS bpb_status_check');
        DB::statement("ALTER TABLE bank_payment_batches ADD CONSTRAINT bpb_status_check CHECK (status IN ('GENERADO','PAGADO','PAGADO_PARCIAL','ANULADO'))");

        // 8) Perfiles: pantallas nuevas (no se le quita nada a nadie).
        //    aprobar_pagos_liquidacion NO va al perfil LIQUIDACIONES: es solo del jefe, por excepción (P3).
        $this->agregarPantalla('CONTABILIDAD', 'pagos_banco');
        $this->agregarPantalla('CONTABILIDAD', 'confirmar_pagos');
        $this->agregarPantalla('GERENCIA', 'tablero_pagos_lectura');
        $this->agregarPantalla('FINANZAS', 'tablero_pagos_lectura');
    }

    public function down(): void
    {
        foreach ([['CONTABILIDAD', 'pagos_banco'], ['CONTABILIDAD', 'confirmar_pagos'],
                  ['GERENCIA', 'tablero_pagos_lectura'], ['FINANZAS', 'tablero_pagos_lectura']] as [$perfil, $clave]) {
            $this->quitarPantalla($perfil, $clave);
        }

        DB::statement('ALTER TABLE bank_payment_batches DROP CONSTRAINT IF EXISTS bpb_status_check');
        DB::table('bank_payment_batches')->where('status', 'PAGADO_PARCIAL')->update(['status' => 'PAGADO']);
        DB::statement("ALTER TABLE bank_payment_batches ADD CONSTRAINT bpb_status_check CHECK (status IN ('GENERADO','PAGADO','ANULADO'))");

        Schema::dropIfExists('bank_payment_batch_items');

        foreach (['sp_approval_status_check', 'sp_payment_status_check', 'sp_payment_method_check', 'sp_pago_aprobado_check'] as $c) {
            DB::statement("ALTER TABLE settlement_payments DROP CONSTRAINT IF EXISTS {$c}");
        }
        Schema::table('settlement_payments', function (Blueprint $table) {
            $table->dropIndex(['approval_status', 'payment_status']);
            $table->dropConstrainedForeignId('approved_by');
            $table->dropConstrainedForeignId('payee_third_party_id');
            $table->dropUnique(['payment_order_code']);
            $table->dropColumn(['payment_order_code', 'approval_status', 'approved_at', 'rejection_reason', 'scheduled_week',
                'scheduled_year', 'payment_status', 'payment_method', 'voucher_path']);
        });

        DB::statement('DROP INDEX IF EXISTS producer_advances_spot80_activo_unique');
        Schema::table('producer_quota_lines', fn (Blueprint $table) => $table->dropIndex(['cut_date']));
        foreach (['pa_origin_check', 'pa_approval_status_check', 'pa_payment_status_check', 'pa_payment_method_check',
                  'pa_spot80_check', 'pa_saldo_check', 'pa_pago_aprobado_check'] as $c) {
            DB::statement("ALTER TABLE producer_advances DROP CONSTRAINT IF EXISTS {$c}");
        }
        // Los 80 % automáticos y los saldos a favor no tienen sentido sin estas columnas: se desactivan (no se borran)
        DB::table('producer_advances')->where('origin', '<>', 'MANUAL')->update(['status' => false]);
        Schema::table('producer_advances', function (Blueprint $table) {
            $table->dropIndex(['approval_status', 'payment_status']);
            foreach (['producer_quota_id', 'producer_quota_line_id', 'source_settlement_id', 'approved_by', 'paid_by'] as $fk) {
                $table->dropConstrainedForeignId($fk);
            }
            $table->dropUnique(['payment_order_code']);
            $table->dropColumn(['payment_order_code', 'origin', 'boxes', 'scheduled_week', 'scheduled_year', 'approval_status',
                'approved_at', 'rejection_reason', 'payment_status', 'payment_method', 'paid_at', 'payment_reference', 'voucher_path']);
        });

        DB::statement('ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_advance_80_check');
        Schema::table('settlements', fn (Blueprint $table) => $table->dropColumn('advance_80_amount'));
        DB::statement('DROP SEQUENCE IF EXISTS payment_order_seq');
        DB::statement('ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_payment_week_offset_check');
        Schema::table('contracts', fn (Blueprint $table) => $table->dropColumn('payment_week_offset'));
    }

    // profiles.screens es jsonb: llega como texto y se guarda como JSON
    private function agregarPantalla(string $perfil, string $clave): void
    {
        foreach (DB::table('profiles')->where('name', $perfil)->where('base_role', $perfil)->get() as $p) {
            $pantallas = json_decode($p->screens ?? '[]', true) ?: [];
            if (!in_array($clave, $pantallas, true)) {
                $pantallas[] = $clave;
                DB::table('profiles')->where('id', $p->id)->update(['screens' => json_encode($pantallas)]);
            }
        }
    }

    private function quitarPantalla(string $perfil, string $clave): void
    {
        foreach (DB::table('profiles')->where('name', $perfil)->where('base_role', $perfil)->get() as $p) {
            $pantallas = array_values(array_diff(json_decode($p->screens ?? '[]', true) ?: [], [$clave]));
            DB::table('profiles')->where('id', $p->id)->update(['screens' => json_encode($pantallas)]);
        }
    }
};
```

**Notas para quien programe:**
- Al programar, confirmar que `SUM(purchase_order_lines.total)` es el mismo valor que el accesor `PurchaseOrder::total`; si no, llenar `amount` con un comando aparte que use el modelo (con simulación).
- Código de orden: `'ORD-' . $anio . '-' . str_pad(DB::selectOne("select nextval('payment_order_seq') as n")->n, 5, '0', STR_PAD_LEFT)`.
- Semana ISO N+1 o N+2: con `Carbon::now()->setISODate($anio, $semana)->addWeeks(k)` y leer `isoWeek`/`isoWeekYear` (cruza bien el cambio de año).

### 7.4 Modelos: `$fillable` y `$casts`

| Modelo | `$fillable` + | `$casts` + / notas |
|---|---|---|
| `TallySheet` (1a) | `status`, `deactivation_reason`, `client_key` | `'status' => 'boolean'` |
| `Profile` (1a) | — | `TIPOS_BASE` + TARJADOR; `PANTALLAS_PERMITIDAS` |
| `Contract` | `payment_week_offset` | `'integer'`. LEGAL lo edita en `saveContracts` (`in:0,1`). |
| `Settlement` | `advance_80_amount` | `'decimal:2'` |
| `ProducerAdvance` | `producer_quota_id`, `producer_quota_line_id`, `source_settlement_id`, `payment_order_code`, `origin`, `boxes`, `scheduled_week`, `scheduled_year`, `approval_status`, `approved_by`, `approved_at`, `rejection_reason`, `payment_status`, `payment_method`, `paid_at`, `payment_reference`, `paid_by`, `voucher_path` | `'approved_at' => 'datetime'`, `'paid_at' => 'date:Y-m-d'`, `'boxes' => 'integer'`. Constante `ORIGENES`. **`saldo()`** devuelve 0 si no está ANTERIOR, EN_BANCO o PAGADA. |
| `SettlementPayment` | `payment_order_code`, `approval_status`, `approved_by`, `approved_at`, `rejection_reason`, `scheduled_week`, `scheduled_year`, `payee_third_party_id`, `payment_status`, `payment_method`, `voucher_path` | `'approved_at' => 'datetime'` |
| **`BankPaymentBatchItem`** *(nuevo, `Auditable`)* | todas sus columnas | `'account_number' => 'encrypted'`, `'holder_id' => 'encrypted'`, `'amount' => 'decimal:2'`, `'paid_at' => 'date:Y-m-d'`; `$hidden = ['account_number', 'holder_id']`; agregar `holder_id` a `$auditarEnmascarar` del trait. |
| `BankPaymentBatch` | — | relación `items()` |

**Servicio nuevo `App\Services\Anticipo80`:** ⚠️ *19/11 (13.A.6):* ya **no** se llama al guardar o quitar un camión. Tiene `crear(ProducerQuotaLine, User)` (botón PAGAR) y `recalcular(ProducerQuotaLine)` (al cambiar las cajas o el `real_price` de la compra en Compra de fruta). Reglas en 3.1 y 3.4. Avisa en la campanita (`Notificaciones`) a quien tiene `aprobar_pagos_liquidacion` cuando hay órdenes nuevas o que volvieron a POR APROBAR.

**`SettlementController@store`** (fase 1b):
- En la LQ SPOT, por cada compra con 80 % activo: EN BANCO o PAGADA → se descuenta (fila en `settlement_advances` y suma en `advance_80_amount`); si no → ANULADA.
- Neto antes del 80 % < 0 → error como hoy. Neto final < 0 → cuota 0 y anticipo SALDO por la diferencia.
- `pagos()` deja **una cuota por LQ**: CONTRATO "PAGO ÚNICO (100 %)", SPOT "SALDO SPOT"; con código de orden, POR_APROBAR y semana programada.
- `annul`: pide cuotas sin aprobar ni pagar; anula cuotas y SALDO.
- **Se retiran** `PATCH /settlements/{id}/payments/{n}/pay` y `/unpay` (P12).

### 7.5 Endpoints

**Fase 1a (tarjas):**

| Método y ruta | Middleware | Qué hace |
|---|---|---|
| `GET /tallies/weeks` | `pantalla:tarjas` | Semanas con compras: cajas compradas, con tarja y camiones. Sin dinero. |
| `GET /customer-orders/{id}/tallies?quitadas=0\|1` | `pantalla:tarjas` | Como hoy, **sin** `real_price` ni `payment_scheme` |
| `PUT /customer-orders/{id}/tallies` | `pantalla:tarjas` | Escritorio: filas nuevas o cambiadas (con `updated_at`) + `removed:[{id,reason}]`. Sin borrado implícito. |
| `POST /tallies` `{customer_order_id, client_key, …}` | `pantalla:tarjas` | Un camión nuevo. Si el `client_key` ya existe, devuelve el mismo (200). |
| `PUT /tallies/{id}` `{…, updated_at}` | `pantalla:tarjas` | Un camión; 409 si cambió. |
| `PATCH /tallies/{id}/deactivate` `{reason}` · `PATCH /tallies/{id}/reactivate` | `pantalla:tarjas` | Quitar con motivo ("ESCRIBE EL MOTIVO PARA QUITAR LA TARJA.") / volver a poner. Bloqueado si el cupo está LIQUIDADO. |
| `GET /tallies/{id}/history` · `GET /tallies/history?producer_quota_line_id=` | `pantalla:tarjas,liquidar` | Historial acotado (3.5 A) |

**Fase 1b (pagos):**

| Método y ruta | Middleware | Qué hace |
|---|---|---|
| `GET /settlement-payables/board?anio=&semana=&negociacion=&dia=&estado=&orden=&vendedor=` | `pantalla:aprobar_pagos_liquidacion,pagos,tablero_pagos_lectura` | Tablero: `{filas, grupos, totales}` calculados en el servidor con los mismos filtros. Sin `cuenta` para `tablero_pagos_lectura`. |
| `GET /settlement-payables/board/export?…` | ídem | Excel de las mismas filas (sin cuentas) |
| `GET /settlement-payables?estado=` | `pantalla:pagos,aprobar_pagos_liquidacion` | Pestañas de seguimiento |
| `PATCH /settlement-payables/approve` `{items:[{tipo,id,scheduled_week?,scheduled_year?}]}` | `pantalla:aprobar_pagos_liquidacion` | Aprueba en lote (transacción + `lockForUpdate`) |
| `PATCH /settlement-payables/{tipo}/{id}/reject` `{reason}` | `pantalla:aprobar_pagos_liquidacion` | Rechaza con motivo |
| `POST/PUT /producer-advances…` *(existen)* | `pantalla:anticipos,liquidar` | Los manuales nacen POR_APROBAR; solo se editan o desactivan si no están aprobados ni en el banco. |
| `GET /accounting/payables?origen=&semana=` | `pantalla:pagos_banco` | POR PAGAR unificado |
| `POST /accounting/bank-batches/preview` · `POST /accounting/bank-batches` `{items:[{tipo,id}]}` | `pantalla:pagos_banco` | Revisar y generar (OC + liquidaciones + anticipos) |
| `GET /accounting/bank-batches` · `GET /accounting/bank-batches/{id}/file` | `pantalla:pagos_banco` | Lotes y TXT |
| `PATCH /accounting/bank-batches/{id}/cancel` `{reason}` | `pantalla:pagos_banco` | Anular lote GENERADO |
| `PATCH /accounting/payables/{tipo}/{id}/return` `{reason}` | `pantalla:pagos_banco` | Devolver a Liquidaciones |
| `PATCH /accounting/bank-batches/{id}/paid` `{paid_at, bank_reference, fallidas:[{item_id, motivo}]}` | `pantalla:confirmar_pagos` | Pagado o pagado en parte |
| `PATCH /accounting/payables/{tipo}/{id}/manual-pay` (multipart) | `pantalla:confirmar_pagos` | Pago fuera del TXT (TRANSFERENCIA / CHEQUE / CRUCE) |
| `PATCH /accounting/payables/{tipo}/{id}/reverse` `{reason}` | `pantalla:confirmar_pagos` | Reverso con motivo |
| Rutas de OC (`/accounting/purchase-orders…`) | `pantalla:aprobar_oc` | Sin cambio (aprobar y rechazar) |

### 7.6 Pantallas y permisos (`config/pantallas.php`)

| Clave | Sección | Nombre | `roles` | `solo` |
|---|---|---|---|---|
| `tarjas` *(existe)* | EXPORTACIONES | Tarjas | LIQUIDACIONES (+ perfil TARJADOR por migración) | — |
| `aprobar_pagos_liquidacion` *(nueva)* | LIQUIDACIÓN | Aprobar anticipos y pagos (jefe) | — (excepción por persona) | LIQUIDACIONES |
| `tablero_pagos_lectura` *(nueva)* | LIQUIDACIÓN | Tablero de anticipos y pagos (solo lectura) | GERENCIA, FINANZAS | — |
| `pagos_banco` *(nueva)* | CONTABILIDAD | Pagos al banco (preparar lote y TXT) | CONTABILIDAD | CONTABILIDAD |
| `confirmar_pagos` *(nueva, permiso)* | CONTABILIDAD | Confirmar pagos del banco (permiso) | CONTABILIDAD | CONTABILIDAD |
| `aprobar_oc` *(existe)* | CONTABILIDAD | **Aprobación de OC** (nombre nuevo, misma clave) | CONTABILIDAD | — |

**Frontend:**
- Nuevo `src/pages/liquidacion/SettlementPaymentsBoardPage.jsx` (`/liquidacion/tablero-pagos`, `P(['aprobar_pagos_liquidacion','pagos','tablero_pagos_lectura'], …)`).
- Nuevo `src/pages/contabilidad/BankPaymentsPage.jsx` (`/contabilidad/pagos-banco`, `pagos_banco`); los botones de confirmar solo con `confirmar_pagos`.
- `AccountingOrdersPage.jsx`: queda con POR APROBAR y TODAS de OC; sin lotes.
- `SettlementHistoryPage.jsx`: pestañas de seguimiento. `SettlementDetailPage.jsx`: estado de cada cuota en lugar de "Registrar pago"; enlace "Historial de tarjas"; fila "ANTICIPO 80 %".
- `ProducerAdvancesPage` (anticipos): estado de aprobación y pago de cada anticipo manual.
- `src/routes/menu.js` y `AppRouter.jsx`: ítems nuevos. ⚠️ Los dos tienen cambios de espacios de Peter que **no** van en el commit: agregar solo las líneas nuevas.

### 7.7 Pruebas que debe hacer QA

**Fase 1a (tarjas):**
1. Usuario TARJADOR: entra directo a Tarjas; el menú solo muestra Tarjas. `GET /port-tariff-items`, `/customers`, `/shipments`, `/customer-orders`, `/settlements`, `/producer-advances` → 403.
2. El ADMIN intenta darle `liquidar`, `pagos` o `dashboard` al perfil TARJADOR o como excepción → rechazado con mensaje en MAYÚSCULAS; `/me` no las trae aunque estén en la base.
3. `GET /customer-orders/{id}/tallies` no trae `real_price` ni `payment_scheme` (para nadie).
4. Concurrencia: el celular agrega un camión mientras la laptop tiene la semana abierta; la laptop guarda → el camión del celular **sigue**.
5. Dos personas editan el mismo camión → la segunda recibe 409 con el nombre de quien cambió.
6. Doble envío con el mismo `client_key` → un solo camión.
7. Quitar tarja sin motivo → 422; con motivo → `status false`; deja de sumar en liquidación (preview), Cierre de embarque, Ganancia por viaje, Tablero financiero y "tiene tarjas" de Compra de fruta. Reactivar la vuelve a sumar.
8. Cupo LIQUIDADO: no se agrega, cambia, quita ni reactiva una tarja (mensaje "YA FUE LIQUIDADO"). Al anular la LQ, se puede de nuevo.
9. Historial de la tarja WK45 id 1 (en una copia local, no en producción): CREADA el 05/11 con 500 / 10 / 20 y recibidas 470; cada edición con usuario y fecha; LIQUIDADA si aplica. **No** trae IP, ruta ni registros de otras tablas; un usuario sin `tarjas` ni `liquidar` → 403; `table_name` en la URL se ignora.
10. Celular (Chrome, 375 px): tarjetas, teclado numérico, "Guardar camión" guarda solo ese camión; sin red, los datos no se pierden. Escritorio (≥ 768 px): la tabla se ve como antes.
11. `npm run build` sin errores; `php -l` en cada PHP; migración aplicada en `SIAE` y `siae_test`; `down()` probado en local.

**Fase 1b (pagos):**
1. Compra SPOT 80_20 con tarja de 1.000 embarcadas a $7,00 → orden 80 % de 5.600,00 POR APROBAR con `ORD-…`. Sin tarja → SIN TARJA; sin precio → SIN PRECIO; CONTRATO o SPOT 100 → sin 80 %.
2. Segundo camión de la misma compra → la **misma** orden sube de monto (índice único). Con la orden APROBADA, el tarjador no puede cambiar embarcadas (mensaje); Liquidaciones sí, y la orden vuelve a POR APROBAR.
3. El aprobador no puede aprobar una LQ ni un anticipo que él mismo creó (salvo ADMIN). Aprobar dos veces la misma → la segunda dice cuál ya cambió.
4. Totales del tablero = suma de las filas visibles con cada combinación de filtros; precio ponderado; exportar trae las mismas filas. `tablero_pagos_lectura` no ve cuentas ni botones.
5. Liquidar SPOT con el 80 % PAGADO → `advance_80_amount` = 5.600, cuota SALDO SPOT = neto − 5.600 (ejemplo 3.2: 648,00), semana N+1. Con el 80 % POR APROBAR → queda ANULADO y la cuota es el neto completo. 80 % mayor que el neto → cuota 0 y SALDO a favor, que sale preseleccionado en la siguiente LQ.
6. LQ CONTRATO con `payment_week_offset = 1` → cuota 100 % con semana N+2; el aprobador puede cambiarla a N+1.
7. Anticipo manual: nace POR APROBAR; no se ofrece para descontar hasta que esté EN BANCO o PAGADO; los ANTERIOR sí.
8. Contabilidad: con solo `pagos_banco` genera el lote y el TXT, pero no puede marcar pagado (403). Con `confirmar_pagos`, marca PAGADO_PARCIAL con una línea FALLIDA → esa orden vuelve a POR PAGAR y puede ir a otro lote.
9. Doble pago: la misma orden en dos lotes vivos → error de la base (índice único). Una orden sin aprobar no se puede pagar (CHECK).
10. Un usuario de Liquidaciones no puede recibir `pagos_banco` ni `confirmar_pagos`; uno de Contabilidad no puede recibir `aprobar_pagos_liquidacion` (`solo`).
11. Los lotes de OC siguen funcionando igual para Andrea después de la migración (OC → aprobar → lote → TXT → pagado).
12. Anular una LQ con la cuota aprobada → error; con la cuota rechazada → se anula, la cuota queda ANULADA y el SALDO a favor se desactiva.
13. El TXT y la bitácora no muestran cuentas ni cédulas completas (`****1234`).

---

## 8. Impacto en datos existentes

| Dato | Qué se hace | Cómo se verifica |
|---|---|---|
| Tarja WK45 id 1 (500 / 10 / 20) | **Correcta, no se toca** (Peter, 17/11). Recibidas = 470. | La pantalla muestra 470 |
| Tarjas existentes (1a) | Quedan `status = true` | Contar antes y después |
| Liquidaciones en producción | 0 liquidaciones, 0 cuotas, 0 lotes (`siae-datos`, 17/11). No hay pagos que migrar. | Volver a contar justo antes de subir |
| Anticipos | 1 pendiente de descontar → ANTERIOR + PAGADA + MANUAL; se sigue descontando como hoy | Preguntar a Liquidaciones si de verdad se entregó |
| Perfiles | TARJADOR nuevo. CONTABILIDAD + `pagos_banco` y `confirmar_pagos`. GERENCIA y FINANZAS + `tablero_pagos_lectura`. **LIQUIDACIONES no cambia**: Peter da `aprobar_pagos_liquidacion` al jefe por excepción. | Revisar en Perfiles y permisos |
| `contracts.payment_week_offset` | Todos en 0. Si algún contrato paga una semana más tarde, LEGAL lo cambia en su pantalla. | — |
| Compras CONTRATO con 80_20 | No se migran: la LQ CONTRATO las paga al 100 % desde la fase 1b. | — |
| Cuentas bancarias | **0 registradas.** Sin cuentas no sale ningún TXT. Hay que incluir PRODUCTOR y COMERCIALIZADORA en `bankAccounts()`. | Lista de vendedores con LQ y sin cuenta (sin números en el chat) |

Orden en producción: simulación → respaldo de la base, del `dist` y de los `.env` (la `APP_KEY` es necesaria para las cuentas cifradas) → migración → revisión.

### 8.1 Requisitos antes de pagar con el sistema

| # | Requisito | Estado (17/11) | Bloquea |
|---|---|---|---|
| R1 | Compras CONTRATO sin contrato | **Se deja así** (P17): Comercial y LEGAL las revisan a mano. El sistema ya no deja **liquidarlas**. | Solo la liquidación de esas compras; **no** la fase 1 (el 80 % es solo SPOT) |
| R2 | Compras sin precio real | Igual que R1. Además, sin precio no hay 80 % (fila SIN PRECIO). | La LQ y el 80 % de esa compra |
| R3 | Parámetros de la semana | **Validado** desde la fase 0 | La LQ de esa semana |
| R4 | Cuentas bancarias de vendedores | 0 cargadas; las carga Contabilidad en su pantalla | El TXT |
| R5 | Códigos de banco | Sin llenar | El TXT |
| R6 | TXT real del Pichincha | Sin confirmar; formato PROVISIONAL | Usar el TXT con dinero real |
| R7 | Fase 0 | ✅ **En producción** | — |
| R8 | Tarjas al día | 1 tarja en producción; la WK40 sin tarjas. Con la fase 1a, el tarjador las carga desde el puerto; las históricas, con `siae-datos` (logística → comercial → tarjas → liquidaciones) | El 80 % y la LQ de esas semanas |

---

## 9. Riesgos y cómo se cubren

| Riesgo | Control |
|---|---|
| **Pagar dos veces** | Índices únicos parciales en `bank_payment_batch_items`; `lockForUpdate` al generar y al liquidar; 80 % único por negociación; la LQ anula el 80 % que no salió y descuenta el que salió. |
| **Pagar sin aprobar** | CHECK `sp_pago_aprobado_check` / `pa_pago_aprobado_check` y validación en el backend. |
| **Borrar el camión de otro** (laptop y celular a la vez) | Guardado por camión, sin borrado implícito, `updated_at` (409) y `client_key`. |
| **Inflar las embarcadas después de aprobar el 80 %** | Solo `liquidar` las cambia; el 80 % vuelve a POR APROBAR o, si ya salió, la LQ lo ajusta. Todo queda en el historial. |
| **El tarjador ve precios** | Lista blanca del tipo TARJADOR; `tarjas` fuera de `$lectura`; respuesta de tarjas sin precios. |
| **Cuenta cambiada a última hora** | Copia congelada en el lote; bloqueo de 3 días o cambio posterior a la aprobación (P11, fase 2). |
| **Quien liquida, se aprueba y se paga** | `solo` en las pantallas; el backend impide aprobar lo propio (salvo ADMIN). |
| **Monto ajustado a mano** | El monto no se edita: se recalcula desde el origen. |
| **Formato del TXT equivocado** | PROVISIONAL hasta tener uno real (R6). |
| **Ver cuentas o cédulas sin permiso** | Cifradas; fuera de `cuentas_bancarias` se ven `****1234`. |

---

## 10. Fases y orden de implementación

| Fase | Contenido | Estado / depende de |
|---|---|---|
| **0** | Faltantes y recibidas, LQ por contrato y SPOT, retención IR, R1–R3 | ✅ **En producción** (17/11) |
| **1a** | Tipo TARJADOR, cierre de fugas de `tarjas`, tarjas con baja lógica, guardado por camión, vista celular, historial | OK de Peter a la sección 12 (puntos 1 a 3) |
| **1b** | Migración 7.3, `Anticipo80`, LQ que descuenta el 80 % y deja una cuota programada, anticipos manuales con aprobación, Tablero de anticipos y pagos, Pagos al banco con líneas, fallidas, pago manual y reverso, cuentas de productores. ⚠️ *19/11: se parte en 1b-1 y 1b-2, y se agrega 1c (material sobrante); ver 13.C.* | Fase 1a en producción |
| **2** | Cuentas de AGAT de origen (P9), comprobantes, exportable PAGOS Y RETENCIONES, bloqueo por cuenta cambiada (P11) | TXT real (R6) |
| **2b** | Pago a otra persona con carta (`payee_third_party_id`, P8) | Diseño aparte |
| **3** | Plan de cuentas y asientos sugeridos (sección 6) | Preguntas 24 a 30 de Contabilidad |

**Orden sugerido:**
1. **1a** completa → QA → producción. El tarjador empieza a cargar la semana en curso.
2. **1b en una sola subida.** El 80 % automático y el cambio de la LQ deben salir **juntos**: si sale el 80 % sin el cambio de la LQ, la LQ volvería a pagar el 80 % (doble pago).
3. Antes de usar el TXT con dinero real: R4, R5 y R6.

---

## 11. Preguntas para Peter: respuestas

1. ✅ **RESPONDIDA (17/11):** el 80 % SPOT se calcula sobre las **CAJAS EMBARCADAS**, en una orden antes de la LQ; la LQ SPOT paga el saldo.
2. ✅ **APROBADA (17/11):** cada contrato tiene su valor por defecto (`payment_week_offset`, lo pone LEGAL) y el jefe de Liquidaciones lo puede cambiar al aprobar.
3. ✅ **APROBADA (17/11):** aprueba solo el jefe de Liquidaciones (pantalla por persona), nunca lo que él mismo creó. Si no hay jefe, aprueba el ADMIN.
4. ✅ **APROBADA (17/11):** si los descuentos pasan el saldo, no se paga y queda **SALDO A FAVOR DE AGAT**, que se descuenta en la siguiente LQ.
5. ✅ **RESPONDIDA (17/11):** con el **PRECIO PACTADO**: cajas embarcadas × precio pactado × 0,80.
6. ✅ **APROBADA (17/11):** una sola bandeja y un solo TXT por corrida, con filtro por origen (pantalla Pagos al banco).
7. ✅ **APROBADA (17/11):** no se pagan cuotas en partes; "PARCIAL" se cubre con el lote PAGADO_PARCIAL y la línea FALLIDA.
8. ✅ **APROBADA (17/11):** con dos beneficiarios, los descuentos se prorratean; se detalla en el diseño de pago a otra persona (fase 2b).
9. ✅ **APROBADA (17/11):** se registran las cuentas de origen de AGAT en la fase 2; los números los escribe Contabilidad en la pantalla.
10. ✅ **APROBADA (17/11):** por ahora solo el exportable (opción a); el plan de cuentas dentro del SIAE, en la fase 3.
11. ✅ **APROBADA (17/11):** cuarentena de 3 días o cualquier cambio posterior a la aprobación; la libera Contabilidad con un check que queda en la bitácora (fase 2).
12. ✅ **APROBADA (17/11):** Liquidaciones deja de registrar pagos; solo Contabilidad los registra.
13. ✅ **RESUELTA con la fase 0:** las caídas ya no se pagan (se pagan las RECIBIDAS) y la retención IR entró en la misma entrega.
14. ✅ **RESPONDIDA (17/11):** sí, los anticipos y préstamos manuales pasan por aprobación y por el TXT.
15. ✅ **RESPONDIDA (17/11):** "PAGADO DE MES" se registra como pago manual con forma **CRUCE**.
16. ✅ **RESUELTA con la fase 0:** materiales y anticipos manuales se descuentan en la LQ de **mayor valor de fruta**. El 80 % se descuenta en la LQ SPOT.
17. ✅ **RESPONDIDA (17/11):** las compras CONTRATO sin contrato y sin precio real se dejan así; Comercial y LEGAL las revisan a mano. El sistema sigue bloqueando su **liquidación** (R1/R2), pero **no** bloquea el resto de la fase 1, porque el 80 % es solo SPOT.
18. ✅ **RESPONDIDA (17/11):** el día de proceso es el **DÍA DE CORTE** (`cut_date`).
19. ✅ **RESPONDIDA (17/11):** GERENCIA y FINANZAS ven el tablero solo para leer (`tablero_pagos_lectura`), sin cuentas ni botones.
20. ✅ **RESPONDIDA (17/11):** una línea del TXT por cada orden (1 a 1).
21. ✅ **RESPONDIDA (17/11):** en Contabilidad hay varias personas; el diseño usa pantallas por persona: `pagos_banco` (preparar) y `confirmar_pagos` (confirmar), además de `aprobar_oc` (5.5). Quién valida el plan de cuentas pasa a la fase 3 con las preguntas 24 a 30.
22. ⚠️ **SUPUESTO (sin respuesta de Comercial):** un anticipo por negociación, calculado con **todas** las tarjas de esa compra; si embarca en varios días, la orden se recalcula mientras esté POR APROBAR, y lo que llegue después de aprobada se paga en la LQ. Datos para Comercial: en el SIAE la WK40 SPOT tiene 68 negociaciones y ##### cajas compradas; el reporte trae 15 negociaciones y ##### cajas embarcadas. Falta saber de qué hoja sale "CAJAS/EMB" y qué eran las 3 filas ocultas.
23. ⚠️ **SUPUESTO (sin respuesta):** se agrupa por la fecha de corte real de cada compra; el 06/11 del Excel se toma como la fecha del reporte y no se guarda.

**Para Contabilidad (fase 3, no bloquean la fase 1):** 24 a 30 siguen **pendientes**, tal como están en la sección 6.5:
24. ¿La fruta va directo al costo (5.1.1.3.1) o pasa por inventario (1.1.3.1.1)? *Recomiendo:* directo al costo.
25. ¿La NC reduce 5.1.1.3.1 o va a 4.3.5 OTRAS RENTAS? *Recomiendo:* que reduzca la compra.
26. ¿Préstamos a productores en 1.1.4.4 o en una subcuenta nueva? *Recomiendo:* subcuenta propia.
27. ¿Se provisiona la fruta al embarcar (2.1.5.1.1)? *Recomiendo:* sí, si el cierre de mes cae entre embarque y LQ.
28. ¿Materiales descontados contra el inventario de cada insumo al liquidar? *Recomiendo:* sí, al costo con que salieron.
29. ¿La cuenta 1.1.4.1 con tipo "Seguros pagados por anticipado" es un error de Contífico? *Recomiendo:* corregirla antes de usar 1.1.4.1.1.
30. ¿Cuenta de transporte de fruta? *Recomiendo:* crear "TRANSPORTE DE FRUTA" para reconocido y descontado.

**Sobre las cajas de la tarja (regla del 17/11):** todas ✅ **RESUELTAS con la fase 0**:
31. ✅ FALTANTES las registra el personal de tarjas en la misma tarja; se pueden corregir mientras el cupo no esté liquidado.
32. ✅ CONTRATO también se paga sobre RECIBIDAS.
33. ✅ Retención (tramo y base), transporte reconocido y bono, sobre RECIBIDAS. La base usa el mayor entre el precio real y el oficial.
34. ✅ La hoja de tarjas muestra RECIBIDAS calculada (no se escribe), con su total.

---

## 12. Lo que todavía necesita respuesta de Peter (lista corta)

1. **Tipo base TARJADOR** (recomendado) en lugar de un perfil LIQUIDACIONES restringido. ¿OK?
2. ~~**Candado de EMBARCADAS** cuando el 80 % ya está aprobado~~ → **ya no aplica** (19/11, 13.A.5): el 80 % sale de las cajas compradas.
3. **¿Qué semanas ve el tarjador?** *Recomiendo:* solo las que tienen compras sin liquidar (las liquidadas, en solo lectura). ¿Hace falta limitarlo a **su puerto**, como el bodeguero con su bodega?
4. **Padding en celular:** cambiar `<main>` de `Layout.jsx` a `p-3 md:p-6` (en escritorio no cambia nada). ¿OK?
5. **Sin señal en el puerto:** ¿basta con no perder lo escrito y reintentar, o necesitan trabajar **sin internet** toda la jornada? Lo segundo es otro alcance (modo sin conexión).
6. **Nombres para los permisos** (en Perfiles, no en este documento): quién es el **jefe de Liquidaciones** (`aprobar_pagos_liquidacion`) y, en Contabilidad, quién **confirma** pagos (`confirmar_pagos`) y quién solo **prepara** (`pagos_banco`).
7. **¿Bloquear que la misma persona genere el TXT y lo confirme como pagado?** *Recomiendo:* no, porque el portal del Pichincha ya pide el token de quien sube.
8. **Comercial:** P22 y P23 quedan como supuestos; confirmar cuando puedan.
9. **Contabilidad:** TXT real del Pichincha (R6), cuentas de vendedores (R4) y códigos de banco (R5), antes de pagar con dinero real.

---

## 13. Cambios del 19/11/2026 — **DISEÑO APROBADO POR PETER (19/11/2026)**: preguntas 13.D resueltas; falta programar

Peter decidió dos cambios el 19/11, antes de programar la fase 1b:
- **A)** El anticipo del 80 % nace en **Compra de fruta**, con un botón **PAGAR** por compra SPOT.
- **B)** El **material sobrante** después de la tarja lo decide la **analista comercial**.

Esta sección manda sobre las secciones 1 a 12 donde digan otra cosa; allí quedó marcado lo reemplazado.

**Respuestas de Peter (19/11), ya incorporadas:**
- PAGAR se habilita con la compra **enviada a bodega**, y lo pulsa **solo la ASISTENTE comercial** (permiso por persona).
- La fruta **siempre llega**: Liquidar sigue exigiendo tarja.
- El sobrante lo decide **solo la ANALISTA comercial** (permiso por persona).
- DEVOLVER puede ser **parcial**: la bodega registra lo devuelto **por insumo** y lo que no regresa se **descuenta automáticamente**. Las cajas se cuentan por el **cartón**.
- PENDIENTE vencido (14 días desde la decisión) y DEVOLVER no recibido **bloquean al productor**: no se liquida su 20 % ni se pulsa PAGAR en sus compras nuevas. Avisan en rojo al **COORDINADOR DE COMPRAS** (pantalla nueva por persona), que puede pasarlo a DESCONTAR para destrabar.
- Fases 1b-1 → 1c → 1b-2.

> **Nombres de las cajas (ojo):** desde el 18/11, **solo en la pantalla de Tarjas**, el total del camión se llama RECIBIDAS y lo que se paga se llama EMBARCADAS (`DESARROLLO.md`). En la base, `tally_sheets.boxes_shipped` sigue siendo **el total del camión**. En este anexo, **TARJA TOTAL** = Σ `boxes_shipped` de las tarjas activas = buenas + caídas + rechazadas + faltantes. Es justo lo que Peter suma para el sobrante.

### 13.0 Reglas de negocio que se tocan (señalado como pide `CLAUDE.md`)

| Regla | Antes (diseño 17/11) | Ahora (19/11) |
|---|---|---|
| **Liquidación — anticipo 80 %** | Lo calcula el sistema al guardar cada camión, sobre las EMBARCADAS de la tarja (P1) | **Comercial pulsa PAGAR** en la compra SPOT ya enviada a bodega. La base son las **CAJAS COMPRADAS**, y se paga en la **semana de corte** |
| **Liquidación — "solo compras embarcadas"** | Se cumplía también en el 80 % (sin tarja no había 80 %) | El 80 % sale **antes** de la tarja. La LQ sigue pagando **solo lo recibido** y descuenta el 80 % completo. Si sobra, queda SALDO A FAVOR DE AGAT (regla 3 de la sección 2, P4) |
| **Liquidación — materiales** | Se cobra todo lo retirado menos lo devuelto | El sobrante (retirado − tarja total) lo **decide** la analista: DESCONTAR (como hoy), DEVOLVER o PENDIENTE. **Sin decisión no se liquida.** Lo que no regresa de un DEVOLVER se descuenta solo |
| **Bloqueo del productor (nuevo)** | No existía | Si debe material (DEVOLVER sin cerrar, o PENDIENTE vencido), **no se liquida ninguna de sus LQ** (el 20 %) y **no se pulsa PAGAR** en sus compras nuevas hasta que devuelva o el coordinador de compras lo pase a DESCONTAR |
| **Costo promedio** | El despacho congela el costo | Sin cambio. Lo PENDIENTE viaja a la semana siguiente **con el costo congelado de su despacho** |
| **Contrato / SPOT, flete, OC** | — | **Sin cambio.** CONTRATO sigue al 100 % en la LQ, sin PAGAR. Las OC conservan su único aprobador |
| **Semana de compra** | — | Sin cambio. El 80 % va al cupo de la compra y se programa en la semana ISO de su `cut_date` |

---

### 13.A Anticipo 80 % desde Compra de fruta

#### 13.A.1 Proceso paso a paso

| # | Quién | Qué pasa |
|---|---|---|
| 1 | Comercial | Guarda la compra SPOT (forma de pago 80/20) y la **envía a bodega** (ya existe). |
| 2 | **Asistente comercial** (permiso `pagar_anticipo_80`) | En la grilla de Compra de fruta, esa compra muestra el botón **PAGAR** (verde, icono `HandCoins`). Al pulsarlo, un `DialogoConfirmacion` dice: "VAS A PEDIR EL ANTICIPO 80 % DE <VENDEDOR> — <MARCA>: 1.000 CAJAS × $7,00 × 80 % = $5.600,00, SEMANA DE PAGO WK45". Si el vendedor está **BLOQUEADO** por material (13.B.10), el botón sale gris con el motivo. |
| 3 | Sistema | Crea **una orden de pago por compra** (`ORD-AAAA-NNNNN`), POR APROBAR, y avisa en la campanita a quien tiene `aprobar_pagos_liquidacion`. La compra muestra el estado de la orden en lugar del botón: POR APROBAR / APROBADA / EN BANCO / PAGADA / DEVUELTA. |
| 4 | Jefe de Liquidaciones | En el **Tablero de anticipos y pagos** (4.0) marca con un check las órdenes correctas y pulsa **Aprobar**, o devuelve una con su motivo (vuelve a Comercial, que puede pedirla de nuevo). |
| 5 | Contabilidad | En **CONTABILIDAD → Cuentas por pagar**, pestaña **ANTICIPOS DE PRODUCTORES**, ve las aprobadas con el banco, el tipo y la cuenta enmascarada `****1234` del vendedor, y el estado PENDIENTE / VERIFICADA de la cuenta (existe desde el 18/11). Elige cuáles pagar y genera el **TXT del Pichincha** cuando Andrea decida: **una línea por orden** (P20). |
| 6 | Contabilidad (`confirmar_pagos`) | Marca el lote PAGADO, o PAGADO_PARCIAL con las líneas FALLIDAS (5.3). |
| 7 | Liquidaciones, semana siguiente | Liquida el cupo. La **LQ SPOT** paga lo **RECIBIDO**, descuenta materiales (con la decisión de 13.B), anticipos y préstamos, retención y **el 80 % ya pagado**, y deja la cuota **SALDO SPOT**. Si la tarja vino por debajo de lo comprado, avisa, y lo pagado de más queda como **SALDO A FAVOR DE AGAT**. |

- **Solo SPOT con 80/20.** CONTRATO se paga al 100 % en la LQ, y SPOT al 100 % (`payment_scheme = '100'`) también: ninguno de los dos muestra PAGAR.
- **Monto** = `quantity_cajas` × `real_price` × 0,80, redondeado a 2 decimales. Se congela en la orden (`boxes`, `unit_price`, `amount`), siguiendo la convención de valores congelados.
- **Semana de pago** = semana ISO del `cut_date` de la compra (`scheduled_week` / `scheduled_year`). No se edita al aprobar.

#### 13.A.2 Qué ya existe y se reutiliza

| Pieza | Dónde | Uso |
|---|---|---|
| Envío a bodega | `producer_quota_lines.sent_to_warehouse_at`; `PurchaseAllocationController::enviarABodega` / `quitarEnvio`; botón por línea en `PurchaseAllocationPage.jsx` (~1559-1574) | Condición para PAGAR. El botón PAGAR va junto a "✔ ENVIADA". |
| Orden del 80 % | `producer_advances` con `origin = 'SPOT_80'`, índice único por compra (7.3) | Igual. Cambia la base (cajas compradas) y quién la crea (`created_by` = Comercial). |
| Aprobación | Tablero 4.0, `aprobar_pagos_liquidacion`, regla "no aprueba lo que él creó" | Igual. Como la crea Comercial, el jefe de Liquidaciones sí puede aprobarla. |
| Cuenta del vendedor | `third_party_bank_accounts` cifrada, `verified_at`/`verified_by` (18/11), `CuentaBancaria::enmascarada` | Para el TXT, la cuenta debe estar **VERIFICADA**. |
| TXT Pichincha | `PichinchaPagos` + `AccountingController::preview/generate/batchFile/batchPaid/batchCancel` | Se generaliza a "órdenes pagables" (OC o anticipo) con `bank_payment_batch_items` (7.3), sin cambiar el formato del archivo. |
| LQ SPOT | `SettlementController@store` + `pagos()` | Se cambia como dice 7.4: descuenta el 80 % y deja una sola cuota. |

#### 13.A.3 Casos borde

| Caso | Qué hace el sistema |
|---|---|
| **Compra partida** (Dividir compra, 13/11) | La orden **se queda en la compra original**, con su monto congelado. Las filas que salen de la división muestran "80 % EN ORD-… (COMPRA DIVIDIDA)" y **no** tienen PAGAR: el vendedor es el mismo, y la LQ SPOT descuenta el 80 % del cupo completo. Si la orden estaba POR APROBAR, no se recalcula al dividir (las cajas solo se repartieron). |
| **Cambian las cajas o el precio** con la orden POR APROBAR | La orden se recalcula sola y sigue POR APROBAR. |
| Ídem con la orden **APROBADA** (sin lote) | Se recalcula, **vuelve a POR APROBAR** y se avisa al aprobador. Se usa `lockForUpdate` para que Contabilidad no la meta en un lote en ese momento. |
| Ídem con la orden **EN BANCO o PAGADA** | El cambio **se permite** (la fruta real manda), pero antes un `DialogoConfirmacion` dice "EL 80 % YA SE PAGÓ SOBRE 1.000 CAJAS: LA DIFERENCIA SE AJUSTA EN LA LIQUIDACIÓN". La orden no cambia. El tablero marca "COMPRA CAMBIADA DESPUÉS DE PAGAR EL 80 %". |
| Cambiar **SPOT → CONTRATO** o **80/20 → 100**, el **día de corte** o el **vendedor** con la orden activa | No se permite (422) mientras la orden esté APROBADA, EN BANCO o PAGADA. Con la orden POR APROBAR, se puede cambiar y la orden se **anula** sola (CONTRATO o 100 %) o se recalcula (día de corte). |
| **Tarja por debajo de las cajas compradas** | Tablero y Liquidar avisan: "TARJA (900) MENOR QUE LO COMPRADO (1.000): EL 80 % SE PAGÓ DE MÁS". La LQ descuenta el 80 % completo; si el neto queda negativo, cuota 0 y **SALDO A FAVOR DE AGAT** (3.4, P4), que sale preseleccionado en la siguiente LQ del vendedor. |
| **Cupo liquidado** | No hay PAGAR (422: "EL CUPO DE <VENDEDOR> WK45 YA FUE LIQUIDADO: TODO SE PAGA EN LA LIQUIDACIÓN"). Tampoco si la compra ya tuvo una LQ, aunque esté anulada (regla de 3.4). |
| Al liquidar, la orden está **POR APROBAR, APROBADA sin lote o DEVUELTA** | La LQ la **anula** y paga todo en su cuota (regla de 3.4, sin cambio). |
| **Compra anulada** (quitar la compra o quitar el envío) | Con la orden POR APROBAR, al quitar se **anula** sola (queda en la bitácora). Con la orden APROBADA, EN BANCO o PAGADA, **no se quita** (422, mensaje en 13.A.5). Peter (19/11): **la fruta siempre llega**, así que no se diseña "liquidar con 0 recibidas" y Liquidar sigue exigiendo tarja. |
| **Vendedor BLOQUEADO por material** (13.B.10) | No hay PAGAR en sus compras nuevas (422, mensaje en 13.A.5). Las órdenes que ya existían (pedidas, aprobadas o en el banco) **siguen su curso** (pregunta 13.D-N2). |
| **Cuenta del vendedor PENDIENTE o sin cuenta** | PAGAR **sí** se puede, con un aviso ámbar en el diálogo. En Cuentas por pagar, la fila sale "NO SE PUEDE PAGAR: CUENTA PENDIENTE DE VERIFICAR" / "SIN CUENTA BANCARIA" y no entra al TXT. |
| **Dos clics o dos personas** a la vez en PAGAR | El índice único parcial (una orden SPOT_80 activa por compra) y `lockForUpdate` sobre la compra. La segunda recibe "LA COMPRA YA TIENE ANTICIPO 80 % (ORD-…)". |

#### 13.A.4 Cambios a la migración 1b (7.3) — no es una migración aparte

La 1b todavía no se programa, así que sus cambios van **dentro** de 7.3. Esa migración toma la fecha del día en que se programe; el nombre `2026_11_18_000002` ya está usado. Se reemplaza el bloque 4 de `producer_advances` así (solo lo que cambia lleva el comentario del 19/11):

```php
        // 4) Anticipos: 80 % pedido por Comercial (SPOT_80), saldo a favor y manuales, con aprobación y pago
        Schema::table('producer_advances', function (Blueprint $table) {
            $table->foreignId('producer_quota_id')->nullable()->constrained('producer_quotas');
            $table->foreignId('producer_quota_line_id')->nullable()->constrained('producer_quota_lines'); // compra del 80 %
            $table->foreignId('source_settlement_id')->nullable()->constrained('settlements');           // LQ que dejó el SALDO
            $table->string('payment_order_code', 20)->nullable()->unique();
            $table->string('origin', 10)->default('MANUAL');      // MANUAL | SPOT_80 | SALDO
            // 19/11/2026: el 80 % se calcula con las CAJAS COMPRADAS (no con la tarja) y el precio pactado,
            // congelados al pulsar PAGAR. Se recalculan solo mientras la orden no salga al banco (13.A.3).
            $table->integer('boxes')->nullable();                 // cajas compradas al pedir el 80 %
            $table->decimal('unit_price', 12, 4)->nullable();     // precio pactado (real_price) al pedir el 80 %
            $table->smallInteger('scheduled_week')->nullable();   // 19/11/2026: semana ISO del día de corte
            $table->smallInteger('scheduled_year')->nullable();
            $table->string('approval_status', 15)->default('POR_APROBAR');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('payment_status', 10)->nullable();     // null | EN_BANCO | PAGADA | FALLIDA
            $table->string('payment_method', 15)->nullable();     // LOTE_BANCO | TRANSFERENCIA | CHEQUE | CRUCE
            $table->date('paid_at')->nullable();
            $table->string('payment_reference', 60)->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users');
            $table->string('voucher_path', 255)->nullable();
            $table->index(['approval_status', 'payment_status']);
        });
        DB::table('producer_advances')->update(['approval_status' => 'ANTERIOR', 'payment_status' => 'PAGADA']);
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_origin_check CHECK (origin IN ('MANUAL','SPOT_80','SALDO'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_approval_status_check CHECK (approval_status IN ('POR_APROBAR','APROBADA','RECHAZADA','ANULADA','ANTERIOR'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_payment_status_check CHECK (payment_status IS NULL OR payment_status IN ('EN_BANCO','PAGADA','FALLIDA'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('LOTE_BANCO','TRANSFERENCIA','CHEQUE','CRUCE'))");
        // 19/11/2026: el 80 % siempre lleva compra, cupo, cajas, precio y semana de pago
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_spot80_check CHECK (origin <> 'SPOT_80' OR (producer_quota_id IS NOT NULL AND producer_quota_line_id IS NOT NULL
            AND boxes > 0 AND unit_price > 0 AND scheduled_week IS NOT NULL AND scheduled_year IS NOT NULL))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_saldo_check CHECK (origin <> 'SALDO' OR source_settlement_id IS NOT NULL)");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_pago_aprobado_check CHECK (payment_status IS NULL OR approval_status IN ('APROBADA','ANTERIOR'))");
        DB::statement("CREATE UNIQUE INDEX producer_advances_spot80_activo_unique ON producer_advances (producer_quota_line_id) WHERE origin = 'SPOT_80' AND status");
        Schema::table('producer_quota_lines', fn (Blueprint $table) => $table->index('cut_date'));
```

El bloque 8 (perfiles) **no cambia**: `pagar_anticipo_80` **no va en ningún perfil**; el ADMIN se lo da a la asistente comercial como excepción por persona (Peter, 19/11).

**`down()`:** se agrega `'unit_price'` a la lista de `dropColumn` de `producer_advances`. El resto del `down()` de 7.3 no cambia.

**Modelo `ProducerAdvance`:** `$fillable` + `unit_price`. `$casts` + `'unit_price' => 'decimal:4'`. El resto queda como en 7.4.

#### 13.A.5 Validaciones del backend (mensajes)

**`POST /customer-orders/{id}/purchases/{lineId}/advance-80`** (botón PAGAR), dentro de una transacción con `lockForUpdate` sobre la compra y su cupo:

| Regla | Mensaje (422) |
|---|---|
| CONTRATO o SPOT al 100 % | "SOLO LAS COMPRAS SPOT CON PAGO 80/20 TIENEN ANTICIPO: LAS DE CONTRATO Y LAS SPOT AL 100 % SE PAGAN EN LA LIQUIDACIÓN." |
| No está enviada a bodega | "PRIMERO ENVÍA LA COMPRA A BODEGA: EL 80 % SE PIDE CUANDO EL VENDEDOR YA PUEDE RETIRAR EL MATERIAL." |
| Sin `real_price` | "FALTA EL PRECIO REAL DE LA COMPRA: SIN ÉL NO SE CALCULA EL 80 %." |
| Sin `cut_date` | "FALTA EL DÍA DE CORTE DE LA COMPRA: EL 80 % SE PAGA EN ESA SEMANA." |
| Cajas en 0 | "LA COMPRA NO TIENE CAJAS." |
| Cupo LIQUIDADO, o la compra ya tuvo una LQ | "EL CUPO DE <VENDEDOR> WK<N> YA FUE LIQUIDADO: TODO SE PAGA EN LA LIQUIDACIÓN." |
| Ya tiene una orden activa | "LA COMPRA YA TIENE ANTICIPO 80 % (<ORD-…>): ESTÁ <ESTADO>." |
| Fila salida de una división cuyo origen tiene 80 % | "ESTA COMPRA SALIÓ DE DIVIDIR <ORD-…>: SU 80 % YA ESTÁ EN ESA ORDEN." |
| La compra tiene cambios sin guardar (versión distinta) | "GUARDA LA SEMANA ANTES DE PEDIR EL 80 %." (se usa la `version` que ya existe) |
| Vendedor BLOQUEADO por material (13.B.10) | "<VENDEDOR> ESTÁ BLOQUEADO: DEBE DEVOLVER <Q> <INSUMO>, <Q> <INSUMO> DE WK<N> (<VENCIÓ EL dd/mm \| DEVOLUCIÓN SIN RECIBIR>). LA BODEGA <BODEGA> DEBE REGISTRAR LA DEVOLUCIÓN O EL COORDINADOR DE COMPRAS PASARLO A DESCONTAR." |

**`PATCH /customer-orders/{id}/purchases/{lineId}/advance-80/cancel`** `{reason}`: Comercial retira su pedido **solo** mientras esté POR APROBAR o DEVUELTA. Sin motivo: "ESCRIBE EL MOTIVO PARA RETIRAR EL PEDIDO DEL 80 %." Si ya fue aprobada: "EL 80 % YA FUE APROBADO: PIDE A LIQUIDACIONES QUE LO DEVUELVA."

**`PurchaseAllocationController@update`** (guardar la semana) **y `quitarEnvio`**, si la compra tiene una orden SPOT_80 activa:

| Cambio | Orden POR APROBAR / DEVUELTA | Orden APROBADA (sin lote) | Orden EN BANCO / PAGADA |
|---|---|---|---|
| Cajas o precio real | Recalcula | Recalcula y vuelve a POR APROBAR, con aviso al aprobador | Se permite; la orden no cambia; aviso en el tablero |
| SPOT → CONTRATO, 80/20 → 100 | Anula la orden | 422: "LA COMPRA TIENE ANTICIPO 80 % APROBADO (<ORD-…>): NO SE PUEDE CAMBIAR LA NEGOCIACIÓN NI LA FORMA DE PAGO. PIDE A LIQUIDACIONES QUE LO DEVUELVA." | 422: "EL 80 % DE ESTA COMPRA YA SE PAGÓ (<ORD-…>): NO SE PUEDE CAMBIAR LA NEGOCIACIÓN NI LA FORMA DE PAGO." |
| Día de corte | Recalcula la semana de pago | 422 (mismo texto, "LA FECHA DE CORTE") | 422 |
| Quitar la compra o quitar el envío | Anula la orden | 422: "LA COMPRA TIENE ANTICIPO 80 % (<ORD-…>): NO SE PUEDE QUITAR. PIDE A LIQUIDACIONES QUE LO DEVUELVA." | 422: "EL 80 % DE ESTA COMPRA YA SE PAGÓ: LA COMPRA SE QUEDA PARA RECUPERARLO EN LA LIQUIDACIÓN." |

**Tarjas (`TallySheetController`):** se quita el candado de EMBARCADAS de 3.4. El tarjador corrige todo hasta que se liquide el cupo, como hoy. No se agrega ninguna validación nueva en Tarjas.

#### 13.A.6 Código (lo programa la sesión principal)

| Archivo | Cambio |
|---|---|
| `app/Services/Anticipo80.php` (nuevo) | `crear()`, `recalcular()` y `anular()`, con las reglas de 13.A.3 y 13.A.5. Avisa con `Notificaciones`. **No** lee tarjas. |
| `PurchaseAllocationController` | Rutas `advance80` y `cancelAdvance80`. En `update()` y `quitarEnvio()`, la tabla de 13.A.5. `cargar()` devuelve por compra `anticipo80: {code, estado, amount}` **solo** si el usuario tiene `pagar_anticipo_80` o `aprobar_pagos_liquidacion` (Compra de fruta no muestra montos desde el 18/11; el monto sale solo en el diálogo de PAGAR). |
| `PurchaseAllocationPage.jsx` | Botón PAGAR o el `EstadoBadge` de la orden, junto a "✔ ENVIADA". `DialogoConfirmacion` con el cálculo. Toasts con `toastMessages.js`. |
| `SettlementController` | Lo de 7.4 (descontar el 80 %, cuota única SALDO SPOT, anular el que no salió). `preview` agrega el aviso "TARJA MENOR QUE LO COMPRADO". |
| `TallySheetController` | Nada (no se agrega el candado). |
| `AccountingController` + `PichinchaPagos` | `PichinchaPagos` recibe un "pagable" (OC o anticipo: beneficiario, valor, referencia y cuenta). `problemas()` agrega, para anticipos: "LA CUENTA DEL VENDEDOR ESTÁ PENDIENTE: VERIFÍCALA EN CUENTAS BANCARIAS." Referencia del TXT: `ANT80 <ORD-…> WK<n>` (40 caracteres). |
| `BankPaymentsPage.jsx` (5.1) | Se llama **"Cuentas por pagar"**. La primera pestaña es **ANTICIPOS DE PRODUCTORES**: aprobados, semana de pago, vendedor, banco, `****1234`, estado de la cuenta y monto. Casillas → Revisar → Generar TXT. |

#### 13.A.7 Permisos

| Acción | Pantalla (`config/pantallas.php`) | Tipo base por defecto | El backend valida |
|---|---|---|---|
| Ver el estado del 80 % en la grilla | `compra_fruta` *(existe)* | COMERCIAL | Sin montos, salvo con `pagar_anticipo_80` |
| **PAGAR** y retirar el pedido | **`pagar_anticipo_80`** *(nueva; sección COMERCIAL; `roles` vacío; `solo` COMERCIAL)* | **Ninguno**: excepción por persona para la **asistente comercial** | Middleware `pantalla:pagar_anticipo_80`, las reglas de 13.A.5 y el bloqueo de 13.B.10 |
| Aprobar o devolver | `aprobar_pagos_liquidacion` *(4.3)* | Ninguno: excepción por persona (jefe de Liquidaciones) | No aprueba lo que él creó; solo POR APROBAR |
| Preparar el TXT | `pagos_banco` *(5.5; menú "Cuentas por pagar")* | CONTABILIDAD | Solo APROBADAS, sin lote vivo y con la cuenta VERIFICADA |
| Confirmar pagado o fallido | `confirmar_pagos` *(5.5)* | CONTABILIDAD | — |
| Ver la cuenta completa | `cuentas_bancarias` *(existe)* | CONTABILIDAD | Fuera de esa pantalla, siempre `****1234` |

El TARJADOR y el BODEGUERO no ven nada de esto (lista blanca / sin pantalla).

#### 13.A.8 Ejemplo con números inventados (tarja por debajo de lo comprado)

Compra SPOT de 1.000 cajas a $7,00, oficial $7,50, retención 1 %, materiales $400. La tarja trae **700** en total, de las que 20 son rechazadas: **680 recibidas**.

| Concepto | Valor |
|---|---|
| Semana de corte: **80 %** = 1.000 × 7,00 × 0,80 | **5.600,00** |
| Fruta en la LQ = 680 × 7,00 | 4.760,00 |
| − Materiales (con la decisión de 13.B) | −400,00 |
| − Retención (1 % de 680 × 7,50) | −51,00 |
| = Neto antes del 80 % | 4.309,00 |
| − 80 % ya pagado | −5.600,00 |
| **Cuota SALDO SPOT** | **0,00** |
| **SALDO A FAVOR DE AGAT** (se descuenta en la siguiente LQ del vendedor) | **1.291,00** |

---

### 13.B Material sobrante después de la tarja

#### 13.B.1 Proceso paso a paso

| # | Quién | Qué pasa |
|---|---|---|
| 1 | Bodega | Despacha el material de la compra (receta por marca; ya existe). El costo queda congelado en el despacho. |
| 2 | Tarjador | Registra los camiones en el puerto (ya existe). |
| 3 | Sistema | Calcula el **sobrante** por **vendedor × semana × marca**: **SOBRANTE = cajas de material retirado + cajas traídas de un PENDIENTE − TARJA TOTAL**. Ejemplo: retira 800; tarja 780 buenas + 20 rechazadas = 800 → sobrante **0**. Retira 800; tarja 700 + 20 = 720 → sobrante **80**. |
| 4 | **Analista comercial** | En **COMERCIAL → Material sobrante** ve la semana con los sobrantes SIN DECIDIR. Reparte cada uno entre **DESCONTAR**, **DEVOLVER** y **PENDIENTE** (ej. 30 + 50 = 80). La suma debe dar el total. |
| 5a | — DESCONTAR | Se cobra en la liquidación al costo congelado del despacho (como hoy). |
| 5b | — DEVOLVER | La bodega de retiro recibe un aviso en la campanita. Registra la **devolución que ya existe** (Nuevo movimiento → DEVOLUCIÓN), que ahora viene **enlazada** al sobrante, con las cantidades **por insumo** ya puestas, que corrige con lo que de verdad llega. Al guardar marca "ES LA ÚLTIMA DEVOLUCIÓN DE ESTE SOBRANTE" (marcado por defecto): **lo que no regresó se descuenta solo** en la liquidación. Ejemplo: sobran 50, regresan 30 porque 20 se mojaron → se descuentan 20. Lo devuelto no se cobra. |
| 5c | — PENDIENTE | Queda un **saldo de material a favor** del vendedor. En su **próximo despacho**, la pantalla lo muestra con su fecha de vencimiento ("A FAVOR: 50 CAJAS DE WK45, VENCE EL dd/mm") y recomienda **entregar menos**. Si a los **14 días desde la decisión** no lo usó, **NO se descuenta solo**: el productor queda **BLOQUEADO** (13.B.10) hasta que lo devuelva. |
| 6 | Liquidaciones | **Liquidar queda bloqueado** mientras haya un sobrante sin decidir ("MATERIAL SOBRANTE SIN DECIDIR"), o un DEVOLVER que la bodega todavía no cerró. |
| 7 | **Coordinador de compras** | Ve en rojo, con un contador en el menú como el de "Por despachar", a cada productor **BLOQUEADO** y lo que debe. Si el material no va a volver, lo pasa a **DESCONTAR** con un motivo, y el productor se destraba. |

- **Aplica a todo el material de la receta** de esa marca (BOM): por cada insumo, cantidad = cajas × `ratio_per_box`, redondeada como en el despacho.
- **Solo cupos con compras de Comercial** (los cupos manuales sin compra no tienen tarja).
- **Sobrante 0 o negativo** (la tarja trae más que lo retirado): no hay nada que decidir. Si es negativo, sale un aviso informativo: "LA TARJA (820) PASA EL MATERIAL RETIRADO (800)".

#### 13.B.2 Qué ya existe y se reutiliza

| Pieza | Dónde | Uso |
|---|---|---|
| Despacho por cupo × marca × bodega | `inventory_movements` (EGRESO, motivo 4, `producer_quota_id`, `brand_id`) + `inventory_movement_lines` (`quantity`, `unit_cost` congelado, `total`) | Cantidad retirada por insumo y su costo |
| Receta por marca | `material_recipes` (`brand` = código, `ratio_per_box`, `status`) | Convertir cajas ↔ cantidad por insumo |
| Devolución ligada al cupo | `inventory_movements` (DEVOLUCION, motivo 7, `producer_quota_id`); `InventoryMovementController::validarDevolucionCupo` y `returnableQuotas` | DEVOLVER se registra aquí, con un enlace nuevo a la decisión |
| Materiales en la LQ | `SettlementController::materiales()` (retirado − devuelto, solo categorías `chargeable_to_producer`) + `settlement_materials` | Se agregan las columnas de PENDIENTE, traído y vencido |
| Cálculo del despacho | `MaterialDispatchController::calcularMateriales()` (fórmula − ya despachado) | Se resta además el saldo a favor vigente |
| Costo promedio | `CostoPromedio::recalcular` | Sin cambio. Lo PENDIENTE no es un movimiento de stock: el material ya salió de la bodega |
| Campanita | `Notificaciones` / `user_notifications` | Avisos a la bodega (DEVOLVER) y a la analista (sobrante nuevo o que cambió) |

**Hoy no existe** nada de "material a favor" entre semanas: hoy todo lo no devuelto se cobra, que equivale a DESCONTAR todo.

#### 13.B.3 Cajas ↔ insumos (aprobado por Peter el 19/11: se cuenta por el cartón)

El despacho **no guarda cajas**: guarda la cantidad de cada insumo (lo verifiqué en `MaterialDispatchController::store` y en la tabla `inventory_movements`). Por eso el sistema **habla en cajas** con la analista y **cobra y devuelve por insumo**.

**1) De insumos a cajas (cuántas cajas retiró):**
- **TIENE**, por insumo = retirado − devuelto sin enlazar + traído de un PENDIENTE.
- **CAJAS RETIRADAS** = el **menor** de TIENE ÷ `ratio_per_box` (sin decimales) entre los insumos de la receta en la categoría **CARTÓN** con `ratio_per_box = 1` (tapa y fondo). Una caja necesita tapa **y** fondo.
- Si la receta no tiene cartón, se usa el insumo con el mayor `ratio_per_box`.
- **SOBRANTE (cajas)** = CAJAS RETIRADAS − TARJA TOTAL.

**2) Del sobrante a cada insumo:**
- **Sobrante del insumo** = TIENE − redondeo(TARJA TOTAL × ratio), sin bajar de 0. Es el mismo redondeo del despacho: LIBRAS con 2 decimales y lo demás entero hacia arriba.
- Lo retirado **por encima** de la receta (ej. 20 fundas de más) entra aquí, en el sobrante del insumo, y va a DESCONTAR si la analista no lo reparte.

**3) De la decisión en cajas a cada insumo:**
- DEVOLVER del insumo = redondeo **hacia abajo** de (cajas a devolver × ratio), sin pasar el sobrante del insumo. PENDIENTE, igual.
- DESCONTAR se queda con el resto, así la suma por insumo da exacto.

**4) De lo devuelto por insumo de vuelta a cajas (solo para mostrar):**
- CAJAS DEVUELTAS = el menor de (devuelto ÷ ratio) entre tapa y fondo.
- **El cobro siempre es por insumo:** lo que falta = DEVOLVER del insumo − devuelto del insumo. Al cerrar la devolución, eso pasa a descontar (`return_shortfall_qty`).

**Ejemplo (receta inventada: fondo 1, tapa 1, funda 1, químico 0,0002 frascos por caja):**

| | Fondo | Tapa | Funda | Químico |
|---|---|---|---|---|
| Retirado (800 cajas) | 800 | 800 | 800 | 1 (0,16 → 1) |
| Tarja total 720 × ratio | 720 | 720 | 720 | 1 (0,144 → 1) |
| **Sobrante** (80 cajas) | 80 | 80 | 80 | 0 |
| Decisión: 50 DEVOLVER + 30 DESCONTAR | 50 / 30 | 50 / 30 | 50 / 30 | — |
| La bodega recibe | 30 | 30 | 25 | — |
| **Se descuenta** = DESCONTAR + lo que no regresó | 30 + 20 = 50 | 30 + 20 = 50 | 30 + 25 = 55 | 0 |

En pantalla: "DEVUELTAS 30 CAJAS" (el menor entre tapa y fondo); la funda se cobra por unidad.

#### 13.B.4 Tablas y columnas (nuevas y cambiadas)

| Tabla | Cambio | Tipo / regla | Para qué |
|---|---|---|---|
| **`material_surplus_decisions`** *(nueva)* | `producer_quota_id` FK, `brand_id` FK, `warehouse_id` FK null (bodega de retiro, a la que se devuelve) | — | Una decisión por cupo × marca |
| | `boxes_withdrawn`, `boxes_carried_in`, `boxes_tallied`, `boxes_surplus` | integer; CHECK `boxes_surplus > 0` | **Foto** de las cifras al decidir. Si al liquidar no coinciden con las de ese momento, hay que volver a decidir |
| | `boxes_deduct`, `boxes_return`, `boxes_pending` | integer ≥ 0; CHECK suma = `boxes_surplus` | La decisión |
| | `notes` varchar(255) null, `decided_by` FK users, `decided_at` timestamp | — | Quién y cuándo |
| | `return_closed_at` timestamp null, `return_closed_by` FK users null | — | Cuándo se cerró el DEVOLVER (la bodega con "última devolución", o el coordinador). Sin DEVOLVER, queda nulo |
| | `status` boolean, `deactivation_reason` varchar(255) null; CHECK `status OR deactivation_reason IS NOT NULL` | — | Baja lógica al rehacerla |
| | índice único parcial `(producer_quota_id, brand_id) WHERE status` | — | Una decisión activa por cupo y marca |
| **`material_surplus_lines`** *(nueva)* | `material_surplus_decision_id` FK, `supply_id` FK; único `(decision, supply)` | — | Detalle por insumo de la receta |
| | `surplus_qty`, `deduct_qty`, `return_qty`, `pending_qty` | decimal(12,2) ≥ 0; CHECK suma = `surplus_qty` | Cantidades (la misma escala que `inventory_movement_lines.quantity`) |
| | `unit_cost` | **decimal(14,6)** | Costo congelado: valor ÷ cantidad retirada en ese cupo. Va a 6 decimales, como `inventory_movement_lines.unit_cost`, y no a (12,4): así no se pierden fracciones del promedio |
| | `expires_on` | date null; CHECK `pending_qty = 0 OR expires_on IS NOT NULL` | Vence lo PENDIENTE (decisión + 14 días). Al vencer, **bloquea** (no cobra) |
| | `return_shortfall_qty` | decimal(12,2) ≥ 0; CHECK ≤ `return_qty` | DEVOLVER que no regresó: lo graba la bodega al cerrar la devolución, o el coordinador al pasarlo a DESCONTAR. Se cobra en la LQ **de ese cupo** |
| | `pending_charged_qty` | decimal(12,2) ≥ 0; CHECK ≤ `pending_qty` | PENDIENTE que el coordinador pasó a DESCONTAR. Se cobra en la **siguiente LQ** del vendedor |
| | `charged_settlement_id` | FK settlements null | La LQ que cobró `pending_charged_qty` |
| | `forced_by` FK users, `forced_at` timestamp, `forced_reason` varchar(255) | null; CHECK `forced_at IS NULL OR forced_reason IS NOT NULL` | Quién pasó a DESCONTAR, cuándo y por qué |
| **`material_credit_uses`** *(nueva)* | `material_surplus_line_id` FK, `inventory_movement_id` FK (el despacho que lo usó), `producer_quota_id` FK (el cupo que lo usa), `quantity` decimal(12,2) > 0, `status` boolean | índice `(material_surplus_line_id) WHERE status` | El PENDIENTE que se usó en otro despacho. Si se anula ese despacho, el uso pasa a `status = false` y el saldo vuelve |
| `inventory_movements` | + `material_surplus_decision_id` | FK null; CHECK `material_surplus_decision_id IS NULL OR type = 'DEVOLUCION'` | Enlaza la devolución con el sobrante (DEVOLVER) |
| `settlement_materials` | + `carried_in_qty`, `pending_qty`, `late_charge_qty` | decimal(12,2) default 0, ≥ 0 | En la LQ: lo traído de un PENDIENTE (se cobra aquí), lo dejado PENDIENTE (no se cobra aquí) y el PENDIENTE de otra semana que el coordinador pasó a DESCONTAR (se cobra aquí) |
| | + `material_surplus_line_id` | FK null | Solo en la fila de un `late_charge_qty` de otra semana |

**Cobrado en la LQ, por insumo** = retirado − devuelto + traído − pendiente + `late_charge_qty`. Lo que no regresó de un DEVOLVER ya está dentro, porque no se devolvió. El valor de cada parte va a su propio costo congelado; `unit_cost` de la fila = valor ÷ cobrado.

**Saldo de un PENDIENTE**, por insumo = `pending_qty` − usos activos − devuelto enlazado aplicado al pendiente − `pending_charged_qty`.
- **Vigente** si `expires_on` ≥ hoy: el despacho lo usa.
- **Vencido** si `expires_on` < hoy y el saldo es > 0: **bloquea** al productor y **ya no** lo usa un despacho (pregunta 13.D-N1).

**DEVOLVER abierto** = la decisión tiene `boxes_return` > 0 y `return_closed_at` nulo. Desde el día de la decisión bloquea solo la **liquidación de esa semana**; a los **14 días** sin cerrar bloquea al productor completo, igual que el PENDIENTE vencido (Peter, 19/11/2026, 13.D-N3).

El bloqueo **se calcula en el momento** (servicio `BloqueoMaterial::de($thirdPartyId)`), sin una columna de estado que se desincronice. Una tarea diaria (`material:vencimientos`, en `routes/console.php`) solo avisa en la campanita el día que algo vence.

#### 13.B.5 Migración propuesta

`database/migrations/2026_11_XX_000001_material_sobrante.php` (fecha del día en que se programe; va **después** de la 1b si se suben juntas).

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 19/11/2026: MATERIAL SOBRANTE DESPUÉS DE LA TARJA (docs/modulos/pagos-liquidaciones.md, 13.B).
//   Sobrante = cajas de material retirado (+ traído de un PENDIENTE) − tarja total, por cupo × marca.
//   La analista comercial lo reparte en DESCONTAR (se cobra en la LQ), DEVOLVER (devolución enlazada a bodega)
//   y PENDIENTE (saldo de material a favor para el próximo despacho; a los 14 días sin usar, BLOQUEA al productor hasta que devuelva o el coordinador lo pase a DESCONTAR).
//   Liquidar se bloquea mientras haya un sobrante sin decidir.
return new class extends Migration
{
    public function up(): void
    {
        // 1) Decisión por cupo × marca, con la foto de las cifras con que se decidió
        Schema::create('material_surplus_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producer_quota_id')->constrained('producer_quotas');
            $table->foreignId('brand_id')->constrained('brands');
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses'); // bodega de retiro (a la que se devuelve)
            $table->integer('boxes_withdrawn');                 // cajas de material retirado (13.B.3)
            $table->integer('boxes_carried_in')->default(0);    // cajas traídas de un PENDIENTE anterior
            $table->integer('boxes_tallied');                   // tarja total (Σ boxes_shipped de tarjas activas)
            $table->integer('boxes_surplus');                   // retiradas + traídas − tarja
            $table->integer('boxes_deduct')->default(0);        // DESCONTAR
            $table->integer('boxes_return')->default(0);        // DEVOLVER
            $table->integer('boxes_pending')->default(0);       // PENDIENTE
            $table->string('notes', 255)->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users');
            $table->timestamp('decided_at')->nullable();
            // 19/11/2026: DEVOLVER cerrado (la bodega con "última devolución" o el coordinador); abierto = bloquea al productor
            $table->timestamp('return_closed_at')->nullable();
            $table->foreignId('return_closed_by')->nullable()->constrained('users');
            $table->boolean('status')->default(true);
            $table->string('deactivation_reason', 255)->nullable();
            $table->timestamps();
            $table->index('producer_quota_id');
        });
        DB::statement('ALTER TABLE material_surplus_decisions ADD CONSTRAINT msd_cajas_check CHECK (boxes_withdrawn >= 0 AND boxes_carried_in >= 0
            AND boxes_tallied >= 0 AND boxes_surplus > 0 AND boxes_deduct >= 0 AND boxes_return >= 0 AND boxes_pending >= 0)');
        DB::statement('ALTER TABLE material_surplus_decisions ADD CONSTRAINT msd_suma_check CHECK (boxes_deduct + boxes_return + boxes_pending = boxes_surplus)');
        DB::statement('ALTER TABLE material_surplus_decisions ADD CONSTRAINT msd_motivo_check CHECK (status OR deactivation_reason IS NOT NULL)');
        DB::statement('CREATE UNIQUE INDEX msd_cupo_marca_activa_unique ON material_surplus_decisions (producer_quota_id, brand_id) WHERE status');

        // 2) Detalle por insumo de la receta, con el costo congelado del despacho
        Schema::create('material_surplus_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_surplus_decision_id')->constrained('material_surplus_decisions');
            $table->foreignId('supply_id')->constrained('supplies');
            $table->decimal('surplus_qty', 12, 2);
            $table->decimal('deduct_qty', 12, 2)->default(0);
            $table->decimal('return_qty', 12, 2)->default(0);
            $table->decimal('pending_qty', 12, 2)->default(0);
            $table->decimal('unit_cost', 14, 6)->default(0);    // 6 decimales, como inventory_movement_lines.unit_cost
            $table->date('expires_on')->nullable();             // vence el PENDIENTE (decisión + 14 días): al vencer BLOQUEA, no cobra
            // 19/11/2026 (Peter): DEVOLVER parcial → lo que no regresa se descuenta solo (al cerrar la devolución)
            $table->decimal('return_shortfall_qty', 12, 2)->default(0);
            // 19/11/2026 (Peter): PENDIENTE vencido o DEVOLVER sin recibir → el coordinador de compras lo pasa a DESCONTAR
            $table->decimal('pending_charged_qty', 12, 2)->default(0);
            $table->foreignId('charged_settlement_id')->nullable()->constrained('settlements'); // LQ que cobró pending_charged_qty
            $table->foreignId('forced_by')->nullable()->constrained('users');
            $table->timestamp('forced_at')->nullable();
            $table->string('forced_reason', 255)->nullable();
            $table->timestamps();
            $table->unique(['material_surplus_decision_id', 'supply_id']);
            $table->index('supply_id');
        });
        DB::statement('ALTER TABLE material_surplus_lines ADD CONSTRAINT msl_cantidades_check CHECK (surplus_qty > 0 AND deduct_qty >= 0 AND return_qty >= 0 AND pending_qty >= 0)');
        DB::statement('ALTER TABLE material_surplus_lines ADD CONSTRAINT msl_suma_check CHECK (deduct_qty + return_qty + pending_qty = surplus_qty)');
        DB::statement('ALTER TABLE material_surplus_lines ADD CONSTRAINT msl_vence_check CHECK (pending_qty = 0 OR expires_on IS NOT NULL)');
        DB::statement('ALTER TABLE material_surplus_lines ADD CONSTRAINT msl_faltante_check CHECK (return_shortfall_qty >= 0 AND return_shortfall_qty <= return_qty)');
        DB::statement('ALTER TABLE material_surplus_lines ADD CONSTRAINT msl_cobro_pendiente_check CHECK (pending_charged_qty >= 0 AND pending_charged_qty <= pending_qty)');
        DB::statement('ALTER TABLE material_surplus_lines ADD CONSTRAINT msl_forzado_check CHECK (forced_at IS NULL OR forced_reason IS NOT NULL)');

        // 3) Uso del PENDIENTE en un despacho posterior (si se anula el despacho, status = false y el saldo vuelve)
        Schema::create('material_credit_uses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_surplus_line_id')->constrained('material_surplus_lines');
            $table->foreignId('inventory_movement_id')->constrained('inventory_movements'); // despacho que lo usó
            $table->foreignId('producer_quota_id')->constrained('producer_quotas');         // cupo donde se cobra
            $table->decimal('quantity', 12, 2);
            $table->boolean('status')->default(true);
            $table->timestamps();
            $table->index('inventory_movement_id');
            $table->index('producer_quota_id');
        });
        DB::statement('ALTER TABLE material_credit_uses ADD CONSTRAINT mcu_cantidad_check CHECK (quantity > 0)');
        DB::statement('CREATE INDEX mcu_linea_activa_idx ON material_credit_uses (material_surplus_line_id) WHERE status');

        // 4) Devolución enlazada al sobrante (DEVOLVER)
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->foreignId('material_surplus_decision_id')->nullable()->constrained('material_surplus_decisions');
            $table->index('material_surplus_decision_id');
        });
        DB::statement("ALTER TABLE inventory_movements ADD CONSTRAINT im_sobrante_devolucion_check CHECK (material_surplus_decision_id IS NULL OR type = 'DEVOLUCION')");

        // 5) Materiales de la LQ: traído de un PENDIENTE, dejado PENDIENTE y PENDIENTE pasado a DESCONTAR por el coordinador
        Schema::table('settlement_materials', function (Blueprint $table) {
            $table->decimal('carried_in_qty', 12, 2)->default(0);
            $table->decimal('pending_qty', 12, 2)->default(0);
            $table->decimal('late_charge_qty', 12, 2)->default(0);
            $table->foreignId('material_surplus_line_id')->nullable()->constrained('material_surplus_lines'); // fila de un cobro de otra semana
        });
        DB::statement('ALTER TABLE settlement_materials ADD CONSTRAINT sm_sobrante_check CHECK (carried_in_qty >= 0 AND pending_qty >= 0 AND late_charge_qty >= 0)');

        // 6) Pantallas nuevas (material_sobrante = analista, coordinador_compras = coordinador): NO van en ningún
        //    perfil. Peter (19/11): se dan por excepción por persona.
    }

    public function down(): void
    {
        // Si ya hay decisiones, la LQ las usó para cobrar: revertir descuadraría lo cobrado. Se detiene.
        if (DB::table('material_surplus_decisions')->exists()) {
            throw new RuntimeException('HAY DECISIONES DE MATERIAL SOBRANTE: NO SE PUEDE REVERTIR SIN DESCUADRAR LAS LIQUIDACIONES. REVÍSALAS ANTES.');
        }
        DB::statement('ALTER TABLE settlement_materials DROP CONSTRAINT IF EXISTS sm_sobrante_check');
        Schema::table('settlement_materials', function (Blueprint $table) {
            $table->dropConstrainedForeignId('material_surplus_line_id');
            $table->dropColumn(['carried_in_qty', 'pending_qty', 'late_charge_qty']);
        });
        DB::statement('ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS im_sobrante_devolucion_check');
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropIndex(['material_surplus_decision_id']);
            $table->dropConstrainedForeignId('material_surplus_decision_id');
        });
        Schema::dropIfExists('material_credit_uses');
        Schema::dropIfExists('material_surplus_lines');
        Schema::dropIfExists('material_surplus_decisions');
    }
};
```

**Modelos** (todos con `use \App\Models\Concerns\Auditable;`):

| Modelo | `$fillable` | `$casts` / notas |
|---|---|---|
| `MaterialSurplusDecision` *(nuevo)* | todas sus columnas menos `id` y los timestamps | `boxes_*` → `integer`, `status` → `boolean`, `decided_at` → `datetime`. Relaciones `quota()`, `brand()`, `warehouse()`, `lines()`, `returns()` (`InventoryMovement` por `material_surplus_decision_id`) |
| `MaterialSurplusLine` *(nuevo)* | ídem | `*_qty` → `decimal:2`, `unit_cost` → `decimal:6`, `expires_on` → `date:Y-m-d`, `forced_at` → `datetime`. Métodos `saldoPendiente()`, `vencido()` y `faltaDevolver()` |
| `MaterialCreditUse` *(nuevo)* | ídem | `quantity` → `decimal:2`, `status` → `boolean` |
| `InventoryMovement` | + `material_surplus_decision_id` | — |
| `SettlementMaterial` | + `carried_in_qty`, `pending_qty`, `late_charge_qty`, `material_surplus_line_id` | `decimal:2` en las tres cantidades |
| `MaterialSurplusDecision` | + `return_closed_at`, `return_closed_by` | `return_closed_at` → `datetime` |

**Servicio nuevo `App\Services\BloqueoMaterial`:** `de(int $thirdPartyId): array` devuelve lo que el productor debe: decisión, WK, bodega, insumo, cantidad, motivo (VENCIDO o DEVOLUCIÓN SIN RECIBIR) y la fecha. Vacío = no está bloqueado. Lo usan PAGAR, `SettlementController::calcular()`, la grilla de Compra de fruta, el despacho (solo aviso) y el contador del coordinador.

#### 13.B.6 Endpoints, pantallas y permisos

| Método y ruta | Middleware | Qué hace |
|---|---|---|
| `GET /material-surplus?anio=&semana=&estado=` | `pantalla:material_sobrante,liquidar` | Una fila por cupo × marca con material retirado: vendedor, marca, bodega, retiradas, traídas, tarja total, sobrante, decisión y estado (SIN DECIDIR / DECIDIDO / DEVOLUCIÓN PENDIENTE / CAMBIÓ / SIN SOBRANTE / LIQUIDADO). Valores en $ solo con `ver_costos`. |
| `GET /material-surplus/{quotaId}/{brandId}` | ídem | Detalle por insumo (retirado, devuelto, traído, tarja × ratio, sobrante, propuesta de reparto) |
| `PUT /material-surplus/{quotaId}/{brandId}` `{boxes_deduct, boxes_return, boxes_pending, notes}` | `pantalla:material_sobrante` | Guarda o rehace la decisión: la anterior queda `status = false` con el motivo "REHECHA". Avisa a la bodega si hay DEVOLVER. |
| `GET /material-dispatch/calculate` *(existe)* | `pantalla:despacho` | Devuelve además `a_favor` por insumo, y `valor_recomendado` = fórmula − ya despachado − a favor |
| `POST /material-dispatch` *(existe)* | `pantalla:despacho` | Registra los `material_credit_uses`: uso = mín(saldo, máx(0, fórmula − ya despachado − entregado ahora)), primero lo que vence antes |
| `PATCH /material-dispatch/{id}/deactivate` *(existe)* | igual | Pone sus usos en `status = false` (el saldo vuelve) |
| `GET /inventory-movements/returnable-quotas/{id}` *(existe)* | igual que hoy | Agrega lo que falta devolver: los DEVOLVER abiertos y los PENDIENTES vencidos (decisión, marca, cantidad por insumo) |
| `POST /inventory-movements` *(existe)* | igual que hoy | Acepta `material_surplus_decision_id` (solo DEVOLUCION) y `close_surplus_return` (boolean, por defecto true). Lo devuelto va primero al DEVOLVER y luego al PENDIENTE. Al cerrar, graba `return_shortfall_qty` por insumo y `return_closed_at` |
| `GET /material-surplus/blocked` · `GET /material-surplus/blocked/count` | `pantalla:coordinador_compras` | Productores BLOQUEADOS con lo que deben (para la pantalla y el contador rojo del menú, como `material-dispatch/pending-count`) |
| `PATCH /material-surplus/lines/{id}/force-deduct` `{reason}` | `pantalla:coordinador_compras` | Pasa a DESCONTAR lo que falta: el DEVOLVER abierto → `return_shortfall_qty`, y cierra; el PENDIENTE vencido → `pending_charged_qty`. Con motivo; queda en la bitácora |

| Pantalla | Clave | Sección | Tipo base por defecto | `solo` |
|---|---|---|---|---|
| **Material sobrante** (nueva, `src/pages/comercial/MaterialSurplusPage.jsx`, ruta `/comercial/material-sobrante`) | **`material_sobrante`** | COMERCIAL | **Ninguno**: excepción por persona para la **analista comercial** (Peter, 19/11) | COMERCIAL |
| Liquidar (ve la lista, no decide) | `liquidar` *(existe)* | LIQUIDACIÓN | LIQUIDACIONES | — |
| Devolución enlazada | `nuevo_movimiento` *(existe)* | INVENTARIO | Inventario + BODEGUERO (**solo su bodega**: `puedeBodega`) | — |
| Despacho con saldo a favor | `despacho` *(existe)* | INVENTARIO | Inventario + BODEGUERO | — |
| **Material por devolver** (nueva, `src/pages/comercial/MaterialBlockedPage.jsx`, ruta `/comercial/material-por-devolver`, con contador rojo en el menú) | **`coordinador_compras`** | COMERCIAL | **Ninguno**: excepción por persona para el **coordinador de compras** | — (sin `solo`, por si el coordinador no es de tipo base COMERCIAL) |

**La pantalla Material sobrante:**
- Usa `EncabezadoPagina` y `TablaEstandar` compacta, con los filtros AÑO / SEMANA / ESTADO (por defecto SIN DECIDIR).
- Al elegir una fila se abre un `ModalShell` con tres `CampoNumero decimales={0}` (DESCONTAR, DEVOLVER y PENDIENTE), el total en vivo ("FALTAN 20 CAJAS" en rojo) y la tabla por insumo.
- Botones Guardar (verde) y Cancelar (rojo, texto blanco). Los datos van en MAYÚSCULAS.
- Liquidar enlaza a esta pantalla desde el aviso de bloqueo.

**La pantalla Material por devolver (coordinador de compras):**
- Lista en rojo a cada productor BLOQUEADO: WK, marca, bodega, insumo, cantidad que debe, motivo (VENCIDO EL dd/mm / DEVOLUCIÓN SIN RECIBIR desde el dd/mm) y los días de atraso.
- Acción **"Pasar a descontar"** (botón rojo): `DialogoConfirmacion` con motivo obligatorio y el resumen "SE DESCONTARÁN 20 FONDOS, 20 TAPAS… EN <LA LQ DE WK45 | LA PRÓXIMA LIQUIDACIÓN>".
- El contador del menú cuenta los productores bloqueados. Se recalcula como el de "Por despachar".

#### 13.B.7 Validaciones del backend (mensajes)

| Dónde | Regla | Mensaje (422) |
|---|---|---|
| Guardar la decisión | La suma no da el sobrante | "LA SUMA (DESCONTAR + DEVOLVER + PENDIENTE) DEBE SER <N> CAJAS: HOY SUMA <M>." |
| | Números negativos o con decimales | "LAS CAJAS VAN EN NÚMEROS ENTEROS Y NO NEGATIVOS." |
| | No hay sobrante | "<MARCA> NO TIENE MATERIAL SOBRANTE EN WK<N>: NO HAY NADA QUE DECIDIR." |
| | El cupo ya está LIQUIDADO | "EL CUPO YA FUE LIQUIDADO: EL SOBRANTE NO SE PUEDE CAMBIAR." |
| | Bajar el PENDIENTE por debajo de lo ya usado | "NO SE PUEDE: <Q> <INSUMO> DEL PENDIENTE YA SE USARON EN EL DESPACHO DE WK<N>." |
| | Bajar DEVOLVER por debajo de lo ya devuelto | "LA BODEGA YA RECIBIÓ <N> CAJAS DEVUELTAS: DEVOLVER NO PUEDE SER MENOS." |
| | Las cifras cambiaron mientras decidía (otra tarja o despacho) | "EL SOBRANTE CAMBIÓ MIENTRAS DECIDÍAS (AHORA ES <N>): RECARGA Y VUELVE A REPARTIRLO." (409) |
| Devolución enlazada | Devuelve más de lo decidido de un insumo | "LA DEVOLUCIÓN PASA LO DECIDIDO: SE DECIDIÓ DEVOLVER <Q> <INSUMO>." |
| | La decisión es de otro vendedor o de otro cupo | "ESTA DEVOLUCIÓN ES DE OTRO CUPO: ELIGE LA SEMANA CORRECTA." |
| **Liquidar** (`calcular()` → `problemas`) | Sobrante sin decidir | "MATERIAL SOBRANTE SIN DECIDIR: <MARCA> <N> CAJAS. LA ANALISTA COMERCIAL DEBE DECIDIRLO EN COMERCIAL → MATERIAL SOBRANTE." |
| | La foto no coincide (tarja, despacho o devolución cambió) | "EL MATERIAL SOBRANTE DE <MARCA> CAMBIÓ DESPUÉS DE DECIDIRLO (ERA <A>, AHORA <B>): LA ANALISTA COMERCIAL DEBE VOLVER A REPARTIRLO." |
| | **Productor BLOQUEADO** (DEVOLVER abierto en cualquier cupo, o PENDIENTE vencido): frena **todas** sus LQ, incluida la del cupo del sobrante | "<VENDEDOR> ESTÁ BLOQUEADO: DEBE DEVOLVER <Q> <INSUMO>, <Q> <INSUMO> DE WK<N> (<VENCIÓ EL dd/mm \| DEVOLUCIÓN SIN RECIBIR>). LA BODEGA <BODEGA> DEBE REGISTRAR LA DEVOLUCIÓN O EL COORDINADOR DE COMPRAS PASARLO A DESCONTAR." |
| PAGAR (13.A.5) | Productor BLOQUEADO | El mismo mensaje |
| Pasar a descontar | Sin motivo | "ESCRIBE EL MOTIVO PARA PASAR A DESCONTAR." |
| | No hay nada pendiente | "ESTE MATERIAL YA SE DEVOLVIÓ O YA SE DESCONTÓ: RECARGA LA PANTALLA." |
| | El PENDIENTE no venció | "EL PENDIENTE VENCE EL dd/mm: TODAVÍA SE PUEDE USAR EN EL PRÓXIMO DESPACHO." |
| Despacho | Sin error nuevo; solo informa | Aviso ámbar: "<VENDEDOR> TIENE MATERIAL A FAVOR DE WK<N> (VENCE EL dd/mm): SE RECOMIENDA ENTREGAR MENOS." Si está BLOQUEADO, aviso **rojo** con lo que debe; el despacho no se frena (pregunta 13.D-N4). |

Al guardar una tarja, un despacho o una devolución que cambia el sobrante de una marca ya decidida, se avisa a la analista en la campanita ("EL SOBRANTE DE <VENDEDOR> — <MARCA> WK<N> CAMBIÓ"). No se bloquea la tarja.

#### 13.B.8 Casos borde

| Caso | Qué hace el sistema |
|---|---|
| **Devolución parcial** (sobran 50, regresan 30 porque 20 se mojaron) | La bodega registra lo devuelto **por insumo** y deja marcada "última devolución". Lo que no regresó se graba en `return_shortfall_qty` y **se descuenta solo** en la LQ de ese cupo; el productor se destraba. Si desmarca "última", el DEVOLVER sigue abierto (llegan más después) y el productor sigue bloqueado. |
| Devolución parcial **por insumo** (llegan 30 fondos y 25 fundas) | Se cobra lo que falta de cada insumo (13.B.3, ejemplo); la pantalla muestra "DEVUELTAS 30 CAJAS". |
| DEVOLVER que **nunca llega** | El productor queda BLOQUEADO desde la decisión. El coordinador lo pasa a DESCONTAR: graba el faltante, cierra el DEVOLVER y se cobra en la LQ de ese cupo. |
| La bodega recibe material del vendedor **sin enlazarlo** | Cuenta como hoy (resta del cobro) y **baja el sobrante**. Si ya había decisión, la foto deja de coincidir y la analista vuelve a decidir. |
| **PENDIENTE que vence** (14 días desde la decisión, con saldo) | **No se cobra solo.** El productor queda **BLOQUEADO**: no se liquida su 20 % ni se pulsa PAGAR. Se destraba si la bodega recibe la devolución enlazada (va al PENDIENTE) o si el coordinador lo pasa a DESCONTAR. Esto último se cobra en la **siguiente LQ** del vendedor (fila "MATERIAL PENDIENTE DE WK<N> PASADO A DESCONTAR", al costo congelado) y marca `charged_settlement_id`. Si esa LQ se anula, se desmarca y vuelve a cobrarse en la siguiente; **no** vuelve a bloquear. |
| PENDIENTE pasado a DESCONTAR **sin otra LQ** del vendedor | Queda en Material por devolver como "POR COBRAR EN LA PRÓXIMA LIQUIDACIÓN", con el valor (solo con `ver_costos`). No bloquea. |
| Vence **mientras se liquida** | `SettlementController@store` vuelve a revisar el bloqueo dentro de la transacción. Si vence en ese instante, la LQ no se graba y sale el mensaje del bloqueo. |
| PENDIENTE usado **en parte** | Lo usado se cobra en el cupo nuevo (traído); el resto sigue vigente hasta su vencimiento. |
| Se **anula el despacho** que usó el PENDIENTE | Sus usos pasan a `status = false` y el saldo vuelve. Si ya venció, el productor queda BLOQUEADO por ese saldo. |
| **Compra partida** (Dividir) | No afecta: el sobrante es por cupo × marca y suma las tarjas de todas las compras de esa marca del cupo, incluidas las que salieron de la división. Si la división cambió la marca de una parte, cada marca tiene su sobrante. |
| Compra con material retirado **sin tarja** | Peter (19/11): la fruta siempre llega. Si pasara, Liquidar sigue exigiendo tarja (sin cambio). |
| **Compra anulada** | No se puede quitar una compra con material retirado (regla de hoy en `PurchaseAllocationController`). Si se bajan sus cajas, el sobrante no cambia: sale de lo retirado y de la tarja, no de lo comprado. |
| **Cupo liquidado** | La decisión queda bloqueada. Si se **anula la LQ**, se puede rehacer, salvo lo PENDIENTE ya usado en otro despacho, lo ya devuelto y lo pasado a DESCONTAR. |
| Productor BLOQUEADO con una LQ **ya grabada** de otra semana | La LQ grabada no se toca; el bloqueo frena las LQ **nuevas**. Las cuotas ya aprobadas siguen su curso. |
| Dos marcas del mismo cupo comparten un insumo (ej. un químico de receta TODAS) | El retirado por insumo se toma por marca (`inventory_movements.brand_id`, como `yaDespachado`). Una devolución sin enlace no tiene marca: se reparte primero a la marca con más sobrante de ese insumo, y se muestra. |
| Sobrante **0 o negativo** | No bloquea. Si es negativo, aviso informativo en la pantalla y en Liquidar. |

#### 13.B.9 Qué cambia en Liquidar (`SettlementController`, `SettlementFormPage.jsx`)

- `calcular()` agrega a `problemas` los bloqueos de 13.B.7: sobrante sin decidir, sobrante que cambió y **productor BLOQUEADO** (`BloqueoMaterial::de`). `preview` agrega `material_surplus` (resumen por marca, con enlace a la pantalla).
- `materiales()` pasa a: retirado − devuelto + **traído** (usos activos con `producer_quota_id` = este cupo) − **pendiente** (decisión de este cupo) + **`late_charge_qty`** (PENDIENTE de otras semanas que el coordinador pasó a DESCONTAR y todavía no se cobró). Cada parte se valoriza a su costo congelado.
- `store()` graba `carried_in_qty`, `pending_qty` y `late_charge_qty` en `settlement_materials` y marca `charged_settlement_id`. `annul()` lo desmarca.
- **Pantalla:** la tabla "2. Materiales retirados" suma las columnas TRAÍDO, A FAVOR (sale) y PASADO A DESCONTAR. Los avisos rojos (SOBRANTE SIN DECIDIR, BLOQUEADO) van en la fila de avisos (formato del 19/11).
- **Compra de fruta:** el vendedor bloqueado lleva una barra roja con el motivo (como SIN CÉDULA) y PAGAR sale gris.

#### 13.B.10 Bloqueo del productor por material (Peter, 19/11)

| | Qué |
|---|---|
| **Cuándo** | (a) un **DEVOLVER abierto** en cualquiera de sus cupos, desde el día de la decisión; o (b) un **PENDIENTE vencido** con saldo (14 días desde la decisión). |
| **Qué frena** | Toda **liquidación nueva** del productor (el 20 % y el 100 % de contrato, porque es la misma LQ del cupo) y el botón **PAGAR** del 80 % en sus compras nuevas. El mensaje en MAYÚSCULAS dice qué falta devolver, de qué semana y en qué bodega. |
| **Qué no frena** | Las órdenes y cuotas que ya existían, la Compra de fruta (se puede seguir comprando), las tarjas y, por ahora, el despacho, que solo avisa en rojo (13.D-N4). |
| **Quién se entera** | El **coordinador de compras** (pantalla `coordinador_compras`, por persona): contador rojo en el menú, la pantalla Material por devolver y la campanita el día que algo vence. La analista y Liquidaciones ven el aviso en sus pantallas. |
| **Cómo se destraba** | La bodega registra la devolución enlazada y la cierra (lo que falta se descuenta solo), o el coordinador pasa lo que falta a DESCONTAR con un motivo. |

#### 13.B.11 Impacto en datos existentes (A y B)

| Dato | Qué se hace |
|---|---|
| Despachos y devoluciones en **producción** | Volver a contarlos con `siae-datos` antes de subir (en local hay 0). Los cupos **sin liquidar** con tarja y sobrante quedan SIN DECIDIR y **bloquean su LQ**: hay que avisar a la analista el día de la subida. |
| Cupos ya liquidados | No se tocan: no se crean decisiones hacia atrás. |
| Compras SPOT ya enviadas a bodega y sin LQ | No se crea ninguna orden 80 % automática: Comercial pulsa PAGAR en las que corresponda. Si alguna ya se pagó **por fuera** (Excel), se registra como anticipo **manual ANTERIOR** con un script `CARGA_BD` + `CARGA_SIMULAR=1`, por los mismos endpoints. Así no se paga dos veces. |
| Perfiles | **Ningún perfil cambia.** Por excepción por persona (Usuarios → excepciones): la **asistente comercial** recibe `pagar_anticipo_80`, la **analista comercial** `material_sobrante` y el **coordinador de compras** `coordinador_compras`. |

Orden en producción, como siempre: simulación → respaldo de la base, el `dist` y los `.env` → migración → revisión.

---

### 13.C Fases sugeridas

| Fase | Contenido | Por qué en este orden |
|---|---|---|
| **1b-1** | 13.A completo: migración 7.3 con los cambios de 13.A.4, PAGAR en Compra de fruta, Tablero de aprobación (4.0, solo para el 80 %), **Cuentas por pagar → Anticipos de productores** con `bank_payment_batch_items` y el TXT, y la LQ SPOT que descuenta el 80 % y deja una sola cuota SALDO SPOT | El 80 % y el cambio de la LQ **salen juntos**: si sale el PAGAR sin la LQ nueva, la LQ volvería a pagar el 80 % (doble pago). Mientras tanto, las cuotas de la LQ se siguen registrando en "Pagos e historial" como hoy. |
| **1c** | 13.B completo: migración de 13.B.5, pantalla Material sobrante, bloqueo en Liquidar, saldo a favor en el despacho, devolución enlazada | Toca Liquidar igual que 1b-1: mejor después, para no mezclar los dos cambios. No depende de la 1b. |
| **1b-2** | El resto de la 1b: cuotas de la LQ y OC en Cuentas por pagar, anticipos manuales con aprobación, fallidas, pago manual y reverso | Lo de 5.x que no hace falta para el 80 %. |

#### 13.C.1 Pruebas que debe hacer QA (se suman a las de 7.7; reemplazan los puntos 1 y 2 de la 1b)

1. **SPOT 80/20 enviada**, 1.000 cajas a $7,00, corte en WK45 → PAGAR crea `ORD-…` por 5.600,00, POR APROBAR, semana WK45. Sin envío, sin precio, sin corte, CONTRATO o SPOT al 100 % → 422 con su mensaje.
2. Doble clic en PAGAR → una sola orden. Un usuario COMERCIAL **sin** la excepción `pagar_anticipo_80` → 403; con la excepción, sí puede. Un perfil de LIQUIDACIONES no puede recibir `pagar_anticipo_80` (`solo`).
3. Cambiar las cajas con la orden POR APROBAR → se recalcula; APROBADA → vuelve a POR APROBAR con aviso; PAGADA → no cambia y el tablero avisa. SPOT → CONTRATO con la orden APROBADA → 422.
4. Dividir una compra con 80 % → las partes no tienen PAGAR; la LQ SPOT descuenta el 80 % una sola vez.
5. Con la tarja de 700 (ejemplo 13.A.8) → cuota 0 y SALDO A FAVOR DE AGAT por 1.291,00.
6. Cuentas por pagar: con la cuenta PENDIENTE, la orden no entra al TXT; con la cuenta VERIFICADA, hay una línea por orden y la cuenta va enmascarada en pantalla.
7. Sobrante: retira 800 con tarja 780 + 20 → sin decisión, se liquida. Retira 800 con tarja 700 + 20 → Liquidar bloqueado con "MATERIAL SOBRANTE SIN DECIDIR"; 30 + 50 → se liquida cobrando 30 cajas de material y con 50 a favor.
8. Suma distinta del total → 422. Se cambia la tarja después de decidir → bloqueo "CAMBIÓ" y aviso a la analista.
9. DEVOLVER 50 → el productor queda BLOQUEADO: Liquidar y PAGAR dan el mensaje del bloqueo. La bodega registra 30 por insumo como "última" → 20 se descuentan solos y se destraba. Devolver más de lo decidido → 422.
10. PENDIENTE 50 → el siguiente despacho recomienda 50 menos y registra el uso; anular ese despacho devuelve el saldo. PENDIENTE sin uso a los 15 días → BLOQUEADO (no se cobra solo); aparece en el contador del coordinador; "Pasar a descontar" sin motivo → 422; con motivo → se destraba y se cobra en la siguiente LQ. Si se anula esa LQ, se cobra en la siguiente y no vuelve a bloquear.
11. Un BODEGUERO de otra bodega no puede registrar la devolución enlazada (403). Sin `ver_costos`, Material sobrante y Material por devolver no muestran $. Sin `coordinador_compras` → 403 en `blocked` y `force-deduct`.
12. `npm run build` sin errores; `php -l` en cada PHP; migraciones aplicadas en `SIAE` y `siae_test`; `down()` probado en local.

---

### 13.D Preguntas para Peter

**Resueltas por Peter el 19/11/2026:** N1 no (un PENDIENTE vencido no se usa en despachos; solo se destraba devolviendo o con DESCONTAR). N2 sí (las órdenes 80 % ya existentes siguen su curso). N3 un DEVOLVER bloquea desde el día la liquidación de esa semana y, a los 14 días, al productor completo. N4 no (el despacho solo avisa en rojo).
