import type { FlowNodeType } from '../utils/flowTypes';

export const NODE_COLORS: Record<FlowNodeType, string> = {
  trigger: '#10b981',
  send_message: '#6366f1',
  wait_delay: '#f59e0b',
  condition: '#8b5cf6',
  action: '#0ea5e9',
  end: '#64748b',
};

export const NODE_LABELS: Record<FlowNodeType, string> = {
  trigger: 'Gatilho',
  send_message: 'Enviar Mensagem',
  wait_delay: 'Aguardar',
  condition: 'Condição',
  action: 'Ação',
  end: 'Fim',
};

export function getNodeStyle(type: FlowNodeType, selected: boolean, isDark: boolean) {
  const color = NODE_COLORS[type];
  return {
    container: {
      padding: '10px 14px',
      borderRadius: '12px',
      border: selected ? `2px solid ${color}` : `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
      backgroundColor: isDark ? '#1e1e2e' : '#ffffff',
      minWidth: '180px',
      maxWidth: '220px',
      boxShadow: selected
        ? `0 0 0 2px ${color}33`
        : isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.08)',
      cursor: 'grab',
      transition: 'box-shadow 0.2s, border-color 0.2s',
    } as React.CSSProperties,
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '4px',
    } as React.CSSProperties,
    icon: {
      color,
      flexShrink: 0,
    } as React.CSSProperties,
    title: {
      fontSize: '0.75rem',
      fontWeight: 700,
      color: isDark ? '#e0e0e0' : '#1a1a2e',
      lineHeight: 1.2,
    } as React.CSSProperties,
    subtitle: {
      fontSize: '0.65rem',
      color: isDark ? '#888' : '#888',
      lineHeight: 1.3,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as React.CSSProperties,
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '0.6rem',
      padding: '2px 6px',
      borderRadius: '6px',
      backgroundColor: `${color}18`,
      color,
      fontWeight: 600,
      marginTop: '4px',
    } as React.CSSProperties,
  };
}

export const HANDLE_STYLE_INPUT: React.CSSProperties = {
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  border: '2px solid #64748b',
  backgroundColor: '#fff',
};

export const HANDLE_STYLE_OUTPUT: React.CSSProperties = {
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  border: '2px solid #64748b',
  backgroundColor: '#fff',
};

export function getConditionHandleStyle(isTrue: boolean): React.CSSProperties {
  return {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: `2px solid ${isTrue ? '#10b981' : '#ef4444'}`,
    backgroundColor: '#fff',
  };
}
