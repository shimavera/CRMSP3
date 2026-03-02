import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users, Phone, Calendar, XCircle, CheckCircle2,
    FileText, Handshake, Trophy, Trash2,
    TrendingUp, Clock, MoreHorizontal,
    Video, AlertCircle, Loader2, ArrowRight, Bell, Filter,
    CheckSquare, Square
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

type Stage =
    | 'Novo Lead'
    | 'Contato Iniciado'
    | 'Em Follow-up'
    | 'Qualificando'
    | 'Reunião Agendada'
    | 'No Show'
    | 'Reunião Realizada'
    | 'Proposta Enviada'
    | 'Negociação'
    | 'Fechado'
    | 'Perdido';

interface Lead {
    id: number;
    nome?: string;
    telefone: string;
    status?: string;
    stage?: Stage;
    ia_active?: boolean;
    created_at?: string;
    meeting_datetime?: string;
    meeting_link?: string;
    meeting_status?: string;
    proposal_status?: string;
    closed_reason?: string;
    stage_updated_at?: string;
    followup_stage?: number;
    followup_locked?: boolean;
    last_interaction_at?: string;
    tasks?: { id: string; title: string; due_date: string; completed: boolean }[];
    custom_fields?: Record<string, string>;
}

// ─── CONFIG DAS COLUNAS ───────────────────────────────────────────────────────

const DEFAULT_PIPELINE: { stage: Stage; color: string; bg: string; icon: any; description: string }[] = [
    { stage: 'Novo Lead', color: '#6366f1', bg: '#eef2ff', icon: Users, description: 'Lead recém captado' },
    { stage: 'Contato Iniciado', color: '#0ea5e9', bg: '#f0f9ff', icon: Phone, description: 'Primeiro contato feito' },
    { stage: 'Em Follow-up', color: '#f97316', bg: '#fff7ed', icon: Bell, description: 'Aguardando retorno' },
    { stage: 'Qualificando', color: '#8b5cf6', bg: '#f5f3ff', icon: TrendingUp, description: 'Coletando informações' },
    { stage: 'Reunião Agendada', color: '#f59e0b', bg: '#fffbeb', icon: Calendar, description: 'Reunião marcada' },
    { stage: 'No Show', color: '#ef4444', bg: '#fef2f2', icon: AlertCircle, description: 'Não compareceu' },
    { stage: 'Reunião Realizada', color: '#10b981', bg: '#f0fdf4', icon: CheckCircle2, description: 'Reunião concluída' },
    { stage: 'Proposta Enviada', color: '#f97316', bg: '#fff7ed', icon: FileText, description: 'Proposta em análise' },
    { stage: 'Negociação', color: '#ec4899', bg: '#fdf4ff', icon: Handshake, description: 'Negociando contrato' },
    { stage: 'Fechado', color: '#059669', bg: '#ecfdf5', icon: Trophy, description: 'Cliente convertido' },
    { stage: 'Perdido', color: '#64748b', bg: '#f8fafc', icon: XCircle, description: 'Oportunidade perdida' },
];

const FUNIS_DISPONIVEIS = [
    { id: 'vendas', nome: 'Pré-consulta / Venda', etapas: DEFAULT_PIPELINE },
    {
        id: 'pos_venda', nome: 'Pós-venda / Fidelização', etapas: [
            { stage: 'Novo Lead', color: '#6366f1', bg: '#eef2ff', icon: Users, description: 'Paciente para retorno' },
            { stage: 'Contato Iniciado', color: '#0ea5e9', bg: '#f0f9ff', icon: Phone, description: 'Pesquisa NPS enviada' },
            { stage: 'Agendou Retorno', color: '#10b981', bg: '#f0fdf4', icon: Calendar, description: 'Retorno marcado' },
            { stage: 'Fechado', color: '#059669', bg: '#ecfdf5', icon: Trophy, description: 'Elogio recebido' },
            { stage: 'Perdido', color: '#ef4444', bg: '#fef2f2', icon: XCircle, description: 'Reclamação/Insatisfeito' }
        ]
    }
];

// ─── CAMPOS PERSONALIZADOS DEMOMAÇÃO ──────────────────────────────────────────
const CUSTOM_FIELDS_CONFIG: Array<{ key: string, label: string, type: string, placeholder?: string, options?: string[] }> = [
    { key: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
    { key: 'plano_saude', label: 'Plano de Saúde', type: 'select', options: ['Particular', 'Unimed', 'Amil', 'Bradesco Saúde', 'SulAmérica'] },
    { key: 'data_nascimento', label: 'Data de Nascimento', type: 'date' },
    { key: 'data_avaliacao', label: 'Data da Avaliação', type: 'date' },
    { key: 'email', label: 'E-mail', type: 'email', placeholder: 'email@exemplo.com' },
    { key: 'proposta_valor', label: 'Valor da Proposta / Forecast', type: 'number', placeholder: 'Ex: 1500' }
];

// ─── COMPONENTE CARD ──────────────────────────────────────────────────────────

const LeadCard = (props: {
    lead: Lead;
    stageColor: string;
    onMove: (leadId: number, newStage: Stage | string) => void;
    onDelete: (leadId: number) => void;
    onClick: (lead: Lead) => void;
    currentPipeline?: any[];
    index: number;
}) => {
    const { lead, stageColor, onMove, onDelete, onClick, currentPipeline, index } = props;
    const [showMenu, setShowMenu] = useState(false);
    const daysInStage = lead.stage_updated_at
        ? Math.floor((Date.now() - new Date(lead.stage_updated_at).getTime()) / 86400000)
        : 0;

    const pendingTasks = lead.tasks?.filter(t => !t.completed).length || 0;

    return (
        <Draggable draggableId={lead.id.toString()} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onClick(lead)}
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        marginBottom: '10px',
                        boxShadow: snapshot.isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm), 0 0 0 1px rgba(0,0,0,0.02)',
                        cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                        border: '1px solid var(--border)',
                        borderLeft: `4px solid ${stageColor}`,
                        opacity: 1,
                        transform: snapshot.isDragging ? 'scale(1.02) translateY(-2px)' : 'scale(1)',
                        transition: 'box-shadow 0.2s, transform 0.2s',
                        position: 'relative',
                        userSelect: 'none',
                        ...provided.draggableProps.style,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {lead.nome || 'Lead s/ nome'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                {lead.telefone}
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', flexShrink: 0 }}
                        >
                            <MoreHorizontal size={16} />
                        </button>
                    </div>

                    {/* Tags */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {lead.created_at && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', backgroundColor: '#e2e8f0', color: '#475569', fontWeight: '600' }}>
                                📥 Entrou em {new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                        )}
                        {lead.followup_stage != null && lead.followup_stage > 0 && (
                            <span style={{
                                fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px',
                                backgroundColor: lead.followup_stage >= 3 ? '#fca5a5' : '#fee2e2',
                                color: '#991b1b', fontWeight: '800'
                            }}>
                                {lead.followup_stage >= 3 ? '🚨' : '⏱'} {lead.followup_stage}º Follow-up
                            </span>
                        )}
                        {lead.followup_locked && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '800' }}>
                                🔒 F.UP Travado
                            </span>
                        )}
                        {lead.meeting_status === 'scheduled' && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: '600' }}>
                                📅 Reunião marcada
                            </span>
                        )}
                        {lead.meeting_status === 'completed' && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', backgroundColor: '#d1fae5', color: '#065f46', fontWeight: '600' }}>
                                ✅ Reunião feita
                            </span>
                        )}
                        {lead.proposal_status === 'sent' && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', backgroundColor: '#ffedd5', color: '#9a3412', fontWeight: '600' }}>
                                📄 Proposta enviada
                            </span>
                        )}
                        {lead.ia_active && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', backgroundColor: '#ede9fe', color: '#5b21b6', fontWeight: '600' }}>
                                🤖 IA ativa
                            </span>
                        )}
                        {pendingTasks > 0 && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckSquare size={10} /> {pendingTasks} Tarefa{pendingTasks > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* Tempo no estágio */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', padding: daysInStage >= 5 ? '4px 8px' : '0', background: daysInStage >= 5 ? '#fff1f2' : 'transparent', borderRadius: '8px', width: 'fit-content' }}>
                        <Clock size={11} color={daysInStage >= 3 ? '#ef4444' : '#94a3b8'} />
                        <span style={{ fontSize: '0.65rem', color: daysInStage >= 3 ? '#ef4444' : '#94a3b8', fontWeight: daysInStage >= 5 ? '800' : '500' }}>
                            {daysInStage === 0 ? 'Atualizado hoje' : `${daysInStage}d parado`}
                        </span>
                        {daysInStage >= 5 && <AlertCircle size={10} color="#ef4444" style={{ animation: 'bounce 1s infinite' }} />}
                    </div>

                    {/* Menu de ações rápidas */}
                    {showMenu && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'absolute', top: '36px', right: '8px', zIndex: 100,
                                backgroundColor: 'white', borderRadius: '10px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '6px',
                                minWidth: '180px', border: '1px solid #f1f5f9'
                            }}
                        >
                            <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', padding: '4px 8px', textTransform: 'uppercase' }}>Mover para</div>
                            {(currentPipeline || []).filter((p: any) => p.stage !== lead.stage).map((p: any) => (
                                <button
                                    key={p.stage}
                                    onClick={() => { onMove(lead.id, p.stage); setShowMenu(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        width: '100%', padding: '6px 8px', background: 'none',
                                        border: 'none', cursor: 'pointer', borderRadius: '6px',
                                        fontSize: '0.78rem', color: '#374151', textAlign: 'left'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <ArrowRight size={12} color={p.color} />
                                    {p.stage}
                                </button>
                            ))}
                            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />
                            <button
                                onClick={() => { onDelete(lead.id); setShowMenu(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    width: '100%', padding: '6px 8px', background: 'none',
                                    border: 'none', cursor: 'pointer', borderRadius: '6px',
                                    fontSize: '0.78rem', color: '#ef4444', textAlign: 'left'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                <Trash2 size={12} /> Remover lead
                            </button>
                        </div>
                    )}
                </div>
            )}
        </Draggable>
    );
};

// ─── MODAL DE DETALHES ────────────────────────────────────────────────────────

const LeadDetailModal = ({ lead, onClose, onUpdate, currentPipeline }: { lead: Lead; onClose: () => void; onUpdate: (updated: Lead) => void; currentPipeline: any[] }) => {
    const [form, setForm] = useState({
        ...lead,
        tasks: lead.tasks || [],
        custom_fields: lead.custom_fields || {}
    });
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'tasks' | 'custom'>('details');

    // Nova Tarefa
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDate, setNewTaskDate] = useState('');

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('sp3chat')
            .update({
                stage: form.stage,
                meeting_datetime: form.meeting_datetime,
                meeting_link: form.meeting_link,
                meeting_status: form.meeting_status,
                proposal_status: form.proposal_status,
                closed_reason: form.closed_reason,
                stage_updated_at: form.stage !== lead.stage ? new Date().toISOString() : lead.stage_updated_at,
                tasks: form.tasks,
                custom_fields: form.custom_fields
            })
            .eq('id', lead.id);

        setSaving(false);
        if (!error) onUpdate({ ...lead, ...form });
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', width: '480px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h3 style={{ fontWeight: '800', fontSize: '1.1rem', color: '#1e293b' }}>{lead.nome || 'Lead s/ nome'}</h3>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{lead.telefone}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#94a3b8' }}>×</button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                    <button onClick={() => setActiveTab('details')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'details' ? '2px solid #6366f1' : '2px solid transparent', color: activeTab === 'details' ? '#6366f1' : '#64748b', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>Detalhes</button>
                    <button onClick={() => setActiveTab('custom')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'custom' ? '2px solid #6366f1' : '2px solid transparent', color: activeTab === 'custom' ? '#6366f1' : '#64748b', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>Campos Extra</button>
                    <button onClick={() => setActiveTab('tasks')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'tasks' ? '2px solid #6366f1' : '2px solid transparent', color: activeTab === 'tasks' ? '#6366f1' : '#64748b', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                        Tarefas {form.tasks.filter(t => !t.completed).length > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.6rem', marginLeft: '4px' }}>{form.tasks.filter(t => !t.completed).length}</span>}
                    </button>
                </div>

                {activeTab === 'details' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Estágio</label>
                            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as Stage }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                                {currentPipeline.map(p => <option key={p.stage} value={p.stage}>{p.stage}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>📅 Data da Reunião</label>
                            <input type="datetime-local" value={form.meeting_datetime ? form.meeting_datetime.slice(0, 16) : ''} onChange={e => setForm(f => ({ ...f, meeting_datetime: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>🔗 Link da Reunião</label>
                            <input type="url" value={form.meeting_link || ''} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))} placeholder="https://meet.google.com/..." style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Status da Reunião</label>
                            <select value={form.meeting_status || ''} onChange={e => setForm(f => ({ ...f, meeting_status: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                                <option value="">-- Nenhum --</option>
                                <option value="scheduled">Agendada</option>
                                <option value="completed">Realizada</option>
                                <option value="no_show">No Show</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Status da Proposta</label>
                            <select value={form.proposal_status || ''} onChange={e => setForm(f => ({ ...f, proposal_status: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                                <option value="">-- Nenhum --</option>
                                <option value="sent">Enviada</option>
                                <option value="accepted">Aceita</option>
                                <option value="rejected">Rejeitada</option>
                            </select>
                        </div>

                        {(form.stage === 'Perdido') && (
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Motivo da Perda</label>
                                <textarea value={form.closed_reason || ''} onChange={e => setForm(f => ({ ...f, closed_reason: e.target.value }))} rows={3} placeholder="Ex: Preço alto, sem urgência..." style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }} />
                            </div>
                        )}

                        {form.meeting_link && (
                            <a href={form.meeting_link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#f0fdf4', borderRadius: '10px', color: '#059669', fontWeight: '700', fontSize: '0.85rem', textDecoration: 'none', border: '1px solid #dcfce7' }}>
                                <Video size={16} /> Entrar na Reunião
                            </a>
                        )}
                    </div>
                )}

                {activeTab === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {CUSTOM_FIELDS_CONFIG.map(field => (
                            <div key={field.key}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>{field.label}</label>
                                {field.type === 'select' ? (
                                    <select
                                        value={form.custom_fields[field.key] || ''}
                                        onChange={e => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [field.key]: e.target.value } }))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', backgroundColor: 'white' }}
                                    >
                                        <option value="">-- Selecione --</option>
                                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type={field.type}
                                        placeholder={field.placeholder}
                                        value={form.custom_fields[field.key] || ''}
                                        onChange={e => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [field.key]: e.target.value } }))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Nova Tarefa */}
                        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#1e293b' }}>Criar Lembrete</h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" placeholder="Ex: Ligar para confirmar..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
                                <input type="datetime-local" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} style={{ width: '200px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button
                                    disabled={!newTaskTitle || !newTaskDate}
                                    onClick={() => {
                                        setForm(f => ({
                                            ...f,
                                            tasks: [...f.tasks, { id: Date.now().toString(), title: newTaskTitle, due_date: newTaskDate, completed: false }]
                                        }));
                                        setNewTaskTitle('');
                                        setNewTaskDate('');
                                    }}
                                    style={{ padding: '6px 16px', borderRadius: '8px', backgroundColor: '#6366f1', color: 'white', border: 'none', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', opacity: (!newTaskTitle || !newTaskDate) ? 0.5 : 1 }}
                                >
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        {/* Lista de Tarefas */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {form.tasks.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>Nenhum lembrete para este lead.</p>
                            ) : (
                                form.tasks.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).map(task => {
                                    const isOverdue = !task.completed && isPast(new Date(task.due_date));
                                    const isDueToday = !task.completed && isToday(new Date(task.due_date));

                                    return (
                                        <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', borderRadius: '10px', backgroundColor: task.completed ? '#f8fafc' : 'white', border: `1px solid ${task.completed ? '#e2e8f0' : (isOverdue ? '#fca5a5' : '#e2e8f0')}`, opacity: task.completed ? 0.7 : 1 }}>
                                            <button
                                                onClick={() => setForm(f => ({ ...f, tasks: f.tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t) }))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: task.completed ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center' }}
                                            >
                                                {task.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </button>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '0.9rem', fontWeight: '600', color: task.completed ? '#94a3b8' : '#1e293b', textDecoration: task.completed ? 'line-through' : 'none', marginBottom: '4px' }}>{task.title}</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: task.completed ? '#94a3b8' : (isOverdue ? '#ef4444' : (isDueToday ? '#f59e0b' : '#64748b')), fontWeight: (!task.completed && (isOverdue || isDueToday)) ? '700' : '500' }}>
                                                    <Clock size={12} />
                                                    {format(new Date(task.due_date), "dd/MMM 'às' HH:mm", { locale: ptBR })}
                                                    {isOverdue && ' (Atrasada)'}
                                                    {isDueToday && ' (Hoje)'}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setForm(f => ({ ...f, tasks: f.tasks.filter(t => t.id !== task.id) }))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', opacity: 0.5 }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                <button onClick={handleSave} disabled={saving} style={{ marginTop: '1.5rem', width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#6366f1', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
        </div>
    );
};

// ─── MÉTRICAS ────────────────────────────────────────────────────────────────

const MetricsBar = ({ leads }: { leads: Lead[] }) => {
    const total = leads.length;
    const agendadas = leads.filter(l => l.stage === 'Reunião Agendada' || l.stage === 'Reunião Realizada' || l.stage === 'No Show').length;
    const realizadas = leads.filter(l => l.stage === 'Reunião Realizada').length;
    const noShow = leads.filter(l => l.stage === 'No Show').length;
    const fechados = leads.filter(l => l.stage === 'Fechado').length;
    const contatoIniciado = leads.filter(l => l.stage !== 'Novo Lead').length;

    const pct = (n: number, d: number) => d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`;

    const metrics = [
        { label: 'Taxa de Contato', value: pct(contatoIniciado, total), color: '#0ea5e9' },
        { label: 'Taxa de Agendamento', value: pct(agendadas, contatoIniciado), color: '#f59e0b' },
        { label: 'Show Rate', value: pct(realizadas, agendadas), color: '#10b981' },
        { label: 'No Show Rate', value: pct(noShow, agendadas), color: '#ef4444' },
        { label: 'Close Rate', value: pct(fechados, realizadas), color: '#6366f1' },
        { label: 'Total de Leads', value: String(total), color: '#8b5cf6' },
    ];

    return (
        <div style={{ display: 'flex', gap: '14px', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {metrics.map(m => (
                <div key={m.label} className="glass-card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px', flex: 1, borderTop: `3px solid ${m.color}` }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{m.value}</span>
                </div>
            ))}
        </div>
    );
};

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

const KanbanView = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showMetrics, setShowMetrics] = useState(true);

    // Funil State
    const [activePipelineId, setActivePipelineId] = useState('vendas');
    const currentPipeline = useMemo(() => FUNIS_DISPONIVEIS.find(f => f.id === activePipelineId)?.etapas || DEFAULT_PIPELINE, [activePipelineId]);

    // Filter states
    const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [showFilterOptions, setShowFilterOptions] = useState(false);

    const fetchLeads = async () => {
        const { data, error } = await supabase
            .from('sp3chat')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Leads sem stage recebem 'Novo Lead' por padrão
            setLeads(data.map(l => ({ ...l, stage: l.stage || 'Novo Lead' })));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLeads();

        // Realtime: atualizar kanban automaticamente (MCP)
        const channel = supabase
            .channel('kanban-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sp3chat' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setLeads(prev => [{ ...payload.new as Lead, stage: (payload.new as Lead).stage || 'Novo Lead' }, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setLeads(prev => prev.map(l => l.id === (payload.new as Lead).id ? { ...l, ...payload.new as Lead } : l));
                } else if (payload.eventType === 'DELETE') {
                    setLeads(prev => prev.filter(l => l.id !== (payload.old as Lead).id));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const moveCard = async (leadId: number, newStage: Stage | string) => {
        // Atualizar localmente (otimista) - cast to any or define generalized Stage type
        setLeads(prev => prev.map(l =>
            l.id === leadId ? { ...l, stage: newStage as any, stage_updated_at: new Date().toISOString() } : l
        ));

        // Determinar campos extras baseado no novo estágio
        const extras: any = { stage: newStage, stage_updated_at: new Date().toISOString() };
        if (newStage === 'Reunião Agendada') extras.meeting_status = 'scheduled';
        if (newStage === 'No Show') extras.meeting_status = 'no_show';
        if (newStage === 'Reunião Realizada') extras.meeting_status = 'completed';
        if (newStage === 'Proposta Enviada') extras.proposal_status = 'sent';

        await supabase.from('sp3chat').update(extras).eq('id', leadId);
    };

    const deleteCard = async (leadId: number) => {
        if (!confirm('Remover este lead do Kanban?')) return;
        setLeads(prev => prev.filter(l => l.id !== leadId));
        await supabase.from('sp3chat').update({ stage: null }).eq('id', leadId);
    };

    // ── Drag and Drop (@hello-pangea/dnd) ────────────────────────────────────────────────────────
    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return; // Fora droppable

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return; // Mesmo lugar
        }

        moveCard(Number(draggableId), destination.droppableId);
    };

    // Filtros de data
    const filteredLeads = useMemo(() => {
        if (dateFilterMode === 'all') return leads;

        const now = new Date();
        return leads.filter(l => {
            if (!l.created_at) return false;

            const leadDate = new Date(l.created_at);

            if (dateFilterMode === 'today') {
                return leadDate.toDateString() === now.toDateString();
            }
            if (dateFilterMode === 'week') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(now.getDate() - 7);
                return leadDate >= oneWeekAgo && leadDate <= now;
            }
            if (dateFilterMode === 'month') {
                return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
            }
            if (dateFilterMode === 'custom') {
                if (startDate && leadDate < new Date(startDate + 'T00:00:00')) return false;
                if (endDate && leadDate > new Date(endDate + 'T23:59:59')) return false;
                return true;
            }
            return true;
        });
    }, [leads, dateFilterMode, startDate, endDate]);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px', color: '#6366f1' }}>
            <Loader2 className="animate-spin" size={28} /> <span style={{ fontWeight: '700' }}>Carregando pipeline...</span>
        </div>
    );

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
            {/* Header da Pipeline */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <h2 style={{ fontWeight: '900', fontSize: '1.6rem', color: 'var(--text-primary)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        Pipeline
                        <select
                            value={activePipelineId}
                            onChange={e => setActivePipelineId(e.target.value)}
                            style={{
                                background: 'transparent', border: 'none', fontSize: '1.6rem', fontWeight: '900',
                                color: 'var(--accent)', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none'
                            }}
                        >
                            {FUNIS_DISPONIVEIS.map(f => (
                                <option key={f.id} value={f.id} style={{ fontSize: '1rem', color: 'black' }}>{f.nome}</option>
                            ))}
                        </select>
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: '500' }}>
                        {filteredLeads.filter(l => currentPipeline.some(cp => cp.stage === (l.stage || 'Novo Lead'))).length} leads neste funil · Realtime ativo
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowFilterOptions(!showFilterOptions)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', border: dateFilterMode !== 'all' ? '1px solid var(--accent)' : '1px solid var(--border)', backgroundColor: dateFilterMode !== 'all' ? 'var(--accent-soft)' : 'var(--bg-secondary)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', color: dateFilterMode !== 'all' ? 'var(--accent)' : 'var(--text-primary)', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' }}
                        >
                            <Filter size={16} />
                            {dateFilterMode === 'all' ? 'Filtro: Todo Período' :
                                dateFilterMode === 'today' ? 'Filtro: Hoje' :
                                    dateFilterMode === 'week' ? 'Filtro: Últimos 7 dias' :
                                        dateFilterMode === 'month' ? 'Filtro: Este Mês' : 'Filtro: Período Específico'}
                        </button>

                        {showFilterOptions && (
                            <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '8px', zIndex: 100, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid var(--border)', width: '320px', padding: '16px' }}>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Filtrar por data</h4>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                                    {['all', 'today', 'week', 'month', 'custom'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setDateFilterMode(mode as any)}
                                            style={{ padding: '8px 12px', textAlign: 'left', background: dateFilterMode === mode ? 'var(--accent-soft)' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', color: dateFilterMode === mode ? 'var(--accent)' : 'var(--text-primary)', fontWeight: dateFilterMode === mode ? '700' : '500', fontSize: '0.85rem' }}
                                        >
                                            {mode === 'all' && '🔄 Todo o Período'}
                                            {mode === 'today' && '📅 Data de Hoje'}
                                            {mode === 'week' && '📆 Últimos 7 dias'}
                                            {mode === 'month' && '📊 Este Mês'}
                                            {mode === 'custom' && '⚙️ Período Específico'}
                                        </button>
                                    ))}
                                </div>

                                {dateFilterMode === 'custom' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-soft)', paddingTop: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Data Inicial</label>
                                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '4px', fontSize: '0.85rem' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Data Final</label>
                                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '4px', fontSize: '0.85rem' }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowMetrics(!showMetrics)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}
                    >
                        <TrendingUp size={16} /> {showMetrics ? 'Ocultar' : 'Ver'} Métricas
                    </button>
                </div>
            </div>

            {/* Métricas */}
            {showMetrics && <MetricsBar leads={filteredLeads.filter(l => currentPipeline.some(cp => cp.stage === (l.stage || 'Novo Lead')))} />}

            {/* Board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', flex: 1, paddingBottom: '1rem' }}>
                    {currentPipeline.map(col => {
                        const colLeads = filteredLeads.filter(l => (l.stage || 'Novo Lead') === col.stage);

                        return (
                            <Droppable droppableId={col.stage} key={col.stage}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        style={{
                                            minWidth: '240px',
                                            width: '240px',
                                            backgroundColor: snapshot.isDraggingOver ? col.bg : '#f8fafc',
                                            borderRadius: '12px',
                                            padding: '12px',
                                            border: snapshot.isDraggingOver ? `2px dashed ${col.color}` : '2px solid transparent',
                                            transition: 'background-color 0.2s ease, border 0.2s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            maxHeight: '100%',
                                        }}
                                    >
                                        {/* Header da coluna */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: `2px solid ${col.color}20` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${col.color}30` }}>
                                                    <col.icon size={14} color={col.color} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '800', fontSize: '0.78rem', color: '#1e293b' }}>{col.stage}</div>
                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{col.description}</div>
                                                </div>
                                            </div>
                                            <span style={{ backgroundColor: col.bg, color: col.color, fontWeight: '800', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', border: `1px solid ${col.color}30` }}>
                                                {colLeads.length}
                                            </span>
                                        </div>

                                        {/* Cards */}
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            {colLeads.map((lead, index) => (
                                                <LeadCard
                                                    key={lead.id.toString()}
                                                    index={index}
                                                    lead={lead}
                                                    stageColor={col.color}
                                                    onMove={moveCard}
                                                    onDelete={deleteCard}
                                                    onClick={setSelectedLead}
                                                    currentPipeline={currentPipeline}
                                                />
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        );
                    })}
                </div>
            </DragDropContext>

            {/* Modal */}
            {selectedLead && (
                <LeadDetailModal
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                    currentPipeline={currentPipeline}
                    onUpdate={(updated) => {
                        setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                        setSelectedLead(null);
                    }}
                />
            )}
        </div>
    );
};

export default KanbanView;
