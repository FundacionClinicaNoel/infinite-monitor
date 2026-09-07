# Infinite Monitor / PlataformaNoel — fase 2

## Flujo implementado
Usuario autenticado en Vue → POST /api/intelligent-dashboards/generate → Laravel verifica rol y filtros →
servicio CirugiaDataset entrega catálogo y agregados → petición HMAC por HTTPS a Infinite Monitor →
modelo configurado genera especificación → validación Zod y Laravel → propuesta en pantalla →
aplicar al borrador → guardar → publicación versionada por Admin.

El servicio de Infinite Monitor reutiliza createModel y AI SDK del repositorio. En esta fase genera
especificaciones declarativas (barras/tablas) compatibles con la fase 1. No ejecuta React generado ni SQL.
No accede directamente a SQL Server: Laravel usa sus modelos/servicios y conexiones existentes.
El catálogo disponible sigue siendo cirugia.ocupacion. Solicitudes fuera de ese catálogo devuelven 422.
No incorpora predicciones, indicadores de retrasos ni honorarios que no existan en el catálogo.

## Configuración Laravel
INTELLIGENT_DASHBOARDS_ENABLED=true
INFINITE_MONITOR_ENABLED=true
INFINITE_MONITOR_URL=https://<host-del-servicio>
INFINITE_MONITOR_SHARED_SECRET=<secreto-aleatorio-de-al-menos-32-caracteres>

La URL es solo origen (sin rutas, credenciales ni query). HTTPS obligatorio salvo localhost en local/testing.
Regenerar configuración de Laravel tras cambiar variables. Se requiere la migración de fase 1.
No hay nuevas migraciones ni dependencias en fase 2.

## Configuración Infinite Monitor
NOEL_INTEGRATION_MODE=true
NOEL_SHARED_SECRET=<mismo-secreto-de-Laravel>
NOEL_MODEL=<provider:model-id-compatible-con-salida-estructurada>
NOEL_MODEL_API_KEY=<clave-del-proveedor>

No escribir claves en Git, navegador, prompt ni widgets. Configurar el proveedor/modelo explícitamente.
Usar Node 22+, npm ci, NOEL_INTEGRATION_MODE=true npx next build y NOEL_INTEGRATION_MODE=true npm start.
En Windows, definir NOEL_INTEGRATION_MODE en el entorno del proceso/servicio antes de ejecutar npm.
Se usa next build directamente: el postbuild original prepara un runtime de widgets que este modo no utiliza.
Mantener NOEL_INTEGRATION_MODE=true tanto en build como en runtime. La instrumentación no precalienta
el sandbox. En este modo src/proxy.ts permite únicamente POST /api/noel/generate y GET /api/noel/health.
Desplegar una instancia dedicada a Noel; no combinar con el editor original abierto en el mismo proceso.

## Infraestructura
- Origen HTTPS privado, accesible desde Laravel. En el reverse proxy permitir solo las dos rutas anteriores.
- Timeout del reverse proxy superior a 90 s. Sin redirecciones; Laravel no sigue redirects.
- Un proceso / una réplica en fase 2. La protección de replay reside en memoria por proceso durante
  121 segundos y no persiste reinicios. Antes de escalar a múltiples réplicas, mover los nonces a un
  almacén atómico compartido. TLS y restricción de red siguen siendo necesarios.
- Laravel limita a 6 solicitudes/minuto y una generación simultánea por usuario; el servicio admite 4 en curso.
- Límite de entrada/salida 64 KiB, 12 widgets, 200 filas agregadas; timeout del modelo 60 s.
- Los prompts y agregados se envían al proveedor configurado. No escribir datos identificables de pacientes
  en el chat. El servicio no persiste prompts ni dashboards; Laravel guarda solo el borrador que el usuario acepta.
- El modo integración bloquea las rutas originales de chat, MCP, proxy, widgets y enlaces compartidos.
- No se entrega la cookie Sanctum ni un token de acceso general al servicio. Laravel es el único emisor
  de solicitudes y aplica los roles existentes en cada llamada; Infinite confía solo en solicitudes firmadas.
- Se conservan los permisos y el guardado/publicación de fase 1.

## Protocolo v1
Headers: X-Noel-Timestamp (segundos Unix), X-Noel-Nonce (UUID), X-Noel-Signature (hex HMAC-SHA256).
Firma sobre bytes UTF-8 exactos, unidos por saltos de línea:
v1
POST
/api/noel/generate
<timestamp>
<nonce>
<JSON completo>

Ventana temporal ±60 s. Nonce igual a request_id; se rechazan repeticiones.
Body: request_id, user_id, prompt, current (null o title/spec), catalog, dataset.
El user_id no entra en el prompt del modelo.
Respuesta 200: request_id, title, spec; Laravel exige identidad de solicitud y revalida toda la especificación.
No hay reintentos automáticos para evitar llamadas de IA duplicadas. El usuario puede volver a intentar.
Estados: 401 firma inválida; 409 replay; 413 tamaño; 422 fuera de catálogo/contrato inválido;
429 concurrencia; 502 respuesta inválida; 503 no configurado o fallo del proveedor.

## Pruebas y activación
1. Integrar primero fase 1; después los PRs de fase 2 de ambos repositorios.
2. Ejecutar pruebas Laravel de IntelligentDashboards y build de Vue.
3. Ejecutar vitest, tsc y lint de Infinite; compilar en modo integración.
4. Configurar secreto, proveedor y URL en un entorno de prueba. Consultar /api/noel/health.
5. Confirmar que /api/chat, /api/proxy, /api/widgets y / responden 404.
6. Desde Vue generar “Compara ocupación por quirófano”, revisar, aplicar, guardar y publicar.
7. Otro usuario autorizado debe consultar la publicación; un rol ajeno debe recibir 403.
8. Una solicitud de honorarios debe indicar que falta habilitar esa fuente, nunca inventar cifras.
9. Verificar pérdida de conexión, consulta sin datos, fecha diferente y dos generaciones simultáneas.
10. Comparar cifras contra el mapa quirúrgico real. Las pruebas con mocks no validan conectividad real,
    permisos del proveedor, calidad de generación o rendimiento SQL Server.

Rollback: INFINITE_MONITOR_ENABLED=false. Los dashboards guardados de fase 1 siguen operativos.
No se han desplegado servicios, configurado claves ni ejecutado una llamada real de IA desde este desarrollo.
