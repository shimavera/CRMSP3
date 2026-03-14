import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { ConditionNodeData } from '../utils/flowTypes';
import { getNodeStyle, HANDLE_STYLE_INPUT, getConditionHandleStyle } from './nodeStyles';

const CONDITION_LABELS: Record<string, string> = {
  lead_responded: 'Lead respondeu?',
  field_check: 'Verificar campo',
  stage_check: 'Verificar stage',
  custom_field_check: 'Campo personalizado',
  message_contains: 'Mensagem contém?',
};

export default function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  const isDark = document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';
  const s = getNodeStyle('condition', !!selected, isDark);

  return (
    <div style={s.container}>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE_INPUT} />
      <div style={s.header}>
        <GitBranch size={15} style={s.icon} />
        <span style={s.title}>{d.label || 'Condição'}</span>
      </div>
      <div style={s.subtitle}>{CONDITION_LABELS[d.condition_type] || d.condition_type}</div>
      {d.condition_type === 'stage_check' && d.config?.stage && (
        <div style={s.badge}>Stage: {d.config.stage}</div>
      )}
      {d.condition_type === 'field_check' && d.config?.field && (
        <div style={s.badge}>{d.config.field} {d.config.operator} {d.config.value}</div>
      )}
      {d.condition_type === 'message_contains' && d.config?.keyword && (
        <div style={s.badge}>Contém: "{d.config.keyword}"</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.6rem' }}>
        <span style={{ color: '#10b981', fontWeight: 600 }}>Sim</span>
        <span style={{ color: '#ef4444', fontWeight: 600 }}>Não</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ ...getConditionHandleStyle(true), left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ ...getConditionHandleStyle(false), left: '70%' }}
      />
    </div>
  );
}
