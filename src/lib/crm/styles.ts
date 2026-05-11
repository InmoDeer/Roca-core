// ═══════════════════════════════════════════════════════════════════════════════
// COLORES
// ═══════════════════════════════════════════════════════════════════════════════

export const COLORS = {
  // Fondos
  bgMain: '#f8fafc',
  bgCard: '#fff',
  bgHeader: '#0f172a',
  bgAlert: '#1e1e2e',
  bgVencido: '#fff5f5',

  // Bordes
  borderDefault: '#e2e8f0',
  borderVencido: '#fecaca',

  // Texto
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  textWhite: '#fff',
  textWarning: '#facc15',

  // Acciones / Estados
  blue: '#3b82f6',
  green: '#22c55e',
  greenLight: '#dcfce7',
  greenDark: '#16a34a',
  red: '#ef4444',
  redLight: '#fee2e2',
  redDark: '#dc2626',
  orange: '#f97316',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
  purpleDark: '#7c3aed',
  gray: '#475569',
  grayLight: '#f1f5f9',
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTILOS BASE
// ═══════════════════════════════════════════════════════════════════════════════

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  border: `1px solid ${COLORS.borderDefault}`,
  borderRadius: 6,
  marginBottom: 6,
  boxSizing: 'border-box',
  color: COLORS.textPrimary,
  background: COLORS.bgCard,
}

export const secTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: COLORS.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
  marginTop: 0,
}

export const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 4,
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOTONES
// ═══════════════════════════════════════════════════════════════════════════════

type ButtonVariant = 'green' | 'blue' | 'purple' | 'red' | 'gray' | 'ghost'

const buttonColors: Record<ButtonVariant, { bg: string; color: string; border?: string }> = {
  green: { bg: COLORS.greenLight, color: COLORS.greenDark },
  blue: { bg: COLORS.blue, color: COLORS.textWhite },
  purple: { bg: COLORS.purpleLight, color: COLORS.purpleDark },
  red: { bg: COLORS.redLight, color: COLORS.redDark },
  gray: { bg: COLORS.grayLight, color: COLORS.gray },
  ghost: { bg: COLORS.grayLight, color: COLORS.gray, border: COLORS.borderDefault },
}

export function btnStyle(variant: ButtonVariant): React.CSSProperties {
  const base: React.CSSProperties = {
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 500,
  }
  const { bg, color, border } = buttonColors[variant] || buttonColors.gray
  return { ...base, background: bg, color, ...(border ? { border: `1px solid ${border}` } : {}) }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function getCardStyle(vencido: boolean): React.CSSProperties {
  return {
    background: vencido ? COLORS.bgVencido : COLORS.bgCard,
    border: `1px solid ${vencido ? COLORS.borderVencido : COLORS.borderDefault}`,
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
  }
}

export function getHeaderStyle(): React.CSSProperties {
  return {
    background: COLORS.bgHeader,
    color: COLORS.textWhite,
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  }
}

export function getTabsStyle(): React.CSSProperties {
  return {
    display: 'flex',
    background: COLORS.bgCard,
    borderBottom: `1px solid ${COLORS.borderDefault}`,
    position: 'sticky',
    top: 52,
    zIndex: 99,
  }
}

export function getTabStyle(vistaActiva: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '12px 4px',
    border: 'none',
    cursor: 'pointer',
    background: 'transparent',
    fontSize: 12,
    fontWeight: vistaActiva ? 700 : 400,
    color: vistaActiva ? COLORS.blue : COLORS.textSecondary,
    borderBottom: vistaActiva ? `2px solid ${COLORS.blue}` : '2px solid transparent',
  }
}

export function getBadgeStyle(vistaActiva: boolean): React.CSSProperties {
  return {
    marginLeft: 4,
    background: vistaActiva ? COLORS.blue : COLORS.borderDefault,
    color: vistaActiva ? COLORS.textWhite : COLORS.textSecondary,
    borderRadius: 10,
    padding: '1px 6px',
    fontSize: 10,
  }
}

export function getStatsCardStyle(color: string): React.CSSProperties {
  return {
    background: COLORS.bgCard,
    border: `1px solid ${COLORS.borderDefault}`,
    borderRadius: 8,
    padding: '10px 8px',
    textAlign: 'center' as const,
  }
}

export const contentStyle: React.CSSProperties = {
  padding: '14px 16px',
  maxWidth: 680,
  margin: '0 auto',
}

export const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  padding: '40px 0',
  color: COLORS.textMuted,
}