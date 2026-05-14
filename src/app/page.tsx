'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { STAGES_LEAD, STAGES_PROPIETARIO, STAGE_LABEL } from '../lib/crm/stages'
import AuthGate from '../components/AuthGate'
import { getFecha, estaHoy, estaVencido } from '../lib/crm/dates'
import { getMensaje, getTipoMensaje } from '../lib/crm/messages'
import { getScore, getCalor } from '../lib/crm/scoring'
import type { Opportunity } from '../lib/crm/types'
import { useOpportunities } from '../hooks/useOpportunities'
import { useTimeline } from '../hooks/useTimeline'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type PipelineType = 'lead' | 'propietario'
type Vista = 'hoy' | 'leads' | 'propietarios'

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Home() {
  return (
    <AuthGate>
      {(user) => <CRMApp userId={user.id} />}
    </AuthGate>
  )
}

function CRMApp({ userId }: { userId: string }) {
  const [vista, setVista] = useState<Vista>('hoy')

  // Hooks
  const { 
    opps, properties, activities, pendingActivities, loading, 
    cargarOpps, cargarActivities, crearOpp, actualizarStage, completarCaptacion, completarActividad, getOppWithPendingActivities 
  } = useOpportunities(userId)

  const { 
    timeline, timelineOpen, selectedOpp, loading: timelineLoading,
    cargarTimeline, abrirTimeline, cerrarTimeline, registrarActividad 
  } = useTimeline(cargarActivities)

  // Form crear
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [pipelineNuevo, setPipelineNuevo] = useState<PipelineType>('lead')
  const [stageInicial, setStageInicial] = useState('Contactado')
  const [mostrarForm, setMostrarForm] = useState(false)

  // Programador de acción
  const [oppActiva, setOppActiva] = useState<any>(null)
  const [eventoActivo, setEventoActivo] = useState('')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [nota, setNota] = useState('')

  // Modal actividad manual
  const [mostrarModalActividad, setMostrarModalActividad] = useState(false)
  const [actividadOpp, setActividadOpp] = useState<any>(null)
  const [tipoActividad, setTipoActividad] = useState('call')
  const [resultadoActividad, setResultadoActividad] = useState('')
  const [notaActividad, setNotaActividad] = useState('')
  const [fechaActividad, setFechaActividad] = useState('')

  // Modal captación propietario
  const [mostrarModalCaptacion, setMostrarModalCaptacion] = useState(false)
  const [captacionOpp, setCaptacionOpp] = useState<any>(null)
  const [captarModo, setCaptarModo] = useState<'crear' | 'vincular'>('crear')
  const [propiedadNombre, setPropiedadNombre] = useState('')
  const [propiedadPrecio, setPropiedadPrecio] = useState('')
  const [propiedadDistrito, setPropiedadDistrito] = useState('')
  const [propiedadIdSeleccionada, setPropiedadIdSeleccionada] = useState('')

  // Reagendar
  const [loadingActivity, setLoadingActivity] = useState<string | null>(null)
  const [reagendarActId, setReagendarActId] = useState<string | null>(null)
  const [reagendarFecha, setReagendarFecha] = useState('')

  // Quick add
  const [quickAddOpp, setQuickAddOpp] = useState<any>(null)

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const ICONO_TYPE: Record<string, string> = {
    'call': '📞',
    'whatsapp': '📱', 
    'visit': '🏠',
    'meeting': '🤝',
    'email': '📧',
    'note': '📝'
  }

  const TIPOS_ACTIVIDAD = [
    { value: 'call', label: '📞 Llamada' },
    { value: 'whatsapp', label: '📱 WhatsApp' },
    { value: 'visit', label: '🏠 Visita' },
    { value: 'meeting', label: '🤝 Reunión' },
    { value: 'email', label: '📧 Email' },
    { value: 'note', label: '📝 Nota' },
  ]

  const RESULTADOS = [
    { value: 'respondio', label: '✓ Respondió' },
    { value: 'no_respondio', label: '✕ No respondió' },
    { value: 'reagendo', label: '📅 Reagendó' },
    { value: 'interesado', label: '💡 Interesado' },
    { value: 'sin_interes', label: '😴 Sin interés' },
    { value: 'confirmo_visita', label: '✅ Confirmó visita' },
  ]

  // ── Activity map visual ────────────────────────────────────────────────────

  const ACTIVITY_LABELS: Record<string, string> = {
    call: '📞 Llamada', whatsapp: '📱 WhatsApp',
    visit: '🏠 Visita', meeting: '🤝 Reunión',
    email: '📧 Email', note: '📝 Nota',
  }

  const ACTIVITY_COLORS: Record<string, string> = {
    call: '#3b82f6', whatsapp: '#22c55e',
    visit: '#a855f7', meeting: '#f97316',
    email: '#64748b', note: '#94a3b8',
  }

  const formatFecha = (f: string) => {
    const d = new Date(f)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(diff / 3600000)
    const dias = Math.floor(diff / 86400000)

    const precisa = d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

    if (mins < 1) return `${precisa} (ahora)`
    if (hrs < 1) return `${precisa} (hace ${mins}m)`
    if (hrs < 24) return `${precisa} (hace ${hrs}h)`
    if (dias === 1) return `${precisa} (ayer)`
    if (dias < 30) return `${precisa} (hace ${dias}d)`
    return precisa
  }

  const getTiempoRelativo = (fecha: string) => {
    if (!fecha) return ''
    const ahora = new Date()
    const actFecha = new Date(fecha)
    const diffMs = ahora.getTime() - actFecha.getTime()
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDias = Math.floor(diffHrs / 24)
    if (diffHrs < 1) return 'ahora'
    if (diffHrs < 24) return `${diffHrs}h`
    if (diffDias === 1) return 'ayer'
    if (diffDias < 7) return `${diffDias}d`
    return actFecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
  }

  // ── Carga de datos - ya manejada por hooks ─────────────────────────────────

  useEffect(() => {
    setStageInicial('Contactado')
  }, [pipelineNuevo])

  // ── Crear oportunidad ───────────────────────────────────────────────────────

  const handleCrearOpp = async () => {
    await crearOpp({
      nombre,
      telefono,
      pipeline: pipelineNuevo,
      propertyId,
      stageInicial,
    })

    setNombre('')
    setTelefono('')
    setPropertyId('')
    setMostrarForm(false)
  }

  // ── Captación de propietario (UI handlers) ─────────────────────────────────

  const handleIniciarCaptacion = (opp: Opportunity) => {
    if (opp.property_id) {
      completarCaptacion({ opp, propiedadId: opp.property_id, propiedadIdSeleccionada: '', captarModo: 'crear' })
    } else {
      setCaptacionOpp(opp)
      setCaptarModo('crear')
      setPropiedadNombre('')
      setPropiedadPrecio('')
      setPropiedadDistrito('')
      setPropiedadIdSeleccionada('')
      setMostrarModalCaptacion(true)
    }
  }

  const handleCompletarCaptacion = async (nuevaPropiedadId: string | null) => {
    if (!captacionOpp) return
    
    await completarCaptacion({ 
      opp: captacionOpp, 
      propiedadId: nuevaPropiedadId, 
      propiedadIdSeleccionada: propiedadIdSeleccionada,
      captarModo 
    })
    
    setMostrarModalCaptacion(false)
    setCaptacionOpp(null)
  }

  // ── Actualizar stage (UI handler) ───────────────────────────────────────────

  const handleActualizarStage = async (opp: Opportunity, nuevoStage: string, fecha?: string) => {
    await actualizarStage({ opp, nuevoStage, fecha, nota })
    setOppActiva(null)
    setNota('')
  }

  const abrirProgramador = (opp: Opportunity, evento: string) => {
    setOppActiva(opp)
    setEventoActivo(evento)
    setNota('')
    setFechaSeleccionada(getFecha(1))
  }

  const guardarAccion = async () => {
    if (!oppActiva || !fechaSeleccionada) return
    await actualizarStage({ opp: oppActiva, nuevoStage: eventoActivo, fecha: fechaSeleccionada, nota })
  }

  const handleRegistrarActividad = async () => {
    if (!actividadOpp || !tipoActividad || !resultadoActividad) return
    
    await registrarActividad({
      opp: actividadOpp,
      tipo: tipoActividad,
      resultado: resultadoActividad,
      nota: notaActividad,
      fecha: fechaActividad,
    })
    
    setMostrarModalActividad(false)
    setActividadOpp(null)
    setTipoActividad('call')
    setResultadoActividad('')
    setNotaActividad('')
    setFechaActividad('')
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────

  const leads = opps.filter(o => (o.pipeline_type || 'lead') === 'lead')
  const propietarios = opps.filter(o => o.pipeline_type === 'propietario')

  // ── Fuente operacional única (activities) ──────────────────────────────────

  const oppMap = useMemo(() => Object.fromEntries(opps.map(o => [o.id, o])), [opps])

  const ahora = new Date()
  const inicioHoy = new Date(ahora); inicioHoy.setHours(0,0,0,0)
  const finHoy = new Date(ahora); finHoy.setHours(23,59,59,999)
  const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)

  const pendingOnly = activities.filter(a => a.status === 'pending')
  const pendingScheduled = pendingOnly
    .filter(a => a.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  const vencidasRecientes = pendingScheduled.filter(a =>
    new Date(a.scheduled_at!) < inicioHoy &&
    new Date(a.scheduled_at!) >= hace7d
  )
  const abandonadas = pendingScheduled.filter(a =>
    new Date(a.scheduled_at!) < hace7d
  )
  const hoyAct = pendingScheduled.filter(a =>
    new Date(a.scheduled_at!) >= inicioHoy &&
    new Date(a.scheduled_at!) <= finHoy
  )
  const proximas = pendingScheduled.filter(a =>
    new Date(a.scheduled_at!) > finHoy
  ).slice(0, 5)

  const sinProgramar = pendingOnly.filter(a => !a.scheduled_at)

  const oppsSinActividad = opps.filter(o =>
    (o.status || 'active') === 'active' &&
    !pendingOnly.some(a =>
      a.opportunity_id === o.id
    )
  )

  console.log('[CRM ops]', {
    totalActivities: activities.length,
    pendingOnly: pendingOnly.length,
    vencidasRecientes: vencidasRecientes.length,
    abandonadas: abandonadas.length,
    hoyAct: hoyAct.length,
    proximas: proximas.length,
    sinProgramar: sinProgramar.length,
    oppsSinActividad: oppsSinActividad.length,
  })

  // ── Helper para activity → opp (con guardia contra huérfanas) ─────────────

  const getOppForActivity = (a: any) => oppMap[a.opportunity_id] ?? null

  const ordenar = (arr: any[], activitiesData: any[]) => [...arr].sort((a, b) => getScore(b, activitiesData) - getScore(a, activitiesData))

  // ── Completar + Reagendar ─────────────────────────────────────────────────

  const handleCompletarActividad = async (activityId: string, oppId: string) => {
    setLoadingActivity(activityId)
    try {
      const { error } = await supabase
        .from('activities')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', activityId)
      if (error) { alert(`Error al completar: ${error.message}`); return }

      await cargarActivities()
      if (selectedOpp?.id === oppId) cargarTimeline(oppId)
    } finally {
      setLoadingActivity(null)
    }
  }

  const reagendarActividad = async (activityId: string, nuevaFecha: string) => {
    setLoadingActivity(activityId)
    try {
      const { error } = await supabase
        .from('activities')
        .update({
          scheduled_at: new Date(nuevaFecha).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activityId)
      if (error) { alert(`Error al reagendar: ${error.message}`); return }

      await cargarActivities()
      setReagendarActId(null)
    } finally {
      setLoadingActivity(null)
    }
  }

  const abrirReagendar = (activityId: string) => {
    setReagendarActId(activityId)
    setReagendarFecha(getFecha(1))
  }

  const handleQuickAdd = async () => {
    if (!quickAddOpp || !tipoActividad) return
    setLoadingActivity('quickAdd')
    try {
      await registrarActividad({
        opp: quickAddOpp,
        tipo: tipoActividad,
        resultado: '',
        nota: notaActividad,
        fecha: fechaActividad,
      })
      setQuickAddOpp(null)
      setTipoActividad('call')
      setNotaActividad('')
      setFechaActividad('')
    } finally {
      setLoadingActivity(null)
    }
  }

  // ── Acciones por stage ──────────────────────────────────────────────────────

  const AccionesLead = ({ opp }: { opp: Opportunity }) => {
    const tel = opp.contacts?.telefono
    const urlWA = `https://wa.me/51${tel}?text=${encodeURIComponent(getMensaje(opp, getTipoMensaje(opp)))}`

    const BtnWA = () => (
      <a href={urlWA} target="_blank">
        <button style={btnStyle('green')}>📱 WA</button>
      </a>
    )
    const BtnCall = () => (
      <a href={`tel:+51${tel}`}>
        <button style={btnStyle('blue')}>📞</button>
      </a>
    )

    switch (opp.stage) {
      case 'Contactado':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Interesado')}>💬 Interesado</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage({ opp, nuevoStage: 'Perdido' })}>✕</button>
          </div>
        )
      case 'Interesado':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>✓ Seguimiento</button>
            <button style={btnStyle('purple')} onClick={() => abrirProgramador(opp, 'Visita')}>📅 Agendar visita</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage({ opp, nuevoStage: 'Perdido' })}>✕</button>
          </div>
        )
      case 'Visita':
        return (
          <div style={rowStyle}>
            {opp.visit_date && (
              <span style={{ fontSize: 11, color: '#64748b', marginRight: 'auto' }}>
                📅 {new Date(opp.visit_date).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
            <BtnWA />
            <button style={btnStyle('purple')} onClick={() => abrirProgramador(opp, 'Visita')}>📅 Reagendar</button>
            <button style={btnStyle('green')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>✅ Realizada</button>
            <button style={btnStyle('gray')} onClick={() => actualizarStage({ opp, nuevoStage: 'Interesado' })}>❌ No vino</button>
          </div>
        )
      case 'Seguimiento':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('green')} onClick={() => actualizarStage({ opp, nuevoStage: 'Cerrado' })}>🎉 Cerrar</button>
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>⏳ Pendiente</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage({ opp, nuevoStage: 'Perdido' })}>✕</button>
          </div>
        )
      default:
        return null
    }
  }

  const AccionesPropietario = ({ opp }: { opp: Opportunity }) => {
    const tel = opp.contacts?.telefono
    const urlWA = `https://wa.me/51${tel}?text=${encodeURIComponent(getMensaje(opp, getTipoMensaje(opp)))}`

    const BtnWA = () => (
      <a href={urlWA} target="_blank">
        <button style={btnStyle('green')}>📱 WA</button>
      </a>
    )
    const BtnCall = () => (
      <a href={`tel:+51${tel}`}>
        <button style={btnStyle('blue')}>📞</button>
      </a>
    )

    switch (opp.stage) {
      case 'Contactado':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('purple')} onClick={() => abrirProgramador(opp, 'Tasación')}>📊 Tasación</button>
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Contactado')}>↩ Reintentar</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage({ opp, nuevoStage: 'No captado' })}>✕</button>
          </div>
        )
      case 'Tasación':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>🔄 Seguimiento</button>
            <button style={btnStyle('green')} onClick={() => handleIniciarCaptacion(opp)}>🎉 Captado</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage({ opp, nuevoStage: 'No captado' })}>✕</button>
          </div>
        )
      case 'Seguimiento':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('green')} onClick={() => handleIniciarCaptacion(opp)}>🎉 Captado</button>
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>↩ Reintentar</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage({ opp, nuevoStage: 'No captado' })}>✕</button>
          </div>
        )
      default:
        return null
    }
  }

  // ── Card de oportunidad ─────────────────────────────────────────────────────

  const OppCard = ({ opp, activities: acts }: { opp: any, activities: any[] }) => {
    const score = getScore(opp, acts)
    const vencido = estaVencido(opp)
    const esProp = opp.pipeline_type === 'propietario'

    return (
      <div style={{
        background: vencido ? '#fff5f5' : '#fff',
        border: `1px solid ${vencido ? '#fecaca' : '#e2e8f0'}`,
        borderLeft: `3px solid ${getCalor(score)}`,
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <strong style={{ fontSize: 14 }}>{opp.contacts?.nombre}</strong>
            {opp.status && opp.status !== 'active' && (
              <span style={{ fontSize: 10, marginLeft: 6, color: opp.status === 'paused' ? '#f59e0b' : '#94a3b8' }}>
                {opp.status === 'paused' ? '⏸️' : opp.status === 'won' ? '✅' : opp.status === 'lost' ? '❌' : opp.status}
              </span>
            )}
            {!esProp && opp.properties && (
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                {opp.properties?.nombre} · {opp.properties?.precio}
              </span>
            )}
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {STAGE_LABEL[opp.stage] || opp.stage}
              {opp.next_action_date && (
                <span style={{ marginLeft: 8, color: vencido ? '#ef4444' : '#64748b' }}>
                  {vencido ? '⚠️ ' : '🕐 '}
                  {new Date(opp.next_action_date).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              )}
            </div>
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: getCalor(score), flexShrink: 0, marginTop: 4
          }} />
        </div>
        <div style={{ marginTop: 8 }}>
          {esProp
            ? <AccionesPropietario opp={opp} />
            : <AccionesLead opp={opp} />
          }
        </div>
        <div style={{ marginTop: 6, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
          <button 
            onClick={() => {
              setActividadOpp(opp)
              setMostrarModalActividad(true)
              setTipoActividad('call')
              setResultadoActividad('')
              setNotaActividad('')
              setFechaActividad('')
            }}
            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            ➕ Registrar actividad
          </button>
        </div>
      </div>
    )
  }

  // ── Activity Card (inline, solo para VistaHoy) ─────────────────────────────

  const ActivityCard = ({ activity }: { activity: any }) => {
    const opp = getOppForActivity(activity)
    if (!opp) return null

    const contact = opp.contacts
    const property = opp.properties
    const color = ACTIVITY_COLORS[activity.type] || '#94a3b8'

    return (
      <div style={{
        borderLeft: `3px solid ${color}`,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {ACTIVITY_LABELS[activity.type] || activity.type}
          {activity.result && <span style={{ fontWeight: 400, color: '#64748b' }}> · {activity.result}</span>}
        </div>
        <div style={{ fontSize: 12, color: '#0f172a', marginTop: 2 }}>
          👤 {contact?.nombre || 'Sin nombre'}
        </div>
        {property && (
          <div style={{ fontSize: 11, color: '#64748b' }}>
            🏠 {property.nombre}{property.precio ? ` · ${property.precio}` : ''}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          {activity.scheduled_at ? formatFecha(activity.scheduled_at) : 'Sin programar'}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button
            onClick={() => handleCompletarActividad(activity.id, activity.opportunity_id)}
            disabled={loadingActivity === activity.id}
            style={{ ...btnStyle('green'), fontSize: 11, padding: '3px 8px', opacity: loadingActivity === activity.id ? 0.5 : 1 }}
          >✅ {loadingActivity === activity.id ? '...' : 'Completar'}</button>
          {activity.scheduled_at && (
            <button
              onClick={() => abrirReagendar(activity.id)}
              disabled={loadingActivity === activity.id}
              style={{ ...btnStyle('gray'), fontSize: 11, padding: '3px 8px', opacity: loadingActivity === activity.id ? 0.5 : 1 }}
            >📅 Reagendar</button>
          )}
          <button
            onClick={() => abrirTimeline(opp)}
            disabled={loadingActivity === activity.id}
            style={{ ...btnStyle('gray'), fontSize: 11, padding: '3px 8px', opacity: loadingActivity === activity.id ? 0.5 : 1 }}
          >📋</button>
        </div>
      </div>
    )
  }

  // ── Sección colapsable ──────────────────────────────────────────────────────

  const Seccion = ({ icon, label, count, children, color }: {
    icon: string; label: string; count: number; children: React.ReactNode; color?: string
  }) => {
    if (count === 0) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ ...secTitle, color: color || '#64748b', marginBottom: 8 }}>
          {icon} {label} ({count})
        </h3>
        {children}
      </div>
    )
  }

  // ── Timeline Item (inline, para modal) ─────────────────────────────────────

  const TimelineItem = ({ activity }: { activity: any }) => {
    const color = ACTIVITY_COLORS[activity.type] || '#94a3b8'
    const label = ACTIVITY_LABELS[activity.type] || activity.type
    return (
      <div style={{
        borderLeft: `3px solid ${color}`,
        background: activity.status === 'completed' ? '#fafafa' : '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 6,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {label}
          {activity.result && <span style={{ fontWeight: 400, color: '#64748b' }}> · {activity.result}</span>}
        </div>
        {activity.note && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, fontStyle: 'italic' }}>
            “{activity.note}”
          </div>
        )}
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
          <span>{activity.scheduled_at ? formatFecha(activity.scheduled_at) : '—'}</span>
          <span style={{
            color: activity.status === 'completed' ? '#22c55e' : '#f97316',
            fontWeight: 600,
          }}>
            {activity.status === 'completed' ? 'Completada' : 'Pendiente'}
          </span>
        </div>
      </div>
    )
  }

  // ── Vista HOY ───────────────────────────────────────────────────────────────

  const VistaHoy = () => {
    const totalPendientes = pendingOnly.length
    const totalVencidas = vencidasRecientes.length + abandonadas.length

    return (
      <div>
        {/* Resumen numérico */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8, marginBottom: 16
        }}>
          {[
            { label: 'Pendientes', val: totalPendientes, color: totalPendientes > 0 ? '#ef4444' : '#22c55e', icon: '🔥' },
            { label: 'Vencidas', val: totalVencidas, color: totalVencidas > 0 ? '#f97316' : '#94a3b8', icon: '⚠️' },
            { label: 'Propietarios', val: propietarios.length, color: '#8b5cf6', icon: '🏠' },
            { label: 'Compradores', val: leads.length, color: '#3b82f6', icon: '👥' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '10px 8px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.icon} {s.val}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <Seccion icon="⚠️" label="Vencidas recientes" count={vencidasRecientes.length} color="#ef4444">
          {vencidasRecientes.map(a => <ActivityCard key={a.id} activity={a} />)}
        </Seccion>

        <Seccion icon="💀" label="Abandonadas" count={abandonadas.length} color="#94a3b8">
          {abandonadas.map(a => <ActivityCard key={a.id} activity={a} />)}
        </Seccion>

        <Seccion icon="🔥" label="Hoy" count={hoyAct.length} color="#f97316">
          {hoyAct.map(a => <ActivityCard key={a.id} activity={a} />)}
        </Seccion>

        <Seccion icon="🕐" label="Próximas" count={proximas.length} color="#3b82f6">
          {proximas.map(a => <ActivityCard key={a.id} activity={a} />)}
        </Seccion>

        <Seccion icon="💤" label="Sin próxima acción" count={oppsSinActividad.length} color="#64748b">
          {oppsSinActividad.map(opp => (
            <div key={opp.id} style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '10px 12px', marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{opp.contacts?.nombre || 'Sin nombre'}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {STAGE_LABEL[opp.stage] || opp.stage}
                {opp.pipeline_type === 'propietario' && ' 🏠'}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {opp.contacts?.telefono && (
                  <>
                    <a href={`https://wa.me/51${opp.contacts.telefono}?text=${encodeURIComponent(getMensaje(opp, getTipoMensaje(opp)))}`} target="_blank">
                      <button style={btnStyle('green')}>📱 WA</button>
                    </a>
                    <a href={`tel:+51${opp.contacts.telefono}`}>
                      <button style={btnStyle('blue')}>📞</button>
                    </a>
                  </>
                )}
                <button
                  onClick={() => {
                    setQuickAddOpp(opp)
                    setTipoActividad('call')
                    setNotaActividad('')
                    setFechaActividad('')
                  }}
                  style={btnStyle('purple')}
                >➕ Agendar</button>
              </div>
            </div>
          ))}
        </Seccion>

        {totalPendientes === 0 && oppsSinActividad.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <p style={{ marginTop: 8 }}>Todo al día — sin trabajo pendiente</p>
          </div>
        )}
      </div>
    )
  }

  // ── Vista Leads ─────────────────────────────────────────────────────────────

  const VistaLeads = () => {
    const porStage = STAGES_LEAD.filter(s => s !== 'Cerrado' && s !== 'Perdido')
    return (
      <div>
        {porStage.map(stage => {
          const grupo = leads.filter(o => o.stage === stage)
          if (grupo.length === 0) return null
          return (
            <div key={stage} style={{ marginBottom: 16 }}>
              <h3 style={secTitle}>{STAGE_LABEL[stage] || stage} ({grupo.length})</h3>
              {ordenar(grupo, activities).map(o => <OppCard key={o.id} opp={o} activities={activities} />)}
            </div>
          )
        })}
        {leads.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 32 }}>📭</div>
            <p>Sin compradores activos</p>
          </div>
        )}
      </div>
    )
  }

  // ── Vista Propietarios ──────────────────────────────────────────────────────

  const VistaPropietarios = () => {
    const porStage = STAGES_PROPIETARIO.filter(s => s !== 'Captado' && s !== 'No captado')
    return (
      <div>
        {porStage.map(stage => {
          const grupo = propietarios.filter(o => o.stage === stage)
          if (grupo.length === 0) return null
          return (
            <div key={stage} style={{ marginBottom: 16 }}>
              <h3 style={secTitle}>{STAGE_LABEL[stage] || stage} ({grupo.length})</h3>
              {ordenar(grupo, activities).map(o => <OppCard key={o.id} opp={o} activities={activities} />)}
            </div>
          )
        })}
        {propietarios.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 32 }}>🏠</div>
            <p>Sin propietarios en captación</p>
          </div>
        )}
      </div>
    )
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: '#0f172a', color: '#fff', padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>CRM</span>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none',
            borderRadius: 6, padding: '6px 14px', fontSize: 14, cursor: 'pointer'
          }}
        >
          + Nuevo
        </button>
      </div>

      {/* Form crear */}
      {mostrarForm && (
        <div style={{
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => setPipelineNuevo('lead')}
              style={{
                ...btnStyle(pipelineNuevo === 'lead' ? 'blue' : 'ghost'),
                flex: 1, padding: '8px 0'
              }}
            >
              👥 Comprador
            </button>
            <button
              onClick={() => setPipelineNuevo('propietario')}
              style={{
                ...btnStyle(pipelineNuevo === 'propietario' ? 'purple' : 'ghost'),
                flex: 1, padding: '8px 0'
              }}
            >
              🏠 Propietario
            </button>
          </div>
          <input
            placeholder="Nombre *"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Teléfono *"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            style={inputStyle}
            type="tel"
          />
          {pipelineNuevo === 'lead' && (
            <select
              onChange={e => setPropertyId(e.target.value)}
              value={propertyId}
              style={inputStyle}
            >
              <option value="">Propiedad (opcional)</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          )}
          <select
            onChange={e => setStageInicial(e.target.value)}
            value={stageInicial}
            style={inputStyle}
          >
            {(pipelineNuevo === 'lead' ? STAGES_LEAD : STAGES_PROPIETARIO)
              .filter(s => s !== 'Cerrado' && s !== 'Perdido' && s !== 'Captado' && s !== 'No captado')
              .map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
          </select>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={handleCrearOpp} style={{ ...btnStyle('blue'), flex: 1, padding: '10px 0' }}>
              Crear
            </button>
            <button onClick={() => setMostrarForm(false)} style={{ ...btnStyle('ghost'), padding: '10px 16px' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky', top: 52, zIndex: 99
      }}>
        {([
          { key: 'hoy', label: '🔥 Hoy', badge: pendingOnly.length },
          { key: 'leads', label: '👥 Compradores', badge: leads.length },
          { key: 'propietarios', label: '🏠 Propietarios', badge: propietarios.length },
        ] as { key: Vista; label: string; badge: number }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setVista(tab.key)}
            style={{
              flex: 1, padding: '12px 4px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 12, fontWeight: vista === tab.key ? 700 : 400,
              color: vista === tab.key ? '#3b82f6' : '#64748b',
              borderBottom: vista === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                marginLeft: 4, background: vista === tab.key ? '#3b82f6' : '#e2e8f0',
                color: vista === tab.key ? '#fff' : '#64748b',
                borderRadius: 10, padding: '1px 6px', fontSize: 10
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ padding: '14px 16px', maxWidth: 680, margin: '0 auto' }}>
        {vista === 'hoy' && <VistaHoy />}
        {vista === 'leads' && <VistaLeads />}
        {vista === 'propietarios' && <VistaPropietarios />}
      </div>

      {/* Programador de acción (bottom sheet) */}
      {oppActiva && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '2px solid #0f172a',
          padding: 16, zIndex: 200,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 15 }}>
              {eventoActivo} — {oppActiva.contacts?.nombre}
            </strong>
            <button onClick={() => setOppActiva(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          <input
            type="datetime-local"
            value={fechaSeleccionada}
            onChange={e => setFechaSeleccionada(e.target.value)}
            step="300"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {[1, 2, 7].map(d => (
              <button key={d} onClick={() => setFechaSeleccionada(getFecha(d))} style={btnStyle('ghost')}>
                +{d}d
              </button>
            ))}
          </div>
          <input
            placeholder="Nota (opcional)"
            value={nota}
            onChange={e => setNota(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <button onClick={guardarAccion} style={{ ...btnStyle('blue'), width: '100%', padding: '12px 0', fontSize: 15 }}>
            Guardar
          </button>
        </div>
      )}

      {/* Modal Actividad Manual */}
      {mostrarModalActividad && actividadOpp && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '2px solid #3b82f6',
          padding: 16, zIndex: 200,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong style={{ fontSize: 15 }}>
              Nueva Actividad — {actividadOpp.contacts?.nombre}
            </strong>
            <button onClick={() => setMostrarModalActividad(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {TIPOS_ACTIVIDAD.map(t => (
              <button
                key={t.value}
                onClick={() => setTipoActividad(t.value)}
                style={{
                  ...btnStyle(tipoActividad === t.value ? 'blue' : 'ghost'),
                  padding: '6px 10px', fontSize: 12
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          
          <select
            value={resultadoActividad}
            onChange={e => setResultadoActividad(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          >
            <option value="">Seleccionar resultado...</option>
            {RESULTADOS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          
          <input
            type="datetime-local"
            value={fechaActividad}
            onChange={e => setFechaActividad(e.target.value)}
            step="300"
            style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="Programar para más tarde (opcional)"
          />
          
          <input
            placeholder="Nota adicional (opcional)"
            value={notaActividad}
            onChange={e => setNotaActividad(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          
          <button 
            onClick={handleRegistrarActividad}
            disabled={!tipoActividad || !resultadoActividad}
            style={{ 
              ...btnStyle('blue'), 
              width: '100%', 
              padding: '12px 0', 
              fontSize: 15,
              opacity: (!tipoActividad || !resultadoActividad) ? 0.5 : 1
            }}
          >
            Registrar
          </button>
        </div>
      )}

      {/* Reagendar bottom sheet */}
      {reagendarActId && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '2px solid #3b82f6',
          padding: 16, zIndex: 200,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 15 }}>📅 Reagendar actividad</strong>
            <button onClick={() => setReagendarActId(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          <input
            type="datetime-local"
            value={reagendarFecha}
            onChange={e => setReagendarFecha(e.target.value)}
            step="300"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {[1, 2, 7].map(d => (
              <button key={d} onClick={() => setReagendarFecha(getFecha(d))} style={btnStyle('ghost')}>
                +{d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => reagendarActividad(reagendarActId, reagendarFecha)}
            disabled={loadingActivity === reagendarActId}
            style={{ ...btnStyle('blue'), width: '100%', padding: '12px 0', fontSize: 15, opacity: loadingActivity === reagendarActId ? 0.5 : 1 }}
          >
            {loadingActivity === reagendarActId ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Timeline Modal */}
      {timelineOpen && selectedOpp && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '2px solid #0f172a',
          padding: 16, zIndex: 200,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          maxHeight: '60vh', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong style={{ fontSize: 15 }}>📋 Historial — {selectedOpp.contacts?.nombre || 'Sin nombre'}</strong>
            <button onClick={cerrarTimeline} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          {timelineLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Cargando...</div>
          ) : timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Sin actividades registradas</div>
          ) : (
            <>
              {timeline.filter(a => a.status === 'pending').length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#f97316', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⏳ Pendientes</div>
                  {timeline.filter(a => a.status === 'pending').map(a => <TimelineItem key={a.id} activity={a} />)}
                </>
              )}
              {timeline.filter(a => a.status === 'completed').length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✅ Completadas</div>
                  {timeline.filter(a => a.status === 'completed').map(a => <TimelineItem key={a.id} activity={a} />)}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Quick Add bottom sheet */}
      {quickAddOpp && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '2px solid #8b5cf6',
          padding: 16, zIndex: 200,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong style={{ fontSize: 15 }}>➕ Agendar actividad — {quickAddOpp.contacts?.nombre}</strong>
            <button onClick={() => setQuickAddOpp(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {TIPOS_ACTIVIDAD.map(t => (
              <button
                key={t.value}
                onClick={() => setTipoActividad(t.value)}
                style={{ ...btnStyle(tipoActividad === t.value ? 'blue' : 'ghost'), padding: '6px 10px', fontSize: 12 }}
              >{t.label}</button>
            ))}
          </div>

          <input
            type="datetime-local"
            value={fechaActividad}
            onChange={e => setFechaActividad(e.target.value)}
            step="300"
            style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="Programar (opcional)"
          />

          <input
            placeholder="Nota (opcional)"
            value={notaActividad}
            onChange={e => setNotaActividad(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          />

          <button
            onClick={handleQuickAdd}
            disabled={loadingActivity === 'quickAdd'}
            style={{ ...btnStyle('purple'), width: '100%', padding: '12px 0', fontSize: 15, opacity: loadingActivity === 'quickAdd' ? 0.5 : 1 }}
          >
            {loadingActivity === 'quickAdd' ? 'Guardando...' : 'Agendar'}
          </button>
        </div>
      )}

      {/* Modal Captación Propietario */}
      {mostrarModalCaptacion && captacionOpp && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '2px solid #8b5cf6',
          padding: 16, zIndex: 200,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          maxHeight: '80vh', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong style={{ fontSize: 15 }}>
              Captar propietario — {captacionOpp.contacts?.nombre}
            </strong>
            <button onClick={() => setMostrarModalCaptacion(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setCaptarModo('crear')}
              style={{ ...btnStyle(captarModo === 'crear' ? 'purple' : 'ghost'), flex: 1 }}
            >
              ➕ Crear propiedad
            </button>
            <button
              onClick={() => setCaptarModo('vincular')}
              style={{ ...btnStyle(captarModo === 'vincular' ? 'purple' : 'ghost'), flex: 1 }}
            >
              🔗 Vincular existente
            </button>
          </div>
          
          {captarModo === 'crear' ? (
            <>
              <input
                placeholder="Nombre de la propiedad *"
                value={propiedadNombre}
                onChange={e => setPropiedadNombre(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <input
                placeholder="Precio (ej: 150000)"
                value={propiedadPrecio}
                onChange={e => setPropiedadPrecio(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
                type="number"
              />
              <input
                placeholder="Distrito *"
                value={propiedadDistrito}
                onChange={e => setPropiedadDistrito(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <button 
                onClick={async () => {
                  if (!propiedadNombre || !propiedadDistrito) {
                    alert('Nombre y distrito son obligatorios')
                    return
                  }
                  const { data: nuevaProp } = await supabase.from('properties').insert([{
                    nombre: propiedadNombre,
                    precio: parseFloat(propiedadPrecio) || 0,
                    distrito: propiedadDistrito,
                    tipo: 'Departamento',
                    operacion: 'venta',
                    estado: 'disponible',
                    moneda: 'USD',
                    user_id: userId,
                  }]).select().single()
                  
                  if (nuevaProp) {
                    await handleCompletarCaptacion(nuevaProp.id)
                  }
                }}
                disabled={!propiedadNombre || !propiedadDistrito}
                style={{ 
                  ...btnStyle('purple'), 
                  width: '100%', 
                  padding: '12px 0', 
                  fontSize: 15,
                  opacity: (!propiedadNombre || !propiedadDistrito) ? 0.5 : 1
                }}
              >
                Crear y captar
              </button>
            </>
          ) : (
            <>
              <select
                value={propiedadIdSeleccionada}
                onChange={e => setPropiedadIdSeleccionada(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              >
                <option value="">Seleccionar propiedad...</option>
                {properties.filter(p => !p.propietario_id).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} — {p.distrito}</option>
                ))}
              </select>
              <button 
                onClick={async () => {
                  if (!propiedadIdSeleccionada) {
                    alert('Selecciona una propiedad')
                    return
                  }
                  await handleCompletarCaptacion(propiedadIdSeleccionada)
                }}
                disabled={!propiedadIdSeleccionada}
                style={{ 
                  ...btnStyle('purple'), 
                  width: '100%', 
                  padding: '12px 0', 
                  fontSize: 15,
                  opacity: !propiedadIdSeleccionada ? 0.5 : 1
                }}
              >
                Vincular y captar
              </button>
              {properties.filter(p => !p.propietario_id).length === 0 && (
                <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 8 }}>
                  No hay propiedades disponibles para vincular
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  border: '1px solid #e2e8f0', borderRadius: 6,
  marginBottom: 6, boxSizing: 'border-box', color: '#0f172a',
  background: '#fff',
}

const secTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 8, marginTop: 0
}

const rowStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4
}

const btnStyle = (variant: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    border: 'none', borderRadius: 5, cursor: 'pointer',
    padding: '5px 10px', fontSize: 12, fontWeight: 500,
  }
  const variants: Record<string, React.CSSProperties> = {
    green: { background: '#dcfce7', color: '#16a34a' },
    blue: { background: '#3b82f6', color: '#fff' },
    purple: { background: '#ede9fe', color: '#7c3aed' },
    red: { background: '#fee2e2', color: '#dc2626' },
    gray: { background: '#f1f5f9', color: '#475569' },
    ghost: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
  }
  return { ...base, ...(variants[variant] || variants.gray) }
}