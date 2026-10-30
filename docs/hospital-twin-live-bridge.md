# Puente hospitalario real de PlataformaNoel

Infinite Monitor recibe una proyección operacional agregada de PlataformaNoel. No consulta SQL Server ni envía datos a IA. La fuente sigue siendo BITS.

Configurar únicamente en el servidor `HOSPITAL_TWIN_SOURCE_TOKEN` con la credencial vigente del consumidor ya autorizado en Integraciones y `HOSPITAL_TWIN_HOSPITAL_ID` con el hospital configurado. No guardar valores en Git, widgets, URLs o navegador. Al rotar la credencial institucional actualizar esta configuración y reiniciar el proceso.

El comando Laravel `php artisan hospital-twin:sync-monitor` publica una lectura real y verifica el ACK exacto de hospital y fecha. `--watch` mantiene un único emisor cada 30 segundos con bloqueo local; en producción ejecutarlo bajo el supervisor de procesos institucional. No se necesita que Next consulte de vuelta al servidor web PHP, lo que evita bloqueos con un solo worker.

Rutas servidor a servidor, todas con Bearer obligatorio:

- POST `/api/twin/sync`: JSON limitado a 512 KiB, hospital/fuente/fechas/contadores validados, escritura atómica en `data/hospital-twin/snapshot.json`.
- GET `/api/twin/hospital`: snapshot real vigente, conservando fecha de origen.
- GET `/api/twin/events`: lote acotado y sanitizado, filtros de fecha/cursor y límite 1–100. No es un historial exhaustivo ni un canal de auditoría.
- GET `/api/twin/stream`: SSE con ready, snapshot, events y warning; reconexión o nuevos clientes reciben el contexto vigente, sin garantía de replay histórico completo.

Sin lectura válida o con antigüedad mayor de cinco minutos se devuelve 503. Nunca se sintetizan datos DEMO ni se reemplazan errores con ceros. El directorio privado de datos debe quedar fuera del servidor estático y del repositorio, con acceso restringido al usuario del servicio.

Despliegue coordinado: aplicar primero rutas Next y secreto de servidor, luego adaptador autenticado y emisor Laravel. Probar envío real, GET autenticados, rechazo 401 anónimo y SSE. Supervisar tanto Next como el emisor; health por sí solo no acredita la fuente hospitalaria. Reversión: detener emisor, revertir rutas/adaptador juntos y conservar la configuración y respaldo privado; no borrar registros clínicos.

Validación local 30/10/2026: emisor real confirmado, snapshot remoto e informe con proceso operativo, SSE 200 y rutas anónimas 401. El estado gerencial verificó nueve áreas y seis flujos; son una observación puntual, no cifras constantes.

Daniel Grajales
