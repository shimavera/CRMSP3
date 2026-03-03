import { useState, useEffect } from 'react';
import {
  X, Activity, CheckCircle2, XCircle, PauseCircle, Loader2,
  ChevronDown, ChevronRight, Filter, Clock, User, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { FlowExecution } from '../../lib/supabase';

type StatusFilter = 'all' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

type ExecutionWithLead = FlowExecution & {
  lead_nome?: string;
  lead_telefone?: string;
};

interface FlowExecutionLogProps {
  flowId: number;
  flowName: string;
  isDark: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Activity }> = {
  running:   { label: 'Rodando',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: Loader2 },
  paused:    { label: 'Pausado',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: PauseCircle },
  completed: { label: 'Completo',  color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle2 },
  failed:    { label: 'Falhou',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: XCircle },
  cancelled: { label: 'Cancelado', color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: XCircle },
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(startStr?: string, endStr?: string): string {
  if (!startStr || !endStr) return '—';
  const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
  if (ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

export default function FlowExecutionLog({ flowId, flowName, isDark, onClose }: FlowExecutionLogProps) {
  const [executions, setExecutions] = useState<ExecutionWithLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const loadExecutions = async () => {
    setIsLoading(true);

    // Step 1: buscar execuções
    const { data: execData, error } = await supabase
      .from('sp3_flow_executions')
      .select('*')
      .eq('flow_id', flowId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !execData) {
      setIsLoading(false);
      return;
    }

    // Step 2: buscar nomes dos leads separadamente
    const leadIds = [...new Set(execData.map((e: Record<string, unknown>) => e.lead_id as number))];
    let leadMap: Record<number, { nome: string; telefone: string }> = {};

    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('sp3chat')
        .select('id, nome, telefone')
        .in('id', leadIds);

      if (leads) {
        leadMap = Object.fromEntries(
          leads.map((l: Record<string, unknown>) => [l.id as number, { nome: l.nome as string, telefone: l.telefone as string }])
        );
      }
    }

    // Combinar
    const mapped: ExecutionWithLead[] = execData.map((row: Record<string, unknown>) => ({
      ...row,
      lead_nome: leadMap[row.lead_id as number]?.nome || undefined,
      lead_telefone: leadMap[row.lead_id as number]?.telefone || undefined,
    } as ExecutionWithLead));

    setExecutions(mapped);
    setIsLoading(false);
  };

  useEffect(() => {
    loadExecutions();
  }, [flowId]);

  const filtered = statusFilter === 'all'
    ? executions
    : executions.filter(e => e.status === statusFilter);

  const counts = executions.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bg = isDark ? '#0f0f1a' : '#f8fafc';
  const cardBg = isDark ? '#1a1a2e' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#e0e0e0' : '#1a1a2e';
  const textSecondary = isDark ? '#888' : '#64748b';
  const textMuted = isDark ? '#555' : '#94a3b8';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '90%',
        maxWidth: '640px',
        maxHeight: '85vh',
        backgroundColor: bg,
        borderRadius: '16px',
        border: `1px solid ${border}`,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            backgroundColor: 'rgba(99,102,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Activity size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {flowName}
            </div>
            <div style={{ fontSize: '0.7rem', color: textSecondary }}>
              {executions.length} execu{executions.length === 1 ? 'ção' : 'ções'} total
              {counts.running ? ` \u00b7 ${counts.running} rodando` : ''}
              {counts.failed ? ` \u00b7 ${counts.failed} falha(s)` : ''}
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={loadExecutions}
            title="Atualizar"
            style={{
              padding: '6px', borderRadius: '8px', border: `1px solid ${border}`,
              backgroundColor: 'transparent', color: textSecondary, cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} style={isLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>

          {/* Filter */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              style={{
                padding: '6px 10px', borderRadius: '8px',
                border: `1px solid ${statusFilter !== 'all' ? 'var(--accent)' : border}`,
                backgroundColor: statusFilter !== 'all' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: statusFilter !== 'all' ? 'var(--accent)' : textSecondary,
                cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <Filter size={12} />
              {statusFilter === 'all' ? 'Filtrar' : STATUS_CONFIG[statusFilter]?.label}
            </button>
            {showFilterMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                backgroundColor: cardBg, borderRadius: '10px',
                border: `1px solid ${border}`,
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                zIndex: 10, minWidth: '140px', padding: '4px',
              }}>
                {(['all', 'running', 'completed', 'paused', 'failed', 'cancelled'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setShowFilterMenu(false); }}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: '6px',
                      border: 'none', textAlign: 'left',
                      backgroundColor: statusFilter === s ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)') : 'transparent',
                      color: s === 'all' ? textPrimary : STATUS_CONFIG[s].color,
                      fontSize: '0.7rem', fontWeight: 500, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    {s === 'all' ? (
                      <><Activity size={12} /> Todos ({executions.length})</>
                    ) : (
                      <>
                        {(() => { const Icon = STATUS_CONFIG[s].icon; return <Icon size={12} />; })()}
                        {STATUS_CONFIG[s].label} ({counts[s] || 0})
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              padding: '6px', borderRadius: '8px', border: 'none',
              backgroundColor: 'transparent', color: textSecondary, cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={24} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              color: textMuted, fontSize: '0.8rem',
            }}>
              {executions.length === 0
                ? 'Nenhuma execu\u00e7\u00e3o registrada para este fluxo ainda.'
                : 'Nenhuma execu\u00e7\u00e3o com o filtro selecionado.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map(exec => {
                const cfg = STATUS_CONFIG[exec.status] || STATUS_CONFIG.cancelled;
                const StatusIcon = cfg.icon;
                const isExpanded = expandedId === exec.id;
                const log = exec.execution_log || [];

                return (
                  <div key={exec.id} style={{
                    borderRadius: '10px',
                    border: `1px solid ${isExpanded ? 'var(--accent)' : border}`,
                    backgroundColor: cardBg,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}>
                    {/* Execution row */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : exec.id)}
                      style={{
                        width: '100%', padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        border: 'none', backgroundColor: 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      {/* Status badge */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '3px 8px', borderRadius: '6px',
                        backgroundColor: cfg.bg, color: cfg.color,
                        fontSize: '0.62rem', fontWeight: 600,
                        flexShrink: 0, minWidth: '80px',
                      }}>
                        <StatusIcon size={11} style={exec.status === 'running' ? { animation: 'spin 1s linear infinite' } : undefined} />
                        {cfg.label}
                      </div>

                      {/* Lead info */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={11} style={{ color: textMuted, flexShrink: 0 }} />
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 500, color: textPrimary,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {exec.lead_nome || `Lead #${exec.lead_id}`}
                        </span>
                      </div>

                      {/* Date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <Clock size={11} style={{ color: textMuted }} />
                        <span style={{ fontSize: '0.65rem', color: textSecondary }}>
                          {formatDate(exec.started_at)}
                        </span>
                      </div>

                      {/* Duration */}
                      <span style={{
                        fontSize: '0.62rem', color: textMuted,
                        minWidth: '50px', textAlign: 'right', flexShrink: 0,
                      }}>
                        {formatDuration(exec.started_at, exec.completed_at)}
                      </span>

                      {/* Expand icon */}
                      {isExpanded
                        ? <ChevronDown size={14} style={{ color: textMuted, flexShrink: 0 }} />
                        : <ChevronRight size={14} style={{ color: textMuted, flexShrink: 0 }} />
                      }
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{
                        borderTop: `1px solid ${border}`,
                        padding: '12px 14px',
                        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                      }}>
                        {/* Lead details */}
                        <div style={{
                          display: 'flex', gap: '16px', marginBottom: '12px',
                          fontSize: '0.65rem', color: textSecondary,
                        }}>
                          <span>ID: #{exec.id}</span>
                          {exec.lead_telefone && <span>Tel: {exec.lead_telefone}</span>}
                          {exec.pause_reason && <span>Motivo pausa: {exec.pause_reason}</span>}
                        </div>

                        {/* Timeline */}
                        {log.length === 0 ? (
                          <div style={{ fontSize: '0.68rem', color: textMuted, fontStyle: 'italic' }}>
                            Nenhum registro de execução detalhado disponível.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {log.map((entry, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                position: 'relative', paddingLeft: '18px', paddingBottom: i < log.length - 1 ? '8px' : '0',
                              }}>
                                {/* Vertical line */}
                                {i < log.length - 1 && (
                                  <div style={{
                                    position: 'absolute', left: '6px', top: '12px',
                                    width: '1px', bottom: '0',
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                  }} />
                                )}
                                {/* Dot */}
                                <div style={{
                                  position: 'absolute', left: '2px', top: '4px',
                                  width: '9px', height: '9px', borderRadius: '50%',
                                  backgroundColor: entry.action === 'failed' ? '#ef4444'
                                    : entry.action === 'completed' ? '#10b981'
                                    : 'var(--accent)',
                                  border: `2px solid ${isDark ? '#1a1a2e' : '#ffffff'}`,
                                  flexShrink: 0,
                                }} />

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontSize: '0.68rem', fontWeight: 600, color: textPrimary,
                                  }}>
                                    {entry.action}
                                    {entry.result && (
                                      <span style={{
                                        fontWeight: 400, color: textSecondary, marginLeft: '6px',
                                      }}>
                                        {'— '}{entry.result}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.6rem', color: textMuted }}>
                                    {entry.node_id} {'·'} {formatTime(entry.timestamp)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
