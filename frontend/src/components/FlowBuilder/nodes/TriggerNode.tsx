import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import type { TriggerNodeData } from '../utils/flowTypes';
import { getNodeStyle, HANDLE_STYLE_OUTPUT } from './nodeStyles';

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  stage_change: 'Mudança de Stage',
  new_lead: 'Novo Lead',
  no_response_timeout: 'Sem Resposta',
  external_lead: 'Lead do Site',
};

const UNIT_LABELS: Record<string, string> = {
  minutes: 'min',
  hours: 'h',
  days: 'dia(s)',
};

export default function TriggerNode({ data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  const isDark = document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';
  const s = getNodeStyle('trigger', !!selected, isDark);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <Play size={15} style={s.icon} />
        <span style={s.title}>{d.label || 'Gatilho'}</span>
      </div>
      <div style={s.subtitle}>{TRIGGER_LABELS[d.triggerType] || 'Manual'}</div>
      {d.triggerType === 'stage_change' && d.config?.to_stage && (
        <div style={s.badge}>→ {d.config.to_stage}</div>
      )}
      {d.triggerType === 'no_response_timeout' && d.config?.timeout_value && (
        <div style={s.badge}>{d.config.timeout_value} {UNIT_LABELS[d.config.timeout_unit] || 'min'} sem resposta</div>
      )}
      {d.triggerType === 'external_lead' && (
        <div style={s.badge}>Formulário externo</div>
      )}
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE_OUTPUT} />
    </div>
  );
}
