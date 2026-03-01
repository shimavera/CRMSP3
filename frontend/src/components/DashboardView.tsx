import React, { useMemo, useState } from 'react';
import {
    Users, Activity, CheckCircle2, TrendingUp, Filter, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { format, subDays, isAfter, parseISO, startOfDay } from 'date-fns';
import type { Lead } from '../lib/supabase';

interface DashboardViewProps {
    leads: Lead[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const DashboardView: React.FC<DashboardViewProps> = ({ leads }) => {
    const [dateRange, setDateRange] = useState<'7' | '30' | 'all'>('30');

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

    // Calcular métricas generais
    const metrics = useMemo(() => {
        const total = filteredLeads.length;
        const comIA = filteredLeads.filter(l => l.ia_active).length;
        const comReuniao = filteredLeads.filter(l => l.meeting_datetime).length;
        const ganhos = filteredLeads.filter(l => l.stage === 'Ganho' || l.stage === 'Fidelização').length;

        const conversao = total > 0 ? ((ganhos / total) * 100).toFixed(1) : '0';

        return { total, comIA, comReuniao, ganhos, conversao };
    }, [filteredLeads]);

    // Dados para gráfico de Leads por Estágio
    const stageData = useMemo(() => {
        const stages: Record<string, number> = {};

        filteredLeads.forEach(lead => {
            const stage = lead.stage || lead.status || 'Novo Lead';
            stages[stage] = (stages[stage] || 0) + 1;
        });

        // Ordenar os estágios por contagem descrescente
        return Object.entries(stages)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredLeads]);

    // Dados para gráfico de linha do tempo (Últimos dias)
    const timelineData = useMemo(() => {
        if (dateRange === 'all') return []; // Não mostramos gráfico diário para 'all' pois ficaria bagunçado

        const days = parseInt(dateRange);
        const data: Record<string, number> = {};

        // Inicializar todos os dias do range com 0
        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const dateStr = format(date, 'dd/MM');
            data[dateStr] = 0;
        }

        filteredLeads.forEach(lead => {
            if (!lead.created_at) return;
            const dt = parseISO(lead.created_at);
            // Mostrar apenas leads do range
            if (isAfter(dt, subDays(startOfDay(new Date()), days))) {
                const dateStr = format(dt, 'dd/MM');
                if (data[dateStr] !== undefined) {
                    data[dateStr]++;
                }
            }
        });

        return Object.entries(data).map(([date, count]) => ({ date, count }));
    }, [filteredLeads, dateRange]);

    // Dados Inteligência vs Manual
    const iaData = useMemo(() => {
        const ativados = filteredLeads.filter(l => l.ia_active).length;
        const desativados = filteredLeads.length - ativados;

        return [
            { name: 'Sarah (IA)', value: ativados },
            { name: 'Humano', value: desativados }
        ];
    }, [filteredLeads]);

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header / Filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart3 size={24} color="var(--accent)" />
                        Dashboard de Performance
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Acompanhe métricas, funil e conversão dos seus leads.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '6px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
                    <Filter size={16} color="var(--text-muted)" style={{ margin: '0 8px' }} />
                    <select
                        value={dateRange}
                        onChange={e => setDateRange(e.target.value as any)}
                        style={{ border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                        <option value="7">Últimos 7 dias</option>
                        <option value="30">Últimos 30 dias</option>
                        <option value="all">Todo o período</option>
                    </select>
                </div>
            </div>

            {/* Grid de Métricas Top */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <MetricCard
                    title="Total de Leads"
                    value={metrics.total}
                    icon={<Users size={20} color="#0ea5e9" />}
                    bgColor="#e0f2fe"
                    textColor="#0369a1"
                />
                <MetricCard
                    title="Taxa de Conversão"
                    value={`${metrics.conversao}%`}
                    icon={<TrendingUp size={20} color="#10b981" />}
                    bgColor="#d1fae5"
                    textColor="#047857"
                />
                <MetricCard
                    title="Agendamentos"
                    value={metrics.comReuniao}
                    icon={<Activity size={20} color="#f59e0b" />}
                    bgColor="#fef3c7"
                    textColor="#b45309"
                />
                <MetricCard
                    title="Vendas (Ganho)"
                    value={metrics.ganhos}
                    icon={<CheckCircle2 size={20} color="#ec4899" />}
                    bgColor="#fce7f3"
                    textColor="#be185d"
                />
            </div>

            {/* Gráficos Principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

                {/* Gráfico 1: Volume de Leads Diário */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={18} /> Volume de Leads Cadastrados
                    </h3>
                    {dateRange === 'all' ? (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            Selecione um período (7 ou 30 dias) para ver a curva diária.
                        </div>
                    ) : (
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer>
                                <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        name="Novos Leads"
                                        stroke="#6366f1"
                                        strokeWidth={4}
                                        dot={{ strokeWidth: 2, r: 4, fill: '#fff' }}
                                        activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Pilares IA vs Humano */}
                <div className="glass-card" style={{ padding: '1.5rem', height: '100%' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PieChartIcon size={18} /> Atuação
                    </h3>
                    <div style={{ height: '240px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={iaData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {iaData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Funil de Vendas Transversal */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={18} /> Distribuição do Funil (Estágios Atuais)
                </h3>
                <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer>
                        <BarChart data={stageData} layout="vertical" margin={{ top: 0, right: 20, left: 30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                            <YAxis
                                type="category"
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                                width={120}
                            />
                            <RechartsTooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="value" name="Leads" radius={[0, 6, 6, 0]} barSize={32}>
                                {stageData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
};

// Componente helper para cards numéricos
function MetricCard({ title, value, icon, bgColor, textColor }: { title: string; value: string | number; icon: React.ReactNode; bgColor: string; textColor: string }) {
    return (
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: `4px solid ${textColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {title}
                </span>
                <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: bgColor }}>
                    {icon}
                </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-primary)', lineHeight: 1 }}>
                {value}
            </div>
        </div>
    );
}

export default DashboardView;
