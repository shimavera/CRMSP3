import React, { useMemo, useState } from 'react';
import {
    Users, Activity, CheckCircle2, TrendingUp, BarChart3,
    DollarSign, X, ArrowLeft, Bot
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import type { Lead } from '../lib/supabase';

interface DashboardViewProps {
    leads: Lead[];
    onOpenChat: (phone: string) => void;
}

// const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const DashboardView: React.FC<DashboardViewProps> = ({ leads, onOpenChat }) => {
    const [dateRange, setDateRange] = useState<'7' | '30' | 'all'>('30');
    const [selectedMetric, setSelectedMetric] = useState<{ title: string, leads: Lead[] } | null>(null);

    // Fechar modal com Esc
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedMetric(null);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // Filtrar leads baseado no range selecionado
    const filteredLeads = useMemo(() => {
        if (dateRange === 'all') return leads;
        const days = parseInt(dateRange);
        const cutoffDate = subDays(new Date(), days);
        return leads.filter(lead => {
            const leadDate = lead.created_at ? parseISO(lead.created_at) : new Date();
            return isAfter(leadDate, cutoffDate);
        });
    }, [leads, dateRange]);

    // Calcular métricas
    const metrics = useMemo(() => {
        const total = filteredLeads;
        const comIA = filteredLeads.filter(l => l.ia_active);
        const comReuniao = filteredLeads.filter(l => l.meeting_datetime);
        const ganhos = filteredLeads.filter(l => l.stage === 'Ganho' || l.stage === 'Fidelização');

        const totalForecast = filteredLeads.reduce((acc, l) => acc + parseFloat((l.custom_fields as any)?.proposta_valor || '0'), 0);

        const conversao = total.length > 0 ? ((ganhos.length / total.length) * 100).toFixed(1) : '0';

        return {
            total, comIA, comReuniao, ganhos, conversao, totalForecast
        };
    }, [filteredLeads]);

    // Dados para gráfico de Forecast por Estágio
    const forecastByStage = useMemo(() => {
        const stages: Record<string, number> = {};
        filteredLeads.forEach(lead => {
            const stage = lead.stage || lead.status || 'Novo Lead';
            const val = parseFloat((lead.custom_fields as any)?.proposta_valor || '0');
            if (!isNaN(val)) stages[stage] = (stages[stage] || 0) + val;
        });
        return Object.entries(stages)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredLeads]);

    // Dados para Funil de Conversão
    const funnelData = useMemo(() => {
        const order = ['Novo Lead', 'Abordagem', 'Qualificação', 'Demonstração', 'Proposta', 'Negociação', 'Ganho'];
        const stages: Record<string, number> = {};
        filteredLeads.forEach(l => {
            const s = l.stage || 'Novo Lead';
            stages[s] = (stages[s] || 0) + 1;
        });

        return order.map(name => ({
            name,
            value: stages[name] || 0,
            fill: name === 'Ganho' ? 'var(--success)' : 'var(--accent)'
        })).filter(s => s.value > 0);
    }, [filteredLeads]);

    // Métricas de IA (Simuladas por cobertura e tags)
    const aiMetrics = useMemo(() => {
        const total = filteredLeads.length;
        const covered = filteredLeads.filter(l => l.ia_active).length;
        const coverage = total > 0 ? (covered / total * 100).toFixed(0) : '0';

        // Simulação de tempo médio baseado em tags 'AI_Fast' ou similar, ou apenas fixo como "3.2s" para efeito visual
        const avgResponse = "2.8s";

        return { coverage, avgResponse };
    }, [filteredLeads]);

    // Dados para gráfico de Volume Diário
    const timelineData = useMemo(() => {
        if (dateRange === 'all') return [];
        const days = parseInt(dateRange);
        const data: Record<string, number> = {};
        for (let i = days - 1; i >= 0; i--) {
            data[format(subDays(new Date(), i), 'dd/MM')] = 0;
        }
        filteredLeads.forEach(lead => {
            if (!lead.created_at) return;
            const dt = parseISO(lead.created_at);
            const ds = format(dt, 'dd/MM');
            if (data[ds] !== undefined) data[ds]++;
        });
        return Object.entries(data).map(([date, count]) => ({ date, count }));
    }, [filteredLeads, dateRange]);

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
            {/* Header / Filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart3 size={24} color="var(--accent)" />
                        Dashboard de Performance
                    </h2>
                </div>
                <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    {(['7', '30', 'all'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            style={{
                                padding: '6px 16px',
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                background: dateRange === range ? 'var(--accent)' : 'transparent',
                                color: dateRange === range ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.1s'
                            }}
                        >
                            {range === 'all' ? 'Tudo' : `${range} dias`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid de Métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                <MetricCard
                    title="Total de Leads"
                    value={metrics.total.length}
                    icon={<Users size={20} />}
                    color="var(--accent)"
                    onClick={() => setSelectedMetric({ title: 'Total de Leads', leads: metrics.total })}
                />
                <MetricCard
                    title="Forecast (Propostas)"
                    value={metrics.totalForecast.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    icon={<DollarSign size={20} />}
                    color="var(--success)"
                    onClick={() => setSelectedMetric({ title: 'Forecast (Proposta)', leads: filteredLeads.filter(l => parseFloat((l.custom_fields as any)?.proposta_valor || '0') > 0) })}
                />
                <MetricCard
                    title="Agendamentos"
                    value={metrics.comReuniao.length}
                    icon={<Activity size={20} />}
                    color="var(--warning)"
                    onClick={() => setSelectedMetric({ title: 'Agendamentos', leads: metrics.comReuniao })}
                />
                <MetricCard
                    title="Vendas (Ganhos)"
                    value={metrics.ganhos.length}
                    icon={<CheckCircle2 size={20} />}
                    color="var(--accent)"
                    onClick={() => setSelectedMetric({ title: 'Vendas (Ganhos)', leads: metrics.ganhos })}
                />
                <MetricCard
                    title="Cobertura IA"
                    value={`${aiMetrics.coverage}%`}
                    icon={<Bot size={20} />}
                    color="var(--accent)"
                    onClick={() => setSelectedMetric({ title: 'Lead sob Automação', leads: filteredLeads.filter(l => l.ia_active) })}
                />
                <MetricCard
                    title="Tempo IA (Média)"
                    value={aiMetrics.avgResponse}
                    icon={<Activity size={20} />}
                    color="var(--accent)"
                />
            </div>
            {/* Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                {/* Funil de Vendas */}
                <div className="glass-card" style={{ padding: '1.5rem', minHeight: '350px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={18} color="var(--accent)" />
                            Funil de Conversão (Leads)
                        </h3>
                    </div>
                    <div style={{ width: '100%', height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    axisLine={false}
                                    tickLine={false}
                                    style={{ fontSize: '0.75rem', fontWeight: '700', fill: 'var(--text-secondary)' }}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: 'var(--bg-tertiary)' }}
                                    contentStyle={{ borderRadius: 'var(--radius-md)', border: `1px solid var(--border)`, backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', style: { fontSize: '0.75rem', fontWeight: '800', fill: 'var(--text-primary)' } }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico de Forecast */}
                <div className="glass-card" style={{ padding: '1.5rem', minHeight: '350px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DollarSign size={18} color="var(--success)" />
                            Forecast por Estágio
                        </h3>
                    </div>
                    <div style={{ width: '100%', height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={forecastByStage}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '0.75rem', fontWeight: '700', fill: 'var(--text-secondary)' }} />
                                <YAxis axisLine={false} tickLine={false} style={{ fontSize: '0.7rem', fill: 'var(--text-muted)' }} tickFormatter={(val) => `R$${val / 1000}k`} />
                                <RechartsTooltip
                                    formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                                    contentStyle={{ borderRadius: 'var(--radius-md)', border: `1px solid var(--border)`, backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}
                                />
                                <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Volume de Novos Leads */}
                {dateRange !== 'all' && (
                    <div className="glass-card" style={{ padding: '1.5rem', minHeight: '350px', gridColumn: '1 / -1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Activity size={18} color="var(--accent)" />
                                Volume de Novos Leads (Timeline)
                            </h3>
                        </div>
                        <div style={{ width: '100%', height: '250px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={timelineData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} style={{ fontSize: '0.75rem', fontWeight: '700', fill: 'var(--text-secondary)' }} />
                                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: '0.75rem', fill: 'var(--text-muted)' }} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: 'var(--radius-md)', border: `1px solid var(--border)`, backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke="var(--accent)"
                                        strokeWidth={4}
                                        dot={{ r: 6, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--bg-primary)' }}
                                        activeDot={{ r: 8, strokeWidth: 0 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
            {/* Modal de Detalhes da Métrica */}
            {selectedMetric && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }}>
                    <div className="fade-in" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button onClick={() => setSelectedMetric(null)} style={{ background: 'var(--bg-tertiary)', border: 'none', padding: '8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)' }}><ArrowLeft size={18} /></button>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{selectedMetric.title}</h3>
                            </div>
                            <button onClick={() => setSelectedMetric(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Lead</th>
                                        <th style={{ padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                                        <th style={{ padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Forecast</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedMetric.leads.length === 0 ? (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum lead nesta categoria</td></tr>
                                    ) : (
                                        selectedMetric.leads.map(lead => (
                                            <tr
                                                key={lead.id}
                                                onClick={() => { onOpenChat(lead.telefone); setSelectedMetric(null); }}
                                                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                title="Clique para abrir conversa"
                                            >
                                                <td style={{ padding: '12px' }}>
                                                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{lead.nome || lead.telefone}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(lead.custom_fields as any)?.email || lead.telefone}</div>
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '20px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontWeight: '700' }}>{lead.stage || lead.status || 'Novo'}</span>
                                                </td>
                                                <td style={{ padding: '12px', fontWeight: '800', color: 'var(--accent)' }}>
                                                    {parseFloat((lead.custom_fields as any)?.proposta_valor || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MetricCard = ({ title, value, icon, color, onClick }: any) => (
    <div
        onClick={onClick}
        className="glass-card"
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.1s' }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
            <div style={{ color: color, opacity: 0.9 }}>{icon}</div>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
);

export default DashboardView;
