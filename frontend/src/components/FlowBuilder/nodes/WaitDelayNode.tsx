import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import type { WaitDelayNodeData } from '../utils/flowTypes';
import { getNodeStyle, HANDLE_STYLE_INPUT, HANDLE_STYLE_OUTPUT } from './nodeStyles';

const UNIT_LABELS: Record<string, string> = {
  minutes: 'minuto(s)',
  hours: 'hora(s)',
  days: 'dia(s)',
  minutes_before_meeting: 'min(s) antes da Reunião',
  hours_before_meeting: 'hora(s) antes da Reunião',
  days_before_meeting: 'dia(s) antes da Reunião',
};

export default function WaitDelayNode({ data, selected }: NodeProps) {
  const d = data as WaitDelayNodeData;
  const isDark = document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';
  const s = getNodeStyle('wait_delay', !!selected, isDark);

  return (
    <div style={s.container}>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE_INPUT} />
      <div style={s.header}>
        <Clock size={15} style={s.icon} />
        <span style={s.title}>{d.label || 'Aguardar'}</span>
      </div>
      <div style={{ ...s.badge, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={10} />
          {d.delay_value || 1} {UNIT_LABELS[d.delay_unit] || 'hora(s)'}
        </div>
        {d.business_hours && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
            <Clock size={10} /> Horário Comercial
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE_OUTPUT} />
    </div>
  );
}
