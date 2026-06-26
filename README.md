# n8n Dashboard

Panel de administración single-page para la [API REST pública de n8n](https://docs.n8n.io/api/) **v1.1.1**.
Una UI única para operar toda tu instancia de n8n (workflows, ejecuciones, credenciales, tags, tablas de datos, paquetes y, si tienes Enterprise, usuarios, proyectos, carpetas, variables, insights, auditoría y source control) sin tocar la CLI ni el editor de n8n.

> **Modo single-tenant con proxy en el servidor.** La API key vive solo en el `.env` del servidor. El navegador nunca la ve.

---

## Tabla de contenidos

- [¿Por qué existe este proyecto?](#por-qué-existe-este-proyecto)
- [Características](#características)
- [Cómo funciona (arquitectura)](#cómo-funciona-arquitectura)
- [Stack técnico](#stack-técnico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Desarrollo local](#desarrollo-local)
- [Despliegue con Docker](#despliegue-con-docker)
- [Configuración](#configuración)
- [Modelo de seguridad](#modelo-de-seguridad)
- [Detección de capacidades Enterprise](#detección-de-capacidades-enterprise)
- [Cobertura de la API](#cobertura-de-la-api)
- [Backup local (File System Access API)](#backup-local-file-system-access-api)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Scripts de desarrollo](#scripts-de-desarrollo)
- [Roadmap interno](#roadmap-interno)
- [Licencia](#licencia)

---

## ¿Por qué existe este proyecto?

La UI oficial de n8n está pensada para editar workflows, no para gestionarlos en lote. Este dashboard añade una capa de operaciones:

- **Vista global** de qué pasa en tu instancia (errores recientes, executions corriendo, contadores por estado).
- **Bulk operations** sobre workflows: activar/desactivar/archivar/borrar muchos a la vez.
- **Inspección de ejecuciones** con datos completos, retry, stop masivo.
- **Gestión de credenciales** con formularios generados dinámicamente desde el schema de n8n (los secretos nunca se devuelven en la respuesta, solo el tipo y metadata).
- **Tablas de datos (Cloud/Enterprise)** con editor de filas, filtros DSL, bulk update/upsert/delete con `dryRun`.
- **Source control pull** con `force` y `autoPublish` desde la UI.
- **Auditorías de seguridad** y métricas de insights.
- **Backups locales** sin servidor adicional, usando File System Access API para escribir los JSON de workflows directamente en una carpeta que tú elijas.

Todo expuesto a través de la **API pública v1.1.1**, así que es 100% compatible con cualquier n8n self-hosted o cloud.

---

## Características

### Overview (`/`)

- Tarjetas de stats en vivo: workflows totales/activos, ejecuciones en error (últimas 100), corriendo ahora (auto-refresh 10s), tags definidos.
- Listado de las 8 ejecuciones fallidas más recientes con link al detalle.
- Mapa de capacidades detectadas vía `GET /discover` (recursos, scopes, número de endpoints y operaciones por recurso).
- Aviso de recursos con 0 endpoints (probablemente Enterprise-only).

### Workflows (`/workflows`, `/workflows/[id]`)

- Listado paginado con cursor, filtros por nombre, estado activo/inactivo y tags.
- Bulk: activar, desactivar, archivar, desarchivar, eliminar.
- Detalle: editor JSON con validación `versionId`, asignar/quitar tags, transferir a otro proyecto, activar/desactivar, archivar.
- Exclusión de pinned data opcional para acelerar cargas.

### Ejecuciones (`/executions`, `/executions/[id]`)

- Listado con filtros por estado (`success`, `error`, `running`, `waiting`, `crashed`, `canceled`, `new`) y rango de fechas.
- **Live polling** configurable: el contador de "running" se refresca cada 10 s automáticamente.
- Detalle con los datos completos de la ejecución (con `includeData=true`).
- Acciones: retry, stop individual, bulk stop por status/workflowId/rango de fechas.

### Credenciales (`/credentials`, `/credentials/[id]`)

- Listado (los secretos nunca vienen en la respuesta — solo tipo, nombre, scopes, proyectos donde está compartida).
- **Formulario de creación generado dinámicamente** desde `GET /credentials/schema/{type}`.
- Test de credencial, edición de nombre/tipo, transferencia de proyecto, eliminación.

### Tags (`/tags`)

- CRUD completo.
- Asignación masiva desde la pantalla de workflows.

### Data Tables (`/data-tables`, `/data-tables/[id]`)

- Disponible en **Cloud / Enterprise**.
- CRUD de tablas con tipos de columna `string | number | date | boolean`.
- Añadir/renombrar/eliminar columnas.
- Explorador de filas con DSL de filtros (`type: 'and' | 'or'` + condiciones).
- Bulk update / upsert / delete con soporte para `dryRun` y `returnData`.

### Community Packages (`/community-packages`)

- Listado de paquetes npm instalados, con versión y update available.
- Instalación, actualización y desinstalación, con flag `verify`.

### n8n Packages (`/packages`) — Beta

- Export a archivo `.n8np`.
- Import con políticas configurables:
  - Conflicto de workflows: `new-version | fail | skip`.
  - Matching de credenciales: `id-only`.
  - Credenciales faltantes: `must-preexist | create-stub`.
  - IDs de workflow: `new | source`.
  - Publicación: `preserve-published-state | match-source | publish-all | unpublish-all`.

### Enterprise (auto-detectado, gateado por `NEXT_PUBLIC_ENTERPRISE_ENABLED`)

- **Users** — listar, invitar (devuelve `inviteAcceptUrl`), cambiar rol, eliminar.
- **Projects** — CRUD + gestión de miembros con roles `project:editor | project:viewer`.
- **Folders** — listar, crear, eliminar (con target de transferencia).
- **Variables** — CRUD con scope por proyecto.
- **Insights** — métricas por rango de fechas (`startDate`, `endDate`, `projectId`): total, fallados, failure rate, time saved, average run time, desglose por workflow.
- **Audit** — correr auditoría de seguridad con filtro por categoría (`credentials`, `database`, `nodes`, `filesystem`, `instance`).
- **Source Control** — pull desde Git con `force` y `autoPublish` (`none | all | published`).

### Settings (`/settings`)

- Estado de conexión en vivo (latencia, base URL, si es HTTP inseguro).
- Lista de scopes concedidos por tu API key.
- Mapa completo de endpoints descubiertos.

### Backup (`/backup`) — feature destacada

- Selector de carpeta destino (usa File System Access API).
- Editor de paths relativos por workflow (validación: no absolutos, no `..`, sin caracteres prohibidos, autocompleta `.json`).
- Resolución automática de duplicados (`workflow.json` se convierte en `workflow-<id>.json`).
- Export en bulk con barra de progreso, manejo de errores por workflow, soporte de fallback para navegadores sin FSA (descarga como ZIP).

---

## Cómo funciona (arquitectura)

El proyecto sigue un patrón de **BFF (Backend for Frontend) ligero** sobre Next.js App Router:

```
┌──────────────┐         ┌──────────────────────────┐         ┌──────────────┐
│  Navegador   │  fetch  │  Next.js Route Handlers  │  fetch  │   n8n API    │
│  (React UI)  │ ──────► │  /api/n8n/[[...path]]    │ ──────► │ /api/v1/...  │
│              │         │  + /api/n8n/discover     │         │              │
│              │         │  + /api/n8n/health       │         │              │
└──────────────┘         └──────────────────────────┘         └──────────────┘
                                  │
                                  ▼
                         process.env.N8N_API_KEY
                         (nunca llega al browser)
```

### Pieza por pieza

1. **Catchall proxy** (`src/app/api/n8n/[[...path]]/route.ts`)
   - Acepta `GET/POST/PUT/PATCH/DELETE` con la misma forma que la API pública.
   - Whitelist regex sobre los segmentos del path: `^[A-Za-z0-9_\-.~]+$` — bloquea path traversal, slashes, NULs.
   - Parsea JSON y `multipart/form-data` (necesario para `/n8n-packages/import`).
   - Devuelve el JSON de n8n tal cual, más campos extra en errores: `hint` (sugerencia contextual según status) y `body`.

2. **Cliente n8n** (`src/lib/n8n-client.ts`)
   - Construye URLs con `${N8N_BASE_URL}/api/v1/...`.
   - Inyecta `X-N8N-API-KEY` en cada request.
   - Maneja timeouts con `AbortController` (default 30 s, configurable).
   - Soporta `dispatcher` de undici para honrar `N8N_VERIFY_TLS=false` en self-hosted con certificados auto-firmados.
   - Mapea códigos HTTP a hints legibles (401 → "verifica la API key", 404 → "puede ser Enterprise", 422 → "política de redacción", etc.).
   - Flag de log: `N8N_DEBUG_LOG=1` imprime método, path, status y duración.

3. **Validación de env** (`src/lib/env.ts`)
   - Usa Zod para validar y normalizar:
     - `N8N_BASE_URL` → URL válida + strip trailing slash.
     - `N8N_API_KEY` → string no vacío.
     - `N8N_VERIFY_TLS` → boolean (`true` salvo `false` o `0`).
     - `N8N_TIMEOUT_MS` → número positivo (default 30000).
     - `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_ENTERPRISE_ENABLED`.
   - Cache en memoria tras la primera lectura.

4. **Capabilities** (`src/lib/capability.ts`)
   - Llama a `GET /discover?include=schemas` y cachea 5 min.
   - Devuelve `Capability { resources: Set<string>, scopes: Set<string>, endpoints: Map }`.
   - Si `/discover` falla, devuelve un capability vacío (fail open).

5. **Capability Gate** (`src/components/capability-gate.tsx`)
   - Componente que oculta secciones no disponibles y muestra un fallback amable ("no disponible — probablemente requiere Enterprise").

6. **Cliente del navegador** (`src/lib/api-client.ts`)
   - Wrapper sobre `fetch` con `useN8nQuery` (TanStack Query) listo para usar.
   - Lanza `ApiError` con `status`, `hint` y `body`.

---

## Stack técnico

| Capa            | Tecnología                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| Framework       | **Next.js 14.2.18** (App Router, standalone output)                         |
| UI              | **React 18.3**, **TypeScript 5.7** (strict)                                |
| Estilos         | **Tailwind CSS 3.4** + `tailwindcss-animate` + tokens HSL por tema         |
| Componentes     | **shadcn/ui** sobre **Radix UI** (AlertDialog, Dialog, Dropdown, Select, Tabs, Toast, Tooltip, Popover, Switch, Checkbox, Separator, Label) |
| Estado servidor | **TanStack Query v5** (con retry inteligente: 4xx no reintenta)           |
| Tablas          | **TanStack Table v8** + paginación por cursor propia                       |
| Formularios     | **react-hook-form** + **zod** + **@hookform/resolvers**                    |
| Iconos          | **lucide-react**                                                           |
| Visualización   | **recharts**                                                               |
| Fechas          | **date-fns** + **date-fns-tz** (locales `en` y `es`)                       |
| Validación env  | **zod**                                                                    |
| Utilidades CSS  | **clsx** + **tailwind-merge**                                              |
| Temas           | **next-themes** (light/dark/system)                                        |
| Package manager | **pnpm ≥ 9**                                                               |
| Runtime         | **Node.js ≥ 22**                                                           |

---

## Estructura del proyecto

```
DashboardN8N/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root layout + Providers + Shell
│   │   ├── page.tsx                      # Dashboard overview (/)
│   │   ├── globals.css                   # Tokens HSL, scrollbar, JSON viewer
│   │   ├── error.tsx                     # Error boundary
│   │   ├── loading.tsx                   # Suspense fallback
│   │   ├── not-found.tsx                 # 404
│   │   ├── api/n8n/
│   │   │   ├── [[...path]]/route.ts      # Catchall proxy → n8n
│   │   │   ├── discover/route.ts         # GET /api/n8n/discover
│   │   │   └── health/route.ts           # GET /api/n8n/health (latency check)
│   │   ├── workflows/
│   │   │   ├── page.tsx                  # Listado + bulk ops
│   │   │   └── [id]/page.tsx             # Detalle + JSON editor
│   │   ├── executions/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── credentials/                  # List + create + schema-driven form
│   │   ├── tags/
│   │   ├── data-tables/                  # Cloud/Enterprise
│   │   ├── community-packages/
│   │   ├── packages/                     # n8n Packages (beta)
│   │   ├── backup/                       # File System Access bulk export
│   │   ├── settings/
│   │   └── enterprise/
│   │       ├── users/
│   │       ├── projects/
│   │       ├── folders/
│   │       ├── variables/
│   │       ├── insights/
│   │       ├── audit/
│   │       └── source-control/
│   ├── components/
│   │   ├── layout/                       # Shell, Sidebar, Topbar, PageHeader
│   │   ├── ui/                           # shadcn/ui primitivos (Button, Card, ...)
│   │   ├── data-table/                   # Tabla genérica + paginación cursor
│   │   ├── backup/                       # SaveFolderPicker, BackupPathsEditor, BulkExport
│   │   ├── workflow/                     # Componentes específicos de workflow
│   │   ├── capability-gate.tsx           # Gate visual por capability
│   │   ├── code-viewer.tsx               # JSON viewer con syntax highlight
│   │   ├── confirm-dialog.tsx
│   │   ├── enterprise-guard.tsx
│   │   ├── providers.tsx                 # QueryClientProvider + Toaster
│   │   ├── status-badge.tsx
│   │   └── theme-toggle.tsx
│   └── lib/
│       ├── api-client.ts                 # fetch wrapper + useN8nQuery (cliente)
│       ├── n8n-client.ts                 # n8nRequest + N8nError (servidor)
│       ├── env.ts                        # Validación Zod de variables de entorno
│       ├── capability.ts                 # getCapabilities() con cache 5 min
│       ├── feature-flags.ts              # isEnterpriseEnabled()
│       ├── types.ts                      # Tipos TypeScript del API v1.1.1
│       ├── format.ts                     # relativeTime, formatBytes, truncate...
│       ├── download.ts                   # downloadBlob + safeFilename
│       ├── fs-access.ts                  # File System Access API + IndexedDB
│       ├── backup-paths.ts               # Validación + dedupe de paths
│       └── cn.ts                         # clsx + tailwind-merge
├── public/                               # Assets estáticos
├── Dockerfile                            # Build multi-stage (deps → builder → runner)
├── docker-compose.yml                    # Servicio dashboard + healthcheck
├── next.config.mjs                       # standalone output + security headers
├── tailwind.config.ts                    # Design tokens
├── tsconfig.json                         # strict + path alias @/*
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── .env.example
├── .eslintrc.json                        # extends next/core-web-vitals
└── .gitignore
```

---

## Requisitos previos

- **Node.js ≥ 22** (o usa la imagen Docker).
- **pnpm ≥ 9** (`corepack enable && corepack prepare pnpm@latest --activate`).
- Una instancia de **n8n** con la **API pública habilitada**: *Settings → n8n API → Create an API key*.

---

## Desarrollo local

```bash
# 1. Clonar e instalar
git clone <repo>
cd DashboardN8N
pnpm install

# 2. Copiar env de ejemplo
cp .env.example .env

# 3. Editar .env con tu N8N_BASE_URL y N8N_API_KEY
#    (sin trailing slash en la URL)

# 4. Arrancar dev server
pnpm dev
# → http://localhost:3000
```

Activa opcionalmente los logs de las llamadas a n8n:

```bash
N8N_DEBUG_LOG=1 pnpm dev
```

---

## Despliegue con Docker

```bash
# 1. Configurar env
cp .env.example .env
# editar .env

# 2. Construir y arrancar
docker compose up -d --build

# 3. Abrir
# → http://localhost:3000
```

El `docker-compose.yml` define:

- Build multi-stage desde el `Dockerfile` (deps → builder → runner con usuario no-root).
- Imagen final `dashboard-n8n:latest` basada en `node:22-alpine` con `output: 'standalone'`.
- Puerto `3000:3000`.
- **Healthcheck** cada 30 s contra `/api/n8n/health`.
- `restart: unless-stopped`.

### Si tu n8n corre en otro contenedor

Descomenta en `docker-compose.yml`:

```yaml
networks:
  - n8n-net
extra_hosts:
  - "host.docker.internal:host-gateway"   # si n8n está en el host
```

---

## Configuración

Variables en `.env`:

| Variable                        | Obligatoria | Default          | Descripción                                                                 |
| ------------------------------- | ----------- | ---------------- | --------------------------------------------------------------------------- |
| `N8N_BASE_URL`                  | **sí**      | —                | URL de tu instancia n8n (sin slash final).                                  |
| `N8N_API_KEY`                   | **sí**      | —                | API key generada en *Settings → n8n API*.                                   |
| `N8N_VERIFY_TLS`                | no          | `true`           | Pon `false` solo para self-hosted con certificado auto-firmado en dev.       |
| `N8N_TIMEOUT_MS`                | no          | `30000`          | Timeout por request al backend de n8n.                                      |
| `NEXT_PUBLIC_APP_NAME`          | no          | `n8n Dashboard`  | Nombre visible en la UI.                                                    |
| `NEXT_PUBLIC_ENTERPRISE_ENABLED`| no          | `false`          | Si es `true`, muestra las secciones `/enterprise/*` en el sidebar.          |

Validación Zod al arranque: si falta algo o el formato es incorrecto, el servidor responde 500 con un mensaje detallado.

---

## Modelo de seguridad

La decisión clave: **la API key nunca abandona el servidor**.

| Capa              | Medida                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Servidor          | `N8N_API_KEY` se lee en `process.env` solo dentro de Route Handlers (`runtime = 'nodejs'`).                          |
| Catchall proxy    | Whitelist regex sobre segmentos de path. Bloquea `..`, NULs, slashes, caracteres fuera de `[A-Za-z0-9_\-.~]`.        |
| Catchall proxy    | Solo métodos `GET/POST/PUT/PATCH/DELETE`. Otros → `405 Method Not Allowed`.                                          |
| Catchall proxy    | JSON inválido → `400 Bad Request` con mensaje claro.                                                                  |
| Response headers  | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. |
| Next.js           | `poweredByHeader: false`, `reactStrictMode: true`.                                                                    |
| Errores           | Se devuelve `message`, `hint` y `body` opaco — nunca se filtra la API key ni headers internos.                        |
| Producción        | Servir **siempre detrás de HTTPS** (Caddy, Traefik, Nginx, etc.).                                                     |
| Docker            | Usuario no-root (`app:app`) en el stage `runner`.                                                                     |

Lo que **no** hace el dashboard:

- No implementa rate limiting outbound (más allá del timeout por request). Respeta los límites de plataforma de tu n8n.
- No tiene autenticación propia. Asume que lo proteges a nivel de red (reverse proxy con auth, VPN, IP allowlist, OAuth proxy, etc.).

---

## Detección de capacidades Enterprise

Al cargar, el dashboard llama a `GET /discover?include=schemas` y cachea el resultado **5 minutos**. La respuesta se usa para:

1. **Construir el sidebar dinámicamente**: oculta secciones para las que tu API key no tiene permiso o tu edición de n8n no soporta.
2. **`CapabilityGate`**: oculta features Enterprise-only en páginas concretas con un mensaje amable.
3. **`Settings → Discovered resources`**: muestra el mapa completo de recursos/endpoints detectados.

Si `/discover` falla (n8n caído, key inválida), se devuelve un capability vacío y la UI falla *abierto* (muestra todo, los errores aparecen al intentar usarlo).

Adicionalmente, `NEXT_PUBLIC_ENTERPRISE_ENABLED=false` oculta las rutas `/enterprise/*` aunque `/discover` las reporte — útil para deployments mixtos.

---

## Cobertura de la API

| Sección              | Endpoints usados                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflows            | `GET/POST /workflows`, `GET/PUT/DELETE /workflows/{id}`, `GET /workflows/{id}/{versionId}`, `POST /workflows/{id}/{activate,deactivate,archive,unarchive}`, `PUT /workflows/{id}/{transfer,tags}`, `GET /workflows/{id}/tags` |
| Executions           | `GET/DELETE /executions/{id}`, `GET /executions`, `POST /executions/{id}/{retry,stop}`, `POST /executions/stop`, `GET/PUT /executions/{id}/tags` |
| Credentials          | `GET/POST /credentials`, `GET/PATCH/DELETE /credentials/{id}`, `POST /credentials/{id}/test`, `GET /credentials/schema/{type}`, `PUT /credentials/{id}/transfer` |
| Tags                 | `GET/POST /tags`, `GET/PUT/DELETE /tags/{id}`                                                                                                 |
| Data Tables          | `GET/POST /data-tables`, `GET/PATCH/DELETE /data-tables/{id}`, `GET/POST/PATCH/DELETE /data-tables/{id}/rows[/update,/upsert,/delete]`, `GET/POST/PATCH/DELETE /data-tables/{id}/columns[/{id}]` |
| Community Packages   | `GET/POST /community-packages`, `PATCH/DELETE /community-packages/{name}`                                                                     |
| n8n Packages (beta)  | `POST /n8n-packages/{export,import}`                                                                                                          |
| Enterprise Users     | `GET /users`, `GET/POST /users/{id}`, `DELETE /users/{id}`, `PATCH /users/{id}/role`                                                          |
| Enterprise Projects  | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}`, `GET/POST /projects/{id}/users`, `PATCH/DELETE /projects/{id}/users/{userId}`        |
| Enterprise Folders   | `GET/POST /projects/{projectId}/folders`, `GET/PATCH/DELETE /folders/{id}`                                                                   |
| Enterprise Variables | `GET/POST /variables`, `GET/PUT/DELETE /variables/{id}`                                                                                       |
| Enterprise Insights  | `GET /insights/by-workflow?startDate=&endDate=&projectId=`                                                                                     |
| Enterprise Audit     | `POST /audit?daysAbandonedWorkflow=&categories=`                                                                                              |
| Source Control       | `POST /source-control/pull`, `GET /source-control/get-status`                                                                                 |
| Discover             | `GET /discover` (con cache 5 min)                                                                                                             |

---

## Backup local (File System Access API)

La pantalla `/backup` ofrece una vía rápida para **exportar todos tus workflows como JSON** sin montar un servidor de backups:

1. Click en "Elegir carpeta" → el navegador abre el picker nativo (`window.showDirectoryPicker()`).
2. La carpeta queda asociada vía IndexedDB (`backup-db.handles.base-dir`) — no se sube nada.
3. Edita los paths relativos por workflow si quieres (se validan: no absolutos, no `..`, sin caracteres prohibidos, `.json` auto-añadido).
4. Si dos workflows resuelven al mismo path, el segundo se renombra automáticamente a `nombre-<id>.json`.
5. Click en "Exportar" → cada workflow se serializa y se escribe directamente en la carpeta vía `FileSystemDirectoryHandle.createWritable()`.
6. Si el navegador no soporta FSA (Firefox, Safari), fallback a descarga individual de cada workflow como `.json`.

**Limitaciones conocidas**: FSA solo funciona en navegadores Chromium-based (Chrome, Edge, Brave) sobre HTTPS o `localhost`. La carpeta debe permanecer accesible al sitio (el navegador puede pedir re-permiso).

---

## Limitaciones conocidas

- La **n8n API no está disponible durante el free trial** de n8n Cloud.
- El dashboard **no implementa rate limiting** outbound — respeta los límites de plataforma de tu instancia.
- `n8n-packages` es **beta**: si está deshabilitado, las llamadas devuelven 404 y la UI lo refleja en Settings.
- La API pública **no expone** la carpeta padre de un workflow ni el `projectId` en el recurso workflow (solo dentro de `shared[]`). El campo `parentFolderId` está deprecado en los types.
- Sin auth propia — proteger a nivel de red.
- File System Access API solo en Chromium-based.

---

## Scripts de desarrollo

```bash
pnpm dev          # next dev          — dev server con HMR
pnpm build        # next build        — build de producción
pnpm start        # next start        — arrancar build de producción
pnpm typecheck    # tsc --noEmit      — type-check sin emitir
pnpm lint         # next lint         — ESLint (next/core-web-vitals)
```

---

## Roadmap interno

Ideas consideradas pero no prioritarias:

- [ ] Editor visual de workflows (drag & drop) — fuera del scope: ya existe la UI oficial.
- [ ] Historial de cambios local por workflow (diff entre versiones).
- [ ] Programador de bulk actions (cron-like).
- [ ] Métricas históricas persistentes (más allá de lo que da `/insights`).
- [ ] Auth integrada (NextAuth + provider OIDC).
- [ ] Tests E2E con Playwright contra una instancia n8n dockerizada.
- [ ] Tests unitarios para `n8n-client`, `env.ts`, `backup-paths.ts`.

---

## Licencia

MIT
