# Plan de Implementación — Migración a Railway + Reestructura Monorepo

> **Documento vivo.** Este archivo se actualiza progresivamente a medida que se completa el trabajo.

---

## Cómo usar este documento (instrucciones para IA y humanos)

- Cada tarea es un checkbox `- [ ]`. Marcar como `- [x]` SOLO cuando esté verificada (no solo escrita).
- El campo `Status` de cada fase tiene tres estados: `⏳ Pendiente`, `🔄 En progreso`, `✅ Completada`.
- Al iniciar una fase: cambiar status a `🔄 En progreso` y poner fecha en `Iniciada`.
- Al completar una fase: cambiar status a `✅ Completada`, poner fecha en `Completada`, y agregar una entrada breve en `Notas de ejecución` sobre decisiones tomadas o desviaciones del plan.
- Si surge un blocker o se decide cambiar el plan: documentar en `Notas de ejecución` de la fase respectiva, no borrar el item original.
- Las estimaciones de tiempo son orientativas, no compromisos.

---

## Contexto

Producto: CRM + ERP B2B multi-tenant para PyMEs en República Dominicana, con facturación, gestión de clientes/productos/gastos, asistente AI, y (futuro) integración con plataforma fiscal externa.

**Estado actual:**
- Next.js 16.2.6 monolítico, desplegado en Vercel (`prj_dza2rFixCFJR5n5pxEe7NvhTXUSS`).
- Supabase como base de datos. Schema ya es multi-tenant (`businesses`, `business_members`, RLS por `business_id`).
- Solo un usuario por business (limitación de aplicación; el schema soporta multi-business).
- Sin lógica DGII/e-CF implementada. La integración fiscal vivirá en un servicio externo aparte y se conectará vía HTTP en una fase posterior.

**Objetivo de esta migración:**
1. Cortar Vercel y desplegar en Railway con Docker + auto-deploy desde GitHub.
2. Reestructurar a monorepo con frontend y backend separados (`apps/web` Next.js + `apps/api` Hono), preparando la base para múltiples consumidores futuros (móvil, partners B2B, admin console).
3. Preservar 100% del código de dominio existente. Cero reescritura.

---

## Decisiones de arquitectura

| Decisión | Elección | Razón |
| --- | --- | --- |
| Monorepo tooling | pnpm workspaces + Turborepo | Estándar TS, builds en paralelo, optimizado para Docker con `turbo prune`. |
| Backend framework | Hono + Zod + `@hono/zod-openapi` | Liviano, streaming nativo (asistente AI), OpenAPI auto-generado → SDKs para partners futuros. |
| API style | REST versionado (`/v1`) | Compatible con cualquier consumidor (web, móvil, partners). |
| ORM | Drizzle sobre supabase-js | Queries type-safe, mejor DX que raw SQL. supabase-js se mantiene para auth/storage. |
| Auth usuarios | Supabase Auth + JWT forward al API | API verifica JWT y usa cliente Supabase con ese token → RLS sigue aplicando. |
| Comunicación web↔api | BFF sobre Railway Private Network | Next.js es lo único expuesto. Llama API por `http://api.railway.internal:8080`. |
| Build | Dockerfile multi-stage + `output: 'standalone'` + `turbo prune` | Portabilidad (no lock-in Railway), fuentes para PDFs, reproducibilidad para auditoría. |
| Background jobs | pg-boss (diferido a Fase 4) | Cuando aparezca el primer job real. Sin Redis inicialmente. |
| Email | Resend + React Email | Cuando se agregue notificaciones (Fase 3). |
| Observability | Sentry (errores) + Axiom (logs) + OpenTelemetry (traces) | Se agrega en Fase 1 al levantar Railway. |
| Cutover Vercel | Hard cutover (sin paralelo) | Confirmado por el usuario. Backup: mantener proyecto Vercel 48h por si rollback. |

---

## Estructura final del repo

```
/Users/ernestomendez/Software/CRM/
├── apps/
│   ├── web/                          # Next.js 16 — solo UI
│   │   ├── src/{app,components,lib,i18n,messages,proxy.ts}
│   │   ├── public/
│   │   ├── next.config.ts            # con output: 'standalone'
│   │   ├── Dockerfile
│   │   └── package.json
│   └── api/                          # Hono — backend REST
│       ├── src/
│       │   ├── index.ts              # bootstrap + serve
│       │   ├── middleware/auth.ts    # verifica JWT Supabase
│       │   ├── routes/{customers,products,invoices,quotations,expenses,settings,assistant,pdf}.ts
│       │   └── lib/{pdf,openai}.ts
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── contracts/                    # Zod schemas compartidos
│   ├── db/                           # Drizzle + supabase clients + tipos generados
│   ├── core/                         # Lógica de dominio pura
│   └── tsconfig/                     # Configs base
├── supabase/                         # Migraciones + RLS + seeds
├── tests/
├── docs/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json                      # root
```

---

## FASE 1 — Bones del monorepo + Railway

**Status:** ✅ Completada
**Iniciada:** 2026-06-24
**Completada:** 2026-06-24
**Estimación:** 1-2 semanas
**Real:** ~1 día (sesión enfocada)

**Objetivo:** Producto funciona igual que hoy, pero corriendo en Railway desde una estructura monorepo con `apps/web` + `apps/api` scaffolded. Vercel apagado.

### Setup monorepo

- [x] Instalar pnpm global (corepack: pnpm 11.9 en host, pnpm@9.15.0 pinned en `packageManager`)
- [x] Crear `pnpm-workspace.yaml` con `packages: ['apps/*', 'packages/*']`
- [x] Crear `turbo.json` con pipelines: `build`, `dev`, `lint`, `typecheck`, `test`
- [x] Strip root `package.json` a monorepo-only (solo `turbo` en devDeps)
- [x] `pnpm install` resuelve sin errores

### Mover frontend a apps/web

- [x] `git mv src apps/web/src`
- [x] `git mv public apps/web/public`
- [x] Mover `next.config.ts`, `tsconfig.json`, `postcss.config.*`, `vitest.config.*`, `components.json`, `tests/` → `apps/web/` (eslint config se quedó en root como monorepo-wide)
- [x] Crear `apps/web/package.json` con deps de UI/Next + scripts
- [x] Agregar `output: 'standalone'` + `outputFileTracingRoot` en `apps/web/next.config.ts`
- [x] `pnpm --filter @crm/web dev/build/test` todos verdes
- [x] Actualizar `.gitignore` para ser monorepo-aware (paths sin `/` anclado)

### Extraer packages compartidos

- [x] `packages/tsconfig/`: `base.json`, `nextjs.json`, `node.json`
- [x] `packages/contracts/`: 7 Zod schemas (customer, invoice, product, quotation, expense, payment, settings). Export `@crm/contracts/*`
- [x] `packages/db/`: 4 archivos (types, browser, server, admin). Subpath exports `@crm/db/{browser,server,admin}` para evitar bundling server-only en browser. `next` como peerDep opcional (proxy.ts usa `next/headers`)
- [x] `packages/core/`: solo money helpers (calc + format) + tests (26 tests)
- [x] Actualizar imports en `apps/web` (48 imports validation, 30+ supabase, 4 money)
- [x] Test suite sigue verde (44 tests: 26 core + 18 web)
- [~] **Diferido a Phase 2**: Drizzle (sin endpoints API que se beneficien todavía); domain/, assistant/, ai/, openai/, pdf/, auth/ se quedaron en `apps/web/src/lib/` porque importan Supabase o Next.js directamente

### Scaffold apps/api

- [x] Crear `apps/api/package.json` con Hono 4.10 + `@hono/zod-openapi` 1.4 + tsup + tsx + vitest
- [x] `apps/api/src/index.ts`: bootstrap Hono + healthcheck `GET /healthz`
- [x] `pnpm --filter @crm/api dev` levanta en localhost:8080
- [x] `curl http://localhost:8080/healthz` retorna 200
- [x] `pnpm --filter @crm/api build` produce `dist/index.js` (~450 B)
- [~] **Diferido**: middleware/auth.ts, middleware/error.ts (vienen con las rutas de negocio en Phase 2)

### Dockerfiles

- [x] `.dockerignore` raíz
- [x] `apps/web/Dockerfile`: multi-stage (pruner → installer → runner), `turbo prune @crm/web --docker`, Next.js standalone runtime. Imagen final 230 MB
- [x] `apps/api/Dockerfile`: multi-stage similar + `pnpm deploy --prod` + fuentes `font-noto font-noto-emoji` para @react-pdf/renderer (Phase 2). Imagen 657 MB (optimizable con tsup bundling cuando llegue Phase 2)
- [x] Build local de ambas imágenes OK, containers responden healthcheck
- **Lección**: separar `deps` y `builder` en stages distintos rompe los symlinks de pnpm workspace → tsup no se encuentra. Hay que install+build en el mismo stage.

### docker-compose para dev local

- [x] `docker-compose.yml` raíz con servicios `web` + `api`, ambos leen `env_file: .env.local`, `API_URL=http://api:8080`

### Setup Railway

- [x] Proyecto: `keen-blessing` (`4bf78170-671c-4204-8559-8faeb376c0da`) — workspace "Ernesto Mendez's Projects"
- [x] Repo conectado: `ernestomendez1/CRM`
- [x] Servicio `web`: ID `6987d418-337f-4e8d-84c9-802727e481cd`, dominio público `https://web-production-9995f.up.railway.app`
- [x] Servicio `api`: ID `103701db-29e7-4638-87b1-376e9b421ec0`, solo private network (`http://api.railway.internal:8080`)
- [x] Dockerfile path configurado por servicio vía GraphQL `serviceInstanceUpdate` (CLI no tiene flag directo)
- [x] Watch patterns configurados por servicio para builds incrementales
- [x] Env vars seteadas en ambos servicios (`railway variables --skip-deploys --set`)
- [x] Auto-deploy desde push a main funcionando
- [x] Healthchecks pasan; ambos deploys SUCCESS

### Observability básica (Sentry)

- [-] **Diferido**: No bloqueante para Phase 1. Agregar cuando aparezca el primer issue de producción.

### Cutover Vercel

- [x] Dominio: usa generado por Railway (`*.up.railway.app`), sin dominio custom por ahora
- [x] Supabase → Auth → URL Configuration: site_url + uri_allow_list actualizados vía Management API (PAT). Incluye Railway URL + localhost para dev local
- [x] Smoke test producción OK: login, CRUD customer/product/invoice/quotation/expense, descarga PDFs, asistente AI (después de agregar OPENAI_API_KEY al web), extracción gasto, settings
- [x] Borrar `.vercel/` del repo
- [x] Vercel deployment ya borrado por el usuario antes de empezar

### Notas de ejecución

**Refinamientos vs plan original:**
- `packages/core` solo recibió `money/` (helpers puros). `domain/*`, `assistant/*`, `ai/*`, `openai/*`, `pdf/*`, `auth/*` se quedaron en `apps/web/src/lib/` porque importan Supabase o Next.js (no son lógica pura). Migran en Phase 2 junto con la separación de rutas API.
- Drizzle diferido a Phase 2 (sin endpoints que se beneficien todavía).
- `packages/auth` eliminado del scope (session.ts usa `next/navigation.redirect()` — acoplado a Next.js, vive en apps/web).

**Sorpresas en ejecución:**
1. **Railway IaC (`railway/iac`) tiene un bug con pnpm**: la importación se rompe con `?namespace=` query string ("Cannot find module ...?namespace=..."). Workaround: usar CLI directo + GraphQL para configurar Dockerfile path. Probado con `node-linker=hoisted` también — mismo bug. Reportable a railwayapp/cli.
2. **Railway no tiene "DOCKERFILE" en su Builder enum** — solo `HEROKU`, `NIXPACKS`, `PAKETO`, `RAILPACK`. La forma correcta es setear `dockerfilePath` y Railpack lo respeta automáticamente. No hace falta cambiar el builder.
3. **PORT inyectado por Railway no respeta el del Dockerfile**: hay que setear `PORT=3000` (web) y `PORT=8080` (api) explícitamente en env vars, sino el contenedor escucha en otro puerto que el dominio.
4. **Env vars duplicadas web↔api**: `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_POOLER_URL`, `OPENAI_EXPENSE_MODEL` están en AMBOS servicios durante Phase 1 porque las rutas en `apps/web/src/app/api/*` y los Server Actions todavía las usan. Quitar del web cuando Phase 2 migre esas rutas al api.
5. **Hono + Zod 4**: `@hono/zod-openapi` 0.16.x requiere zod 3.x. Hay que usar 1.x line (>= 1.0). Hono también >= 4.10.0.
6. **Servicios sin instancia**: cuando creas un servicio en el dashboard sin deployar, queda como "shell" a nivel proyecto pero sin `ServiceInstance` en el environment — el CLI no puede operarlo. Hay que crear vía dashboard+deployar, o usar `railway add --repo` que lo hace todo.
7. **`railway add` ignora el proyecto linkeado**: cae en el último proyecto linkeado a CUALQUIER subdirectorio. Hay que `railway link` desde el directorio exacto donde corres `railway add`.

**Pendientes para próxima sesión / TODO:**
- Revocar el PAT de Supabase Management (`sbp_d8d6dd97...`) en https://supabase.com/dashboard/account/tokens y borrar `SUPABASE_ACCESS_TOKEN` de `.env.local`.
- Setear región explícita en ambos servicios Railway (actualmente default — verificar latencia y mover a `us-east-4` si hace falta).
- Sentry + Axiom (observability) cuando llegue el primer issue de producción.

---

## FASE 2 — Migración de dominios a API REST

**Status:** ⏳ Pendiente
**Iniciada:** —
**Completada:** —
**Estimación:** 3-6 semanas

**Objetivo:** Cada dominio del producto (settings, products, customers, quotations, invoices, expenses) consumido por el web vía HTTP al `apps/api`. Server Actions eliminados o reducidos a wrappers de invalidación de cache.

### Infraestructura compartida

- [ ] `apps/web/src/lib/api-client.ts`: cliente fetch tipado que envuelve `fetch`, lee JWT desde cookies de Supabase (server-side) o session (client-side), adjunta `Authorization: Bearer ...`, usa `process.env.API_URL`
- [ ] `apps/api/src/lib/responses.ts`: helpers de respuesta estandarizada (`ok()`, `created()`, `badRequest()`, `notFound()`, `forbidden()`)
- [ ] Generador de OpenAPI spec: `pnpm --filter api gen:openapi` produce `apps/api/openapi.json`

### Migración por dominio

Orden sugerido (menor a mayor riesgo):

#### Settings (más simple, sin relaciones)
- [ ] Endpoints `GET/PATCH /v1/settings/profile`, `/v1/settings/numbering`, `/v1/settings/branding`
- [ ] Web llama vía `api-client` desde server actions wrappers
- [ ] `revalidatePath('/settings')` se mantiene en el wrapper Next.js
- [ ] Borrar lógica directa de Supabase en `src/app/(app)/settings/actions.ts`

#### Products
- [ ] Endpoints REST CRUD `/v1/products`
- [ ] Migrar `src/app/(app)/products/actions.ts`
- [ ] Tests verdes

#### Customers
- [ ] Endpoints REST CRUD `/v1/customers`
- [ ] Migrar `src/app/(app)/customers/actions.ts`
- [ ] Tests verdes

#### Quotations
- [ ] Endpoints REST `/v1/quotations` (CRUD + cambio de estado)
- [ ] Migrar acciones de quotations
- [ ] Tests verdes

#### Invoices
- [ ] Endpoints REST `/v1/invoices` (CRUD + emisión + cambio de estado)
- [ ] Migrar acciones de invoices
- [ ] Confirmar que `fiscal_metadata` JSONB sigue siendo escribible (cliente fiscal externo se agregará en Fase 5)
- [ ] Tests verdes

#### Expenses
- [ ] Endpoints REST `/v1/expenses` (CRUD + extracción AI)
- [ ] Migrar `src/app/(app)/expenses/actions.ts`
- [ ] Migrar `src/app/api/expenses/extract/route.ts` → `apps/api/src/routes/expenses.ts:extract`
- [ ] Tests verdes

### Migrar rutas AI pesadas

- [ ] `/api/assistant/chat` → `apps/api/src/routes/assistant.ts:chat` con streaming Hono nativo
- [ ] `/api/assistant/execute` → `apps/api/src/routes/assistant.ts:execute`
- [ ] Quitar `export const maxDuration = 30` (era Vercel-only, irrelevante en Railway)
- [ ] Web actualiza llamadas a las nuevas URLs del api

### Migrar generación de PDFs

- [ ] `/api/pdf/quotation/[id]` → `apps/api/src/routes/pdf.ts:quotation`
- [ ] `/api/pdf/invoice/[id]` → `apps/api/src/routes/pdf.ts:invoice`
- [ ] Confirmar fuentes en imagen Docker del api (test visual de PDF generado)
- [ ] Mover `@react-pdf/renderer` y `src/lib/pdf/*` a `apps/api/`

### Limpieza

- [ ] Borrar `apps/web/src/app/api/` (debería quedar vacío)
- [ ] Borrar `src/lib/fiscal/` y `src/app/api/fiscal/` (directorios placeholder vacíos)
- [ ] Quitar `FISCAL_PLATFORM_*` de `.env.example`
- [ ] Verificar que el web no tiene `SUPABASE_SERVICE_ROLE_KEY` (debe vivir solo en api)
- [ ] OpenAPI spec publicado en `apps/api/openapi.json` y comiteado

### Notas de ejecución

_(Vacío hasta que se ejecute.)_

---

## FASE 3 — Multi-tenancy UX completo

**Status:** ⏳ Pendiente
**Iniciada:** —
**Completada:** —
**Estimación:** 3-4 semanas

**Objetivo:** Un usuario puede pertenecer a múltiples businesses y cambiar entre ellas. Nuevos usuarios pueden registrarse y crear su primera business. Owners pueden invitar miembros.

### Business switcher

- [ ] Reemplazar `requireBusiness()` en `apps/api/src/middleware/auth.ts` para leer `business_id` desde cookie `selected_business_id` en vez de tomar el primero
- [ ] Si la cookie no existe o el business no pertenece al usuario: rechazar con 403 (el web lo redirige)
- [ ] Componente switcher en `apps/web/src/components/business-switcher.tsx` (dropdown en header)
- [ ] Endpoint `POST /v1/session/business` que valida ownership y setea cookie
- [ ] Eliminar el `// For multi-business support later` comment de `src/lib/auth/session.ts:71`

### Signup + onboarding

- [ ] Página `/signup` con Supabase Auth (email + password, magic link opcional)
- [ ] Wizard de onboarding post-signup: crear primera business (name, legal_name, tax_id, currency, country=DO default)
- [ ] Endpoint `POST /v1/businesses` que crea business + business_member (role=owner) en transacción
- [ ] Email de bienvenida via Resend (requiere setup Resend, ver más abajo)
- [ ] Reemplazar página `/no-business` con redirect a `/onboarding`

### Invitación de usuarios

- [ ] Endpoint `POST /v1/businesses/:id/invitations` (genera token, guarda en tabla `invitations`, envía email)
- [ ] Endpoint `POST /v1/invitations/:token/accept` (valida token, crea business_member)
- [ ] UI en settings: lista de miembros + formulario para invitar (email + role)
- [ ] Migración: tabla `invitations` con `business_id`, `email`, `role`, `token`, `expires_at`, `accepted_at`
- [ ] RLS en `invitations`: solo owners/admins del business pueden listar/crear

### Setup Resend (primer caso real de email)

- [ ] Crear cuenta Resend, agregar dominio, configurar DNS (SPF, DKIM)
- [ ] `packages/emails/`: scaffold con React Email
- [ ] Templates: `welcome.tsx`, `invitation.tsx`
- [ ] Cliente Resend en `apps/api/src/lib/email.ts`
- [ ] Env var `RESEND_API_KEY` en api
- [ ] Test de envío en sandbox

### Audit RLS (defensa en profundidad)

- [ ] Test suite en `apps/api/tests/rls/` que crea dos usuarios en dos businesses distintos
- [ ] Cada test intenta: leer/escribir/borrar recursos del otro tenant → debe fallar
- [ ] Cobertura: customers, products, invoices, quotations, expenses, settings, invitations
- [ ] CI ejecuta estos tests contra schema de Supabase de staging

### Notas de ejecución

_(Vacío hasta que se ejecute.)_

---

## FASE 4 — Worker (cuando lo justifique)

**Status:** ⏳ Pendiente
**Iniciada:** —
**Completada:** —
**Estimación:** 1-2 semanas

**Objetivo:** Background job processor para tareas asíncronas que no deben bloquear requests del API. Solo activar cuando exista un job real que lo justifique.

**Criterio de activación:** un endpoint del api tarda >2s consistentemente y la operación se puede diferir, O necesitas garantía de entrega (emails, webhooks salientes).

### Setup worker

- [ ] Scaffold `apps/worker/` con Node + pg-boss + script de entry
- [ ] `Dockerfile` para el worker
- [ ] Agregar servicio `worker` en Railway (mismo proyecto, mismo repo, Root Directory `apps/worker`, sin public domain)
- [ ] Env vars: `SUPABASE_DB_POOLER_URL` (pg-boss usa el mismo Postgres)
- [ ] pg-boss inicializa schema `pgboss` en migración

### Patrón de jobs compartido

- [ ] `packages/jobs/`: definiciones tipadas de jobs (name, payload schema Zod, handler signature)
- [ ] `apps/api/src/lib/queue.ts`: cliente que encola jobs (`enqueue('send-email', payload)`)
- [ ] `apps/worker/src/handlers/`: un archivo por tipo de job
- [ ] Worker registra handlers, hace polling de pg-boss
- [ ] Manejo de retries y dead-letter

### Primeros jobs candidatos (priorizar por necesidad real)

- [ ] `send-email`: cualquier email transaccional pasa por aquí en vez de directo desde el api
- [ ] `generate-pdf`: si la latencia de PDFs grandes se vuelve problema visible
- [ ] (Futuro) `recurring-invoice`: cuando se agregue feature de facturación recurrente

### Observability

- [ ] Logs de worker llegan a Axiom
- [ ] Sentry captura errores no manejados en handlers
- [ ] Dashboard en pg-boss admin (o tabla custom) para ver jobs pendientes/fallidos

### Notas de ejecución

_(Vacío hasta que se ejecute.)_

---

## FASE 5 — API pública + SDK + integración fiscal

**Status:** ⏳ Pendiente
**Iniciada:** —
**Completada:** —
**Estimación:** 2-3 semanas

**Objetivo:** Exponer el API a partners externos con autenticación por API key, SDK auto-generado, docs públicos. Conectar la plataforma fiscal externa.

### API pública

- [ ] Habilitar dominio público `api.tudominio.com` en servicio Railway `api`
- [ ] Migración: tabla `api_keys` con `id`, `business_id`, `key_hash`, `name`, `created_by`, `last_used_at`, `revoked_at`
- [ ] Middleware `apiKeyAuth` en api: alternativo a JWT, autentica por `X-API-Key` header
- [ ] UI en settings: lista de keys + crear/revocar (la key se muestra solo una vez al crear)
- [ ] Rate limiting por API key (memoria local primero, Redis cuando escale)

### SDK auto-generado

- [ ] `packages/sdk-ts/`: generado desde `apps/api/openapi.json` via `openapi-typescript-codegen` o `orval`
- [ ] CI publica nueva versión del SDK a npm privado cuando OpenAPI spec cambia
- [ ] README del SDK con ejemplos

### Docs públicos

- [ ] Setup Mintlify o Scalar apuntando al OpenAPI spec
- [ ] Dominio `docs.tudominio.com`
- [ ] Guías de "Getting started" + ejemplos por endpoint

### Integración plataforma fiscal externa

- [ ] `apps/api/src/lib/fiscal-client.ts`: cliente HTTP a la plataforma fiscal (usa `FISCAL_PLATFORM_BASE_URL` + `FISCAL_PLATFORM_API_KEY`)
- [ ] Endpoint `POST /v1/invoices/:id/emit`: invoca cliente fiscal, guarda response en `fiscal_metadata`
- [ ] Endpoint `POST /v1/webhooks/fiscal`: recibe actualizaciones de estado desde plataforma fiscal
- [ ] Tabla `webhook_events`: `id`, `source`, `event_id`, `payload`, `received_at`, `processed_at` (idempotencia)
- [ ] Validación HMAC del webhook (header `X-Signature`)
- [ ] Worker job `process-fiscal-webhook` (si hay procesamiento pesado) o procesamiento sync si es simple
- [ ] UI: badge de estado fiscal en detalle de invoice, polling o realtime para actualizaciones

### Notas de ejecución

_(Vacío hasta que se ejecute.)_

---

## FASE 6 — App móvil (cuando el negocio lo demande)

**Status:** ⏳ Pendiente
**Iniciada:** —
**Completada:** —
**Estimación:** 8-12 semanas

**Objetivo:** App nativa iOS + Android para owners/vendedores que facturan desde el teléfono.

- [ ] `apps/mobile/` con Expo (React Native)
- [ ] Consume el mismo API REST (mismo SDK que partners)
- [ ] Comparte `packages/contracts` y `packages/core`
- [ ] Auth con Supabase Auth (deep links)
- [ ] Funcionalidad mínima viable: ver facturas, crear factura rápida, capturar gasto con cámara, ver clientes
- [ ] Distribución via TestFlight + Play Store

### Notas de ejecución

_(Vacío hasta que se ejecute.)_

---

## FASE 7 — Admin console (cuando exista equipo de soporte)

**Status:** ⏳ Pendiente
**Iniciada:** —
**Completada:** —
**Estimación:** 3-4 semanas

**Objetivo:** Consola interna para staff de soporte/operaciones. Separada del producto-cliente.

- [ ] `apps/admin/` con Next.js
- [ ] Auth con Supabase Auth + role `staff` (nueva tabla `staff_users`)
- [ ] Dominio separado: `admin.tudominio.com` (Railway service propio)
- [ ] Comparte `packages/ui` con `apps/web`
- [ ] Funcionalidad: ver todas las businesses, impersonar (con audit log), métricas globales, gestión de billing (cuando exista)

### Notas de ejecución

_(Vacío hasta que se ejecute.)_

---

## Variables de entorno (referencia final)

| Variable | `web` | `api` | `worker` | Notas |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ❌ | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ❌ | Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ✅ | ✅ | Solo backend |
| `SUPABASE_DB_POOLER_URL` | ❌ | ✅ | ✅ | Drizzle directo + pg-boss |
| `OPENAI_API_KEY` | ❌ | ✅ | ❌ | Asistente + extracción |
| `RESEND_API_KEY` | ❌ | ✅ | ✅ | Emails (Fase 3+) |
| `SENTRY_DSN` | ✅ | ✅ | ✅ | Distinto por servicio |
| `AXIOM_TOKEN` | ✅ | ✅ | ✅ | Logs |
| `API_URL` | ✅ | ❌ | ❌ | `http://api.railway.internal:8080` en prod |
| `FISCAL_PLATFORM_BASE_URL` | ❌ | ✅ | ❌ | Fase 5+ |
| `FISCAL_PLATFORM_API_KEY` | ❌ | ✅ | ❌ | Fase 5+ |
| `PORT` | auto | auto | auto | Railway inyecta |

---

## Anti-patrones a evitar

- ❌ Reescribir desde cero. Refactor preserva lógica probada.
- ❌ NestJS. Demasiado opinionado, ecosistema TS en RD/LATAM más pequeño.
- ❌ tRPC. Encierra en TS end-to-end, no sirve para móvil nativo ni partners.
- ❌ Prisma. No juega bien con Supabase RLS. Drizzle es superior.
- ❌ Microservicios desde día 1. Monolito modular en monorepo, extraer cuando un servicio tenga perfil de carga radicalmente distinto.
- ❌ Kubernetes. Railway/Fly cubren tus necesidades por años.
- ❌ Distroless images al inicio. `node:alpine` está bien, distroless complica debugging.
- ❌ SBOM, image signing, Trivy scans. Hasta que un cliente lo pida explícitamente.
- ❌ Pre-construir worker antes de tener un job real. Esperar el primer caso de uso.
- ❌ Tests de contrato cross-service antes de que existan partners externos.
- ❌ Realtime (Supabase realtime, websockets) antes de tener un caso de uso visible (notificaciones cross-tab, dashboards live).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Refactor masivo rompe formularios sutilmente | Migración dominio por dominio, no big-bang. Tests existentes verdes en cada paso. |
| `output: 'standalone'` no copia archivos de `next-intl` o assets | Probar build Docker localmente antes de pushear. Si falta, `outputFileTracingIncludes` en `next.config.ts`. |
| RLS deja de aplicar si api usa service-role por accidente | Convención: `@crm/db/server` requiere JWT explícito, `@crm/db/admin` solo desde rutas marcadas `// admin-only`. Lint rule custom opcional. |
| Latencia web↔api en Railway private network | Ambos servicios en misma región. Medir en smoke tests. Railway private network es <1ms intra-región. |
| Cutover sin paralelo deja a usuarios sin servicio si algo falla | Cutover fuera de horario laboral. Mantener proyecto Vercel pausado (no borrado) 48h para rollback rápido. |
| pnpm + Turbo + Docker builds lentos en CI | Usar `turbo prune --docker` en multi-stage. Layer caching de pnpm con `pnpm fetch`. |

---

## Verificación end-to-end (smoke test estándar)

Ejecutar después de cada fase, antes de marcar como completada:

1. Login con usuario existente
2. Crear customer, product, quotation, invoice, expense
3. Editar y eliminar uno de cada
4. Descargar PDF de invoice y quotation
5. Asistente AI: enviar mensaje, recibir respuesta (streaming)
6. Extracción de gasto: subir foto de recibo, confirmar campos extraídos
7. Verificar `Authorization` header se propaga correctamente web→api
8. Intentar acceso cross-tenant (con sesión de business A, query de business B) → debe fallar
9. `pnpm -r test` verde
10. Logs en Sentry y Axiom muestran actividad sin errores no esperados
