import { supabase } from '../supabase'

export const getFecha = (dias: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 16)
}

export const estaVencido = (opp: any): boolean =>
  !!opp.next_action_date && new Date(opp.next_action_date) < new Date()

export const estaHoy = (opp: any): boolean => {
  if (!opp.next_action_date) return false
  const limite = new Date()
  limite.setHours(23, 59, 59, 999)
  return new Date(opp.next_action_date) <= limite
}

export const getPendingActivities = async (userId: string) => {
  const { data } = await supabase
    .from('activities')
    .select(`
      id, type, scheduled_at, note, status,
      opportunity_id,
      contacts ( nombre, telefono ),
      properties ( nombre )
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
  
  if (!data) return { vencidas: [], hoy: [], proximas: [] }
  
  const ahora = new Date()
  const inicioHoy = new Date(ahora)
  inicioHoy.setHours(0, 0, 0, 0)
  const finHoy = new Date(ahora)
  finHoy.setHours(23, 59, 59, 999)
  
  const vencidas = data.filter((a: any) => 
    a.scheduled_at && new Date(a.scheduled_at) < inicioHoy
  )
  
  const hoy = data.filter((a: any) => 
    a.scheduled_at && new Date(a.scheduled_at) >= inicioHoy && new Date(a.scheduled_at) <= finHoy
  )
  
  const proximas = data.filter((a: any) => 
    a.scheduled_at && new Date(a.scheduled_at) > finHoy
  )
  
  return { vencidas, hoy, proximas }
}