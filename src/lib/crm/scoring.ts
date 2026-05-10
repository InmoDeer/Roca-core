const stageScores: Record<string, number> = {
  'Visita': 50,
  'Seguimiento post-visita': 45,
  'Seguimiento': 30,
  'Interesado': 20,
  'Propuesta/Tasación': 40,
  'Contactado': 20,
}

export const getScore = (opp: any): number => {
  let score = 0
  score += stageScores[opp.stage] || 0
  if (opp.next_action_date) {
    const diff = new Date(opp.next_action_date).getTime() - Date.now()
    if (diff < 0) score += 30
    else if (diff < 86400000) score += 20
  }
  return score
}

export const getCalor = (score: number): string => {
  if (score > 70) return '#ef4444'
  if (score > 40) return '#f97316'
  return '#94a3b8'
}