'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [leads, setLeads] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [leadActivo, setLeadActivo] = useState<any>(null)
  const [eventoActivo, setEventoActivo] = useState('')
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [nota, setNota] = useState('')

  const cargarLeads = async () => {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        id,
        status,
        stage,
        next_action_date,
        next_action_type,
        visit_date,
        follow_up_count,
        contacts ( name, phone ),
        properties ( title, price, district, whatsapp_short, whatsapp_full )
      `)
      .neq('status', 'Perdido')
      .order('next_action_date', { ascending: true })

    if (!error) setLeads(data || [])
  }

  const cargarProperties = async () => {
    const { data } = await supabase.from('properties').select('*')
    setProperties(data || [])
  }

  const crearLead = async () => {
    if (!nombre || !telefono) {
      alert('Nombre y teléfono son obligatorios')
      return
    }

    const { data: contact } = await supabase
      .from('contacts')
      .insert([{ name: nombre, phone: telefono }])
      .select()
      .single()

    await supabase
      .from('opportunities')
      .insert([{
        contact_id: contact.id,
        property_id: propertyId || null,
        status: 'Nuevo',
        stage: 'Nuevo',
        next_action_type: 'escribir',
        next_action_date: new Date().toISOString()
      }])

    setNombre('')
    setTelefono('')
    setPropertyId('')
    cargarLeads()
  }

  useEffect(() => {
    cargarLeads()
    cargarProperties()
  }, [])

  const getLeadsActivos = () => {
    let limite = new Date()
    limite.setHours(limite.getHours() + 24)

    let activos = leads.filter(l =>
      l.next_action_date &&
      new Date(l.next_action_date) <= limite
    )

    if (activos.length === 0) {
      limite = new Date()
      limite.setHours(limite.getHours() + 48)

      activos = leads.filter(l =>
        l.next_action_date &&
        new Date(l.next_action_date) <= limite
      )
    }

    return activos
  }

  const getProximosRestantes = () => {
    const limite = new Date()
    limite.setHours(limite.getHours() + 48)
    return leads.filter(l =>
      l.next_action_date &&
      new Date(l.next_action_date) > limite
    )
  }

  const getScore = (l: any) => {
    let score = 0

    if (l.stage === 'Visita realizada') score += 50
    else if (l.stage === 'Visita agendada') score += 40
    else if (l.stage === 'Previsita') score += 30
    else if (l.stage === 'Contactado') score += 20

    if (l.next_action_date) {
      const diff = new Date(l.next_action_date).getTime() - Date.now()
      if (diff < 0) score += 30
      else if (diff < 86400000) score += 20
    }

    return score
  }

  const getMensaje = (l: any, tipo: string) => {
    const nombre = l.contacts?.name?.split(' ')[0] || ''
    const propiedad = l.properties?.title || ''
    const precio = l.properties?.price || ''

    if (tipo === 'primer_contacto') {
      return `Hola ${nombre}, te escribo por el inmueble "${propiedad}" - ${precio}. ¿Te interesa recibir más información?`
    }
    if (tipo === 'seguimiento') {
      return `Hola ${nombre}, quería saber si pudiste revisar la información del inmueble "${propiedad}". ¿Tienes alguna duda?`
    }
    if (tipo === 'confirmar_visita') {
      const fecha = l.visit_date ? new Date(l.visit_date).toLocaleString('es-PE', { dateStyle: 'full', timeStyle: 'short' }) : ''
      return `Hola ${nombre}, te confirmo la visita para el ${fecha}. ¿Te parece si nos vemos ahí?`
    }
    if (tipo === 'recordatorio') {
      return `Hola ${nombre}, te escribo para recordarte sobre el inmueble "${propiedad}". ¿Sigues interesado?`
    }
    if (tipo === 'gracias_visita') {
      return `Hola ${nombre}, gracias por visitarnos. ¿Qué te pareció el inmueble "${propiedad}"? ¿Te gustaría avanzar?`
    }
    if (tipo === 'cita_perdida') {
      return `Hola ${nombre}, lamentamos que no pudieras asistir a la visita. ¿Podemos reagendar? Estoy atento`
    }
    if (tipo === 'interesado') {
      return `Hola ${nombre}, me alegra que te interese el inmueble "${propiedad}". ¿Te gustaría agendar una visita para verlo en persona?`
    }
    if (tipo === 'sin_interes') {
      return `Hola ${nombre}, entendido. Si en algún momento cambias de idea, aquí estaré. ¡Saludos!`
    }
    if (tipo === 'promocion') {
      return `Hola ${nombre}, tengo una oportunidad especial en "${propiedad}" - ${precio}. ¡No te la pierdas! ¿Te interesa?`
    }
    if (tipo === 'proximamente') {
      return `Hola ${nombre}, solo quería mantener el contacto sobre el inmueble "${propiedad}". ¿Sigues interesado?`
    }
    return `Hola ${nombre}, te escribo por el inmueble "${propiedad}"`
  }

  const getFecha = (dias: number) => {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    return d.toISOString().slice(0, 16)
  }

  const ordenar = (arr: any[]) =>
    [...arr].sort((a, b) => getScore(b) - getScore(a))

  const abrirProgramador = (l: any, evento: string) => {
    setLeadActivo(l)
    setEventoActivo(evento)
    setNota('')
    
    const sugerida = new Date()
    sugerida.setDate(sugerida.getDate() + 1)
    setFechaSeleccionada(sugerida.toISOString().slice(0, 16))
  }

  const actualizarStage = async (l: any, evento: string, fecha?: string) => {
    const mapa: Record<string, string> = {
      'contactado': 'Contactado',
      'respondio': 'Previsita',
      'agenda_visita': 'Visita agendada',
      'visita_realizada': 'Visita realizada',
      'cerrado': 'Cierre',
      'no_interesado': 'Perdido',
      'no_responde': 'Contactado'
    }

    const esNoResponde = evento === 'no_responde'
    let fechaAutomatica = fecha
    let followUpCount = l.follow_up_count || 0

    if (esNoResponde && !fecha) {
      const dias = followUpCount === 0 ? 2 : followUpCount === 1 ? 4 : 7
      const fechaAuto = new Date()
      fechaAuto.setDate(fechaAuto.getDate() + dias)
      fechaAutomatica = fechaAuto.toISOString()
      followUpCount += 1
    } else if (!fecha && !esNoResponde) {
      const fechaAuto = new Date()
      fechaAuto.setDate(fechaAuto.getDate() + 1)
      fechaAutomatica = fechaAuto.toISOString()
    }

    const nuevoStage = mapa[evento] || l.stage
    const esPerdido = nuevoStage === 'Perdido'
    const esCierre = nuevoStage === 'Cierre'

    await supabase.from('interactions').insert([{
      opportunity_id: l.id,
      result: evento,
      note: nota
    }])

    let visitDateValue = l.visit_date
    if (evento === 'agenda_visita' && fecha) {
      visitDateValue = new Date(fecha).toISOString()
    }

    const updateData: any = {
      stage: nuevoStage,
      next_action_date: fechaAutomatica ? new Date(fechaAutomatica).toISOString() : null,
      visit_date: visitDateValue
    }

    if (esNoResponde) {
      updateData.follow_up_count = followUpCount
    }

    await supabase.from('opportunities').update(updateData).eq('id', l.id)

    if (esPerdido || esCierre) {
      setLeads(prev => prev.filter(lead => lead.id !== l.id))
    } else {
      setLeads(prev => prev.map(lead =>
        lead.id === l.id 
          ? { ...lead, stage: nuevoStage, next_action_date: fecha ? new Date(fecha).toISOString() : null, visit_date: visitDateValue } 
          : lead
      ))
    }

    setLeadActivo(null)
    setNota('')
  }

  const guardarAccion = async () => {
    if (!leadActivo || !fechaSeleccionada) return
    await actualizarStage(leadActivo, eventoActivo, fechaSeleccionada)
  }

  const contactar = (l: any) => {
    const telefono = l.contacts?.phone
    const mensaje = getMensaje(l, 'primer_contacto')
    const url = `https://wa.me/51${telefono}?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank')
    abrirProgramador(l, 'contactado')
  }

  const marcarContactado = (l: any) => {
    abrirProgramador(l, 'contactado')
  }

  const getAccionPorStage = (l: any) => {
    const telefono = l.contacts?.phone
    const tipoMsg = 
      l.stage === 'Nuevo' ? 'primer_contacto' : 
      l.stage === 'Contactado' ? 'seguimiento' : 
      l.stage === 'Previsita' ? 'interesado' :
      l.stage === 'Visita agendada' ? 'confirmar_visita' :
      l.stage === 'Visita realizada' ? 'gracias_visita' :
      'recordatorio'
    const urlWhatsApp = `https://wa.me/51${telefono}?text=${encodeURIComponent(getMensaje(l, tipoMsg))}`
    const botonStyle = { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 8 }

    switch (l.stage) {
      case 'Nuevo':
        return (
          <div style={botonStyle}>
            <a href={urlWhatsApp} target="_blank">
              <button>📱 WhatsApp</button>
            </a>
            <a href={`tel:+51${telefono}`}>
              <button>📞 Llamar</button>
            </a>
            <button onClick={() => marcarContactado(l)}>✓ Ya contacté</button>
          </div>
        )

      case 'Contactado':
        return (
          <div>
            <div style={botonStyle}>
              <a href={urlWhatsApp} target="_blank">
                <button>📱 WhatsApp</button>
              </a>
              <a href={`tel:+51${telefono}`}>
                <button>📞 Llamar</button>
              </a>
              <button disabled style={{ background: '#4CAF50', color: 'white' }}>✓ Contactado</button>
            </div>
            <div style={botonStyle}>
              <span style={{ fontSize: 12, color: '#666', marginRight: 'auto' }}>¿Respondió?</span>
              <button onClick={() => actualizarStage(l, 'respondio')}>✅ Sí</button>
              <button onClick={() => actualizarStage(l, 'no_responde')}>❌ No</button>
              <button onClick={() => actualizarStage(l, 'no_interesado')}>🗑️</button>
            </div>
          </div>
        )

      case 'Previsita':
        return (
          <div style={{ ...botonStyle, flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div>
              <input 
                type="datetime-local" 
                id={`fecha-${l.id}`}
                step="300"
                style={{ marginRight: '8px', padding: '5px' }}
              />
              <button onClick={() => {
                const fecha = (document.getElementById(`fecha-${l.id}`) as HTMLInputElement)?.value
                if (fecha) {
                  abrirProgramador(l, 'agenda_visita')
                  setFechaSeleccionada(fecha)
                }
              }}>
                📅 Confirmar
              </button>
            </div>
            <button onClick={() => actualizarStage(l, 'no_responde')}>❌ No responde</button>
          </div>
        )

      case 'Visita agendada':
        return (
          <div style={botonStyle}>
            {l.visit_date && (
              <span style={{ marginRight: 'auto', fontSize: '12px', color: '#666' }}>
                📅 {new Date(l.visit_date).toLocaleString()}
              </span>
            )}
            <button onClick={() => actualizarStage(l, 'visita_realizada')}>✅ Visita realizada</button>
            <button onClick={() => actualizarStage(l, 'no_responde')}>❌ No se presentó</button>
          </div>
        )

      case 'Visita realizada':
        return (
          <div style={botonStyle}>
            <button onClick={() => actualizarStage(l, 'cerrado')}>🎉 Cerrar</button>
            <button onClick={() => actualizarStage(l, 'no_responde')}>⏳ Pendiente</button>
          </div>
        )

      case 'Cierre':
        return (
          <div style={botonStyle}>
            <button disabled style={{ background: '#4CAF50', color: 'white' }}>🎉 Cerrado</button>
          </div>
        )

      default:
        return null
    }
  }

  const accionLabel = (tipo: string) => {
    if (tipo === 'llamar') return '📞 Llamar'
    if (tipo === 'escribir') return '📝 Escribir'
    if (tipo === 'visita') return '🏠 Visita'
    return ''
  }

  const renderLead = (l: any) => {
    const telefono = l.contacts?.phone
    const propiedad = l.properties
    const esUrgente = new Date(l.next_action_date) < new Date()
    const score = getScore(l)
    const colorCalor = score > 70 ? 'red' : score > 40 ? 'orange' : 'gray'

    if (!telefono) {
      return (
        <div
          key={l.id}
          style={{
            marginBottom: 12,
            padding: 10,
            background: '#ffcccc',
            color: '#cc0000'
          }}
        >
          <strong>⚠️ {l.contacts?.name}</strong> - Sin teléfono
          <button onClick={() => actualizarStage(l, 'no_interesado')}>Eliminar</button>
        </div>
      )
    }

    if (l.status === 'Perdido' || l.status === 'Cierre') {
      return null
    }

    const stageLabel = (stage: string) => {
      const map: Record<string, string> = {
        'Nuevo': '🆕 Nuevo',
        'Contactado': '📞 Contactado',
        'Previsita': '📋 Previsita',
        'Visita agendada': '📅 Visita agendada',
        'Visita realizada': '✅ Visita realizada',
        'Cierre': '🎉 Cierre',
        'Perdido': '❌ Perdido'
      }
      return map[stage] || stage
    }

    return (
      <div
        key={l.id}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12,
          padding: 10,
          background: esUrgente ? '#ffe5e5' : '#f5f5f5',
          color: '#000'
        }}
      >
        <div style={{ flex: 1 }}>
          <span style={{ 
            width: 10, 
            height: 10, 
            background: colorCalor, 
            borderRadius: '50%', 
            display: 'inline-block',
            marginRight: 6
          }} />
          <strong>{l.contacts?.name}</strong> - {stageLabel(l.stage)}
          {propiedad && <span> - {propiedad.title} - {propiedad.price}</span>}
          <br />
          {l.next_action_date && new Date(l.next_action_date).toLocaleString()}
          <br />
          {getAccionPorStage(l)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <a href={`https://wa.me/51${telefono}?text=${encodeURIComponent(getMensaje(l, l.stage === 'Nuevo' ? 'primer_contacto' : l.stage === 'Contactado' ? 'seguimiento' : 'recordatorio'))}`} target="_blank">📱</a>
          <a href={`tel:+51${telefono}`}>📞</a>
          <button onClick={() => actualizarStage(l, 'no_interesado')} style={{ background: '#ccc', fontSize: 11, padding: '2px 6px' }}>Descartar</button>
        </div>
      </div>
    )
  }

  const hoyTotal = getLeadsActivos()
  const accionHoy = leads.filter(l => {
    if (!l.next_action_date) return false
    return new Date(l.next_action_date) <= new Date()
  })
  const proximosRestantes = getProximosRestantes()
  const vencidos = leads.filter(l => {
    if (!l.next_action_date) return false
    return new Date(l.next_action_date) < new Date()
  })
  const sinAccion = leads.filter(l => !l.next_action_date)

  return (
    <div style={{ padding: 20, background: '#fff', minHeight: '100vh', color: '#000' }}>
      <div style={{ marginBottom: 20, padding: 10, border: '1px solid #ccc' }}>
        <h3>Crear Lead</h3>
        <input
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{ marginRight: 5 }}
        />
        <input
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          style={{ marginRight: 5 }}
        />
        <select onChange={(e) => setPropertyId(e.target.value)} value={propertyId} style={{ marginRight: 5 }}>
          <option value="">Seleccionar propiedad</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button onClick={crearLead}>Crear Lead</button>
      </div>

      {vencidos.length > 0 && (
        <div style={{ background: 'red', color: 'white', padding: 10, marginBottom: 10 }}>
          ⚠️ Tienes {vencidos.length} leads pendientes
        </div>
      )}

      {sinAccion.length > 0 && (
        <div style={{ background: 'black', color: 'yellow', padding: 10, marginBottom: 10 }}>
          ⚠️ {sinAccion.length} leads sin seguimiento
        </div>
      )}

      <h1>🔥 {accionHoy.length} Acción hoy</h1>

      {accionHoy.length > 0 ? (
        <>
          {ordenar(accionHoy).map(renderLead)}
        </>
      ) : (
        <>
          <h2>📋 Sin acción inmediata</h2>
          {proximosRestantes.length > 0 && (
            <p style={{ color: '#888' }}>Tienes {proximosRestantes.length} leads programados para más adelante</p>
          )}
        </>
      )}

      {leadActivo && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '2px solid #333',
          padding: '15px',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          <strong style={{ fontSize: '16px' }}>Programar siguiente acción</strong>
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="datetime-local"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
              step="300"
              style={{ padding: '8px', fontSize: '14px' }}
            />
            <div style={{ display: 'flex', gap: '4px', marginTop: 4 }}>
              <button onClick={() => setFechaSeleccionada(getFecha(1))} style={{ padding: '4px 8px', fontSize: '12px' }}>+1 día</button>
              <button onClick={() => setFechaSeleccionada(getFecha(2))} style={{ padding: '4px 8px', fontSize: '12px' }}>+2 días</button>
              <button onClick={() => setFechaSeleccionada(getFecha(7))} style={{ padding: '4px 8px', fontSize: '12px' }}>+7 días</button>
            </div>
            <input
              placeholder="Nota (opcional)"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              style={{ padding: '8px', flex: 1 }}
            />
            <button onClick={guardarAccion} style={{ background: '#4CAF50', color: 'white', padding: '10px 20px' }}>Guardar</button>
            <button onClick={() => { setLeadActivo(null); setNota('') }} style={{ padding: '10px' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
