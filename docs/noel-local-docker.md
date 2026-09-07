# Noel: IA local dentro de la clínica

La opción local usa Ollama. No requiere clave de OpenAI ni fallback a proveedores externos.
El SDK compatible con OpenAI apunta exclusivamente a http://ollama:11434/v1/chat/completions.
El valor técnico `ollama` que exige el SDK no es una credencial real y no autentica el servicio.
Ollama no publica puertos al host. NOEL_LOCAL_ONLY=true rechaza los proveedores externos.
La red runtime de Compose es interna, sin salida directa a Internet. OLLAMA_NO_CLOUD=1
deshabilita funciones cloud de Ollama. Descargar inicialmente imágenes/modelos requiere Internet
o importarlos desde otro equipo. No afirmar aislamiento del resto de la plataforma o de su infraestructura.

## Requisitos pendientes del servidor

Confirmar sistema operativo, CPU, RAM, GPU y VRAM antes de elegir modelo y fijar OLLAMA_IMAGE.
Esta configuración base funciona con CPU; el rendimiento debe medirse. No asigna GPU automáticamente.
Los 60 segundos actuales de generación pueden ser insuficientes con CPU/modelos grandes: probar primero;
no ampliar solo un timeout sin revisar Laravel (75 s), proxy (90 s), navegador y bloqueo por usuario.
Elegir un modelo local con soporte de salida estructurada y revisar su licencia.
Empezar con un usuario simultáneo; la carga real y límites deben ajustarse a la máquina.

## Instalación

Usar feature/noel-integration-fase-2. Estos archivos sustituyen la receta HTTP anterior.
Mantener el mismo nombre de proyecto Compose para conservar los volúmenes de modelos.

1. Copiar deploy/noel-local.env.example a .env.docker y completar secreto, OLLAMA_MODEL y OLLAMA_IMAGE.
   Compose construye NOEL_MODEL=ollama:<OLLAMA_MODEL>. NOEL_MODEL_API_KEY ya no hace falta.
2. Colocar el certificado y clave en deploy/certs/fullchain.pem y deploy/certs/privkey.pem.
   El certificado debe cubrir el dominio usado por Laravel y ser confiable para su servidor.
   Para una CA interna, instalar su certificado raíz en el servidor Laravel; no desactivar SSL.
3. Preparar imágenes y descargar modelo (sin el servidor Ollama normal escribiendo en el volumen):

```bash
docker compose --env-file .env.docker -f compose.noel-local.yaml config --quiet
docker compose --env-file .env.docker -f compose.noel-local.yaml build infinite-monitor
docker compose --env-file .env.docker -f compose.noel-local.yaml pull ollama proxy model-pull
docker compose --env-file .env.docker -f compose.noel-local.yaml stop infinite-monitor ollama
docker compose --env-file .env.docker -f compose.noel-local.yaml --profile download run --rm --no-deps model-pull
docker compose --env-file .env.docker -f compose.noel-local.yaml up -d
docker compose --env-file .env.docker -f compose.noel-local.yaml ps
```

No usar `down -v`: elimina modelos descargados. En la primera instalación, stop puede no tener servicios que detener.
El contenedor temporal model-pull descarga el modelo; no recibe prompts ni datos de la clínica.
El servicio normal Ollama comparte ese volumen después de finalizar la descarga.
Si se creó el contenedor de la receta HTTP anterior, detenerlo antes del nuevo proxy para liberar 8039.

4. Consultar https://DOMINIO_DEL_SERVIDOR:8039/api/noel/health con certificado validado.
   Ahora 8039 publica HTTPS del proxy, no HTTP de Next. La raíz / devuelve 404 deliberadamente.
5. Registrar https://DOMINIO_DEL_SERVIDOR:8039 y el secreto en Integraciones API de PlataformaNoel.
   Marcar red privada si corresponde. Probar y activar.
6. La verificación comprueba firma y presencia del modelo descargado; no ejecuta inferencia.
   Generar un dashboard real y comparar cifras, guardar/publicar y probar permisos de otro usuario.

No se ha probado esta imagen Docker ni inferencia real en el entorno de desarrollo, que carece de Docker/GPU.
Las pruebas automatizadas comprueban contrato, destino local, rechazo de cloud y respuestas simuladas.
La compilación de Next es una validación separada, no sustituye construir/desplegar la imagen.

Referencias: https://docs.ollama.com/docker, https://docs.ollama.com/api/openai-compatibility,
https://docs.ollama.com/faq. Fijar versiones/digests de imágenes antes de producción.
