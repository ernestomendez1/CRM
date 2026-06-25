<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Plan de implementación activo

Este proyecto está en migración de Vercel → Railway y reestructura a monorepo (apps/web Next.js + apps/api Hono). El plan completo, dividido en fases con checkboxes, vive en `docs/IMPLEMENTATION_PLAN.md`.

**Antes de hacer cambios estructurales** (mover archivos, agregar dependencias, modificar Dockerfiles, tocar Railway/Supabase config): lee `docs/IMPLEMENTATION_PLAN.md` para saber en qué fase estamos y qué decisiones de arquitectura ya están tomadas.

**Cuando completes una tarea del plan**: marca el checkbox correspondiente como `[x]`, actualiza el `Status` de la fase si cambia (⏳/🔄/✅), y agrega una entrada breve en la sección "Notas de ejecución" de esa fase si hubo desviación o decisión relevante.

**Cuando el usuario pida "sigamos con Fase X"**: lee el documento, identifica el primer checkbox sin marcar de esa fase, ejecútalo, marca y continúa.
