import { type DragEvent } from 'react';
import {
  Plus, Play, MessageSquare, Clock, GitBranch, Zap, Flag,
  Trash2, Copy, ToggleLeft, ToggleRight, ChevronRight, Loader2,
} from 'lucide-react';
import type { FlowDefinition } from '../../lib/supabase';
import type { FlowNodeType } from './utils/flowTypes';
import { NODE_PALETTE } from './utils/flowTypes';
import { NODE_COLORS } from './nodes/nodeStyles';

const PALETTE_ICONS: Record<FlowNodeType, typeof Play> = {
  trigger: Play,
  send_message: MessageSquare,
  wait_delay: Clock,
  condition: GitBranch,
  action: Zap,
  end: Flag,
};

interface FlowSidebarProps {
  flows: FlowDefinition[];
  selectedFlowId: number | null;
  onSelectFlow: (id: number) => void;
  onCreateFlow: () => void;
  onDeleteFlow: (id: number) => void;
  onDuplicateFlow: (id: number) => void;
  onToggleActive: (id: number, active: boolean) => void;
  isLoading: boolean;
  isDark: boolean;
}

export default function FlowSidebar({
  flows,
  selectedFlowId,
  onSelectFlow,
  onCreateFlow,
  onDeleteFlow,
  onDuplicateFlow,
  onToggleActive,
  isLoading,
  isDark,
}: FlowSidebarProps) {

  const onDragStart = (event: DragEvent, nodeType: FlowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{
      width: '240px',
      minWidth: '240px',
      height: '100%',
      borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: isDark ? '#12121e' : '#ffffff',
      overflow: 'hidden',
    }}>
      {/* Flow List Section */}
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: isDark ? '#888' : '#64748b',
          }}>
            Fluxos
          </span>
          <button
            onClick={onCreateFlow}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--accent)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Novo
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <Loader2 size={20} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : flows.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '20px 8px',
            fontSize: '0.7rem',
            color: isDark ? '#666' : '#94a3b8',
          }}>
            Nenhum fluxo criado ainda.
            <br />Clique em "Novo" para começar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
            {flows.map(flow => (
              <div
                key={flow.id}
                onClick={() => onSelectFlow(flow.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedFlowId === flow.id
                    ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)')
                    : 'transparent',
                  border: selectedFlowId === flow.id
                    ? '1px solid var(--accent)'
                    : `1px solid transparent`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: flow.is_active ? '#10b981' : '#64748b',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: selectedFlowId === flow.id ? 600 : 500,
                  color: isDark ? '#e0e0e0' : '#1a1a2e',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {flow.name}
                </span>
                <ChevronRight size={12} style={{ color: isDark ? '#555' : '#94a3b8', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}

        {/* Actions for selected flow */}
        {selectedFlowId && (
          <div style={{
            display: 'flex',
            gap: '4px',
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            {(() => {
              const flow = flows.find(f => f.id === selectedFlowId);
              if (!flow) return null;
              return (
                <>
                  <button
                    onClick={() => onToggleActive(flow.id, !flow.is_active)}
                    title={flow.is_active ? 'Desativar' : 'Ativar'}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '6px',
                      borderRadius: '6px',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      backgroundColor: 'transparent',
                      color: flow.is_active ? '#10b981' : (isDark ? '#888' : '#64748b'),
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                    }}
                  >
                    {flow.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button
                    onClick={() => onDuplicateFlow(flow.id)}
                    title="Duplicar"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px',
                      borderRadius: '6px',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      backgroundColor: 'transparent',
                      color: isDark ? '#888' : '#64748b',
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteFlow(flow.id)}
                    title="Excluir"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px',
                      borderRadius: '6px',
                      border: '1px solid rgba(239,68,68,0.3)',
                      backgroundColor: 'transparent',
                      color: '#ef4444',
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Node Palette Section */}
      <div style={{
        padding: '16px',
        flex: 1,
        overflowY: 'auto',
      }}>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: isDark ? '#888' : '#64748b',
          display: 'block',
          marginBottom: '10px',
        }}>
          Arraste para o canvas
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {NODE_PALETTE.map(item => {
            const Icon = PALETTE_ICONS[item.type];
            const color = NODE_COLORS[item.type];
            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  backgroundColor: isDark ? '#1a1a2e' : '#f8fafc',
                  cursor: 'grab',
                  transition: 'all 0.15s',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: `${color}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div>
                  <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: isDark ? '#e0e0e0' : '#1a1a2e',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: '0.6rem',
                    color: isDark ? '#666' : '#94a3b8',
                  }}>
                    {item.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
