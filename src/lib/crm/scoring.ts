const stageScores: Record<string, number> = {
  'Captado': 0,
  'No captado': 0,
  'Perdido': 0,
  'Cerrado': 0,
  'Seguimiento': 35,
  'Visita': 50,
  'Interesado': 30,
  'Contactado': 20,
  'Tasación': 40,
}

export const getLastActivity = (oppId: string, activities: any[]): any => {
  if (!activities || activities.length === 0) return null
  const oppActivities = activities.filter(a => a.opportunity_id === oppId && a.completed_at)
  if (oppActivities.length === 0) return null
  return oppActivities.sort((a, b) => 
    new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  )[0]
}

export const getPendingActivities = (oppId: string, activities: any[]): any[] => {
  if (!activities) return []
  return activities.filter(a => 
    a.opportunity_id === oppId && 
    a.status === 'pending' && 
    a.scheduled_at
  )
}

export const getOverdueActivities = (oppId: string, activities: any[]): any[] => {
  if (!activities) return []
  const now = new Date()
  return activities.filter(a => 
    a.opportunity_id === oppId && 
    a.status === 'pending' && 
    a.scheduled_at && 
    new Date(a.scheduled_at) < now
  )
}

export const getUpcomingVisits = (opp: any): boolean => {
  if (!opp.visit_date) return false
  const visitDate = new Date(opp.visit_date)
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return visitDate >= now && visitDate <= sevenDaysFromNow
}

export const getDaysSinceLastActivity = (oppId: string, activities: any[]): number => {
  const lastActivity = getLastActivity(oppId, activities)
  if (!lastActivity || !lastActivity.completed_at) return 999
  const diff = Date.now() - new Date(lastActivity.completed_at).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export const isVisitToday = (opp: any): boolean => {
  if (!opp.visit_date) return false
  const visitDate = new Date(opp.visit_date)
  const today = new Date()
  return visitDate.toDateString() === today.toDateString()
}

export const getScore = (opp: any, activities: any[] = []): number => {
  let score = 0
  
  if (!activities || activities.length === 0) {
    score += stageScores[opp.stage] || 0
    if (opp.next_action_date) {
      const diff = new Date(opp.next_action_date).getTime() - Date.now()
      if (diff < 0) score += 30
      else if (diff < 86400000) score += 20
    }
    return score
  }
  
  score += stageScores[opp.stage] || 0
  
  const overdue = getOverdueActivities(opp.id, activities)
  if (overdue.length > 0) score += 40
  
  const pendingToday = getPendingActivities(opp.id, activities).filter(a => {
    const today = new Date()
    const scheduled = new Date(a.scheduled_at)
    return scheduled.toDateString() === today.toDateString()
  })
  if (pendingToday.length > 0) score += 25
  
  if (isVisitToday(opp)) score += 35
  else if (getUpcomingVisits(opp)) score += 35
  
  const daysInactive = getDaysSinceLastActivity(opp.id, activities)
  if (daysInactive > 14) score -= 30
  else if (daysInactive > 7) score -= 15
  
  score += (opp.follow_up_count || 0) * 5
  
  const lastActivity = getLastActivity(opp.id, activities)
  if (lastActivity && ['respondio', 'interesado', 'confirmo_visita', 'reagendo'].includes(lastActivity.result)) {
    score += 15
  }
  
  const pendingActivities = getPendingActivities(opp.id, activities)
  pendingActivities.forEach(a => {
    score += a.priority || 0
  })
  
  if (opp.status && opp.status !== 'active' && opp.status !== null) {
    score -= 100
  }
  
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