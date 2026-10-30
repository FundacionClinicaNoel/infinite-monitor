# Diseño institucional de tableros mediante IA

POST `/api/twin/bridge/design` recibe `{prompt, previous_spec?}` con el mismo Bearer privado del puente. Es un endpoint exclusivo de servidor; la interfaz institucional pasa por los permisos administrativos de PlataformaNoel. No sustituye las rutas genéricas del canvas o del chat.

Reutiliza `createModel` del generador de Infinite Monitor y la clave de servidor `OPENROUTER_API_KEY`. Modelo predeterminado: `openrouter:openai/gpt-5.4-mini`; se puede seleccionar un modelo del registro local mediante `HOSPITAL_TWIN_DESIGN_MODEL`. El catálogo remoto confirmó disponible el modelo predeterminado el 30/10/2026. La clave debe estar vigente y con acceso/saldo; no activar el acceso starter público para habilitar este endpoint protegido.

El proveedor recibe solamente la solicitud de diseño y el diseño anterior validado. No recibe los resultados de BITS/Xenco, pacientes, documentos, eventos o credenciales. La interfaz advierte que no deben escribirse identificadores; se rechazan correos, patrones de documento y referencias individuales conocidas. Esta barrera no es una garantía de detección universal de información personal.

La salida es JSON declarativo: versión, título, descripción y hasta seis paneles de un catálogo cerrado de indicadores quirúrgicos. Se rechazan HTML/código/SQL, métricas no permitidas, tipos incompatibles y IDs duplicados. PlataformaNoel consulta los valores y los representa con sus componentes Vue y colores institucionales; no se ejecuta código producido por la IA. Los filtros EPS/fecha son explícitos en la pantalla y no cambian silenciosamente por el prompt.

Límites: una generación simultánea y cinco intentos por minuto por proceso, cuerpo 16KiB, respuesta 1800 tokens, timeout90s, sin reintentos automáticos. El proxy Laravel añade permisos, limitación por usuario y timeout120s. En un despliegue distribuido la cuota global debe imponerse en el gateway institucional.

Configuración privada: crear/actualizar la clave en el servidor, conservar el resto de `.env.local`, reiniciar el proceso y probar una solicitud gerencial sin datos personales. Errores de credencial, saldo, cuota y respuesta inválida se presentan de forma sanitizada; no se registra el request o error crudo del proveedor.

Pruebas: contrato, privacidad del prompt/diseño previo, salida inválida, concurrencia, autenticación, cuota y errores mediante proveedor simulado. La comprobación real de credencial del 30/10/2026 devolvió 401; la generación real no está acreditada hasta reemplazarla y repetir el recorrido.

Daniel Grajales
