import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import type { ActionNodeData } from '../utils/flowTypes';
import { getNodeStyle, HANDLE_STYLE_INPUT, HANDLE_STYLE_OUTPUT } from './nodeStyles';

const ACTION_LABELS: Record<string, string> = {
  move_stage: 'Mover Stage',
  update_field: 'Atualizar Campo',
  lock_followup: 'Pausar Follow-up',
  unlock_followup: 'Retomar Follow-up',
  close_conversation: 'Fechar Conversa',
  update_calendar_confirmation: 'Atualizar Confirmação',
};

export default function ActionNode({ data, selected }: NodeProps) {
  const d = data as ActionNodeData;
  const isDark = document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';
  const s = getNodeStyle('action', !!selected, isDark);

  return (
    <div style={s.container}>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE_INPUT} />
      <div style={s.header}>
        <Zap size={15} style={s.icon} />
        <span style={s.title}>{d.label || 'Ação'}</span>
      </div>
      <div style={s.subtitle}>{ACTION_LABELS[d.action_type] || d.action_type}</div>
      {d.action_type === 'move_stage' && d.config?.stage && (
        <div style={s.badge}>→ {d.config.stage}</div>
      )}
      {d.action_type === 'close_conversation' && d.config?.reason && (
        <div style={s.badge}>{d.config.reason}</div>
      )}
      {d.action_type === 'update_calendar_confirmation' && d.config?.confirmation_status && (
        <div style={s.badge}>{d.config.confirmation_status === 'confirmed' ? '✓ Confirmado' : '✗ Não confirmado'}</div>
      )}
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE_OUTPUT} />
    </div>
  );
}
