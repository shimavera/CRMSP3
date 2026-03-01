import React, { useMemo, useState } from 'react';
import {
    Users, Activity, CheckCircle2, TrendingUp, BarChart3,
    DollarSign, X, ArrowLeft
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import type { Lead } from '../lib/supabase';

interface DashboardViewProps {
    leads: Lead[];
}

// const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const DashboardView: React.FC<DashboardViewProps> = ({ leads }) => {
    const [dateRange, setDateRange] = useState<'7' | '30' | 'all'>('30');
    const [selectedMetric, setSelectedMetric] = useState<{ title: string, leads: Lead[] } | null>(null);

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
                <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    {(['7', '30', 'all'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                background: dateRange === range ? 'var(--accent)' : 'transparent',
                                color: dateRange === range ? 'white' : '#64748b',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
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
                    color="#6366f1"
                    onClick={() => setSelectedMetric({ title: 'Total de Leads', leads: metrics.total })}
                />
                <MetricCard
                    title="Forecast (Propostas)"
                    value={metrics.totalForecast.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    icon={<DollarSign size={20} />}
                    color="#10b981"
                    onClick={() => setSelectedMetric({ title: 'Forecast (Proposta)', leads: filteredLeads.filter(l => parseFloat((l.custom_fields as any)?.proposta_valor || '0') > 0) })}
                />
                <MetricCard
                    title="Agendamentos"
                    value={metrics.comReuniao.length}
                    icon={<Activity size={20} />}
                    color="#f59e0b"
                    onClick={() => setSelectedMetric({ title: 'Agendamentos', leads: metrics.comReuniao })}
                />
                <MetricCard
                    title="Vendas (Ganhos)"
                    value={metrics.ganhos.length}
                    icon={<CheckCircle2 size={20} />}
                    color="#ec4899"
                    onClick={() => setSelectedMetric({ title: 'Vendas (Ganhos)', leads: metrics.ganhos })}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isAfter(parseISO('2000-01-01'), subDays(new Date(), 1)) ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                {/* Gráfico Forecast por Stage */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={18} /> Previsão de Receita por Estágio
                    </h3>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer>
                            <BarChart data={forecastByStage} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fontWeight: 600 }} />
                                <RechartsTooltip
                                    formatter={(val: any) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    contentStyle={{ borderRadius: '12px' }}
                                />
                                <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico Timeline */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={18} /> Volume de Novos Leads
                    </h3>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer>
                            <LineChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                                <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Modal de Detalhes da Métrica */}
            {selectedMetric && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="fade-in" style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button onClick={() => setSelectedMetric(null)} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#64748b' }}><ArrowLeft size={18} /></button>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{selectedMetric.title}</h3>
                            </div>
                            <button onClick={() => setSelectedMetric(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                                        <th style={{ padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Lead</th>
                                        <th style={{ padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Status</th>
                                        <th style={{ padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Forecast</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedMetric.leads.length === 0 ? (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Nenhum lead nesta categoria</td></tr>
                                    ) : (
                                        selectedMetric.leads.map(lead => (
                                            <tr key={lead.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                <td style={{ padding: '12px' }}>
                                                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{lead.nome || lead.telefone}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{(lead.custom_fields as any)?.email || lead.telefone}</div>
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '20px', backgroundColor: '#f1f5f9', fontWeight: '700' }}>{lead.stage || lead.status || 'Novo'}</span>
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
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: `5px solid ${color}`, cursor: 'pointer', transition: 'transform 0.2s' }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>{title}</span>
            <div style={{ opacity: 0.8 }}>{icon}</div>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-primary)' }}>{value}</div>
    </div>
);

export default DashboardView;
