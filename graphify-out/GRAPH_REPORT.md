# Graph Report - roca-core  (2026-05-13)

## Corpus Check
- 22 files · ~10,399 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 120 nodes · 143 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d85cae8f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `This is NOT the Next.js you know` - 10 edges
2. `getScore()` - 8 edges
3. `supabase` - 7 edges
4. `Schema Supabase (deducido del código)` - 5 edges
5. `Arquitectura operacional` - 5 edges
6. `CRMApp()` - 4 edges
7. `Lógica de negocio` - 4 edges
8. `getLastActivity()` - 3 edges
9. `getDaysSinceLastActivity()` - 3 edges
10. `useTimeline()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `CRMApp()` --calls--> `useTimeline()`  [EXTRACTED]
  src/app/page.tsx → src/hooks/useTimeline.ts
- `CRMApp()` --calls--> `useOpportunities()`  [EXTRACTED]
  src/app/page.tsx → src/hooks/useOpportunities.ts

## Communities (14 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (20): btnStyle(), CRMApp(), inputStyle, PipelineType, rowStyle, secTitle, Vista, estaHoy() (+12 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (8): buttonColors, ButtonVariant, COLORS, contentStyle, emptyStateStyle, inputStyle, rowStyle, secTitle

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (13): Archivos clave, code:block5 (Contactado → Interesado → Visita → Seguimiento → Cerrado), code:block6 (Contactado → Tasación → Seguimiento → Captado), Descripción, Estado de page.tsx, graphify, Lógica de negocio, Pipeline Lead (compradores) (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.23
Nodes (3): btnStyle, inputStyle, supabase

### Community 4 - "Community 4"
Cohesion: 0.36
Nodes (9): getCalor(), getDaysSinceLastActivity(), getLastActivity(), getOverdueActivities(), getPendingActivities(), getScore(), getUpcomingVisits(), isVisitToday() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (9): `activities`, code:block1 (id: uuid PK), code:block2 (id: uuid PK), code:block3 (id: uuid PK), code:block4 (id: uuid PK), `contacts`, `opportunities`, `properties` (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.25
Nodes (5): { createClient }, fs, path, supabase, tables

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (7): Acciones operacionales, Arquitectura operacional, code:block7 (⚠️ Vencidas recientes (≤7d)  → scheduled_at < inicioHoy, >= ), code:block8 (AuthGate → login → CRMApp(userId)), Flujo de datos, Núcleo: activities, no next_action_date, VistaHoy — 5 secciones operacionales

### Community 8 - "Community 8"
Cohesion: 0.4
Nodes (3): geistMono, geistSans, metadata

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **49 isolated node(s):** `nextConfig`, `eslintConfig`, `config`, `path`, `{ createClient }` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `This is NOT the Next.js you know` connect `Community 2` to `Community 5`, `Community 7`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `Schema Supabase (deducido del código)` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `Arquitectura operacional` connect `Community 7` to `Community 2`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `nextConfig`, `eslintConfig`, `config` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._