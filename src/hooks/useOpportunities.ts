'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useOpportunities = (userId: string) => {
  const [opps, setOpps] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const cargarOpps = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('opportunities')
      .select(`
        id, stage, next_action_date, next_action_type,
        visit_date, follow_up_count, pipeline_type, property_id, contact_id, status,
        contacts ( nombre, telefono ),
        properties ( nombre, precio, distrito )
      `)
      .not('stage', 'in', '("Cerrado","Perdido","Captado","No captado")')
      .eq('user_id', userId)
      .order('next_action_date', { ascending: true })

    if (data) setOpps(data)
    setLoading(false)
  }

  const cargarActivities = async () => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
    if (data) setActivities(data)
  }

  const cargarProperties = async () => {
    const { data } = await supabase.from('properties').select('*')
    if (data) setProperties(data)
  }

  useEffect(() => {
    cargarOpps()
    cargarProperties()
    cargarActivities()
  }, [userId])

  const crearOpp = async (params: {
    nombre: string
    telefono: string
    pipeline: 'lead' | 'propietario'
    propertyId?: string
    stageInicial: string
  }) => {
    const { nombre, telefono, pipeline, propertyId, stageInicial } = params

    if (!nombre || !telefono) {
      alert('Nombre y teléfono son obligatorios')
      return null
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
        .insert([{ nombre, telefono, user_id: userId }])
        .select()
        .single()
      if (!newContact) return null
      contactId = newContact.id
    }

    const { data: newOpp } = await supabase.from('opportunities').insert([{
      contact_id: contactId,
      property_id: pipeline === 'lead' ? (propertyId || null) : null,
      stage: stageInicial,
      pipeline_type: pipeline,
      next_action_type: 'escribir',
      next_action_date: new Date().toISOString(),
      user_id: userId,
    }]).select().single()

    await cargarOpps()
    return newOpp
  }

  const actualizarStage = async (params: {
    opp: any
    nuevoStage: string
    fecha?: string
    nota?: string
  }) => {
    const { opp, nuevoStage, fecha, nota } = params
    
    const esFinal = nuevoStage === 'Cerrado' || nuevoStage === 'Perdido' || nuevoStage === 'Captado' || nuevoStage === 'No captado'

    let fechaProxima = fecha
    if (!fecha && !esFinal) {
      const auto = new Date()
      const dias = nuevoStage === 'Interesado' ? 2 : 1
      auto.setDate(auto.getDate() + dias)
      fechaProxima = auto.toISOString()
    }

    const activityMap: Record<string, string> = {
      'Contactado': 'whatsapp',
      'Interesado': 'whatsapp',
      'Visita': 'visit',
      'Seguimiento': 'whatsapp',
      'Tasación': 'meeting',
    }
    const actividadType = activityMap[nuevoStage] || 'call'
    const channel = nuevoStage === 'Contactado' || nuevoStage === 'Interesado' || nuevoStage === 'Tasación' ? 'whatsapp' : 'phone'
    const esActividadFutura = fechaProxima && new Date(fechaProxima) > new Date()

    if (esActividadFutura && fechaProxima) {
      await supabase.from('activities').insert([{
        opportunity_id: opp.id,
        type: actividadType,
        channel: channel,
        result: nuevoStage,
        status: 'pending',
        note: nota || null,
        scheduled_at: new Date(fechaProxima).toISOString(),
        user_id: userId,
      }])
    } else {
      await supabase.from('activities').insert([{
        opportunity_id: opp.id,
        type: actividadType,
        channel: channel,
        result: nuevoStage,
        status: 'completed',
        note: nota || null,
        completed_at: new Date().toISOString(),
        user_id: userId,
      }])
    }

    const updateData: any = {
      stage: nuevoStage,
      next_action_date: esFinal ? null : (fechaProxima ? new Date(fechaProxima).toISOString() : null),
    }

    if (nuevoStage === 'Visita' && fecha) {
      updateData.visit_date = new Date(fecha).toISOString()
    }

    await supabase.from('opportunities').update(updateData).eq('id', opp.id)
    await cargarOpps()
  }

  const completarCaptacion = async (params: {
    opp: any
    propiedadId?: string | null
    propiedadIdSeleccionada?: string
    captarModo: 'crear' | 'vincular'
  }) => {
    const { opp, propiedadId, propiedadIdSeleccionada, captarModo } = params
    
    let propertyId = propiedadId
    
    if (captarModo === 'vincular' && propiedadIdSeleccionada) {
      propertyId = propiedadIdSeleccionada
    }
    
    if (propertyId) {
      await supabase.from('properties').update({
        propietario_id: opp.contact_id
      }).eq('id', propertyId)
    }
    
    await supabase.from('opportunities').update({
      stage: 'Captado',
      property_id: propertyId,
      next_action_date: null
    }).eq('id', opp.id)
    
    await supabase.from('activities').insert([{
      opportunity_id: opp.id,
      type: 'meeting',
      channel: 'whatsapp',
      result: 'Captado',
      status: 'completed',
      note: propertyId ? `Captado con propiedad` : 'Captado sin propiedad',
      completed_at: new Date().toISOString(),
      user_id: userId,
    }])
    
    await cargarOpps()
    await cargarProperties()
  }

  return {
    opps,
    properties,
    activities,
    loading,
    cargarOpps,
    cargarActivities,
    crearOpp,
    actualizarStage,
    completarCaptacion,
  }
}