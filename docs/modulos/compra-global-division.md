# Compra global de una comercializadora que se divide después

Diseño de `siae-architect`, 13/11/2026. **Estado: APROBADO por Peter el 13/11/2026** con todas las recomendaciones de §8 (el ejemplo real del cuadro fue de 6.400 avisadas y 6.400 divididas).
Es un **cambio grande**: cambia la tabla de compras (`producer_quota_lines`), toca contratos, tarjas y liquidación, y agrega un endpoint.

Insumos revisados:
- el caso real de Peter (ASCUPOESPE, 13/11/2026);
- `DESARROLLO.md`: compra de fruta, semana de compra, envío a bodega, campanita, contratos, liquidación y tablero;
- el código: `PurchaseAllocationController` (`update`, `enviarABodega`, `quitarEnvio`, `cargar`), `MaterialDispatchController` (bandeja y cupos), `SettlementController`, `TallySheetController`, `Notificaciones`, `TableroOperaciones` y `PurchaseAllocationPage.jsx`;
- la base local `SIAE`, consultada solo con lecturas (`information_schema` y `pg_constraint`).

No se incluyen RUC, cédulas, cuentas ni montos reales.

---

## 0. Respuesta corta

| Tema | Recomendación |
|---|---|
| Opción | **(a) Compra "POR DIVIDIR"**: sin productor ni finca, con una marca propia en la compra. **No** se crea un productor o finca "VARIOS". |
| Cómo dividir | Botón **Dividir compra** en una compra guardada. La fila original **se conserva** como primera fila del cuadro y se crean las demás. Las filas pueden ir a **otro bloque** del mismo pedido, como las BANDA en PACKED, que van siempre SPOT. |
| Si no cuadra (6.400 de 7.000) | El diálogo muestra la diferencia y pide elegir: **bajar la compra a 6.400** (recomendado) o **dejar 600 POR DIVIDIR**. Si suma más, deja un aviso ámbar y no bloquea. |
| Bodega | Si la suma por marca no cambia, la bodega no nota nada. Si cambia, la compra queda marcada **CAMBIÓ**. Una marca nueva genera su aviso en la campanita. |
| Bloqueos | No se divide con el cupo **LIQUIDADO** ni con **tarjas** registradas en esa compra. |
| Pegar cuadro | **Sí**: se pega el cuadro desde Excel o WhatsApp dentro del diálogo y se revisa fila por fila antes de guardar. |
| Migración | 1 migración: 4 columnas en `producer_quota_lines`, 2 CHECK y la corrección de la FK de `user_notifications`. |

---

## 1. Proceso de negocio

1. **La asociación avisa el retiro.** ASCUPOESPE dice que retira material para 7.000 cajas. Comercial registra la compra a ASCUPOESPE, que es el **vendedor**, y en "Productor real" elige **POR DIVIDIR (CUADRO PENDIENTE)**. No pide productor ni finca.
2. **Comercial la envía a bodega.** La bodega recibe el aviso de siempre ("ENVIADO A RETIRAR") y entrega el cartón y los materiales contra el cupo de ASCUPOESPE de esa semana. La campanita y Por despachar no cambian.
3. **Llega el cuadro de despacho.** Esa noche la asociación manda el CUADRO DE DESPACHO con zona, marca, productor, cajas, finca, código MAGAP del acopio y ubicación.
4. **Comercial divide la compra.** Al día siguiente, en Compra de fruta, pulsa **Dividir compra**, pega el cuadro y revisa cada fila: productor, finca, cajas y bloque (marca y presentación). Las filas BANDA ROJA y BANDA AZUL van al bloque PACKED del barco, siempre SPOT.
5. **El sistema cuadra la diferencia.** Si el cuadro suma 6.400 y la compra era de 7.000, pregunta si baja la compra a 6.400 o deja 600 POR DIVIDIR. Si la bodega ya entregó material, avisa que el sobrante se devuelve por el flujo normal de devolución ligada al cupo.
6. **Se guarda la división.** La compra de 7.000 pasa a ser la primera fila del cuadro y se crean las demás. Todas quedan con el mismo vendedor, la misma semana de compra, el mismo precio, el mismo contrato (salvo PACKED) y el mismo estado de envío a bodega. Todo queda en la bitácora.
7. **Tarjas y liquidación siguen igual.** Las tarjas se registran por fila (productor y finca). La liquidación es de **ASCUPOESPE** (vendedor + semana) y muestra el detalle por productor. El pago, la retención y la nota de crédito siguen siendo para ASCUPOESPE.

---

## 2. Qué ya existe y qué se reutiliza

| Pieza | Estado hoy | Qué se hace |
|---|---|---|
| `producer_quota_lines` (compra) | Vendedor por el cupo (`producer_quota_id`), `producer_id` y `farm_id` opcionales en la base, `purchase_block_id`, contrato, envío a bodega | **Se reutiliza.** Se agregan 4 columnas (§3). No hay tabla nueva. |
| `third_parties` / `farms` | ASCUPOESPE es COMERCIALIZADORA; los productores y sus fincas viven aquí | **Sin cambios.** No se crea "VARIOS". |
| `PUT /customer-orders/{id}/purchases` | Exige finca en las compras nuevas; a una COMERCIALIZADORA le pide productor real y finca (líneas ~221-238) | Acepta `pending_split`. Con `true` no pide productor ni finca (§5). |
| `POST /customer-orders/{id}/purchases/farms` | Comercial crea fincas desde la compra | Se reutiliza en el diálogo de división ("+ NUEVA FINCA"). |
| `POST .../purchases/send` y `Notificaciones::envioBodega` | Envío y aviso por compra | Se reutilizan para las filas de **marca nueva** que salen de una compra ya enviada. |
| Despacho de materiales / Por despachar | Agrupan por **cupo (vendedor + semana) + marca + bodega**, no por fila | **Sin cambios.** Por eso dividir en la misma marca no altera lo que la bodega entrega. |
| `tally_sheets.producer_quota_line_id` | Tarja por compra | Sin cambios. Se bloquea dividir una compra que ya tiene tarjas (§4.3). |
| `settlement_lines.producer_quota_line_id` | Detalle de la liquidación por compra | Sin cambios. La liquidación es por cupo del vendedor. |
| Retención (`RetencionBanano`, `third_parties.retention_regime`) | Se calcula sobre el **vendedor** que se liquida | Sin cambios. **No hay retención por productor**, así que ninguna de las dos opciones la afecta. |
| Tablero, alerta AL5 "Compras a comercializadora sin productor" | Cuenta las compras de COMERCIALIZADORA con `producer_id` nulo | Se separa en AL5 (sin productor y **no** POR DIVIDIR) y la nueva AL5b "Compras POR DIVIDIR" (§5.4). |
| `PurchaseAllocationPage.jsx` | Botón Duplicar compra, barra fija y errores con "Ir a la fila" | Opción POR DIVIDIR, botón **Dividir compra** y diálogo nuevo (§5.5). |

**Falla encontrada al revisar** (existe hoy y no depende de este diseño): `user_notifications.producer_quota_line_id` tiene la FK **sin `ON DELETE`**. Si Comercial **quita** una compra que ya fue enviada a bodega y tiene avisos, el `PUT` intenta borrar la fila y PostgreSQL lo rechaza (error 23503, respuesta 500). Pasa con una compra enviada a la que todavía no le han entregado material. La migración la corrige con `ON DELETE SET NULL` (§4).

---

## 3. Tablas y columnas nuevas o cambiadas

### 3.1 Opción elegida: (a) "POR DIVIDIR", no (b) "VARIOS"

| Criterio | (a) Productor y finca opcionales + POR DIVIDIR | (b) Productor y finca "VARIOS" del vendedor |
|---|---|---|
| Terceros | Limpio: no se crean registros falsos | Crea un PRODUCTOR "VARIOS" sin RUC por cada asociación, o uno global. Va contra "un solo PRODUCTOR por persona" y contra la cédula/RUC obligatoria (D4). |
| Bitácora | Se ve "POR DIVIDIR → DIVIDIDA EL dd/mm POR …" y de qué compra sale cada fila (`split_from_line_id`) | Se ve un cambio de productor de VARIOS a X, que no se distingue de una corrección |
| Retención | Sin efecto: es por vendedor | Sin efecto, pero "VARIOS" aparecería como productor en los reportes de retención |
| Cupo de contratos | Sin efecto: el contrato es del vendedor | Igual |
| Reportes (finca, MAG, productor) | La compra pendiente sale **vacía y marcada**. El tablero la cuenta. | "VARIOS" se mezcla con productores reales y en los informes al MAG; es fácil olvidarla |
| Riesgo de quedar así para siempre | Alerta en el tablero y etiqueta ámbar | Alto: parece un dato válido |

### 3.2 `producer_quota_lines`: columnas nuevas

| Columna | Tipo | Nulo | Para qué |
|---|---|---|---|
| `pending_split` | `boolean`, default `false` | no | Compra global **POR DIVIDIR**: se guarda sin productor real ni finca hasta que llegue el cuadro. |
| `split_from_line_id` | `bigint`, FK `producer_quota_lines(id)` `ON DELETE SET NULL` | sí | De qué compra salió esta fila al dividir. Sirve para la traza y la bitácora. |
| `split_at` | `timestamp` | sí | Cuándo se dividió. Va en la fila original y en las nuevas. |
| `split_by` | `bigint`, FK `users(id)` `ON DELETE SET NULL` | sí | Quién la dividió. |

**CHECK:**
- `producer_quota_lines_pending_split_check`: `NOT pending_split OR (producer_id IS NULL AND farm_id IS NULL)`. Una compra POR DIVIDIR no puede tener productor ni finca a medias.
- `producer_quota_lines_split_from_check`: `split_from_line_id IS NULL OR split_from_line_id <> id`.

**Índices:**
- `split_from_line_id` (FK).
- Índice parcial `producer_quota_lines_pending_split_idx` sobre `(producer_quota_id) WHERE pending_split`, para el tablero y el aviso de liquidación.

**`user_notifications`:** la FK `producer_quota_line_id` pasa a `ON DELETE SET NULL` (corrige la falla de §2).

No se agregan columnas para el **código MAGAP del acopio** (C-0040), la **zona** ni la **ubicación del contenedor**. Por ahora van en `notes` de cada fila (ver pregunta 5). La zona ya existe en `farms.zone`.

---

## 4. Migración de Laravel propuesta

Archivo: `siae-backend/database/migrations/2026_11_13_000001_compra_por_dividir.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 13/11/2026 (diseño compra-global-division, pendiente de aprobación de Peter):
// Compra global de una comercializadora que se divide después. Una compra puede guardarse
// POR DIVIDIR (sin productor real ni finca) y al llegar el cuadro de despacho se divide en
// filas por productor y finca. Cada fila nueva recuerda de qué compra salió.
// Además corrige la FK de user_notifications: quitar una compra enviada con avisos daba error 500.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('producer_quota_lines', function (Blueprint $table) {
            // POR DIVIDIR: el vendedor (comercializadora) todavía no manda el detalle de productores
            $table->boolean('pending_split')->default(false);
            // Traza de la división: fila de origen, cuándo y quién
            $table->foreignId('split_from_line_id')->nullable()
                ->constrained('producer_quota_lines')->nullOnDelete();
            $table->timestamp('split_at')->nullable();
            $table->foreignId('split_by')->nullable()->constrained('users')->nullOnDelete();
            $table->index('split_from_line_id');
        });

        // Una compra POR DIVIDIR no lleva productor ni finca (evita estados a medias)
        DB::statement('ALTER TABLE producer_quota_lines ADD CONSTRAINT producer_quota_lines_pending_split_check
            CHECK (NOT pending_split OR (producer_id IS NULL AND farm_id IS NULL))');
        // Una fila no puede salir de sí misma
        DB::statement('ALTER TABLE producer_quota_lines ADD CONSTRAINT producer_quota_lines_split_from_check
            CHECK (split_from_line_id IS NULL OR split_from_line_id <> id)');
        // Para el tablero (AL5b) y el aviso de liquidación: compras pendientes por cupo
        DB::statement('CREATE INDEX producer_quota_lines_pending_split_idx
            ON producer_quota_lines (producer_quota_id) WHERE pending_split');

        // Corrección: la FK de avisos no tenía ON DELETE; quitar una compra enviada con avisos fallaba.
        // El aviso queda (ya leído o no) sin la compra; la bitácora conserva el detalle.
        Schema::table('user_notifications', function (Blueprint $table) {
            $table->dropForeign(['producer_quota_line_id']);
            $table->foreign('producer_quota_line_id')->references('id')->on('producer_quota_lines')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('user_notifications', function (Blueprint $table) {
            $table->dropForeign(['producer_quota_line_id']);
            $table->foreign('producer_quota_line_id')->references('id')->on('producer_quota_lines');
        });

        DB::statement('DROP INDEX IF EXISTS producer_quota_lines_pending_split_idx');
        DB::statement('ALTER TABLE producer_quota_lines DROP CONSTRAINT IF EXISTS producer_quota_lines_split_from_check');
        DB::statement('ALTER TABLE producer_quota_lines DROP CONSTRAINT IF EXISTS producer_quota_lines_pending_split_check');

        Schema::table('producer_quota_lines', function (Blueprint $table) {
            $table->dropForeign(['split_from_line_id']);
            $table->dropForeign(['split_by']);
            $table->dropIndex(['split_from_line_id']);
            $table->dropColumn(['pending_split', 'split_from_line_id', 'split_at', 'split_by']);
        });
    }
};
```

Notas:
- **`down()` y la FK de avisos:** si hubiera avisos con `producer_quota_line_id` nulo por el `SET NULL`, la FK vieja igual se recrea, porque los nulos no la violan.
- **`ProducerQuotaLine`:**
  - `$fillable`: agregar `pending_split`, `split_from_line_id`, `split_at` y `split_by`.
  - `$casts`: `'pending_split' => 'boolean'` y `'split_at' => 'datetime'`.
  - Relaciones: `splitFrom()` (`belongsTo` self), `splitParts()` (`hasMany` self por `split_from_line_id`) y `splitBy()` (`belongsTo User`).
- **Huella:** `PurchaseAllocationController::version()` toma todas las columnas de la línea menos `FUERA_DE_HUELLA`. Las columnas nuevas **entran en la huella**, y está bien: dividir cambia la semana para los demás usuarios.
- Aplicar solo en local (`SIAE` y `siae_test`) hasta que Peter diga "lo de siempre".

---

## 5. Endpoints, validaciones, permisos y pantalla

### 5.1 Cambios en `PUT /customer-orders/{id}/purchases`

- Nuevo campo por compra: `blocks.*.purchases.*.pending_split` con la regla `nullable|boolean`.
- Reglas, con mensajes en MAYÚSCULAS:
  - `pending_split = true` solo si el vendedor es **COMERCIALIZADORA**. Si no: `"BLOQUE n, COMPRA m: SOLO UNA COMPRA A UNA COMERCIALIZADORA PUEDE QUEDAR POR DIVIDIR."`
  - Con `pending_split = true`, el backend **ignora** `producer_id` y `farm_id` (los guarda nulos) y **no** exige finca. Hoy se exigen en las líneas 234-238.
  - Si llegan productor **y** finca, `pending_split` pasa solo a `false`. Es el caso de quien completa la fila a mano sin usar Dividir.
  - Una compra **sin** `pending_split` sigue con la regla de hoy: finca obligatoria y, en COMERCIALIZADORA, productor real.
- Las comparaciones de "compra bloqueada" (líneas 250-284) no cambian. Con el cupo liquidado tampoco se puede cambiar `pending_split`, porque ya cuenta como cambio de finca.
- `cargar()` devuelve por compra `pending_split`, `split_from_line_id`, `split_at`, `split_by` (nombre) y `split_parts` (cantidad de filas que salieron de ella).

### 5.2 Endpoint nuevo: `POST /customer-orders/{id}/purchases/{lineId}/split`

Middleware `pantalla:compra_fruta`. Va en el mismo grupo que `send` y `unsend`, con su comentario de fecha.

**Cuerpo:**
```json
{
  "version": "<huella del GET>",
  "remainder": "REDUCE | KEEP",
  "rows": [
    { "purchase_block_id": 0, "producer_id": 0, "farm_id": 0, "boxes": 0,
      "real_price": null, "official_price": null, "payment_scheme": null, "notes": "ZONA PUERTO INCA · ACOPIO C-0040 · CARROS A MACHALA" }
  ]
}
```

**Validación (422 con mensajes en MAYÚSCULAS):**

| Regla | Mensaje |
|---|---|
| El pedido está activo | `EL PEDIDO ESTÁ ANULADO.` |
| La compra es del pedido | `LA COMPRA NO EXISTE O NO ES DE ESTA SEMANA: RECARGA LA PANTALLA.` |
| El cupo no está LIQUIDADO | `NO SE PUEDE DIVIDIR: EL CUPO DE {VENDEDOR} WKnn YA FUE LIQUIDADO.` |
| La compra no tiene tarjas | `NO SE PUEDE DIVIDIR: LA COMPRA YA TIENE TARJAS. DIVIDE ANTES DE REGISTRAR TARJAS O PIDE A LIQUIDACIONES QUE LAS ANULE.` |
| Al menos 2 filas, o 1 fila con `remainder = KEEP` | `EL CUADRO DEBE TENER AL MENOS DOS FILAS.` |
| `rows.*.boxes` entero ≥ 1 | `FILA n: LAS CAJAS DEBEN SER MAYORES A CERO.` |
| `rows.*.purchase_block_id` es un bloque **de este pedido** | `FILA n: EL BLOQUE NO ES DE ESTE PEDIDO.` |
| Al menos una fila en el bloque de la compra original | `AL MENOS UNA FILA DEBE QUEDAR EN EL BLOQUE ORIGINAL ({MARCA} {PRESENTACIÓN}).` |
| Vendedor COMERCIALIZADORA → `producer_id` obligatorio y de tipo PRODUCTOR activo | `FILA n: ELIGE EL PRODUCTOR.` / `FILA n: {NOMBRE} NO ES UN PRODUCTOR ACTIVO.` |
| Vendedor PRODUCTOR (compra directa) → sin `producer_id`; se divide solo por finca | `FILA n: EN COMPRA DIRECTA SOLO SE DIVIDE POR FINCA.` |
| `farm_id` obligatorio, del productor de la fila y activo (se reutiliza la regla actual) | `FILA n: FALTA LA FINCA.` / `FILA n: LA FINCA {X} NO ES DE {PRODUCTOR}.` (ver pregunta 4) |
| Fila en un bloque **PACKED** → SPOT, sin contrato y con `real_price` obligatorio | `FILA n: LA FRUTA PACKED SE COMPRA SIEMPRE SPOT: ESCRIBE EL PRECIO REAL.` |
| `remainder` en `REDUCE,KEEP`, obligatorio si la suma es menor que la compra | `LAS FILAS SUMAN X DE Y CAJAS: ELIGE SI BAJAS LA COMPRA O DEJAS EL SALDO POR DIVIDIR.` |
| `KEEP` solo si el vendedor es COMERCIALIZADORA | `SOLO UNA COMPRA A UNA COMERCIALIZADORA PUEDE DEJAR SALDO POR DIVIDIR.` |
| `version` igual a la actual (`ControlVersion`) | el 409 de siempre: otro usuario guardó |

**Qué hace, en una transacción con `lockForUpdate` del pedido, como `enviarABodega`:**
1. La **fila original** toma los datos de la **primera fila del cuadro que cae en su bloque**: productor, finca (con la copia de `farm_name` y `mag_code`), cajas, notas, `pending_split = false`, `split_at` y `split_by`. Conserva su `id`, su envío a bodega, sus avisos y su historial. Se usa `update()` modelo por modelo, así queda en la bitácora.
2. Cada fila adicional se crea con `ProducerQuotaLine::create()`. **Copia de la original:** cupo (vendedor + semana de compra), comerciales, día de corte, puerto de entrega, bodega de retiro, precio oficial y real, tipo, forma de pago, contrato y parte, transporte y envío a bodega (`sent_to_warehouse_at` y `sent_to_warehouse_by`). Lleva `split_from_line_id = original`. El bloque y el cliente salen de su `purchase_block_id`, y `variety` de la marca del bloque.
   - **Fila en bloque PACKED:** `negotiation_type = SPOT`, `contract_id = null`, `contract_part = 0`, el `real_price` de la fila y la forma de pago elegida (propuesta: la de la original).
3. **Saldo** (suma < compra):
   - `REDUCE`: no se crea nada más. La compra baja a lo dividido.
   - `KEEP`: se crea una fila más con el saldo, `pending_split = true`, sin productor ni finca y con `split_from_line_id = original`.
4. **Avisos a bodega**, solo si la original **estaba enviada**:
   - Por cada **marca** se comparan las cajas antes y después en el mismo cupo y la misma bodega.
   - Si la marca de la original cambia de total (baja por REDUCE o sube por pasarse), se marca `changed_after_sent_at = now()` en las filas de esa marca. La bandeja muestra **CAMBIÓ**.
   - Si aparece una **marca nueva** (por ejemplo, BANDA ROJA), sus filas nuevas se marcan enviadas y se llama `Notificaciones::envioBodega()` por cada una, porque la bodega tiene que entregar otro material.
   - Si la suma por marca **no cambia**, no hay CAMBIÓ ni avisos nuevos.
5. Recalcula `total_cupo` del cupo, igual que el `PUT`.
6. Responde `cargar()` más `{ "divididas": N, "saldo": X }`.

### 5.3 Permisos

| Acción | Pantalla (`config/pantallas.php`) | Tipos base (`Profile::TIPOS_BASE`) con esa pantalla por defecto | Qué valida el backend |
|---|---|---|---|
| Guardar compra POR DIVIDIR | `compra_fruta` | COMERCIAL (y ADMIN, que ve todo) | `pantalla:compra_fruta` en el `PUT`; la regla de vendedor COMERCIALIZADORA |
| Dividir compra | `compra_fruta` | COMERCIAL, ADMIN | `pantalla:compra_fruta` en la ruta nueva; versión; reglas de §5.2 |
| Ver CAMBIÓ y avisos nuevos | `despacho` | BODEGUERO (su bodega), COORDINADOR_INVENTARIO, JEFE_BODEGA | Sin cambios (`Notificaciones` ya filtra por bodega y pantalla) |
| Ver el detalle dividido en tarjas y liquidación | `tarjas`, `liquidar` | LIQUIDACIONES, ADMIN | Sin cambios |

No hay pantalla nueva ni cambios en perfiles. BODEGUERO no puede dividir porque no tiene `compra_fruta`.

### 5.4 Otros cambios de backend (pequeños)

- **Tablero (`TableroOperaciones`):**
  - AL5 excluye `pending_split`.
  - Nueva **AL5b** "Compras POR DIVIDIR" (aviso), con las cajas y la cantidad de días desde la compra.
- **Liquidar (`SettlementController::preview`):** si el cupo tiene compras `pending_split`, devuelve el aviso `"HAY X CAJAS POR DIVIDIR DE {VENDEDOR}: FALTA EL CUADRO DE PRODUCTORES."`. Bloquear o solo avisar es la pregunta 6.
- **Tarjas (`TallySheetController`):** en la lista de compras, una compra POR DIVIDIR muestra "POR DIVIDIR" en lugar de la finca. Tarjar una compra POR DIVIDIR es la pregunta 2.

### 5.5 Pantalla (`src/pages/comercial/PurchaseAllocationPage.jsx` + componente nuevo)

- **En la fila:**
  - Si el vendedor es COMERCIALIZADORA, el selector "Productor real" tiene arriba la opción **POR DIVIDIR (CUADRO PENDIENTE)**.
  - Al elegirla se vacían productor y finca, la finca queda deshabilitada y aparece la etiqueta ámbar **POR DIVIDIR**.
  - La validación del frontend (líneas ~570-580) no pide finca en ese caso.
- **Botón "Dividir compra":** al lado de Duplicar, con el icono `Split` de lucide-react, `title` y `aria-label`.
  - Solo en compras **guardadas**.
  - Si hay cambios sin guardar: `"GUARDA LOS CAMBIOS ANTES DE DIVIDIR."` (igual que Enviar a bodega).
  - Se deshabilita con su motivo en el `title` si la compra está liquidada o tiene tarjas.
  - Se resalta en las compras POR DIVIDIR.
- **Diálogo nuevo** `src/components/DividirCompraModal.jsx`, con `ModalShell`. Verifica con Glob que el nombre no choque con otro parecido.
  - **Cabecera:** vendedor, barco, marca, presentación, cajas, semana de compra, contrato, enviada a bodega y si ya retiró material.
  - **Pegar cuadro** (§6.1): un área de texto y el botón "Leer cuadro".
  - **Tabla editable:**
    - BLOQUE (`SelectBuscable` con los bloques del pedido; primero los del mismo barco);
    - PRODUCTOR (`SelectBuscable`);
    - FINCA (`SelectBuscable` + "+ NUEVA FINCA", con el endpoint que ya existe);
    - CAJAS (`CampoNumero decimales={0}`);
    - P. REAL (`CampoNumero decimales={2}`, solo en filas de otro bloque o PACKED);
    - NOTAS (en MAYÚSCULAS);
    - `Trash2` para quitar una fila que todavía no se guarda.
  - **Pie:**
    - "DIVIDIDO X DE Y CAJAS".
    - Si falta, se elige entre **"BAJAR LA COMPRA A X"** (marcada por defecto) y **"DEJAR Z CAJAS POR DIVIDIR"**.
    - Si sobra: aviso ámbar `"SE COMPRAN Z CAJAS MÁS: LA BODEGA DEBE ENTREGAR MÁS MATERIAL."`.
    - Si la bodega ya entregó y la marca baja: `"LA BODEGA YA ENTREGÓ MATERIAL PARA Y CAJAS DE {MARCA}: EL SOBRANTE SE DEVUELVE COMO DEVOLUCIÓN LIGADA AL CUPO."`.
  - **Botones:** Cancelar y Guardar. Guardar abre un `DialogoConfirmacion` con el resumen ("Se dividirá en N filas · X cajas · saldo …").
  - Al terminar: `aplicarRespuesta(data)` y un toast de `toastMessages.js`.
- **En la tabla:** las filas que salieron de una división llevan un pequeño "DE #id" o un icono con el `title` "Dividida el dd/mm por …". El recuadro "Contratos WKnn" se recalcula solo, porque usa las compras cargadas.
- **API frontend:** `dividirCompra(orderId, lineId, body)` en el mismo archivo de api que ya usan `enviarABodega` y `quitarEnvio`.

---

## 6. Detalles de la división

### 6.1 Pegar el cuadro (recomendado)

- Se pega lo copiado desde Excel (separado por tabulaciones) o desde WhatsApp (separado por tabulaciones, `;` o 2 o más espacios). Se procesa **solo en el navegador** con `src/utils/cuadroDespacho.js`; el backend vuelve a validar todo.
- **Columnas** que se reconocen por el encabezado, sin importar el orden: ZONA, MARCA, PRODUCTOR, CAJAS / CANTIDAD, FINCA, MAGAP / CÓDIGO, UBICACIÓN. Sin encabezado se usa el orden del cuadro real.
- **Cruce:**
  - PRODUCTOR: igual al nombre en MAYÚSCULAS y sin tildes ni puntos. Si hay más de uno o ninguno, la fila queda en rojo para elegirlo a mano. **No se crean terceros** (ver pregunta 3).
  - MARCA: bloque del **mismo barco** con esa marca. BANDA se cruza con un bloque PACKED. Si no hay bloque: `"FILA n: NO HAY BLOQUE {MARCA} EN ESTE BARCO: AGRÉGALO Y GUARDA ANTES DE DIVIDIR."`.
  - FINCA: entre las fincas del productor. Vacía con una sola finca → esa. Vacía con varias → en rojo para elegir.
  - ZONA, MAGAP del acopio y UBICACIÓN → NOTAS de la fila (`"PUERTO INCA · C-0040 · CARROS A MACHALA"`).
- Las filas de total, las vacías y las de encabezado repetido se ignoran.
- Las filas en rojo no se pueden guardar hasta resolverlas. Se pueden quitar y dejar su cantidad como saldo POR DIVIDIR.

### 6.2 Si la suma no cuadra (6.400 de 7.000)

| Caso | Qué pasa |
|---|---|
| Suma = compra | Se divide y no hay saldo. La bodega no nota nada si no cambia la marca. |
| Suma < compra, **BAJAR** (recomendado) | La compra queda en 6.400. El contrato del vendedor cuenta 6.400. Por despachar muestra CAMBIÓ. El material sobrante, si ya retiró, se devuelve con la devolución ligada al cupo, que ya existe. Si no lo devuelve, se cobra en la liquidación como siempre (retirado − devuelto). |
| Suma < compra, **DEJAR SALDO** | Queda una fila POR DIVIDIR con 600. Sigue contando para el contrato y la bodega. Sirve si viene otro cuadro (por ejemplo, otro día de corte). El tablero la muestra. |
| Suma > compra | Se permite con aviso ámbar, igual que comprar de más. CAMBIÓ en la bodega. |

### 6.3 Bodega, avisos, contrato, tarjas y liquidación

- **Material ya retirado:** el despacho guarda el costo congelado en cada movimiento y se cuenta por cupo + marca + bodega, no por fila. Dividir en la **misma marca** no toca lo retirado ni su costo. Si parte del cuadro es de **otra marca**, la marca original queda con menos cajas que el material retirado (sobrante a devolver) y la marca nueva aparece pendiente. Por eso la bandeja marca CAMBIÓ y llega el aviso nuevo.
- **Avisos (`user_notifications`):** siguen apuntando a la fila original, que conserva su `id`. No se borran ni se repiten. Solo se avisa de las filas de marca nueva.
- **Contrato y `contract_part`:** las filas del mismo bloque heredan el contrato y la parte; el cupo del contrato es del **vendedor**, así que solo cambia si cambia el total. Las filas PACKED pasan a SPOT sin contrato, **cumpliendo la regla**. Una fila no puede cambiar de contrato dentro de la división; si hace falta, se corrige después en la grilla.
- **Tarjas:** se bloquea dividir una compra con tarjas, porque no se sabe a qué productor corresponde cada camión (ver pregunta 2). Lo normal es dividir antes de que llegue la fruta.
- **Liquidación:** la liquidación es por cupo (ASCUPOESPE + semana) y se paga a ASCUPOESPE. La división solo agrega detalle (`settlement_lines` por fila con productor y finca). No se divide con el cupo liquidado.

### 6.4 Reglas de negocio que toca este diseño

| Regla | Efecto |
|---|---|
| **Semana de compra** | **No cambia.** Todas las filas quedan en el cupo del vendedor de la semana de compra de la original. El diálogo no deja cambiar la semana. |
| **Liquidación** (anticipo 80 %, retención por tramos, solo embarcadas, NC = oficial − real) | **No cambia.** Sigue siendo del vendedor. Las filas copian el precio oficial y el real, así que la NC por caja no cambia. Las filas PACKED pueden tener otro precio real (otra NC por caja), como cualquier compra PACKED. |
| **Contrato por marca × presentación; PACKED siempre SPOT** | **Se aplica:** las filas que pasan a un bloque PACKED se fuerzan a SPOT y sin contrato. Si se baja la compra, baja lo usado del contrato. |
| **Flete por contenedor** | Sin efecto. |
| **Órdenes de compra** | Sin efecto. |
| **Finca obligatoria en compras nuevas** (04/11/2026) | **Se relaja** solo para compras de COMERCIALIZADORA marcadas POR DIVIDIR, y por un tiempo, hasta dividir. |

---

## 7. Impacto en datos existentes

- La migración no cambia datos: `pending_split = false` en todas las compras.
- **No** se marcan como POR DIVIDIR las compras históricas de comercializadoras sin productor (cargas WK30-45). La AL5 del tablero ya las cuenta. Si Peter quiere marcarlas, se hace con un script de `siae-datos` que use el mismo `PUT`, con `CARGA_BD` y `CARGA_SIMULAR=1`, primero en simulación y luego respaldo.
- La FK de `user_notifications` se cambia sin tocar filas. Antes de subir, se verifica en la copia que no haya avisos que apunten a compras inexistentes (no debería haber, porque la FK lo impedía).
- **Pruebas sugeridas para `siae-qa`:**
  - compra POR DIVIDIR (solo COMERCIALIZADORA; el CHECK de la base rechaza un estado a medias);
  - dividir sin enviar, enviada y con retiro;
  - BAJAR y DEJAR SALDO;
  - fila a PACKED (SPOT forzado, precio obligatorio);
  - marca nueva (aviso en la campanita) y misma marca (sin CAMBIÓ);
  - bloqueo con tarjas y con cupo liquidado;
  - versión (409);
  - bitácora con `split_from_line_id`;
  - quitar una compra enviada con avisos (ya no da 500);
  - bandeja Por despachar y cupos del despacho iguales antes y después de una división exacta.

---

## 8. Preguntas para Peter

1. **Si el cuadro suma menos (6.400 de 7.000), ¿qué pasa por defecto?**
   Recomiendo **bajar la compra a lo del cuadro**, con la opción de dejar el saldo POR DIVIDIR cuando ASCUPOESPE vaya a mandar otro cuadro. El material sobrante se devuelve con la devolución ligada al cupo, que ya existe.
2. **¿Las tarjas de la asociación vienen por productor o por camión/contenedor (mezclando productores)?**
   Recomiendo **dividir antes de tarjar** y bloquear la división si ya hay tarjas. Si vienen por contenedor, las tarjas se registran en la fila del productor principal del camión o se reparten. Tu respuesta define si hace falta repartir tarjas después.
3. **Si un productor del cuadro no está en Terceros, ¿qué se hace?**
   Recomiendo que su fila quede en el **saldo POR DIVIDIR** hasta que ADMIN lo cree con su cédula o RUC (regla D4). La otra opción es que Comercial pueda crearlo solo con el nombre, "por validar", como en la carga WK40.
4. **Si el cuadro trae la finca vacía, ¿se exige?**
   Recomiendo exigirla: si el productor tiene una sola finca se elige sola, y si no tiene, Comercial la crea con "+ NUEVA FINCA". La alternativa es aceptar la fila "SIN FINCA" con alerta en el tablero.
5. **El código MAGAP del acopio (C-0040), la zona y la ubicación (CARROS A MACHALA, ACOPIO ASCUPOESPE), ¿se usan en algún reporte o en la tarja?**
   Recomiendo guardarlos por ahora en las **notas** de cada fila. Si Logística o el MAG los piden, se agrega una columna después.
6. **¿Se puede liquidar a ASCUPOESPE con compras todavía POR DIVIDIR?**
   Recomiendo **solo avisar** en Liquidar, porque se le paga a la asociación y el detalle es de origen. Si para el MAG el detalle es obligatorio, se bloquea.
