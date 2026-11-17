# Pagos de liquidaciones → Contabilidad (diseño para aprobar)

Fecha: 17/11/2026 · Autor: arquitecto (siae-architect) · Estado: **BORRADOR, ESPERA EL OK DE PETER** · Actualizado el 17/11 con las respuestas de Peter (P1 y P5), el **Tablero de anticipos y pagos** y la tabla de cuentas contables para completar.
Pedido de Peter (17/11/2026): que el sistema calcule las cuotas a pagar de cada liquidación (CONTRATO 100 %, SPOT 80/20), que Liquidaciones las acepte con un check en un listado, que lo aceptado le llegue a Contabilidad para pagar por el banco, y saber cómo se manejan las **cuentas contables**.

> **En un minuto**
> - **Nada de pantallas paralelas.** Se reutilizan los pagos que ya tiene cada liquidación, la bandeja de Contabilidad de las OC, los lotes al banco y el TXT del Pichincha. Las cuentas bancarias siguen cifradas y en su misma tabla.
> - **Tres momentos, una sola cola.** El sistema calcula la cuota. Liquidaciones la **acepta** con un check, o la **devuelve** con un motivo. Contabilidad la **paga** en un lote al banco, o a mano con su comprobante.
> - **SPOT:** el 80 % se paga en la semana de la compra como un **anticipo automático** sobre las cajas embarcadas, y la liquidación de la semana siguiente lo descuenta y paga el 20 % restante.
>   - Eso es lo que decía el Excel del 06/11. Hoy el sistema paga el 80 % recién **después** de liquidar, así que esto **cambia una regla que ya está programada**.
> - **CONTRATO:** un solo pago del 100 % al liquidar. Se programa para la semana en curso o para la siguiente, según el contrato, y Liquidaciones lo puede cambiar al aprobar.
> - **Cuentas contables:** **ahora no** se lleva contabilidad dentro del SIAE.
>   - Se exporta un archivo con el "asiento sugerido" para el sistema contable (Contífico u otro).
>   - El plan de cuentas lo da Andrea o el contador.
>   - El plan de cuentas dentro del SIAE queda para una fase posterior, si se decide.
> - **Antes de usarlo** hay que cerrar los bloqueos de la sección 8.1: compras CONTRATO sin contrato, compras sin precio real, parámetros de la semana, cuentas bancarias, TXT real y la fase 0 (retención, solo embarcadas y LQ separadas por contrato y SPOT).
> - **Producción no tiene liquidaciones ni pagos todavía**, así que no hay que migrar pagos.
> - **Segregación de funciones:** quien liquida no aprueba su propia liquidación, y quien aprueba no paga. El banco nunca recibe un pago sin aprobación ni el mismo pago dos veces.

---

## 1. Proceso de negocio (en simple)

| # | Cuándo | Quién | Qué pasa |
|---|---|---|---|
| 1 | Semana de compra **N** | Comercial / Logística | Se compra la fruta y llega al puerto. Las **tarjas** dicen cuántas cajas se embarcaron. |
| 2 | Semana N, al cerrar las tarjas | **Sistema** | Para cada compra **SPOT** calcula el **anticipo del 80 %**: cajas embarcadas × precio real × 80 %. Lo deja en **POR APROBAR**. |
| 3 | Semana N | Jefe de Liquidaciones | En **LIQUIDACIÓN → Pagos por aprobar** marca con un check los anticipos correctos y pulsa **Aprobar**, o devuelve uno con su motivo. |
| 4 | Semana **N+1** | Liquidaciones | **Liquida** el cupo como hoy (fruta, materiales, transporte, retención, nota de crédito). El sistema descuenta el 80 % ya pagado y calcula la cuota final: el **20 %** de SPOT o el **100 %** de CONTRATO. |
| 5 | Semana N+1 | Jefe de Liquidaciones | Aprueba con un check las cuotas de la liquidación, eligiendo para CONTRATO si se pagan **esta semana o la próxima**. |
| 6 | Cuando toca | Contabilidad (Andrea) | En **CONTABILIDAD → Pagos al banco** ve juntas las OC aprobadas y las cuotas de liquidación aprobadas. Marca las que va a pagar, **genera el TXT del Pichincha** y lo sube al banco. |
| 7 | Al confirmar el banco | Contabilidad | Marca el lote como **PAGADO**. Si el banco rechazó alguna línea, la marca **FALLIDA** con el motivo, y esa cuota vuelve a "por pagar" (por ejemplo, porque la cuenta estaba mal). |
| 8 | Fin de semana o de mes | Contabilidad | Descarga el **archivo de asientos sugeridos** (liquidaciones, retenciones y pagos) para registrarlos en el sistema contable. |

---

## 2. Reglas: lo que se dijo, lo que hay en el código y lo que propongo

| Tema | 29/10 | 06/11 (Excel) | 17/11 (Peter) | **Código hoy** | **Propuesta** |
|---|---|---|---|---|---|
| CONTRATO | 100 % | — | 100 %, en la semana que transcurre o en la próxima | Cuota 1 = 100 % **al liquidar** | 100 % al liquidar, con **semana programada** = la de liquidación + 0 o + 1 |
| SPOT | 80 % al embarcar y 20 % después | "Anticipo 80 % se paga **ANTES** de liquidar; la liquidación lo descuenta" | 80 % en la semana actual y 20 % en la próxima | Cuotas 1 (80 %) y 2 (20 %) se crean **las dos al liquidar** | 80 % en la semana **N**, como anticipo automático; 20 % en **N+1**, como saldo de la liquidación |
| De qué cuota salen los descuentos | Del 1er pago; si no alcanza, del 2do | Todos en la LQ (retención, materiales, anticipo 80 % pagado) | — | Del 1er pago | **Todos de la cuota de la liquidación.** El anticipo del 80 % sale **bruto**, sin descuentos. |
| Quién registra el pago | ADMIN | — | Contabilidad, por bancos | Pantalla `pagos` (Liquidaciones) | **Contabilidad.** Liquidaciones solo aprueba. |
| Retención IR | No | Sí, por tramos | — | **No se calcula todavía** (parte 3 pendiente; la tabla de tramos y el servicio `RetencionBanano` ya existen) | Se descuenta en la cuota de la liquidación. Es **prerrequisito** de este módulo (ver la fase 0). |

⚠️ **Regla de negocio que cambia (señalado como pide `CLAUDE.md`):**
- La regla que está **programada** dice que el 80 % SPOT se paga después de liquidar.
- La regla del **Excel (06/11)** y la de **Peter (17/11)** dicen que se paga **antes**.
- Tomo la del Excel porque cuadra con la frase de Peter: el 80 % "en la semana actual" (la de compra) y el 20 % "en la próxima" (la de liquidación).
- **Lo confirma el Excel real WK41** (revisado por `siae-datos` el 17/11, solo lectura). Sus hojas DOCUMENTOS y ACUMULADO traen las columnas "ANTICIPO 80%", "ID ORDEN ANTICIPO 80%", "REF. ANTICIPO", "CONFIRMACION DE PAGO DEL ANTICIPO 80%", "20% SALDO FRUTA", "ID ORDEN SALDO 20%" y "SALDO SPOT".
  - Es decir: el 80 % SPOT es una **orden de pago propia, con su número**, que se paga **antes** de la LQ.
  - La LQ SPOT descuenta ese 80 % y paga el 20 % con **otra orden**.
  - CONTRATO = una LQ al 100 %.
- La **pregunta 1** queda solo como confirmación.

**Cómo lo lleva hoy el Excel** (hoja PAGOS): una fila por LQ, con referencia y fecha de pago.
- Estados: **PENDIENTE / PAGADO / PARCIAL / PAGADO DE MES**. "PARCIAL" y "PAGADO DE MES" se aclaran en las preguntas 7 y 15.
- La hoja PENDIENTES POR PAGAR muestra banco, tipo, número y titular por RUC, con el indicador **OK / FALTA CUENTA**: el diseño lo reproduce como el aviso "SIN CUENTA BANCARIA".

⚠️ **Otras dos diferencias que cambian lo que se paga** (las dos quedan en la **fase 0**):
- **Cajas que se pagan (regla nueva, 17/11; reemplaza la del 06/11, que decía "solo embarcadas"):**
  - Peter la definió con el personal de tarjas: **RECIBIDAS = EMBARCADAS − CAÍDAS − RECHAZADAS − FALTANTES**.
  - "Embarcadas" de la tarja es el **total** (bruto). La liquidación paga sobre las **recibidas**. El 80 % SPOT sigue sobre las **embarcadas**.
  - El código de hoy sigue la regla del 29/10: paga **embarcadas + caídas**, como si fueran categorías separadas. Ver 3.3.
- El código no calcula la **retención**.

---

## 3. Cálculo automático de las cuotas

### 3.1 Qué cuotas se generan

| Negociación de la compra | Cuota | Cuándo se crea | Monto | Semana programada |
|---|---|---|---|---|
| **SPOT** (`payment_scheme = 80_20`) | **ANTICIPO 80 %**: una orden **por negociación**, es decir, por cada compra | Al grabar las tarjas de la semana N | **cajas EMBARCADAS × PRECIO PACTADO × 0,80** (sin descuentos) | N |
| SPOT | **SALDO 20 %** (cuota de la liquidación) | Al liquidar, en N+1 | neto de la liquidación − anticipo 80 % ya pagado | N+1 |
| **CONTRATO** (`payment_scheme = 100`) | **PAGO ÚNICO 100 %** | Al liquidar, en N+1 | neto de la liquidación | N+1 + `payment_week_offset` del contrato (0 o 1) |
| SPOT pagado al 100 % (hoy existe) | PAGO ÚNICO 100 % | Al liquidar | neto | N+1 |

- **Fórmula del 80 %: CONFIRMADA por Peter el 17/11** (preguntas 1 y 5) con su Excel "REPORTE DE ANTICIPOS WK 40".
  - Se calcula sobre las **cajas embarcadas** de la tarja y al **precio pactado**, que en el SIAE es el `real_price` de la compra. **No** se usa el precio oficial.
  - Ejemplo inventado: 1.000 cajas × $7,00 × 0,80 = **$5.600,00**.
  - Es **una orden por negociación** (una compra = un vendedor, una marca y un precio), como las filas del reporte de Peter. Si un vendedor tiene dos compras SPOT a precios distintos, tiene dos órdenes.
- **De dónde salen las CAJAS EMBARCADAS** (fuente única): `tally_sheets.boxes_shipped`, que cuelga de la compra (`producer_quota_line_id`). Al liquidar se copian a `settlement_lines.boxes_shipped`.
  - **No** se usa `shipment_bookings.shipped_boxes` del cierre de embarque, porque es por cliente y booking, no por vendedor.
  - **No** se usan las cajas compradas.
- ⚠️ **Sin tarja no hay 80 %.** Si la compra SPOT no tiene tarja, el tablero muestra la fila con estado **SIN TARJA**, cajas 0 y monto 0, y **no se puede aprobar** (casilla desactivada).
  - El backend lo rechaza con "LA COMPRA DE <VENDEDOR> NO TIENE TARJA: NO SE PUEDE CALCULAR EL 80 %".
  - La orden se crea sola cuando Liquidaciones graba la tarja.
  - Hoy en producción hay **1 sola tarja** (WK45) y la WK40 no tiene tarjas: ver el requisito **R8**.
- **Neto de la liquidación** = fruta (**RECIBIDAS** × precio real) + transporte reconocido + bono − materiales − transporte descontado − **retención IR** − anticipos o préstamos elegidos. Las cajas, en 3.3.
- Ya va descontada la nota de crédito, porque se paga al precio real.
- Es lo mismo que el "A pagar = saldo − nota de crédito" del Excel, que calcula el saldo al precio oficial.

**Liquidaciones separadas por CONTRATO y por SPOT (como el Excel).**
- Hoy una liquidación es **por cupo** (vendedor + semana) y puede **mezclar** compras al 100 % y al 80/20.
- El Excel separa un documento LQ por cada contrato (1, 1.1, 1.2, 2…) y otro por SPOT.
- **Propuesta:** se adopta la separación del Excel **antes** de este módulo, en la fase 0 (la "parte 3" del plan del 06/11). Cada liquidación queda de **un solo tipo**:
  - **LQ CONTRATO n** → una sola cuota del 100 %.
  - **LQ SPOT** → descuenta su orden de anticipo 80 % y genera una cuota de SALDO 20 %.
- Así cada orden de pago apunta a **un** documento, igual que las columnas "ID ORDEN" del Excel.
- **Descuentos del vendedor en la semana** (materiales, anticipos manuales): ¿en qué LQ se descuentan si tiene varias? Ver la **pregunta 16**. Recomiendo descontarlos en la LQ de mayor valor de esa semana, como hace hoy el Excel; hay que confirmarlo con Liquidaciones.
- La retención se calcula **por liquidación**, como ya está acordado.

**Número de orden de pago:**
- Cada anticipo 80 % y cada cuota llevan un código visible, `ORD-AAAA-NNNNN`, que equivale a "ID ORDEN ANTICIPO 80%" e "ID ORDEN SALDO 20%".
- Es el que Contabilidad ve en el lote y el que va en la referencia del TXT.

### 3.2 Ejemplo con números inventados (SPOT)

1.000 cajas embarcadas; oficial $7,50; real $7,00; materiales $400; retención 1 %.

| Concepto | Valor |
|---|---|
| **Semana N: ANTICIPO 80 %** = 1.000 × 7,00 × 0,80 | **5.600,00** |
| Fruta al precio real (1.000 × 7,00) | 7.000,00 |
| − Materiales | −400,00 |
| − Retención IR (1 % de la factura de 7.500, al precio oficial) | −75,00 |
| = Neto de la liquidación | 6.525,00 |
| − Anticipo 80 % ya pagado | −5.600,00 |
| **Semana N+1: SALDO 20 %** | **925,00** |

Si el productor no hubiera llegado a cobrar el 80 %, la cuota de N+1 sería de 6.525,00.

### 3.3 Cajas: EMBARCADAS y RECIBIDAS (regla de Peter, 17/11; fase 0)

**Regla:** RECIBIDAS = EMBARCADAS − CAÍDAS − RECHAZADAS − FALTANTES.
- **EMBARCADAS** es el total que trae la tarja (bruto).
- CAÍDAS, RECHAZADAS y FALTANTES son **partes** de ese total.
- **FALTANTES** no existe hoy: hay que agregarlo.

**Qué se calcula con cada número:**

| Cálculo | Cajas | Cambio frente al código de hoy |
|---|---|---|
| **Anticipo 80 % SPOT** | **EMBARCADAS** × precio pactado × 0,80 | Nuevo |
| **Fruta de la liquidación** (20 % SPOT) | **RECIBIDAS** × precio pactado | Hoy: embarcadas + caídas |
| Fruta de la liquidación (100 % CONTRATO) | **RECIBIDAS**, por coherencia (**pregunta 32**) | Hoy: embarcadas + caídas |
| Factura al oficial y **nota de crédito** | **RECIBIDAS** × oficial; NC = máx(0, factura − fruta) | Hoy: embarcadas + caídas |
| **Retención IR**: tasa por tramos y base | Tramo según las cajas **RECIBIDAS** de la LQ; base = factura sobre recibidas (**pregunta 33**) | No existe hoy |
| **Transporte reconocido** y **bono / extra** ("solo por las cajas que llegaron") | **RECIBIDAS** × $/caja (**pregunta 33**) | Hoy: embarcadas + caídas |
| Transporte descontado (monto por compra) | Se descuenta si **RECIBIDAS > 0** | Hoy: si embarcadas + caídas > 0 |
| **Ganancia por viaje** y **Tablero financiero** (costo de la fruta) | **RECIBIDAS** × precio | Hoy: embarcadas + caídas |

**Ejemplo inventado:**
- La tarja trae 1.000 embarcadas, de las que 20 son caídas, 10 rechazadas y 10 faltantes: quedan **960 recibidas**.
- Precio pactado $7,00, oficial $7,50, materiales $400, retención 1 %.

| Concepto | Valor |
|---|---|
| Anticipo 80 % (semana N) = 1.000 × 7,00 × 0,80 | 5.600,00 |
| Fruta en la LQ = 960 × 7,00 | 6.720,00 |
| − Materiales | −400,00 |
| − Retención (1 % de 960 × 7,50 = 7.200) | −72,00 |
| = Neto | 6.248,00 |
| − Anticipo 80 % pagado | −5.600,00 |
| **Cuota 20 % (semana N+1)** | **648,00** |

**El 80 % se calcula sobre embarcadas y la LQ sobre recibidas,** así que con muchas caídas, rechazadas o faltantes el 80 % puede quedar **por encima** del neto. Eso es **SALDO A FAVOR DE AGAT**: no se paga cuota y la diferencia se descuenta en la siguiente liquidación del vendedor (pregunta 4). Ver también 3.4.

**Código que hay que cambiar en la fase 0** (lo programa la sesión principal):

| Archivo | Hoy | Cambio |
|---|---|---|
| `SettlementController::calcular()` (líneas ~363-421) y `quotas()` (~líneas 56-86) | `pagadas = embarcadas + caídas` | `recibidas = embarcadas − caídas − rechazadas − faltantes`. Se suma `t_faltantes`; `boxes_paid` pasa a guardar las **recibidas**. |
| `SettlementController::store()` y `pagos()` | Copian `boxes_fallen` y `boxes_rejected` | Copiar también `boxes_missing`. La retención se calcula sobre las recibidas. |
| `TallySheetController` (línea 73 y validación de las líneas 48-49) | Rechaza solo si embarcadas + caídas + rechazadas = 0 | Exigir **embarcadas > 0** y caídas + rechazadas + faltantes ≤ embarcadas. Mensaje: "LAS CAÍDAS, RECHAZADAS Y FALTANTES NO PUEDEN SUMAR MÁS QUE LAS EMBARCADAS". Agregar `boxes_missing` a la lista de campos (línea 28) y a la comparación de cambios (línea 129). |
| `VoyageCostController::comprasDelViaje()` (línea ~364) | `SUM(boxes_shipped + boxes_fallen)` | `SUM(boxes_shipped − boxes_fallen − boxes_rejected − boxes_missing)`. La **Ganancia por viaje** y el **Tablero financiero** (`TableroFinanciero` usa `gananciaDelViaje`) se corrigen solos. |
| `ShipmentClosingController` (línea ~258) | Suma embarcadas, caídas y rechazadas por barco, cliente y marca | Agregar **faltantes** y **recibidas**. El cruce con el INGRESO del puerto sigue contra **EMBARCADAS** (bruto). |
| Frontend: `TallySheetPage.jsx`, `TalliesPage.jsx`, `SettlementFormPage.jsx`, `SettlementDetailPage.jsx`, `SettlementsPage.jsx`, `ShipmentClosingPage.jsx` | Columnas embarcadas / caídas / rechazadas | Columna **FALTANTES** y columna calculada **RECIBIDAS**, que no se escribe (**pregunta 34**). El rótulo "a pagar" pasa a "RECIBIDAS". |

**Migración de la fase 0** (aparte de la de 7.2 y antes que ella): `2026_11_18_000000_tarjas_faltantes_recibidas.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 18/11/2026: regla de Peter (17/11, con el personal de tarjas):
//   RECIBIDAS = EMBARCADAS − CAÍDAS − RECHAZADAS − FALTANTES. EMBARCADAS es el total (bruto).
//   La liquidación paga RECIBIDAS; el anticipo 80 % SPOT se calcula sobre EMBARCADAS.
//   RECIBIDAS no se guarda en la tarja (se calcula); en la liquidación queda congelada en boxes_paid.
return new class extends Migration
{
    public function up(): void
    {
        // Antes de poner el CHECK: si alguna tarja vieja quedó con caídas + rechazadas > embarcadas
        // (regla del 29/10: eran categorías separadas), se detiene para revisarla a mano con siae-datos.
        $malas = DB::table('tally_sheets')->whereRaw('boxes_fallen + boxes_rejected > boxes_shipped')->count();
        if ($malas > 0) {
            throw new RuntimeException("HAY {$malas} TARJAS CON CAÍDAS + RECHAZADAS MAYORES QUE LAS EMBARCADAS: REVÍSALAS ANTES DE MIGRAR.");
        }

        Schema::table('tally_sheets', function (Blueprint $table) {
            $table->unsignedInteger('boxes_missing')->default(0)->after('boxes_rejected'); // FALTANTES
        });
        DB::statement('ALTER TABLE tally_sheets ADD CONSTRAINT tally_sheets_boxes_nonneg_check CHECK (boxes_shipped >= 0 AND boxes_fallen >= 0 AND boxes_rejected >= 0 AND boxes_missing >= 0)');
        DB::statement('ALTER TABLE tally_sheets ADD CONSTRAINT tally_sheets_boxes_parts_check CHECK (boxes_fallen + boxes_rejected + boxes_missing <= boxes_shipped)');

        Schema::table('settlement_lines', function (Blueprint $table) {
            $table->unsignedInteger('boxes_missing')->default(0)->after('boxes_rejected');
        });
        Schema::table('settlements', function (Blueprint $table) {
            $table->unsignedInteger('boxes_missing')->default(0)->after('boxes_rejected');
        });
        // boxes_paid = RECIBIDAS (lo que se paga), congelado al liquidar
        foreach (['settlement_lines', 'settlements'] as $t) {
            DB::statement("ALTER TABLE {$t} ADD CONSTRAINT {$t}_boxes_missing_check CHECK (boxes_missing >= 0)");
            DB::statement("ALTER TABLE {$t} ADD CONSTRAINT {$t}_boxes_parts_check CHECK (boxes_fallen + boxes_rejected + boxes_missing <= boxes_shipped)");
        }
    }

    public function down(): void
    {
        foreach (['settlement_lines', 'settlements'] as $t) {
            DB::statement("ALTER TABLE {$t} DROP CONSTRAINT IF EXISTS {$t}_boxes_parts_check");
            DB::statement("ALTER TABLE {$t} DROP CONSTRAINT IF EXISTS {$t}_boxes_missing_check");
            Schema::table($t, fn (Blueprint $table) => $table->dropColumn('boxes_missing'));
        }
        DB::statement('ALTER TABLE tally_sheets DROP CONSTRAINT IF EXISTS tally_sheets_boxes_parts_check');
        DB::statement('ALTER TABLE tally_sheets DROP CONSTRAINT IF EXISTS tally_sheets_boxes_nonneg_check');
        Schema::table('tally_sheets', fn (Blueprint $table) => $table->dropColumn('boxes_missing'));
    }
};
```

**`$fillable` y `$casts`:**
- `TallySheet`, `SettlementLine` y `Settlement` agregan `boxes_missing` (`'integer'`).
- `TallySheet` tiene un accesor `getBoxesReceivedAttribute()` para la columna RECIBIDAS de la pantalla.

**Datos existentes:**
- Producción tiene **0 liquidaciones** y **1 sola tarja** (WK45).
- Antes de subir, `siae-datos` revisa con Liquidaciones si esa tarja se llenó con la regla vieja ("embarcadas" netas, con caídas y rechazadas aparte) o con la nueva (bruto).
  - Si es la vieja, se corrige con un script `CARGA_BD` y simulación, usando el mismo endpoint de tarjas: embarcadas = embarcadas + caídas + rechazadas.
  - La migración se detiene sola si encuentra una tarja que no cumple la regla.

### 3.4 Casos borde

| Caso | Qué hace el sistema |
|---|---|
| El 80 % (sobre **embarcadas**) supera el neto de la LQ (sobre **recibidas**), por caídas, rechazadas o faltantes | Igual que la fila de abajo: **SALDO A FAVOR DE AGAT** (pregunta 4). El tablero lo marca en rojo antes de aprobar el 20 %. |
| Los descuentos son mayores que el 20 % (saldo negativo) | **No se liquida en negativo.** El sistema propone dejar la diferencia como **SALDO A FAVOR DE AGAT**: un préstamo automático en Anticipos y préstamos que se descuenta la semana siguiente (pregunta 4). |
| El 80 % todavía **POR APROBAR** o **RECHAZADO** al liquidar | La liquidación **anula** ese anticipo y paga todo en su cuota: no se descuenta lo que nunca se pagó. |
| El 80 % está **en el banco** (lote generado, sin confirmar) al liquidar | Se descuenta igual, porque ya salió hacia el banco. Si después el banco lo rechaza, Contabilidad lo marca FALLIDO y vuelve a "por pagar" (no se anula). |
| Cambian las tarjas después de aprobar el 80 % | Si la cuota no está en el banco, el sistema la **recalcula y la vuelve a POR APROBAR**. Si ya está en el banco, avisa y la diferencia se arregla en la liquidación. |
| Se anula la liquidación | Hoy solo se permite sin pagos registrados. Ahora además pide que **ninguna cuota esté aprobada ni en el banco**: primero se rechaza la cuota y, si está en un lote, se anula el lote. |
| Pago a otra persona (con carta) | La cuota lleva un **beneficiario** (por defecto, el vendedor). Ver 4.4. |

---

## 4. Liquidaciones: "Tablero de anticipos y pagos" (la vista de "Pagos por aprobar")

### 4.0 Tablero de anticipos y pagos (pedido de Peter el 17/11; fase 1)
Copia en el sistema el Excel "REPORTE DE ANTICIPOS WK 40" de Peter: una tabla dinámica filtrada por NEGOCIACIÓN = SPOT, con los indicadores CAJAS / ANTICIPO 80% / NEGOCIACIONES y filas agrupadas por DÍA PROCESO → COMERCIALIZA. En el SIAE, el **DÍA PROCESO es el DÍA DE CORTE** de la compra (respuesta de Peter, P18). **Es la pantalla donde se aprueba**: reemplaza la pestaña "POR APROBAR" de 4.1.

**Ruta:** LIQUIDACIÓN → **Tablero de anticipos y pagos** (`/liquidacion/tablero-pagos`), con una página nueva `SettlementPaymentsBoardPage.jsx`. "Pagos e historial" queda para el historial.

**Filtros** (arriba, en una barra):

| Filtro | Valores | Por defecto |
|---|---|---|
| AÑO / SEMANA | Semana ISO de compra | La semana anterior a la actual (la que se paga) |
| NEGOCIACIÓN | SPOT / CONTRATO / TODAS | SPOT, como el Excel |
| DÍA DE CORTE | Una fecha o todas (`producer_quota_lines.cut_date`) | Todas |
| ESTADO | SIN TARJA / POR APROBAR / APROBADO / EN LOTE / PAGADO / RECHAZADO | POR APROBAR |
| CUOTA | 80 % / 20 % / 100 % | Todas |
| Vendedor | Búsqueda (`SelectBuscable`) | Todos |

**Indicadores** (tres tarjetas arriba, como los botones del Excel):
- **CAJAS EMBARCADAS** (suma), **TOTAL A PAGAR** (suma, en $) y **N° DE NEGOCIACIONES** (cantidad de órdenes).
- ⚠️ **Regla: los indicadores y el total general se calculan SIEMPRE sobre las filas que se ven** con los filtros puestos.
  - En el Excel de Peter había **3 filas ocultas que sí sumaban al total general**. El total que se veía no cuadraba con las filas visibles.
  - En el SIAE no existen las "filas ocultas": lo que no se ve está filtrado y no suma.
  - El backend devuelve los totales ya calculados con los mismos filtros, y la pantalla los compara con la suma de lo que muestra. Si no coinciden, sale un aviso rojo.

**Tabla agrupada** (`TablaEstandar` con grupos, MAYÚSCULAS):

| Columna | Qué muestra |
|---|---|
| ☐ | Casilla por fila. Solo se activa si la fila está POR APROBAR y el usuario puede aprobar. La casilla del encabezado del grupo marca todo el día. |
| DÍA DE CORTE | Encabezado del grupo (`cut_date` de la compra) |
| COMERCIALIZA | Vendedor (comercializadora o productor) |
| N° ORDEN | `ORD-AAAA-NNNNN` |
| CUOTA | 80 % / 20 % / 100 % |
| CAJAS EMB. | Cajas embarcadas de la tarja |
| PRECIO PACT. | Precio pactado de la compra (`real_price`) |
| A PAGAR | 80 % ANTICIPO, o la cuota de la liquidación |
| CUENTA | OK / FALTA CUENTA (sin número, como la hoja PENDIENTES POR PAGAR) |
| ESTADO | `EstadoBadge`, más el motivo si fue rechazado |

- **Subtotal por día:** cajas, a pagar y N° de negociaciones.
- **Total general:** lo mismo para todas las filas visibles.
- **Precio en los subtotales y en el total = promedio ponderado por cajas** (Σ cajas × precio ÷ Σ cajas, a 4 decimales). El Excel de Peter mostraba el **MÁXIMO** en esa celda (por ejemplo $9,30 cuando el ponderado era de unos $8,69), y eso confunde.

**Acciones:**

| Botón | Quién | Qué hace |
|---|---|---|
| **Aprobar seleccionados** (verde) | `aprobar_pagos_liquidacion` | Muestra un `DialogoConfirmacion` con "VAS A APROBAR N ÓRDENES POR $X" y aprueba en lote. Si alguna ya cambió de estado, el backend la rechaza y dice cuál. |
| **Rechazar** (por fila, rojo) | `aprobar_pagos_liquidacion` | Motivo obligatorio |
| **Semana de pago** (solo CONTRATO) | `aprobar_pagos_liquidacion` | Esta semana o la próxima, antes de aprobar |
| **Exportar Excel** | Quien ve la pantalla | Exactamente las filas filtradas, con subtotales y total (el mismo cálculo) |
| **Imprimir** | Quien ve la pantalla | Hoja A4 horizontal con los filtros puestos en el encabezado |

**"DÍA PROCESO" = DÍA DE CORTE (RESPONDIDA por Peter, P18, 17/11):**
- Se usa la columna que **ya existe**, `producer_quota_lines.cut_date` (la fecha de corte que Comercial pone en la compra). **No hace falta una columna nueva**: se descarta el `process_date` que se había propuesto.
- **Anticipo 80 %:** su día es el `cut_date` de la compra (una orden = una compra).
- **Cuota de liquidación (20 % o 100 %):** su día es el **último** `cut_date` de las compras de esa LQ. Se calcula al consultar; no se guarda.
- **Compra sin fecha de corte:** va en un grupo **"SIN FECHA DE CORTE"** al final del tablero. Se puede aprobar, pero sale un aviso ámbar para que Comercial complete la fecha.
- **Candado:** una vez **aprobado** el 80 %, Comercial ya no puede cambiar el `cut_date` de esa compra. Así el tablero ya aprobado no se reacomoda. Lo valida `PurchaseAllocationController` con el mensaje "LA COMPRA YA TIENE ANTICIPO APROBADO: NO SE PUEDE CAMBIAR LA FECHA DE CORTE".
- Para filtrar y agrupar rápido se agrega un índice en `producer_quota_lines.cut_date`.
- ⚠️ **Por verificar (pregunta 23):** en la WK40, los `cut_date` del SIAE van del **25/09 al 03/10**, pero el Excel de Peter agrupa la WK40 en **06/11/2026**. Si "DÍA PROCESO" es el día de corte, el 06/11 no cuadra. Puede ser que en el Excel esa columna tenga la fecha en que se hizo el reporte.
### 4.1 Pestañas de seguimiento
En la pantalla que ya existe, **LIQUIDACIÓN → Pagos e historial** (`/liquidacion/pagos`, `SettlementHistoryPage.jsx`), se agregan pestañas. La aprobación se hace en el **Tablero** (4.0):

| Pestaña | Contenido |
|---|---|
| ~~POR APROBAR~~ | Pasa al **Tablero de anticipos y pagos** (4.0). |
| **APROBADAS / EN BANCO / PAGADAS** | Seguimiento: solo se leen. |
| **DEVUELTAS** | Las que Contabilidad devolvió o el jefe rechazó, con su motivo. |
| HISTORIAL | Lo que la pantalla muestra hoy. |

Columnas de POR APROBAR: semana · vendedor · beneficiario · tipo (ANTICIPO 80 % / SALDO 20 % / 100 %) · LIQ · cajas · monto · semana programada · **cuenta (SÍ/NO, sin número)** · avisos.

### 4.2 Qué se puede hacer

| Acción | Quién | Reglas que valida el backend |
|---|---|---|
| **Aprobar en lote** (check + botón verde) | Pantalla `aprobar_pagos_liquidacion` | Solo si está POR APROBAR. **No puede aprobar quien creó la liquidación** (pregunta 3). Guarda quién aprobó y cuándo. |
| Cambiar la **semana programada** (solo CONTRATO: esta semana o la próxima) | El mismo aprobador, antes de aprobar | Solo `+0` o `+1` respecto de la semana de liquidación. |
| **Rechazar** con motivo | El mismo aprobador | Motivo obligatorio: "ESCRIBE EL MOTIVO DEL RECHAZO." |
| Corregir el **monto** | **Nadie.** | El monto sale del cálculo. Para corregirlo se arregla el origen (tarjas, compra) y se **anula y rehace la liquidación**. Así nadie "ajusta" a mano un pago. |

Un aviso sin bloqueo sale en ámbar:
- "SIN CUENTA BANCARIA: CONTABILIDAD NO PODRÁ PAGAR POR EL BANCO".
- "NC POR RECIBIR".

Lo que sí bloquea es **"CUENTA CAMBIADA HACE MENOS DE X DÍAS"**: hay que confirmarlo (ver los riesgos).

### 4.3 Quién la ve
- El perfil **LIQUIDACIONES** ve la pestaña.
- El **jefe** (o quien Peter diga) tiene además la pantalla `aprobar_pagos_liquidacion`.
- Contabilidad no aprueba liquidaciones: las **paga**, y puede **devolverlas** con motivo si encuentra un problema.

### 4.4 Pago a otra persona (gancho, no diseño completo)
- La cuota guarda `payee_third_party_id`: a quién se le paga. Por defecto es el vendedor.
- El diseño de "factura y pago a otra persona con carta" (pendiente desde el 11/11) llenará ese campo **por compra**, con la carta adjunta. Solo Contabilidad o el ADMIN lo confirman.
- Si en una misma liquidación hay compras con beneficiarios distintos, la cuota se **parte por beneficiario**: se pagan dos líneas en el TXT (pregunta 8).

---

## 5. Contabilidad: "Pagos al banco"

### 5.1 Una sola bandeja, junto con las OC (recomendado)
La pantalla que ya existe, **CONTABILIDAD → Aprobación y pago de OC** (`AccountingOrdersPage.jsx`), pasa a llamarse **"Aprobación y pago (OC y liquidaciones)"**:

| Pestaña | Hoy | Con este diseño |
|---|---|---|
| POR APROBAR | OC | OC (sin cambios; las liquidaciones **no** pasan por aquí, las aprueba Liquidaciones) |
| **POR PAGAR** | OC aprobadas | OC aprobadas **+ cuotas de liquidación aprobadas**. Filtro **ORIGEN** (OC / LIQUIDACIÓN / ANTICIPO 80 %) y **semana programada**. |
| LOTES AL BANCO | Lotes de OC | Lotes mixtos, con el detalle **por línea** y su estado |
| TODAS | OC | Todo, con filtros |

¿Por qué juntas? Andrea sube **un solo TXT** al Pichincha por corrida, y así ve en un lugar todo lo que sale del banco esa semana. Si prefieres pantallas separadas, es la **pregunta 6**.

### 5.2 Lote de pago y TXT
- Se marcan líneas → **Revisar** (como el `preview` de hoy: dice cuáles no se pueden pagar y por qué) → **Generar archivo Pichincha**.
- Al generar, por cada línea se **congela una copia** del beneficiario y de su cuenta en la línea del lote: banco, tipo, número **cifrado**, titular e identificación.
  - Así, si alguien cambia la cuenta después, el lote no cambia.
  - Volver a bajar el TXT da exactamente el mismo archivo.
- La referencia de pago de una liquidación es la del Excel, cortada a 40 caracteres: `NOMBRE CORTO LIQ <cajas> <marca> WKxx`. Si no cabe, se prioriza el **N° de orden** (`ORD-…`), para cruzar el pago con el banco.
- `PichinchaPagos` se cambia para leer **líneas de lote**, y ya no OC directamente. El formato sigue **PROVISIONAL** hasta tener un TXT real.

### 5.3 Registro del pago, pago fallido y reverso

| Situación | Qué hace Contabilidad | Efecto |
|---|---|---|
| El banco pagó todo | Lote → **PAGADO** (fecha de pago, referencia del banco y comprobante PDF o foto opcional) | Todas las líneas → PAGADO; cuotas y OC → PAGADA |
| El banco rechazó algunas líneas | Marca cada línea **FALLIDO** con el motivo y el resto PAGADO | Lote → **PAGADO_PARCIAL**. La cuota fallida vuelve a **POR PAGAR** y puede ir en otro lote, una vez corregida la cuenta. |
| El banco rechazó todo o se generó por error | Lote → **ANULADO** con motivo (como hoy) | Todo vuelve a POR PAGAR |
| Se pagó **fuera** del TXT (cheque, transferencia manual) | **Registrar pago manual**: forma de pago, fecha, referencia, comprobante | Cuota → PAGADA, sin lote. Es lo que hoy hace "registrar pago" en Liquidaciones, que pasa a Contabilidad. |
| Se registró por error | **Reversar pago** con motivo obligatorio (solo `pagar_liquidaciones` o ADMIN) | Cuota → POR PAGAR. Queda en la bitácora. **No** se reversa una línea de un lote PAGADO sin antes marcarla FALLIDA. |
| **Pago parcial** de una cuota (pagar $500 de $925) | **No se permite** (pregunta 7) | Una cuota se paga entera. Para pagar en partes, Liquidaciones tendría que partirla. |

### 5.4 Estados de punta a punta

```
                ┌────────── RECHAZADA (motivo) ◄───┐
                │                                   │ jefe de Liquidaciones / Contabilidad devuelve
CALCULADA ──► POR_APROBAR ──(check)──► APROBADA ──(lote TXT)──► EN_BANCO ──► PAGADA
   (sistema)       │                    ▲   │                        │
                   │                    │   └─(pago manual)──────────┼──► PAGADA
                   │                    └──────── FALLIDA ◄──────────┘ (banco rechazó la línea)
                   └──► ANULADA  (se anuló la liquidación o el 80 % quedó sin pagar al liquidar)
```

Se guardan dos columnas, como en las OC: **`approval_status`** (POR_APROBAR, APROBADA, RECHAZADA, ANULADA, ANTERIOR) y **`payment_status`** (vacío, EN_BANCO, PAGADA, FALLIDA).

### 5.5 Quién ve qué

| Pantalla (clave) | Tipo base inicial | Ve | Hace |
|---|---|---|---|
| `pagos` *(existe)* | LIQUIDACIONES | Cuotas y su estado; la cuenta solo como SÍ/NO | Nada nuevo: ya **no** registra pagos (ese permiso pasa a Contabilidad) |
| `aprobar_pagos_liquidacion` *(nueva, `solo: LIQUIDACIONES`)* | LIQUIDACIONES (dárselo solo al jefe) | POR APROBAR | Aprobar, rechazar, semana programada |
| `aprobar_oc` *(existe)* | CONTABILIDAD | OC | Como hoy |
| `pagar_liquidaciones` *(nueva, `solo: CONTABILIDAD`)* | CONTABILIDAD | Cuotas aprobadas, con la cuenta enmascarada `****1234` | Lote, TXT, pagado, fallido, pago manual, reverso, devolver |
| `cuentas_bancarias` *(existe)* | CONTABILIDAD | Cuentas completas | Como hoy |
| `asientos_contables` *(nueva, fase 3)* | CONTABILIDAD | Asientos sugeridos | Exportar |

- **El ADMIN** puede todo, como siempre.
- **Por qué `solo`:** con `solo` ningún perfil de Liquidaciones puede recibir la pantalla de pagar, y ningún perfil de Contabilidad la de aprobar liquidaciones. Así la segregación la garantiza el sistema y no depende de que alguien arme bien un perfil.
- **BODEGUERO** no aplica.

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

## 7. Base de datos: cambios sobre lo que ya existe

**Qué se reutiliza tal cual:**
- `settlements`, `settlement_lines`, `settlement_advances`.
- `banks`, `third_party_bank_accounts` (cifrada).
- `bank_payment_batches`, `RetencionBanano`, `retention_brackets`, `settlement_week_parameters`.
- Perfiles y `config/pantallas.php`.

**No se crea** una tabla paralela de "pagos": se **extienden** `settlement_payments` (cuotas de liquidación) y `producer_advances` (el 80 % es un anticipo). Solo es nueva la **línea del lote** (`bank_payment_batch_items`), que hoy no existe porque el lote apunta a la OC directamente.

### 7.1 Tablas y columnas

| Tabla | Cambio | Tipo / regla | Para qué |
|---|---|---|---|
| `contracts` | + `payment_week_offset` | smallint, default 0, CHECK IN (0,1) | CONTRATO: pagar en la semana de liquidación (0) o en la siguiente (1) |
| `settlements` | + `retention_regime` | varchar(12), null | Régimen congelado al liquidar (NORMAL, BPA, NO_RETENER) |
| | + `retention_rate` | decimal(5,2), default 0 | Tasa efectiva congelada |
| | + `retention_amount` | decimal(12,2), default 0 | Retención IR (se resta del neto) |
| `producer_advances` | + `producer_quota_id` | FK → producer_quotas, null, índice | Cupo del anticipo 80 % automático |
| | + `payment_order_code` | varchar(20), único, null | N° de orden `ORD-AAAA-NNNNN` |
| | + `origin` | varchar(10), default 'MANUAL', CHECK IN ('MANUAL','SPOT_80','SALDO') | Manual (hoy), 80 % SPOT, saldo a favor de AGAT |
| | + `boxes` | integer, null | Cajas embarcadas con que se calculó el 80 % |
| | + `scheduled_week`, `scheduled_year` | smallint, null | Semana ISO programada |
| | + estados y aprobación (como `settlement_payments`) | ver abajo | |
| | + `producer_quota_line_id` | FK → producer_quota_lines, null, índice | **Negociación** (compra) del 80 % |
| `producer_quota_lines` | + índice en `cut_date` (la columna ya existe) | index | DÍA DE CORTE del tablero (P18) |
| | índice único parcial | `(producer_quota_line_id) WHERE origin='SPOT_80' AND status` | Un solo 80 % activo **por negociación** |
| `settlement_payments` | + `payment_order_code` | varchar(20), único, null | N° de orden (mismo correlativo) |
| | + `approval_status` | varchar(15), default 'POR_APROBAR', CHECK IN ('POR_APROBAR','APROBADA','RECHAZADA','ANULADA','ANTERIOR') | |
| | + `approved_by` (FK users), `approved_at` (timestamp), `rejection_reason` (text) | null | |
| | + `scheduled_week`, `scheduled_year` | smallint, null | Semana programada |
| | + `payee_third_party_id` | FK → third_parties, null (null = el vendedor) | Pago a otra persona |
| | + `payment_status` | varchar(10), null, CHECK IN ('EN_BANCO','PAGADA','FALLIDA') | |
| | + `payment_method` | varchar(15), null, CHECK IN ('LOTE_BANCO','TRANSFERENCIA','CHEQUE','CRUCE') | |
| | + `voucher_path` | varchar(255), null | Comprobante (PDF o foto) en `storage/app/private` |
| | índice | `(approval_status, payment_status)` | Bandejas |
| | *(existentes)* `paid_at`, `reference`, `paid_by` | sin cambio | Fecha, referencia del banco y quién registró |
| **`bank_payment_batch_items`** *(nueva)* | `bank_payment_batch_id` | FK, índice | Línea del TXT |
| | `source_type` | varchar(12), CHECK IN ('OC','LIQUIDACION','ANTICIPO') | |
| | `purchase_order_id` / `settlement_payment_id` / `producer_advance_id` | FK null; CHECK: **exactamente uno**, acorde a `source_type` | |
| | `payee_third_party_id` | FK → third_parties | |
| | `amount` | decimal(12,2), CHECK > 0 | |
| | `bank_id`, `account_type`, `account_number` (**text cifrado**), `holder_id_type`, `holder_id`, `holder_name` | Copia congelada de la cuenta | Que un cambio de cuenta no altere el lote |
| | `reference` | varchar(40) | Lo que va al banco |
| | `status` | varchar(10), default 'EN_BANCO', CHECK IN ('EN_BANCO','PAGADO','FALLIDO','ANULADO') | Estado de la línea (mismo patrón que `bank_payment_batches.status`) |
| | `failure_reason` (text), `paid_at` (date), `bank_reference` (varchar 60) | null | |
| | **índices únicos parciales** | `(settlement_payment_id)`, `(producer_advance_id)` y `(purchase_order_id)` `WHERE status IN ('EN_BANCO','PAGADO')` | **Lo mismo no puede estar en dos lotes vivos: evita pagar dos veces a nivel de base** |
| `bank_payment_batches` | CHECK de `status` | + 'PAGADO_PARCIAL' | |
| | + `company_bank_account_id` | FK null (fase 2) | De qué cuenta de AGAT sale |
| **`company_bank_accounts`** *(nueva, fase 2)* | `bank_id`, `account_type`, `account_number` (cifrado), `alias`, `status` (bool) | | Cuentas de AGAT (origen) |

**`purchase_orders.bank_payment_batch_id`** se mantiene y se sigue llenando, para no romper lo que ya está en producción. El detalle del lote se lee de `bank_payment_batch_items`.

### 7.2 Migración propuesta (fase 1)

`database/migrations/2026_11_18_000001_pagos_liquidaciones.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 18/11/2026: PAGOS DE LIQUIDACIONES → CONTABILIDAD (diseño docs/modulos/pagos-liquidaciones.md).
//   - Cuotas de liquidación (settlement_payments) y anticipos (producer_advances) con aprobación
//     (Liquidaciones) y estado de pago (Contabilidad), igual que las OC.
//   - SPOT: el 80 % es un anticipo automático (origin SPOT_80) por cupo; la liquidación lo descuenta.
//   - CONTRATO: semana de pago = liquidación + payment_week_offset (0/1).
//   - Lotes al banco con líneas (bank_payment_batch_items) y copia congelada de la cuenta (cifrada).
//   - Retención IR congelada en la liquidación (si la parte 3 ya la creó, no se repite).
return new class extends Migration
{
    public function up(): void
    {
        // 1) Contrato: pagar la semana de la liquidación (0) o la siguiente (1)
        Schema::table('contracts', function (Blueprint $table) {
            $table->smallInteger('payment_week_offset')->default(0);
        });
        DB::statement('ALTER TABLE contracts ADD CONSTRAINT contracts_payment_week_offset_check CHECK (payment_week_offset IN (0,1))');

        // 2) Retención congelada en la liquidación
        Schema::table('settlements', function (Blueprint $table) {
            if (!Schema::hasColumn('settlements', 'retention_amount')) {
                $table->string('retention_regime', 12)->nullable();
                $table->decimal('retention_rate', 5, 2)->default(0);
                $table->decimal('retention_amount', 12, 2)->default(0);
            }
        });

        // 3) Anticipos: el 80 % SPOT automático + aprobación y pago
        Schema::table('producer_advances', function (Blueprint $table) {
            $table->foreignId('producer_quota_id')->nullable()->constrained('producer_quotas');
            $table->foreignId('producer_quota_line_id')->nullable()->constrained('producer_quota_lines'); // negociación del 80 %
            $table->string('payment_order_code', 20)->nullable()->unique(); // ORD-AAAA-NNNNN ("ID ORDEN ANTICIPO 80%")
            $table->string('origin', 10)->default('MANUAL');      // MANUAL | SPOT_80 | SALDO
            $table->integer('boxes')->nullable();                 // embarcadas con que se calculó el 80 %
            $table->smallInteger('scheduled_week')->nullable();
            $table->smallInteger('scheduled_year')->nullable();
            $table->string('approval_status', 15)->default('POR_APROBAR');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('payment_status', 10)->nullable();     // null | EN_BANCO | PAGADA | FALLIDA
            $table->string('payment_method', 15)->nullable();
            $table->date('paid_at')->nullable();
            $table->string('payment_reference', 60)->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users');
            $table->string('voucher_path', 255)->nullable();
            $table->index(['approval_status', 'payment_status']);
        });
        // Los anticipos que ya existían se entregaron por fuera: quedan ANTERIOR + PAGADA (no entran a bandejas)
        DB::table('producer_advances')->update(['approval_status' => 'ANTERIOR', 'payment_status' => 'PAGADA']);
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_origin_check CHECK (origin IN ('MANUAL','SPOT_80','SALDO'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_approval_status_check CHECK (approval_status IN ('POR_APROBAR','APROBADA','RECHAZADA','ANULADA','ANTERIOR'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_payment_status_check CHECK (payment_status IS NULL OR payment_status IN ('EN_BANCO','PAGADA','FALLIDA'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('LOTE_BANCO','TRANSFERENCIA','CHEQUE','CRUCE'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_spot80_quota_check CHECK (origin <> 'SPOT_80' OR (producer_quota_id IS NOT NULL AND producer_quota_line_id IS NOT NULL))");
        // 17/11/2026: el 80 % es por NEGOCIACIÓN (compra), como el REPORTE DE ANTICIPOS de Peter
        DB::statement("CREATE UNIQUE INDEX producer_advances_spot80_activo_unique ON producer_advances (producer_quota_line_id) WHERE origin = 'SPOT_80' AND status");
        // 17/11/2026: el tablero agrupa por DÍA DE CORTE (respuesta de Peter): índice en la columna que ya existe
        Schema::table('producer_quota_lines', fn (Blueprint $table) => $table->index('cut_date'));

        // 4) Cuotas de liquidación: aprobación, semana programada, beneficiario y pago
        Schema::table('settlement_payments', function (Blueprint $table) {
            $table->string('payment_order_code', 20)->nullable()->unique(); // ORD-AAAA-NNNNN ("ID ORDEN SALDO 20%"); mismo correlativo que los anticipos
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
        // Las ya pagadas quedan ANTERIOR + PAGADA; las pendientes entran a POR APROBAR
        DB::table('settlement_payments')->whereNotNull('paid_at')
            ->update(['approval_status' => 'ANTERIOR', 'payment_status' => 'PAGADA', 'payment_method' => 'TRANSFERENCIA']);
        DB::statement("ALTER TABLE settlement_payments ADD CONSTRAINT sp_approval_status_check CHECK (approval_status IN ('POR_APROBAR','APROBADA','RECHAZADA','ANULADA','ANTERIOR'))");
        DB::statement("ALTER TABLE settlement_payments ADD CONSTRAINT sp_payment_status_check CHECK (payment_status IS NULL OR payment_status IN ('EN_BANCO','PAGADA','FALLIDA'))");
        DB::statement("ALTER TABLE settlement_payments ADD CONSTRAINT sp_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('LOTE_BANCO','TRANSFERENCIA','CHEQUE','CRUCE'))");
        // No se paga lo que no está aprobado
        DB::statement("ALTER TABLE settlement_payments ADD CONSTRAINT sp_pago_aprobado_check CHECK (payment_status IS NULL OR approval_status IN ('APROBADA','ANTERIOR'))");
        DB::statement("ALTER TABLE producer_advances ADD CONSTRAINT pa_pago_aprobado_check CHECK (payment_status IS NULL OR approval_status IN ('APROBADA','ANTERIOR'))");

        // 5) Líneas del lote al banco (OC, cuota de liquidación o anticipo) con la cuenta congelada
        Schema::create('bank_payment_batch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_payment_batch_id')->constrained('bank_payment_batches');
            $table->string('source_type', 12);                    // OC | LIQUIDACION | ANTICIPO
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders');
            $table->foreignId('settlement_payment_id')->nullable()->constrained('settlement_payments');
            $table->foreignId('producer_advance_id')->nullable()->constrained('producer_advances');
            $table->foreignId('payee_third_party_id')->nullable()->constrained('third_parties');
            $table->decimal('amount', 12, 2);
            // Copia de la cuenta al generar (null solo en líneas históricas de OC)
            $table->foreignId('bank_id')->nullable()->constrained('banks');
            $table->string('account_type', 10)->nullable();
            $table->text('account_number')->nullable();           // cifrado (cast 'encrypted')
            $table->string('holder_id_type', 1)->nullable();
            $table->string('holder_id', 20)->nullable();
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
        DB::statement("ALTER TABLE bank_payment_batch_items ADD CONSTRAINT bpbi_amount_check CHECK (amount > 0)");
        DB::statement("ALTER TABLE bank_payment_batch_items ADD CONSTRAINT bpbi_source_check CHECK (
            (source_type = 'OC'          AND purchase_order_id IS NOT NULL AND settlement_payment_id IS NULL AND producer_advance_id IS NULL) OR
            (source_type = 'LIQUIDACION' AND settlement_payment_id IS NOT NULL AND purchase_order_id IS NULL AND producer_advance_id IS NULL) OR
            (source_type = 'ANTICIPO'    AND producer_advance_id IS NOT NULL AND purchase_order_id IS NULL AND settlement_payment_id IS NULL))");
        // Candado contra el doble pago: un mismo origen no puede estar en dos líneas vivas
        foreach (['purchase_order_id', 'settlement_payment_id', 'producer_advance_id'] as $col) {
            DB::statement("CREATE UNIQUE INDEX bpbi_{$col}_vivo_unique ON bank_payment_batch_items ({$col}) WHERE status IN ('EN_BANCO','PAGADO')");
        }

        // Las OC que ya están en lotes pasan a líneas (sin copia de cuenta: no se descifra en una migración)
        DB::statement("INSERT INTO bank_payment_batch_items (bank_payment_batch_id, source_type, purchase_order_id, payee_third_party_id, amount, status, created_at, updated_at)
            SELECT po.bank_payment_batch_id, 'OC', po.id, po.third_party_id,
                   GREATEST(COALESCE((SELECT SUM(l.total) FROM purchase_order_lines l WHERE l.purchase_order_id = po.id), 0), 0.01),
                   CASE b.status WHEN 'PAGADO' THEN 'PAGADO' WHEN 'ANULADO' THEN 'ANULADO' ELSE 'EN_BANCO' END, now(), now()
            FROM purchase_orders po JOIN bank_payment_batches b ON b.id = po.bank_payment_batch_id");
        // OJO al programar: confirmar que SUM(l.total) es el mismo valor que PurchaseOrder::total (accesor).
        // Si no, llenar amount con un comando aparte que use el modelo (con simulación).

        // 6) Lote pagado en parte
        DB::statement('ALTER TABLE bank_payment_batches DROP CONSTRAINT IF EXISTS bpb_status_check');
        DB::statement("ALTER TABLE bank_payment_batches ADD CONSTRAINT bpb_status_check CHECK (status IN ('GENERADO','PAGADO','PAGADO_PARCIAL','ANULADO'))");

        // 7) Perfiles: pantallas nuevas (no se le quita nada a nadie). Si el JSON es jsonb, ajustar.
        $this->agregarPantalla('LIQUIDACIONES', 'aprobar_pagos_liquidacion');
        $this->agregarPantalla('CONTABILIDAD', 'pagar_liquidaciones');
    }

    public function down(): void
    {
        $this->quitarPantalla('LIQUIDACIONES', 'aprobar_pagos_liquidacion');
        $this->quitarPantalla('CONTABILIDAD', 'pagar_liquidaciones');

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
            $table->dropColumn(['payment_order_code', 'approval_status', 'approved_at', 'rejection_reason', 'scheduled_week', 'scheduled_year',
                'payment_status', 'payment_method', 'voucher_path']);
        });

        DB::statement('DROP INDEX IF EXISTS producer_advances_spot80_activo_unique');
        Schema::table('producer_quota_lines', fn (Blueprint $table) => $table->dropIndex(['cut_date']));
        foreach (['pa_origin_check', 'pa_approval_status_check', 'pa_payment_status_check', 'pa_payment_method_check',
                  'pa_spot80_quota_check', 'pa_pago_aprobado_check'] as $c) {
            DB::statement("ALTER TABLE producer_advances DROP CONSTRAINT IF EXISTS {$c}");
        }
        // Los 80 % automáticos dejan de tener sentido sin estas columnas: se desactivan (no se borran)
        DB::table('producer_advances')->where('origin', '<>', 'MANUAL')->update(['status' => false]);
        Schema::table('producer_advances', function (Blueprint $table) {
            $table->dropIndex(['approval_status', 'payment_status']);
            $table->dropConstrainedForeignId('producer_quota_id');
            $table->dropConstrainedForeignId('producer_quota_line_id');
            $table->dropConstrainedForeignId('approved_by');
            $table->dropConstrainedForeignId('paid_by');
            $table->dropUnique(['payment_order_code']);
            $table->dropColumn(['payment_order_code', 'origin', 'boxes', 'scheduled_week', 'scheduled_year', 'approval_status', 'approved_at',
                'rejection_reason', 'payment_status', 'payment_method', 'paid_at', 'payment_reference', 'voucher_path']);
        });

        // La retención solo se quita si esta migración la creó (si vino de la parte 3, se deja)
        // → al programar: marcar con una bandera o separar la retención en la migración de la parte 3.

        DB::statement('ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_payment_week_offset_check');
        Schema::table('contracts', fn (Blueprint $table) => $table->dropColumn('payment_week_offset'));
    }

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
- **Retención:** si la **parte 3** (LQ/LG) se programa antes, la retención va en esa migración y aquí se quita el bloque 2. Lo ideal es dejarla en una migración propia, **fase 0**.
- **Perfil LIQUIDACIONES:** recibe `aprobar_pagos_liquidacion`. Lo correcto es que **solo el jefe** la tenga, porque es una excepción por persona. Si Peter prefiere que nadie la tenga por defecto, se quita de la migración (pregunta 3).
- **Fase 2** (`company_bank_accounts` y `bank_payment_batches.company_bank_account_id`): va en otra migración.

### 7.3 Modelos: `$fillable` y `$casts`

| Modelo | `$fillable` + | `$casts` + |
|---|---|---|
| `Contract` | `payment_week_offset` | `'payment_week_offset' => 'integer'` |
| `Settlement` | `retention_regime`, `retention_rate`, `retention_amount` | `'retention_rate' => 'decimal:2'`, `'retention_amount' => 'decimal:2'` |
| `ProducerAdvance` | `producer_quota_id`, `producer_quota_line_id`, `payment_order_code`, `origin`, `boxes`, `scheduled_week`, `scheduled_year`, `approval_status`, `approved_by`, `approved_at`, `rejection_reason`, `payment_status`, `payment_method`, `paid_at`, `payment_reference`, `paid_by`, `voucher_path` | `'approved_at' => 'datetime'`, `'paid_at' => 'date:Y-m-d'`, `'boxes' => 'integer'`. Constantes `ORIGENES`. **`saldo()`** debe contar solo anticipos con `approval_status` APROBADA o ANTERIOR. |
| `SettlementPayment` | `payment_order_code`, `approval_status`, `approved_by`, `approved_at`, `rejection_reason`, `scheduled_week`, `scheduled_year`, `payee_third_party_id`, `payment_status`, `payment_method`, `voucher_path` | `'approved_at' => 'datetime'` |
| **`BankPaymentBatchItem`** *(nuevo, con `Auditable`)* | todas sus columnas | `'account_number' => 'encrypted'`, `'amount' => 'decimal:2'`, `'paid_at' => 'date:Y-m-d'`. `$hidden = ['account_number', 'holder_id']` (se enmascaran al mostrar). |
| `BankPaymentBatch` | — | relación `items()` |

Todos usan `Auditable`, ya existente o nuevo.

### 7.4 Endpoints

| Método y ruta | Middleware | Qué hace |
|---|---|---|
| `GET /settlement-payables?estado=&semana=&anio=` | `pantalla:pagos,aprobar_pagos_liquidacion` | Cuotas y anticipos 80 % (unifica las dos tablas para la pantalla) |
| `GET /settlement-payables/board?anio=&semana=&negociacion=&dia=&estado=&cuota=&vendedor=` | `pantalla:aprobar_pagos_liquidacion,pagos` (+ `tablero_pagos_lectura` si se aprueba la pregunta 19) | **Tablero.** Devuelve `{filas, grupos:[{dia, cajas, total, negociaciones, precio_ponderado}], totales:{cajas, total, negociaciones, precio_ponderado}}`, todo calculado en el servidor **con los mismos filtros** que las filas |
| `GET /settlement-payables/board/export?…` | ídem | Excel de las mismas filas y totales (sin cuentas bancarias) |
| `PATCH /settlement-payables/approve` `{items:[{tipo,id,scheduled_week?}]}` | `pantalla:aprobar_pagos_liquidacion` | Aprueba en lote, en una transacción con `lockForUpdate` |
| `PATCH /settlement-payables/{tipo}/{id}/reject` `{reason}` | `pantalla:aprobar_pagos_liquidacion,pagar_liquidaciones` | Rechaza o devuelve con motivo |
| `POST /producer-advances/spot80/recalcular?semana=&anio=` | interno, al guardar tarjas (`TallySheetController@update`) | Crea o ajusta el 80 % de cada cupo SPOT |
| `GET /accounting/payables` | `pantalla:aprobar_oc,pagar_liquidaciones` | POR PAGAR unificado; cada usuario recibe solo los orígenes de sus pantallas |
| `POST /accounting/bank-batches/preview` y `POST /accounting/bank-batches` `{items:[{tipo,id}]}` | `pantalla:aprobar_oc,pagar_liquidaciones` | Como hoy, pero acepta los tres orígenes. El backend revisa la pantalla según el origen de cada línea. |
| `PATCH /accounting/bank-batches/{id}/paid` `{paid_at, bank_reference, fallidas:[{item_id, motivo}]}` | ídem | Pagado o pagado en parte |
| `PATCH /accounting/bank-batches/{id}/cancel` | ídem | Como hoy |
| `PATCH /accounting/payables/{tipo}/{id}/manual-pay` (multipart con comprobante) | `pantalla:pagar_liquidaciones` | Pago fuera del TXT |
| `PATCH /accounting/payables/{tipo}/{id}/reverse` `{reason}` | `pantalla:pagar_liquidaciones` | Reverso con motivo |
| `GET /accounting/exports/pagos-retenciones?desde=&hasta=` | `pantalla:pagar_liquidaciones` | Exportable de la opción (a) |

**Cambian:**
- `PATCH /settlements/{id}/payments/{n}/pay` y `/unpay` (hoy `pantalla:pagos`) **se retiran**, porque su función pasa a `manual-pay` y `reverse` de Contabilidad.
- `SettlementController@store` crea las cuotas en POR_APROBAR, con la semana programada y descontando el SPOT_80.
- `annul` exige que no haya cuotas aprobadas.

### 7.5 Pantallas (frontend)
- **Nuevo** `src/pages/liquidacion/SettlementPaymentsBoardPage.jsx` (**Tablero de anticipos y pagos**, sección 4.0):
  - filtros, tres indicadores, tabla agrupada por día de proceso con subtotales y total general;
  - checks y "Aprobar seleccionados" en verde; rechazar con `DialogoConfirmacion` y motivo;
  - exportar e imprimir.
  - Nueva clave de pantalla: se reutiliza `aprobar_pagos_liquidacion` para aprobar, y `pagos` para ver sin aprobar.
- `src/pages/liquidacion/SettlementHistoryPage.jsx`: pestañas de seguimiento (APROBADAS / EN BANCO / PAGADAS / DEVUELTAS) con `EstadoBadge`.
- `src/pages/liquidacion/SettlementDetailPage.jsx`: los botones "Registrar pago" y "Deshacer" se reemplazan por el **estado de cada cuota**.
- `src/pages/contabilidad/AccountingOrdersPage.jsx`: POR PAGAR con el filtro ORIGEN; LOTES con el detalle por línea y "Marcar fallidas"; "Pago manual" y "Reversar".
- `config/pantallas.php`:
  - `aprobar_pagos_liquidacion` (LIQUIDACIÓN, `solo: ['LIQUIDACIONES']`).
  - `pagar_liquidaciones` (CONTABILIDAD, `solo: ['CONTABILIDAD']`).
  - Cambiar el nombre de `aprobar_oc` a "Aprobación y pago (OC y liquidaciones)", **sin cambiar la clave**.
- `src/routes/menu.js`: **no se toca**, porque Peter tiene cambios de espacios ahí. Si hace falta, se avisa antes.

---

## 8. Impacto en datos existentes

| Dato | Qué se hace | Cómo se verifica |
|---|---|---|
| Liquidaciones en producción | **0 liquidaciones, 0 cuotas, 0 lotes al banco** (revisado por `siae-datos` el 17/11, solo lectura). **Se puede rediseñar sin migrar pagos.** | Volver a contar justo antes de subir |
| OC de departamento | 0 reales; las 15 que hay están ANTERIOR. La copia de líneas de lotes viejos no mueve nada hoy. | Ídem |
| Anticipos | **1 anticipo pendiente** de descontar. Queda ANTERIOR + PAGADA (se entregó por fuera) y se sigue descontando como hoy. | Preguntar a Liquidaciones si de verdad se entregó |
| Perfiles | LIQUIDACIONES: 3 usuarios. CONTABILIDAD: 1 usuario, que hoy **no ve nada de liquidaciones** (solo `aprobar_oc` y `cuentas_bancarias`). La migración le agrega `pagar_liquidaciones`. | Peter elige a cuál de los 3 de Liquidaciones darle `aprobar_pagos_liquidacion` (excepción por persona) |
| `settlement_payments` ya pagadas | Pasan a ANTERIOR + PAGADA (la migración lo hace) | Contar antes y después |
| `settlement_payments` pendientes | Pasan a POR_APROBAR, sin semana programada | Liquidaciones las aprueba en la pantalla nueva |
| `producer_advances` existentes | ANTERIOR + PAGADA + MANUAL | Ninguno entra a las bandejas |
| OC que ya están en lotes | Se crean sus líneas (sin copia de cuenta) | Suma de las líneas = `total` del lote, comprobado con una **simulación** antes |
| `contracts.payment_week_offset` | Todos en 0 (semana de la liquidación) | Si Peter dice que algún contrato paga a la semana siguiente, se carga con un script `CARGA_BD` y `CARGA_SIMULAR=1` usando el endpoint de contratos |
| Cuentas bancarias | **0 registradas en producción.** Sin cuentas no sale ningún TXT. | — |
| Cuentas bancarias de **productores** | Hoy `bankAccounts()` solo lista PROVEEDOR y terceros con OC. **Hay que incluir PRODUCTOR y COMERCIALIZADORA**, y Contabilidad tiene que cargarlas. | Lista de vendedores con liquidación y sin cuenta (sin números en el chat) |
| Retención (fase 0) | Las liquidaciones viejas quedan con retención 0 | Solo si hay liquidaciones; si no, no aplica |

Orden en producción: simulación → respaldo de la base, del `dist` y de los `.env` (la `APP_KEY` es necesaria para las cuentas cifradas) → migración → revisión.

### 8.1 Bloqueos previos (requisitos antes de pagar con el sistema)

Datos de producción revisados por `siae-datos` el 17/11. Sin resolver esto, el cálculo saldría mal o no habría a quién pagar. Las cargas se hacen con `siae-datos`: script con `CARGA_BD`, simulación, respaldo y luego el real.

| # | Bloqueo | Por qué bloquea | Quién lo resuelve | Validación que se agrega |
|---|---|---|---|---|
| R1 | **Compras CONTRATO sin contrato asignado**: WK40 120 de 120, WK39 23 de 42, WK45 2 de 3 | La LQ por contrato (1, 1.1, 2…) y la semana de pago dependen del contrato | Comercial con LEGAL (lista de dudas, cargas por partes) | No se **liquida** una compra CONTRATO sin `contract_id`: "ASIGNA EL CONTRATO DE LA COMPRA …" |
| R2 | **3 compras sin precio real** | Sin precio no hay fruta ni 80 % | Comercial | Ya existe para liquidar; se agrega al cálculo del 80 % (no se genera la orden y sale un aviso) |
| R3 | **Faltan los parámetros de la semana** (`settlement_week_parameters` vacío) | Sin mínimo oficial ni tasa BPA no hay retención ni precio liquidado | Liquidaciones | No se liquida una semana sin parámetros: "REGISTRA LOS PARÁMETROS DE LA WKnn" |
| R4 | **0 cuentas bancarias** de proveedores o productores | El TXT no se puede generar | Contabilidad (Andrea), en su pantalla | Ya existe ("no tiene cuenta bancaria") |
| R5 | **Códigos de banco** sin llenar | Ídem | Contabilidad | Ya existe |
| R6 | **TXT real del Pichincha** sin confirmar | El formato es PROVISIONAL | Andrea manda un archivo ya subido | No usar con dinero real hasta confirmarlo |
| R7 | **Fase 0** sin hacer: retención, **FALTANTES y pago sobre RECIBIDAS** (3.3), LQ separadas contrato/spot | Cambia los montos a pagar | Desarrollo (con aprobación de este diseño) | — |
| R8 | **Tarjas históricas sin cargar**: en producción hay 1 sola tarja (WK45); la WK40 tiene 0 tarjas y 0 bookings cerrados | Sin tarja no hay cajas embarcadas, ni 80 %, ni liquidación | `siae-datos`, en el orden acordado: logística → comercial → **tarjas** → liquidaciones (con simulación) | Fila "SIN TARJA" no aprobable |

---

## 9. Riesgos y cómo se cubren

| Riesgo | Control |
|---|---|
| **Pagar dos veces** | Índices únicos parciales en `bank_payment_batch_items` (nada en dos lotes vivos). `lockForUpdate` al generar. Una cuota PAGADA no vuelve a POR PAGAR sin un reverso con motivo. El 80 % es único por cupo (índice) y la liquidación lo descuenta automáticamente. |
| **Pagar sin aprobar** | CHECK `sp_pago_aprobado_check` / `pa_pago_aprobado_check` en la base, y el backend lo vuelve a validar. |
| **Cuenta cambiada a última hora** (fraude típico) | El lote copia la cuenta al generar. Si la cuenta del beneficiario cambió **después de aprobar la cuota** o en los **últimos X días**, la línea sale bloqueada con "CUENTA CAMBIADA EL dd/mm POR <usuario>: CONFIRMA CON EL PRODUCTOR". Se libera con un check de confirmación que queda en la bitácora (pregunta 11). Además, aviso en la campanita al ADMIN cuando cambia la cuenta de un tercero con pagos pendientes. |
| **Quien liquida, se aprueba y se paga** | Pantallas con `solo` (LIQUIDACIONES ≠ CONTABILIDAD). El backend impide aprobar una cuota de una liquidación que creó el mismo usuario. El ADMIN queda fuera de la regla (es Peter). |
| Monto "ajustado" a mano | El monto no se edita: solo se recalcula desde el origen. |
| El 80 % se paga y la fruta no se embarca | Se calcula **sobre las embarcadas de la tarja**, no sobre lo comprado. |
| Saldo negativo del productor | Pasa a "saldo a favor de AGAT" (préstamo automático) y no se paga en negativo. |
| Formato del TXT equivocado | Sigue siendo **PROVISIONAL**: no se usa con dinero real sin un TXT real de Andrea. |
| Ver cuentas sin permiso | Cifradas. Fuera de `cuentas_bancarias` solo se ven enmascaradas (`****1234`). El TXT solo lo baja `pagar_liquidaciones` o `aprobar_oc`. |

---

## 10. Fases sugeridas

| Fase | Contenido | Depende de |
|---|---|---|
| **0** | Retención IR en la liquidación; **FALTANTES en la tarja y pago sobre RECIBIDAS** (regla del 17/11, sección 3.3: migración `2026_11_18_000000`, cambios en liquidación, tarjas, ganancia por viaje y cierre); **LQ separadas por contrato y SPOT**. Más las validaciones R1 a R3. | Respuestas 31 a 34 |
| **1** | Requisitos R1 a R5 y **R8 (tarjas)** cargados. Migración de 7.2. Anticipo 80 % automático **por negociación**. **Tablero de anticipos y pagos** (4.0) para aprobar en Liquidaciones. POR PAGAR unificado en Contabilidad. Lotes con líneas, fallidas, pago manual y reverso. Cuentas de productores en Cuentas bancarias. | Fase 0 y las respuestas 1 a 7 |
| **2** | Cuentas bancarias de AGAT (origen), comprobantes adjuntos, exportable PAGOS Y RETENCIONES, aviso de cuenta cambiada | TXT real del Pichincha |
| **2b** | Pago a otra persona con carta (diseño aparte; usa `payee_third_party_id`) | Diseño aparte |
| **3** *(opcional)* | Plan de cuentas mínimo, reglas concepto → cuenta y asientos sugeridos exportables | Plan de cuentas de Andrea o del contador; decisión sobre Contífico |

---

## 11. Preguntas para Peter (con mi recomendación)

1. ✅ **RESPONDIDA por Peter (17/11):** el 80 % SPOT se calcula sobre las **CAJAS EMBARCADAS**. Va en una orden de pago antes de la liquidación, y la LQ SPOT paga el 20 %. Confirmado con su "REPORTE DE ANTICIPOS WK 40". Cambia la regla que hoy está programada (el 80 % se paga después de liquidar).

2. **CONTRATO, "esta semana o la próxima": ¿quién decide?**
   *Recomiendo:* que cada contrato tenga un valor por defecto (LEGAL lo pone: semana de liquidación o la siguiente) y que el jefe de Liquidaciones lo pueda cambiar al aprobar.

3. **¿Quién aprueba los pagos en Liquidaciones? ¿Puede aprobar la misma persona que liquidó?**
   *Recomiendo:* solo el jefe de Liquidaciones (pantalla dada por persona), y nunca su propia liquidación. Si en Liquidaciones hay una sola persona, apruebas tú (ADMIN).

4. **Si los descuentos (materiales, retención, anticipos) pasan el 20 %, ¿qué se hace?**
   *Recomiendo:* no pagar nada esa semana y dejar el saldo como **SALDO A FAVOR DE AGAT**, que se descuenta en la siguiente liquidación del vendedor.

5. ✅ **RESPONDIDA por Peter (17/11):** con el **PRECIO PACTADO** (no el oficial). Fórmula: 80 % anticipo = cajas embarcadas × precio pactado × 0,80.

6. **¿Contabilidad ve las OC y las liquidaciones en la misma bandeja y en el mismo TXT?**
   *Recomiendo:* sí, una sola pantalla y un solo TXT por corrida, con un filtro por origen.

7. **¿Se permite pagar una cuota en partes (por ejemplo, la mitad esta semana)?** El Excel tiene el estado "PARCIAL": ¿cuándo se usa?
   *Recomiendo:* no, por ahora. Una cuota se paga entera o falla entera. Si "PARCIAL" sale de cuando el banco rechaza una parte, el diseño lo cubre con el lote PAGADO_PARCIAL y la línea FALLIDA.

8. **Pago a otra persona: si en una liquidación hay compras para dos beneficiarios, ¿de quién salen los descuentos (materiales, retención, anticipos)?**
   *Recomiendo:* de cada beneficiario según sus compras (prorrateo), pero lo vemos en el diseño aparte de "pago a otra persona".

9. **¿Desde cuántas cuentas bancarias de AGAT se paga (solo Pichincha, o también otras)?**
   *Recomiendo:* registrar en el sistema las cuentas de origen de AGAT (fase 2). Los números los escribe Andrea en la pantalla, no en el chat.

10. *(En parte respondida el 17/11: Peter mandó el plan de cuentas de Contífico; el mapeo propuesto está en 6.5 y lo confirma Contabilidad en las preguntas 24 a 30.)* **Cuentas contables: ¿Andrea o el contador nos pasan el plan de cuentas (código y nombre) de compras de fruta, proveedores productores, retención IR banano, anticipos, notas de crédito, materiales cobrados y bancos? ¿Y en qué sistema contable se registra hoy?**
    *Recomiendo:* por ahora, solo el **exportable** (opción a). El plan de cuentas dentro del SIAE (opción b) lo hacemos cuando esté decidido si es Contífico u otro.

11. **Cuenta cambiada a última hora: ¿cuántos días de "cuarentena" bloquean el pago hasta que alguien confirme?**
    *Recomiendo:* 3 días, o cualquier cambio posterior a la aprobación. Confirma Andrea, con un check que queda en la bitácora.

12. **¿Liquidaciones deja de registrar pagos (hoy lo hace en "Pagos e historial")?**
    *Recomiendo:* sí. Solo Contabilidad registra pagos, y Liquidaciones solo aprueba y ve el estado.

13. **Fase 0: ¿confirmas que las cajas caídas ya no se pagan y que la retención entra en esta misma entrega?**
    *Recomiendo:* sí; está decidido desde el 06/11, pero el sistema todavía no lo hace.

14. **¿Los anticipos y préstamos manuales (no el 80 %) también pasan por aprobar y por el TXT, o se siguen entregando por fuera?**
    *Recomiendo:* que pasen por el mismo flujo, para tener todo lo que sale del banco en un solo lugar.

15. **¿Qué significa "PAGADO DE MES" en la hoja PAGOS del Excel?** ¿Es un pago que se hizo junto con otros a fin de mes, o un cruce de cuentas?
    *Recomiendo:* si es un cruce (se compensa con algo que el productor le debe a AGAT), registrarlo como pago manual con la forma **CRUCE**, que el diseño ya tiene.

16. **Con LQ separadas por contrato y SPOT, ¿en cuál se descuentan los materiales y los anticipos manuales de la semana?**
    *Recomiendo:* en la LQ de mayor valor de esa semana. Si no alcanza, el resto en la siguiente. Hay que confirmarlo con Liquidaciones según cómo lo hacen en el Excel.

17. **Requisitos R1 y R2 (compras CONTRATO sin contrato y compras sin precio real): ¿quién los corrige y para cuándo?**
    *Recomiendo:* Comercial con LEGAL, por partes y con lista de dudas, antes de la fase 1.

18. ✅ **RESPONDIDA por Peter (17/11):** el día de proceso es el **DÍA DE CORTE** (`producer_quota_lines.cut_date`). Hay que verificar el 06/11 del Excel (pregunta 23).

19. **¿GERENCIA y FINANZAS ven el Tablero de anticipos y pagos solo para leer (sin aprobar)?**
    *Recomiendo:* sí, con una pantalla nueva de solo lectura, `tablero_pagos_lectura` (roles GERENCIA y FINANZAS), sin cuentas bancarias ni botones.

20. **El 80 % va en una orden por negociación (compra). ¿En el TXT del banco va una línea por orden o una sola transferencia por vendedor y día?**
    *Recomiendo:* una línea por orden, porque cada pago se cruza 1 a 1 con su orden ("ID ORDEN" del Excel). Si el banco cobra comisión por transferencia, lo cambiamos a una por vendedor y día.

21. **Plan de cuentas:** cuando lo mandes, ¿quién valida la tabla CONCEPTO → CUENTA (sección 6.5): Andrea o el contador externo?
    *Recomiendo:* Andrea la llena y el contador la firma; la cargamos solo cuando esté validada.

22. **Para Comercial (WK40 no cuadra):**
    - En el SIAE, la WK40 SPOT tiene **68 negociaciones y 70.388 cajas compradas**; tu reporte trae **15 negociaciones y 14.049 cajas embarcadas**. Parece que el reporte es solo lo procesado el 06/11.
    - **a)** ¿De qué hoja o fuente sale "CAJAS/EMB"?
    - **b)** ¿El 80 % se paga por lo embarcado **hasta ese día** (varios anticipos en la semana) o por **toda la semana** de una vez?
    - **c)** ¿Qué son las 3 filas ocultas que sumaban al total?
    - *Recomiendo:* un anticipo por negociación, calculado con **todas las tarjas** de esa compra. Si una compra embarca en dos días distintos, la orden se recalcula mientras esté POR APROBAR; una vez aprobada, lo que llegue después se paga en la LQ del 20 %.

23. **Verificación del DÍA DE CORTE:** en el SIAE, la WK40 tiene fechas de corte del 25/09 al 03/10, pero tu Excel agrupa la WK40 en **06/11/2026**. ¿El 06/11 es la fecha en que se hizo el reporte?
    *Recomiendo:* agrupar por la fecha de corte real de cada compra. Si el 06/11 era la fecha del reporte, no se guarda.

**Preguntas para Contabilidad (Andrea o el contador) sobre el plan de cuentas:**

24. **¿La fruta va directo al costo (5.1.1.3.1 COMPRA DE BANANO) o pasa por inventario (1.1.3.1.1 FRUTA)?**
    *Recomiendo:* directo al costo, porque la fruta se embarca la misma semana y no queda en bodega.

25. **Nota de crédito (diferencia oficial − pactado): ¿reduce 5.1.1.3.1 o va a 4.3.5 OTRAS RENTAS?**
    *Recomiendo:* que reduzca la compra (5.1.1.3.1), porque el costo real de la fruta es el pactado. Si el contador prefiere una cuenta propia, se crea en Contífico.

26. **Préstamos a productores: no hay cuenta (solo de empleados). ¿Se usa 1.1.4.4 OTROS ANTICIPOS ENTREGADOS o se crea "PRÉSTAMOS A PRODUCTORES"?**
    *Recomiendo:* crear una subcuenta propia, para no mezclarla con otros anticipos.

27. **¿Se provisiona la fruta al embarcar (2.1.5.1.1 PROVISIÓN DE FRUTA LC) y se cancela al liquidar?**
    *Recomiendo:* sí, si el cierre de mes cae entre el embarque y la liquidación. Si no, se registra directo al liquidar.

28. **Materiales descontados: ¿se acreditan al inventario de cada insumo (1.1.3.1.2 CARTON, 1.1.3.1.3 FUNDA…) al liquidar, o se registra antes una cuenta por cobrar al productor cuando sale de bodega?** No existe "Cuentas por cobrar productores".
    *Recomiendo:* acreditar el inventario al liquidar, con el costo promedio con que salió, que ya está en `settlement_materials`.

29. **La cuenta 1.1.4.1 "Anticipo proveedores" tiene el Tipo "Seguros pagados por anticipado" en Contífico. ¿Es un error?**
    *Recomiendo:* que Contabilidad lo corrija en Contífico antes de usar 1.1.4.1.1 para los anticipos del 80 %.

30. **Transporte: no hay cuenta de transporte de fruta. ¿El transporte reconocido va a 5.1.4.9 TRANSPORTE DE CARTONES Y MATERIALES o se crea una? ¿Y a qué cuenta va el transporte descontado?**
    *Recomiendo:* crear "TRANSPORTE DE FRUTA" en el costo y usarla en los dos casos (reconocido en el debe, descontado en el haber).

**Preguntas para Peter sobre las cajas de la tarja (regla del 17/11):**

31. **¿Qué son exactamente las FALTANTES? ¿Quién las registra y cuándo?** Puede ser el personal de tarjas en el puerto, o alguien después, con el reporte del cliente.
    *Recomiendo:* que las registre el personal de tarjas en la misma tarja. Si llegan después con el reporte del cliente, se pueden corregir mientras la compra no esté liquidada (después, la liquidación queda cerrada).

32. **¿El CONTRATO al 100 % también se paga sobre RECIBIDAS?**
    *Recomiendo:* sí, por coherencia con SPOT. Si no, un contrato pagaría cajas caídas o faltantes que el SPOT no paga.

33. **¿La retención (tramo y base) y el transporte reconocido y el bono se calculan sobre RECIBIDAS?**
    *Recomiendo:* sí, todo sobre recibidas. La retención sigue a la factura, y la factura es por lo recibido.

34. **¿La pantalla de Tarjas muestra RECIBIDAS calculado (no se escribe)?**
    *Recomiendo:* sí, una columna gris de solo lectura con la resta, y el total por barco.
