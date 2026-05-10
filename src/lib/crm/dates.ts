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