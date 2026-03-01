import re

with open('src/components/DashboardView.tsx', 'r') as f:
    content = f.read()

# 1. Expand standard icons import
content = content.replace(
    "import {",
    "import {\n    DollarSign, X,"
)

# 2. Add Modal state inside DashboardView
dashboard_state_injection = """    const [dateRange, setDateRange] = useState<'7' | '30' | 'all'>('30');
    const [modalData, setModalData] = useState<{ title: string; list: Lead[] } | null>(null);"""

content = content.replace("    const [dateRange, setDateRange] = useState<'7' | '30' | 'all'>('30');", dashboard_state_injection)

# 3. Update Metrics logic
metrics_old = """    const metrics = useMemo(() => {
        const total = filteredLeads.length;
        const comIA = filteredLeads.filter(l => l.ia_active).length;
        const comReuniao = filteredLeads.filter(l => l.meeting_datetime).length;
        const ganhos = filteredLeads.filter(l => l.stage === 'Ganho' || l.stage === 'Fidelização').length;

        const conversao = total > 0 ? ((ganhos / total) * 100).toFixed(1) : '0';

        return { total, comIA, comReuniao, ganhos, conversao };
    }, [filteredLeads]);"""

metrics_new = """    const metrics = useMemo(() => {
        const _totalLeads = filteredLeads;
        const _comIA = filteredLeads.filter(l => l.ia_active);
        const _comReuniao = filteredLeads.filter(l => l.meeting_datetime);
        const _ganhos = filteredLeads.filter(l => l.stage === 'Ganho' || l.stage === 'Fidelização');
        const _forecastLeads = filteredLeads.filter(l => l.custom_fields && l.custom_fields['proposta_valor'] && Number(l.custom_fields['proposta_valor']) > 0);
        
        const forecastTotal = _forecastLeads.reduce((acc, lead) => {
            return acc + Number(lead.custom_fields['proposta_valor']);
        }, 0);

        const conversao = _totalLeads.length > 0 ? ((_ganhos.length / _totalLeads.length) * 100).toFixed(1) : '0';

        return { 
            total: _totalLeads.length, 
            totalList: _totalLeads,
            comIA: _comIA.length, 
            comIAList: _comIA,
            comReuniao: _comReuniao.length, 
            comReuniaoList: _comReuniao,
            ganhos: _ganhos.length, 
            ganhosList: _ganhos,
            conversao, 
            forecastTotal,
            forecastList: _forecastLeads
        };
    }, [filteredLeads]);"""

content = content.replace(metrics_old, metrics_new)

# 4. Update Metric cards rendering
metric_cards_old = """            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
            </div>"""

metric_cards_new = """            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <MetricCard
                    title="Total de Leads"
                    value={metrics.total}
                    icon={<Users size={20} color="#0ea5e9" />}
                    bgColor="#e0f2fe"
                    textColor="#0369a1"
                    onClick={() => setModalData({ title: 'Total de Leads', list: metrics.totalList })}
                />
                <MetricCard
                    title="Agendamentos"
                    value={metrics.comReuniao}
                    icon={<Activity size={20} color="#f59e0b" />}
                    bgColor="#fef3c7"
                    textColor="#b45309"
                    onClick={() => setModalData({ title: 'Agendamentos', list: metrics.comReuniaoList })}
                />
                <MetricCard
                    title="Vendas (Ganho)"
                    value={metrics.ganhos}
                    icon={<CheckCircle2 size={20} color="#ec4899" />}
                    bgColor="#fce7f3"
                    textColor="#be185d"
                    onClick={() => setModalData({ title: 'Vendas (Ganho)', list: metrics.ganhosList })}
                />
                <MetricCard
                    title="Forecast (Proposta)"
                    value={`R$ ${metrics.forecastTotal.toLocaleString('pt-BR')}`}
                    icon={<DollarSign size={20} color="#8b5cf6" />}
                    bgColor="#f3e8ff"
                    textColor="#6d28d9"
                    onClick={() => setModalData({ title: 'Leads com Forecast', list: metrics.forecastList })}
                />
            </div>"""

content = content.replace(metric_cards_old, metric_cards_new)

# 5. Add UI Modal code at the end of the DashboardView component
modal_ui = """
            {modalData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: 'bold' }}>{modalData.title} ({modalData.list.length})</h3>
                            <button onClick={() => setModalData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20}/></button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '12px' }}>
                            {modalData.list.length === 0 ? (
                                <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>Nenhum lead encontrado neste filtro.</p>
                            ) : (
                                modalData.list.map(lead => (
                                    <div key={lead.id} style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontWeight: '600', color: '#111827' }}>{lead.nome || lead.telefone}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Telefone: {lead.telefone}</div>
                                        {lead.custom_fields?.email && <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>E-mail: {lead.custom_fields.email}</div>}
                                        {lead.custom_fields?.proposta_valor && <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold' }}>Forecast: R$ {Number(lead.custom_fields.proposta_valor).toLocaleString('pt-BR')}</div>}
                                        <div style={{ fontSize: '0.75rem', display: 'inline-block', padding: '2px 8px', backgroundColor: '#e5e7eb', borderRadius: '12px', width: 'fit-content', marginTop: '4px' }}>Estágio: {lead.stage || lead.status || 'Novo Lead'}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};"""

content = content.replace("        </div>\n    );\n};", modal_ui)

# 6. Update MetricCard signature
content = content.replace(
    "function MetricCard({ title, value, icon, bgColor, textColor }: { title: string; value: string | number; icon: React.ReactNode; bgColor: string; textColor: string }) {",
    "function MetricCard({ title, value, icon, bgColor, textColor, onClick }: { title: string; value: string | number; icon: React.ReactNode; bgColor: string; textColor: string; onClick?: () => void }) {"
)

content = content.replace(
    """<div className="glass-card\" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: `4px solid ${textColor}` }}>""",
    """<div onClick={onClick} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: `4px solid ${textColor}`, cursor: onClick ? 'pointer' : 'default' }}>"""
)

# 7. Add specific hover styles to metric card
content = content.replace(
    "cursor: onClick ? 'pointer' : 'default' }}>",
    "cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s' }} onMouseEnter={(e) => { if (onClick) e.currentTarget.style.filter = 'brightness(0.95)'; }} onMouseLeave={(e) => { if (onClick) e.currentTarget.style.filter = 'brightness(1)'; }}>"
)

with open('src/components/DashboardView.tsx', 'w') as f:
    f.write(content)
