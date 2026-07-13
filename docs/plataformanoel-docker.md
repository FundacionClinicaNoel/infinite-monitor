# Infinite Monitor para PlataformaNoel

## Propósito

Este servicio ejecuta Infinite Monitor de forma independiente. PlataformaNoel sigue siendo
la autoridad de autenticación, permisos y acceso a datos. Infinite Monitor no debe conectarse
directamente a SQL Server.

## Requisitos

- Docker Desktop o Docker Engine con Compose v2.
- Al menos 2 GB de memoria disponible.
- Una clave de un proveedor de IA, configurada solo en el entorno del servidor.

## Configuración local

Crear un archivo `.env.docker` (ignorado por Git) o definir las variables en el sistema:

```env
INFINITE_MONITOR_PORT=3010
INFINITE_MONITOR_VERSION=local
PLATAFORMA_NOEL_API_URL=http://host.docker.internal:8000
OPENAI_API_KEY=
OPENROUTER_STARTER_DISABLED=1
SHARE_ID_SECRET=
```

No guardar secretos ni direcciones privadas en `.env.example`.

## Construcción y arranque

```bash
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f infinite-monitor
```

La interfaz queda disponible en `http://localhost:3010` y el estado del servicio en
`http://localhost:3010/api/health`.

## Persistencia

La base SQLite se guarda en el volumen `plataforma-noel-infinite-monitor-data`. Reconstruir
o reemplazar el contenedor no elimina los dashboards. El volumen debe incluirse en la política
de copias de seguridad.

## Actualización

```bash
git pull
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker up -d
```

## Límites de seguridad

- No enviar nombres, documentos, historias clínicas o archivos de pacientes a la IA.
- Consumir únicamente endpoints agregados de `/api/analytics` en PlataformaNoel.
- No incluir tokens permanentes en widgets o código del navegador.
- Mantener `OPENROUTER_STARTER_DISABLED=1` en entornos institucionales.
- Publicar el servicio detrás del proxy institucional; no exponer el puerto 3010 a Internet.
