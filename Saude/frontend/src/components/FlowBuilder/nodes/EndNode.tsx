import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Flag } from 'lucide-react';
import type { EndNodeData } from '../utils/flowTypes';
import { getNodeStyle, HANDLE_STYLE_INPUT } from './nodeStyles';

const OUTCOME_COLORS: Record<string, string> = {
  success: '#10b981',
  neutral: '#64748b',
  failed: '#ef4444',
};

const OUTCOME_LABELS: Record<string, string> = {
  success: 'Sucesso',
  neutral: 'Neutro',
  failed: 'Falhou',
};

export default function EndNode({ data, selected }: NodeProps) {
  const d = data as EndNodeData;
  const isDark = document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';
  const s = getNodeStyle('end', !!selected, isDark);
  const outcomeColor = OUTCOME_COLORS[d.outcome] || '#64748b';

  return (
    <div style={s.container}>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE_INPUT} />
      <div style={s.header}>
        <Flag size={15} style={{ ...s.icon, color: outcomeColor }} />
        <span style={s.title}>{d.label || 'Fim'}</span>
      </div>
      <div style={{
        ...s.badge,
        backgroundColor: `${outcomeColor}18`,
        color: outcomeColor,
      }}>
        {OUTCOME_LABELS[d.outcome] || d.outcome}
      </div>
    </div>
  );
}
