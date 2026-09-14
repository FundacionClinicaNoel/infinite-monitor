# Hospital Digital Twin — dashboard-abastecimiento

## Objetivo

Convertir `dashboard-abastecimiento` en el primer gemelo digital operacional del hospital dentro de Infinite Monitor. La visualización 3D debe representar áreas fijas del hospital y superponer flujos vivos de abastecimiento, medicamentos, pacientes y eventos operacionales.

## Principio de arquitectura

El renderer 3D no debe consultar tablas clínicas ni conocer detalles de Xenco, PlataformaNoel o Cruz Verde. Debe consumir un contrato estable de Digital Twin para que cada sistema se conecte mediante adaptadores.

```text
PlataformaNoel / Xenco / Cruz Verde
              |
              v
       Hospital Event Engine
              |
      +-------+--------+
      |                |
   Snapshot         Eventos
      |                |
      v                v
 Hospital Digital Twin Core
              |
      +-------+--------+
      |       |        |
     REST  WebSocket   MCP
      |       |        |
      +-------+--------+
              |
        Infinite Monitor
```

## Contrato mínimo

### Área

```ts
export type TwinArea = {
  id: string;
  name: string;
  floor?: string;
  position: [number, number, number];
  size: [number, number, number];
  status: "normal" | "attention" | "critical";
  metrics: Record<string, number | string | null>;
};
```

### Flujo

```ts
export type TwinFlow = {
  id: string;
  sourceAreaId: string;
  targetAreaId: string;
  kind: "supply" | "medication" | "patient" | "data";
  volume: number;
  status: "normal" | "attention" | "critical";
  updatedAt: string;
};
```

### Evento

```ts
export type TwinEvent = {
  id: string;
  type: string;
  entityType: string;
  entityId?: string;
  sourceAreaId?: string;
  targetAreaId?: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};
```

## Endpoints previstos

La primera integración real debe poder mapearse a endpoints equivalentes a:

- `GET /api/twin/hospital`
- `GET /api/twin/areas`
- `GET /api/twin/flows`
- `GET /api/twin/metrics`
- `GET /api/twin/events`

Para tiempo real, el cliente deberá poder recibir eventos como:

- `hospital.area.updated`
- `supply.moved`
- `medication.moved`
- `patient.moved`
- `inventory.low`
- `operating_room.delayed`

## Estado de la primera fase

El template `dashboard-abastecimiento` implementa actualmente:

- renderer 3D con Three.js mediante `@react-three/fiber`;
- navegación orbital y zoom;
- áreas seleccionables;
- estado visual por área;
- flujos animados de abastecimiento, medicamentos y pacientes;
- pausa/reanudación de la animación;
- panel contextual del área seleccionada;
- dependencias 3D aisladas en el sandbox del widget mediante `deps.json`;
- dataset demostrativo sin acceso a datos clínicos productivos.

## Próximas fases

1. Extraer el dataset demostrativo a un adaptador `TwinDataSource`.
2. Crear el Hospital Event Engine y snapshot inicial.
3. Conectar `dashboard-abastecimiento` al endpoint de snapshot.
4. Incorporar actualización incremental por WebSocket.
5. Guardar histórico para modo replay.
6. Incorporar reglas de anomalías y cuellos de botella.
7. Exponer herramientas MCP de solo lectura para Infinite Monitor/IA.
8. Añadir simulaciones aisladas que nunca escriban directamente sobre producción.
9. Incorporar BIM/IFC si se dispone del modelo físico del hospital; mantener el modelo lógico 3D como fallback.

## Seguridad

La vista 3D no debe incluir datos clínicos identificables por defecto. La capa de integración deberá aplicar autenticación, autorización, auditoría y minimización/pseudonimización según el rol antes de entregar datos al dashboard o a cualquier agente de IA.
