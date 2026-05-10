'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { STAGES_LEAD, STAGES_PROPIETARIO, STAGE_LABEL } from '../lib/crm/stages'
import AuthGate from '../components/AuthGate'
import { getFecha, estaHoy, estaVencido } from '../lib/crm/dates'
import { getMensaje, getTipoMensaje } from '../lib/crm/messages'
import { getScore, getCalor } from '../lib/crm/scoring'
import type { Opportunity } from '../lib/crm/types'

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
  const [opps, setOpps] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [vista, setVista] = useState<Vista>('hoy')

  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Form crear
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [pipelineNuevo, setPipelineNuevo] = useState<PipelineType>('lead')
  const [stageInicial, setStageInicial] = useState('Nuevo')
  const [mostrarForm, setMostrarForm] = useState(false)

  // Programador de acción
  const [oppActiva, setOppActiva] = useState<any>(null)
  const [eventoActivo, setEventoActivo] = useState('')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [nota, setNota] = useState('')

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const cargarOpps = async () => {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        id, stage, next_action_date, next_action_type,
        visit_date, follow_up_count, pipeline_type,
        contacts ( nombre, telefono ),
        properties ( nombre, precio, distrito )
      `)
      .not('stage', 'in', '("Cerrado","Descartado")')
      .eq('user_id', userIdRef.current)
      .order('next_action_date', { ascending: true })

    if (!error) setOpps(data || [])
  }

  const cargarProperties = async () => {
    const { data } = await supabase.from('properties').select('*')
    setProperties(data || [])
  }

  useEffect(() => {
    cargarOpps()
    cargarProperties()
  }, [])

  useEffect(() => {
    setStageInicial('Nuevo')
  }, [pipelineNuevo])

  // ── Crear oportunidad ───────────────────────────────────────────────────────

  const crearOpp = async () => {
    if (!nombre || !telefono) {
      alert('Nombre y teléfono son obligatorios')
      return
    }

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('telefono', telefono)
      .single()

    let contactId
    if (existingContact) {
      contactId = existingContact.id
    } else {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert([{ nombre: nombre, telefono: telefono, user_id: userIdRef.current }])
        .select()
        .single()
      contactId = newContact.id
    }

    await supabase.from('opportunities').insert([{
      contact_id: contactId,
      property_id: pipelineNuevo === 'lead' ? (propertyId || null) : null,
      stage: stageInicial,
      pipeline_type: pipelineNuevo,
      next_action_type: 'escribir',
      next_action_date: new Date().toISOString(),
      user_id: userIdRef.current,
    }])

    setNombre('')
    setTelefono('')
    setPropertyId('')
    setMostrarForm(false)
    cargarOpps()
  }

  // ── Actualizar stage ────────────────────────────────────────────────────────

  const actualizarStage = async (opp: Opportunity, nuevoStage: string, fecha?: string) => {
    const esFinal = nuevoStage === 'Cerrado' || nuevoStage === 'Descartado'

    let fechaProxima = fecha
    if (!fecha && !esFinal) {
      const auto = new Date()
      const dias = nuevoStage === 'Seguimiento' ? 2 : 1
      auto.setDate(auto.getDate() + dias)
      fechaProxima = auto.toISOString()
    }

    await supabase.from('interactions').insert([{
      opportunity_id: opp.id,
      result: nuevoStage,
      note: nota || null,
    }])

    const updateData: any = {
      stage: nuevoStage,
      next_action_date: esFinal ? null : (fechaProxima ? new Date(fechaProxima).toISOString() : null),
    }

    if (nuevoStage === 'Visita' && fecha) {
      updateData.visit_date = new Date(fecha).toISOString()
    }

    await supabase.from('opportunities').update(updateData).eq('id', opp.id)

    if (esFinal) {
      setOpps(prev => prev.filter(o => o.id !== opp.id))
    } else {
      setOpps(prev => prev.map(o =>
        o.id === opp.id ? { ...o, ...updateData } : o
      ))
    }

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
    await actualizarStage(oppActiva, eventoActivo, fechaSeleccionada)
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────

  const leads = opps.filter(o => (o.pipeline_type || 'lead') === 'lead')
  const propietarios = opps.filter(o => o.pipeline_type === 'propietario')

  const accionHoyLeads = leads.filter(estaHoy)
  const accionHoyProps = propietarios.filter(estaHoy)
  const vencidosLeads = leads.filter(estaVencido)
  const vencidosProps = propietarios.filter(estaVencido)
  const sinAccion = opps.filter(o => !o.next_action_date)

  const ordenar = (arr: any[]) => [...arr].sort((a, b) => getScore(b) - getScore(a))

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
      case 'Interesado':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>✓ Seguimiento</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage(opp, 'Descartado')}>✕</button>
          </div>
        )
      case 'Seguimiento':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('purple')} onClick={() => abrirProgramador(opp, 'Visita')}>📅 Agendar visita</button>
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>↩ Reintentar</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage(opp, 'Descartado')}>✕</button>
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
            <button style={btnStyle('green')} onClick={() => abrirProgramador(opp, 'Seguimiento post-visita')}>✅ Realizada</button>
            <button style={btnStyle('gray')} onClick={() => actualizarStage(opp, 'Seguimiento')}>❌ No vino</button>
          </div>
        )
      case 'Seguimiento post-visita':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('green')} onClick={() => actualizarStage(opp, 'Cerrado')}>🎉 Cerrar</button>
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento post-visita')}>⏳ Pendiente</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage(opp, 'Descartado')}>✕</button>
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
            <button style={btnStyle('purple')} onClick={() => abrirProgramador(opp, 'Propuesta/Tasación')}>📊 Propuesta</button>
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Contactado')}>↩ Reintentar</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage(opp, 'Descartado')}>✕</button>
          </div>
        )
      case 'Propuesta/Tasación':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>🔄 Seguimiento</button>
            <button style={btnStyle('green')} onClick={() => actualizarStage(opp, 'Cerrado')}>🎉 Captado</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage(opp, 'Descartado')}>✕</button>
          </div>
        )
      case 'Seguimiento':
        return (
          <div style={rowStyle}>
            <BtnWA /><BtnCall />
            <button style={btnStyle('green')} onClick={() => actualizarStage(opp, 'Cerrado')}>🎉 Captado</button>
            <button style={btnStyle('gray')} onClick={() => abrirProgramador(opp, 'Seguimiento')}>↩ Reintentar</button>
            <button style={btnStyle('red')} onClick={() => actualizarStage(opp, 'Descartado')}>✕</button>
          </div>
        )
      default:
        return null
    }
  }

  // ── Card de oportunidad ─────────────────────────────────────────────────────

  const OppCard = ({ opp }: { opp: any }) => {
    const score = getScore(opp)
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
      </div>
    )
  }

  // ── Vista HOY ───────────────────────────────────────────────────────────────

  const VistaHoy = () => {
    const totalHoy = accionHoyLeads.length + accionHoyProps.length
    const totalVencidos = vencidosLeads.length + vencidosProps.length

    return (
      <div>
        {/* Resumen numérico */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8, marginBottom: 16
        }}>
          {[
            { label: 'Acción hoy', val: totalHoy, color: totalHoy > 0 ? '#ef4444' : '#22c55e', icon: '🔥' },
            { label: 'Vencidos', val: totalVencidos, color: totalVencidos > 0 ? '#f97316' : '#94a3b8', icon: '⚠️' },
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

        {sinAccion.length > 0 && (
          <div style={{ background: '#1e1e2e', color: '#facc15', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            ⚠️ {sinAccion.length} contacto{sinAccion.length > 1 ? 's' : ''} sin fecha de seguimiento
          </div>
        )}

        {/* Compradores hoy */}
        {accionHoyLeads.length > 0 && (
          <>
            <h3 style={secTitle}>👥 Compradores — Acción hoy ({accionHoyLeads.length})</h3>
            {ordenar(accionHoyLeads).map(o => <OppCard key={o.id} opp={o} />)}
          </>
        )}

        {/* Propietarios hoy */}
        {accionHoyProps.length > 0 && (
          <>
            <h3 style={secTitle}>🏠 Propietarios — Acción hoy ({accionHoyProps.length})</h3>
            {ordenar(accionHoyProps).map(o => <OppCard key={o.id} opp={o} />)}
          </>
        )}

        {totalHoy === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <p style={{ marginTop: 8 }}>Sin acciones pendientes para hoy</p>
            {(leads.length + propietarios.length) > 0 && (
              <p style={{ fontSize: 13 }}>Tienes {leads.length + propietarios.length} contactos programados para más adelante</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Vista Leads ─────────────────────────────────────────────────────────────

  const VistaLeads = () => {
    const porStage = STAGES_LEAD.filter(s => s !== 'Cerrado' && s !== 'Descartado')
    return (
      <div>
        {porStage.map(stage => {
          const grupo = leads.filter(o => o.stage === stage)
          if (grupo.length === 0) return null
          return (
            <div key={stage} style={{ marginBottom: 16 }}>
              <h3 style={secTitle}>{STAGE_LABEL[stage] || stage} ({grupo.length})</h3>
              {ordenar(grupo).map(o => <OppCard key={o.id} opp={o} />)}
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
    const porStage = STAGES_PROPIETARIO.filter(s => s !== 'Cerrado' && s !== 'Descartado')
    return (
      <div>
        {porStage.map(stage => {
          const grupo = propietarios.filter(o => o.stage === stage)
          if (grupo.length === 0) return null
          return (
            <div key={stage} style={{ marginBottom: 16 }}>
              <h3 style={secTitle}>{STAGE_LABEL[stage] || stage} ({grupo.length})</h3>
              {ordenar(grupo).map(o => <OppCard key={o.id} opp={o} />)}
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
              .filter(s => s !== 'Cerrado' && s !== 'Descartado')
              .map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
          </select>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={crearOpp} style={{ ...btnStyle('blue'), flex: 1, padding: '10px 0' }}>
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
          { key: 'hoy', label: '🔥 Hoy', badge: accionHoyLeads.length + accionHoyProps.length },
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
