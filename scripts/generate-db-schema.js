/**
 * Script para generar esquema de base de datos desde Supabase
 * 
 * Usage: node scripts/generate-db-schema.js
 * 
 * Ejecuta este script cada vez que modifiques la estructura de la DB
 * para mantener el esquema actualizado en data/db-schema.json
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Faltan credenciales de Supabase en .env.local')
  console.log('   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const tables = ['contacts', 'properties', 'opportunities', 'interactions']

function mapPostgresType(dataType) {
  const type = dataType.toLowerCase()
  
  if (type.includes('integer') || type.includes('smallint') || type.includes('bigint') || type === 'serial' || type === 'bigserial') {
    return 'integer'
  }
  if (type.includes('numeric') || type.includes('decimal') || type.includes('real') || type.includes('double precision')) {
    return 'numeric'
  }
  if (type.includes('boolean')) {
    return 'boolean'
  }
  if (type.includes('timestamp') || type.includes('date') || type.includes('time')) {
    return 'timestamp'
  }
  if (type.includes('uuid')) {
    return 'uuid'
  }
  if (type.includes('json') || type.includes('jsonb')) {
    return 'json'
  }
  return 'text'
}

async function generateSchema() {
  console.log('🔄 Generando esquema de base de datos...\n')

  const schema = {}

  for (const tableName of tables) {
    try {
      const { data, error } = await supabase.rpc('get_columns_info', { p_table_name: tableName })

      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)

        if (fallbackError) throw fallbackError

        const columns = fallbackData && fallbackData.length > 0 ? Object.keys(fallbackData[0]) : []
        schema[tableName] = {
          columns: columns.map(col => ({
            name: col,
            type: 'unknown',
            nullable: true,
            primary: col === 'id'
          })),
          relations: []
        }
        console.log(`⚠️  ${tableName}: Fallback a inferencia (${columns.length} columnas detectadas)`)
      } else {
        schema[tableName] = {
          columns: data.map(col => ({
            name: col.column_name,
            type: mapPostgresType(col.data_type),
            nullable: col.is_nullable === 'YES',
            primary: col.column_default?.includes('nextval') || false
          })),
          relations: []
        }
        console.log(`✅ ${tableName}: ${data.length} columnas`)
      }

    } catch (err) {
      console.log(`⚠️  ${tableName}: No se pudo consultar (${err.message})`)
      schema[tableName] = {
        columns: [],
        relations: []
      }
    }
  }

  schema.opportunities.relations = [
    { type: 'foreign_key', to: 'contacts', via: 'contact_id' },
    { type: 'foreign_key', to: 'properties', via: 'property_id' }
  ]

  schema.interactions.relations = [
    { type: 'foreign_key', to: 'opportunities', via: 'opportunity_id' }
  ]

  const outputPath = path.join(__dirname, '..', 'data', 'db-schema.json')
  fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2))

  console.log(`\n✅ Esquema guardado en: ${outputPath}\n`)
  
  console.log('📊 Resumen:')
  for (const [table, data] of Object.entries(schema)) {
    console.log(`   ${table}: ${data.columns.length} columnas, ${data.relations.length} relaciones`)
  }
}

generateSchema().catch(console.error)