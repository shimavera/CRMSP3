import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare, Mic, Image, Video } from 'lucide-react';
import type { SendMessageNodeData, FlowMessageItem } from '../utils/flowTypes';
import { getNodeStyle, HANDLE_STYLE_INPUT, HANDLE_STYLE_OUTPUT } from './nodeStyles';

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  text: MessageSquare,
  audio: Mic,
  image: Image,
  video: Video,
};

function getPreview(messages: FlowMessageItem[]): string {
  if (!messages || messages.length === 0) return 'Sem mensagens';
  const first = messages[0];
  if (first.message_type === 'text' && first.text_content) {
    const text = first.text_content;
    return text.length > 40 ? text.slice(0, 40) + '...' : text;
  }
  const labels: Record<string, string> = { audio: 'Audio', image: 'Imagem', video: 'Video' };
  return labels[first.message_type] || first.message_type;
}

export default function SendMessageNode({ data, selected }: NodeProps) {
  const d = data as SendMessageNodeData;
  const isDark = document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';
  const s = getNodeStyle('send_message', !!selected, isDark);

  const msgs = d.messages || [];
  const types = [...new Set(msgs.map(m => m.message_type))];

  return (
    <div style={s.container}>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE_INPUT} />
      <div style={s.header}>
        <MessageSquare size={15} style={s.icon} />
        <span style={s.title}>{d.label || 'Enviar Mensagem'}</span>
      </div>
      <div style={s.subtitle}>{getPreview(msgs)}</div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        {types.map(t => {
          const Icon = TYPE_ICONS[t] || MessageSquare;
          return (
            <div key={t} style={s.badge}>
              <Icon size={10} />
            </div>
          );
        })}
        {msgs.length > 1 && (
          <div style={s.badge}>{msgs.length} msgs</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE_OUTPUT} />
    </div>
  );
}
