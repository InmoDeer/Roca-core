export const getMensaje = (opp: any, tipo: string): string => {
  const nombre = opp.contacts?.nombre?.split(' ')[0] || ''
  const propiedad = opp.properties?.nombre || ''
  const precio = opp.properties?.precio || ''

  const msgs: Record<string, string> = {
    primer_contacto: `Hola ${nombre}, te escribo por el inmueble "${propiedad}" - ${precio}. ¿Te interesa recibir más información?`,
    seguimiento: `Hola ${nombre}, quería saber si pudiste revisar la información del inmueble "${propiedad}". ¿Tienes alguna duda?`,
    confirmar_visita: `Hola ${nombre}, te confirmo la visita para el ${opp.visit_date ? new Date(opp.visit_date).toLocaleString('es-PE', { dateStyle: 'full', timeStyle: 'short' }) : ''}. ¿Te parece bien?`,
    gracias_visita: `Hola ${nombre}, gracias por visitarnos. ¿Qué te pareció "${propiedad}"? ¿Te gustaría avanzar?`,
    post_visita: `Hola ${nombre}, espero que la visita haya sido de tu agrado. ¿Tienes alguna consulta sobre "${propiedad}"?`,
    recordatorio: `Hola ${nombre}, te escribo para recordarte sobre "${propiedad}". ¿Sigues interesado?`,
    propietario_contacto: `Hola ${nombre}, soy agente inmobiliario y me gustaría hablar sobre tu propiedad. ¿Tienes un momento?`,
    propietario_seguimiento: `Hola ${nombre}, quería hacer un seguimiento sobre nuestra conversación de la propiedad. ¿Pudiste revisar la propuesta?`,
  }
  return msgs[tipo] || `Hola ${nombre}, te escribo por "${propiedad}"`
}

export const getTipoMensaje = (opp: any): string => {
  if (opp.pipeline_type === 'propietario') {
    return opp.stage === 'Contactado' ? 'propietario_contacto' : 'propietario_seguimiento'
  }
  const m: Record<string, string> = {
    'Interesado': 'primer_contacto',
    'Seguimiento': 'seguimiento',
    'Visita': 'confirmar_visita',
    'Seguimiento post-visita': 'post_visita',
  }
  return m[opp.stage] || 'recordatorio'
}