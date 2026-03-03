import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import type { WaitDelayNodeData } from '../utils/flowTypes';
import { getNodeStyle, HANDLE_STYLE_INPUT, HANDLE_STYLE_OUTPUT } from './nodeStyles';

const UNIT_LABELS: Record<string, string> = {
  minutes: 'minuto(s)',
  hours: 'hora(s)',
  days: 'dia(s)',
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
      <div style={s.badge}>
        <Clock size={10} />
        {d.delay_value || 1} {UNIT_LABELS[d.delay_unit] || 'dia(s)'}
      </div>
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE_OUTPUT} />
    </div>
  );
}
