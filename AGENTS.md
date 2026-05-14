<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

<!-- BEGIN:crm-docs -->

## Descripción

CRM inmobiliario operacional. Sigue leads (compradores) y propietarios en captación, con activities como núcleo de ejecución diaria. Sin kanban decorativo — prioriza bandeja de trabajo sobre dashboards.

## Stack

- **Next.js 16** con `'use client'`
- **Supabase** (auth, base de datos PostgreSQL)
- **TypeScript** estricto
- **Inline styles** — sin Tailwind, CSS modules ni librería de componentes

## Archivos clave

| Archivo | Rol |
|---|---|
| `src/app/page.tsx` | Única página. `Home` → `AuthGate` → `CRMApp`. Contiene inline: `AccionesLead`, `AccionesPropietario`, `OppCard`, `ActivityCard`, `TimelineItem`, `Seccion`, `VistaHoy/Leads/Propietarios` |
| `src/hooks/useOpportunities.ts` | Hook monolítico: carga opps, activities, properties; CRUD de oportunidades, stages, captación; completar actividad. ~295 líneas |
| `src/hooks/useTimeline.ts` | Hook de historial: timeline por opportunity, registro manual de actividad. ~92 líneas |
| `src/lib/crm/types.ts` | Tipos `Contact`, `Property`, `Opportunity` |
| `src/lib/crm/stages.ts` | `STAGES_LEAD` (6), `STAGES_PROPIETARIO` (5), `STAGE_LABEL` |
| `src/lib/crm/scoring.ts` | Motor de scoring: `getScore()` (0-100+), `getCalor()` (color), `getLastActivity()`, `getOverdueActivities()`, `getDaysSinceLastActivity()` |
| `src/lib/crm/dates.ts` | `getFecha()` (offset días), `estaVencido()`, `estaHoy()` |
| `src/lib/crm/messages.ts` | Plantillas WhatsApp por stage/pipeline |
| `src/lib/crm/styles.ts` | `COLORS`, `btnStyle()`, estilos base, helpers de layout |
| `src/lib/supabase.ts` | Cliente Supabase singleton desde env vars |
| `src/components/AuthGate.tsx` | Wrapper de autenticación: login form o renderiza children con `User` |

## Schema Supabase (deducido del código)

### `opportunities`
```
id: uuid PK
contact_id: uuid → contacts.id
property_id: uuid? → properties.id
stage: string (ver stages.ts)
pipeline_type: 'lead' | 'propietario'
next_action_date: timestamp?
visit_date: timestamp?
follow_up_count: int
status: string? ('active', 'paused', 'won', 'lost')
user_id: uuid
```

### `contacts`
```
id: uuid PK
nombre: string
telefono: string
user_id: uuid
```

### `properties`
```
id: uuid PK
nombre: string
precio: numeric
distrito: string
tipo, operacion, estado, moneda: string
propietario_id: uuid? → contacts.id
user_id: uuid
```

### `activities`
```
id: uuid PK
opportunity_id: uuid → opportunities.id
type: string ('call', 'whatsapp', 'visit', 'meeting', 'email', 'note')
channel: string ('whatsapp', 'phone', 'none')
result: string (ver RESULTADOS en page.tsx)
status: string ('pending', 'completed')
scheduled_at: timestamp?
completed_at: timestamp?
note: string?
priority: int?
user_id: uuid
updated_at: timestamp?
```

## Lógica de negocio

### Pipeline Lead (compradores)
```
Contactado → Interesado → Visita → Seguimiento → Cerrado
                                       ↘ Perdido
```
- **Contactado**: primer contacto, se envió WhatsApp
- **Interesado**: respondió, hay interés
- **Visita**: agendó visita presencial
- **Seguimiento**: post-visita, negociación
- **Cerrado**: compró | **Perdido**: descartó

### Pipeline Propietario (captación)
```
Contactado → Tasación → Seguimiento → Captado
                              ↘ No captado
```
- **Contactado**: primer contacto
- **Tasación**: se agendó tasación del inmueble
- **Seguimiento**: post-tasación, negociación
- **Captado**: aceptó | **No captado**: rechazó

### Scoring
- Score base según stage (20-50 pts)
- +40 si hay activities vencidas
- +25 si hay activities pendientes hoy
- +35 si hay visita hoy o próxima (7d)
- -15/-30 si inactividad >7d/>14d
- +5 por cada follow_up
- -100 si status no es active
- +30/20 si next_action_date vencido/próximo 24h

## Arquitectura operacional

### Núcleo: activities, no next_action_date

El CRM migró de un modelo **opp-centric** (centrado en `next_action_date` de la oportunidad) a un modelo **task-driven** (centrado en `activities` con `scheduled_at`).

**Antes:** VistaHoy mostraba oportunidades con `next_action_date` próxima. Mezclaba estado comercial con ejecución diaria.
**Ahora:** VistaHoy es una **bandeja de trabajo** basada en `pendingActivities` (status = 'pending'). La oportunidad es contexto de la actividad, no el eje.

### VistaHoy — 5 secciones operacionales

Cada sección itera `activities` (no opps). Cada actividad se renderiza con `ActivityCard` inline.

```
⚠️ Vencidas recientes (≤7d)  → scheduled_at < inicioHoy, >= hace7d
💀 Abandonadas (>7d)         → scheduled_at < hace7d
🔥 Hoy                       → scheduled_at entre inicioHoy y finHoy
🕐 Próximas (máx 5)          → scheduled_at > finHoy, ordenado ascendente
💤 Sin próxima acción        → opps activas sin ninguna pending activity
```

### Acciones operacionales

- **✅ Completar**: marca `status = 'completed'` + `completed_at`. NO cambia stage, NO crea actividad nueva.
- **📅 Reagendar**: cambia `scheduled_at`. La card se mueve de sección automáticamente.
- **📋 Timeline**: modal con historial completo de activities de la opportunity, separado pendientes/completadas.
- **➕ Quick add**: crea actividad sin pedir stage/resultado. Solo tipo, fecha, nota.

### Flujo de datos
```
AuthGate → login → CRMApp(userId)
  ├── useOpportunities(userId) → opps, activities, properties, CRUD
  └── useTimeline(cargarActivities) → timeline, registro, modal
CRMApp → VistaHoy/Leads/Propietarios
```

## Restricciones (NO tocar sin discutir)

- **NO** refactorizar hooks (`useOpportunities`, `useTimeline`) — son monolíticos intencionalmente hasta estabilizar núcleo
- **NO** tocar `src/lib/crm/` — lógica de negocio estable
- **NO** reorganizar estructura de archivos — los componentes inline se extraerán cuando el núcleo esté estable
- **NO** auto-generar actividad nueva al completar una — la ejecución real no sigue patrones forzados
- **NO** cambiar stage/pipeline al completar una actividad — contextos separados
- **NO** usar Tailwind o CSS modules — mantener inline styles
- **NO** migrar a RSC — toda la app es client-side

## Estado de page.tsx

~1340 líneas, toda la UI del CRM en un solo archivo. Componentes inline pendientes de extraer a `src/components/` cuando el núcleo esté estable:

| Componente | Aprox líneas | Uso |
|---|---|---|
| `AccionesLead` | 60 | Botones de stage para pipeline lead |
| `AccionesPropietario` | 60 | Botones de stage para pipeline propietario |
| `OppCard` | 70 | Card de oportunidad (VistaLeads/VistaPropietarios) |
| `ActivityCard` | 55 | Card de actividad (VistaHoy) |
| `TimelineItem` | 35 | Item de historial |
| `Seccion` | 12 | Wrapper colapsable de sección |
| `VistaHoy` | 100 | Bandeja operacional de 5 secciones |
| `VistaLeads` | 30 | Pipeline view compradores |
| `VistaPropietarios` | 30 | Pipeline view propietarios |

<!-- END:crm-docs -->
