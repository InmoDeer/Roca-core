'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export const useTimeline = (onActivityCreated?: () => void) => {
  const [timeline, setTimeline] = useState<any[]>([])
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [selectedOpp, setSelectedOpp] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const cargarTimeline = async (oppId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', oppId)
      .order('completed_at', { ascending: false })
    setTimeline(data || [])
    setLoading(false)
  }

  const abrirTimeline = (opp: any) => {
    setSelectedOpp(opp)
    setTimelineOpen(true)
    cargarTimeline(opp.id)
  }

  const cerrarTimeline = () => {
    setTimelineOpen(false)
    setSelectedOpp(null)
    setTimeline([])
  }

  const registrarActividad = async (params: {
    opp: any
    tipo: string
    resultado: string
    nota: string
    fecha?: string
  }) => {
    const { opp, tipo, resultado, nota, fecha } = params
    
    const channel = tipo === 'whatsapp' ? 'whatsapp' : 
                    tipo === 'note' ? 'none' : 'phone'
    
    const esFutura = fecha && new Date(fecha) > new Date()
    
    if (esFutura && fecha) {
      await supabase.from('activities').insert([{
        opportunity_id: opp.id,
        type: tipo,
        channel: channel,
        result: resultado,
        status: 'pending',
        note: nota || null,
        scheduled_at: new Date(fecha).toISOString(),
        user_id: opp.user_id,
      }])
    } else {
      await supabase.from('activities').insert([{
        opportunity_id: opp.id,
        type: tipo,
        channel: channel,
        result: resultado,
        status: 'completed',
        note: nota || null,
        completed_at: new Date().toISOString(),
        user_id: opp.user_id,
      }])
    }
    
    if (selectedOpp?.id === opp.id) {
      cargarTimeline(opp.id)
    }
    
    if (onActivityCreated) {
      onActivityCreated()
    }
  }

  return {
    timeline,
    timelineOpen,
    selectedOpp,
    loading,
    cargarTimeline,
    abrirTimeline,
    cerrarTimeline,
    registrarActividad,
  }
}