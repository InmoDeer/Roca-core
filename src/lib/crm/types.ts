export type Contact = {
  nombre?: string
  telefono?: string
}

export type Property = {
  nombre?: string
  precio?: string
  distrito?: string
}

export type Opportunity = {
  id: string
  stage: string
  pipeline_type?: 'lead' | 'propietario'
  next_action_date?: string
  visit_date?: string
  contacts?: Contact
  properties?: Property
}