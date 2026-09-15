# Hospital Digital Twin — dashboard-abastecimiento

## Objetivo

Convertir `dashboard-abastecimiento` en el primer gemelo digital operacional del hospital dentro de Infinite Monitor. La visualización 3D representa áreas fijas y superpone flujos de abastecimiento, medicamentos, pacientes y eventos operacionales.

## Arquitectura

El renderer 3D no consulta tablas clínicas ni conoce detalles de Xenco, PlataformaNoel o Cruz Verde. Consume un contrato estable de Digital Twin para que cada sistema se conecte mediante adaptadores de solo lectura.

```text
PlataformaNoel / Xenco / Cruz Verde
              |
              v
         TwinDataSource
              |
              v
       Hospital Event Engine
              |
      +-------+--------+
      |                |
   Snapshot         Eventos
      |                |
      +-------+--------+
              |
              v
      /api/twin/hospital
      /api/twin/events
      /api/twin/stream  (SSE)
              |
              v
     dashboard-abastecimiento 3D
              |
         Infinite Monitor
```

## Fase 1 — renderer 3D

Implementado:

- Three.js mediante `@react-three/fiber` y `@react-three/drei`;
- navegación orbital y zoom;
- áreas seleccionables;
- estados visuales por área;
- flujos animados de abastecimiento, medicamentos y pacientes;
- pausa/reanudación de animaciones;
- panel contextual del área seleccionada;
- dependencias 3D aisladas en el sandbox del widget mediante `deps.json`.

## Fase 2 — TwinDataSource + Hospital Event Engine

Implementado en `src/lib/hospital-twin/`:

- `TwinDataSource`: contrato único para snapshot y eventos;
- `DemoTwinDataSource`: proveedor determinista para desarrollo y validación;
- `HttpTwinDataSource`: adapter HTTP de solo lectura para integrar una fuente real;
- `HospitalEventEngine`: normalización de áreas, flujos, métricas y eventos;
- filtrado de flujos que referencian áreas inexistentes;
- recálculo server-side del resumen operacional;
- allow-list de metadata permitida antes de exponer eventos;
- eliminación obligatoria de `entityId` en eventos de paciente;
- API `GET /api/twin/hospital`;
- API `GET /api/twin/events`;
- conservación del último snapshot válido si una actualización posterior falla;
- panel de eventos recientes dentro del widget 3D.

## Fase 4 — actualización incremental por SSE

Implementado:

- `GET /api/twin/stream` con `Content-Type: text/event-stream`;
- bootstrap inicial del widget por REST y actualización posterior mediante `EventSource`;
- eventos SSE nombrados `snapshot`, `events` y `warning`;
- heartbeat periódico para mantener el canal y detectar cortes intermedios;
- `retry` SSE para reconexión automática del navegador;
- soporte de `Last-Event-ID`/cursor para reanudación del stream;
- deduplicación de eventos en el widget por `event.id`;
- refresco del snapshot al recibir cambios operacionales;
- eliminación del `setInterval(..., 5000)` del renderer;
- fallback REST puntual si el canal SSE entra en reconexión;
- conservación del último estado válido si la fuente operacional no responde;
- no se expone el token de la fuente remota al navegador.

### Importante sobre el transporte hacia la fuente real

La Fase 4 elimina el polling periódico del **renderer**. El endpoint SSE server-side utiliza actualmente el contrato `TwinDataSource.getEvents()` existente para obtener eventos del proveedor y publicarlos al navegador. Esto mantiene compatibilidad con la fuente demo y con adapters HTTP actuales.

Cuando PlataformaNoel exponga un stream propio, el adapter podrá sustituir esa consulta incremental por push upstream sin modificar el dashboard 3D ni su contrato SSE.

## Selección de fuente

Sin configuración adicional, Infinite Monitor usa `DemoTwinDataSource`.

Para una integración remota se pueden configurar en el servidor:

```env
HOSPITAL_TWIN_SOURCE_URL=https://servidor-interno/twin
HOSPITAL_TWIN_SOURCE_TOKEN=
```

El token nunca se entrega al widget. Se utiliza exclusivamente server-side por `HttpTwinDataSource`.

La fuente remota debe implementar:

```text
GET {HOSPITAL_TWIN_SOURCE_URL}/snapshot
GET {HOSPITAL_TWIN_SOURCE_URL}/events?since=...&cursor=...&limit=...
```

No se implementan operaciones POST/PUT/PATCH/DELETE desde el Digital Twin hacia los sistemas clínicos.

## Contrato de snapshot

```ts
export interface HospitalTwinSnapshot {
  hospitalId: string;
  generatedAt: string;
  source: "demo" | "remote";
  areas: TwinArea[];
  flows: TwinFlow[];
  summary: {
    areas: number;
    criticalAreas: number;
    attentionAreas: number;
    activeFlows: number;
  };
}
```

### Área

```ts
export interface TwinArea {
  id: string;
  name: string;
  floor?: string | null;
  type:
    | "central"
    | "pharmacy"
    | "surgery"
    | "operating_room"
    | "hospitalization"
    | "other";
  position: [number, number, number];
  size: [number, number, number];
  status: "normal" | "attention" | "critical";
  metrics: Record<string, number | undefined>;
}
```

### Flujo

```ts
export interface TwinFlow {
  id: string;
  from: string;
  to: string;
  kind: "supply" | "medication" | "patient" | "data";
  volume: number;
  status?: "normal" | "attention" | "critical";
}
```

### Evento

```ts
export interface TwinEvent {
  id: string;
  type:
    | "hospital.area.updated"
    | "supply.moved"
    | "medication.moved"
    | "patient.moved"
    | "inventory.low"
    | "operating_room.delayed"
    | "custom";
  entityType?: "supply" | "medication" | "patient" | "area" | "other";
  entityId?: string | null;
  from?: string | null;
  to?: string | null;
  areaId?: string | null;
  occurredAt: string;
  severity: "normal" | "attention" | "critical";
  metadata?: Record<string, string | number | boolean | null>;
}
```

## Eventos SSE

### `snapshot`

Contiene el `HospitalTwinSnapshot` normalizado más reciente.

### `events`

Contiene un `HospitalTwinEventBatch`. El `id:` del frame SSE utiliza el cursor más reciente cuando está disponible, permitiendo que `EventSource` envíe `Last-Event-ID` al reconectar.

### `warning`

Informa una indisponibilidad temporal de la fuente operacional sin cerrar el canal inmediatamente. El widget conserva el último estado válido.

## Eventos operacionales soportados

- `hospital.area.updated`
- `supply.moved`
- `medication.moved`
- `patient.moved`
- `inventory.low`
- `operating_room.delayed`

## Privacidad y seguridad

El renderer no debe recibir datos clínicos identificables por defecto.

El Event Engine aplica una allow-list de metadata operacional. Campos arbitrarios enviados por una integración externa se descartan. Además, cualquier `entityId` asociado a `entityType: "patient"` se elimina antes de devolver el evento al cliente.

El adapter remoto es de solo lectura y tiene timeout. Una caída del proveedor genera errores controlados; no se sustituye silenciosamente por datos demo porque eso podría hacer pasar datos ficticios por información real.

El stream SSE reutiliza exclusivamente snapshots y eventos ya normalizados por el Hospital Event Engine, por lo que no crea una vía paralela que evada las reglas de privacidad.

## Próximas fases

1. Conectar el adapter real de PlataformaNoel para abastecimiento usando consultas/servicios existentes, sin acceso directo desde el renderer.
2. Hacer que PlataformaNoel emita eventos push propios y conectarlos al SSE de Infinite Monitor sin polling server-side.
3. Guardar histórico para modo replay.
4. Incorporar reglas de anomalías y detección de cuellos de botella.
5. Exponer herramientas MCP de solo lectura para Infinite Monitor/IA.
6. Añadir simulaciones aisladas que nunca escriban directamente sobre producción.
7. Incorporar BIM/IFC si se dispone del modelo físico del hospital; mantener el modelo lógico 3D como fallback.

## Fase 5 — informe operativo de abastecimiento

Implementado como segundo widget de dashboard-abastecimiento:

- KPIs trazables: Por atender, En proceso, Por cerrar, Finalizados, salud promedio de stock y volumen en flujo;
- filtros inmediatos por texto, estado y periodo;
- estado agregado por Central, Farmacia/Cruz Verde, Cirugía y bodegas Q01–Q05;
- tabla de flujos entre áreas y eventos operacionales sanitizados;
- actualización inicial por REST e incremental por SSE;
- indicador explícito FUENTE REAL/DEMO, sin presentar datos ficticios como reales;
- exportación CSV e impresión/PDF desde el navegador;
- diseño responsive con desplazamiento controlado para tablas;
- ausencia de nombres, documentos e identificadores clínicos.

Las métricas no se inventan en el renderer: se calculan exclusivamente desde HospitalTwinSnapshot y HospitalTwinEventBatch. Cuando un valor no está disponible, el informe muestra —.
