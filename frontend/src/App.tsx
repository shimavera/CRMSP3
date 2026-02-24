import { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Calendar,
  MessageSquare,
  LayoutDashboard,
  Kanban,
  Settings,
  LogOut,
  Search,
  Activity,
  AlertCircle
} from 'lucide-react';
import ChatView from './components/ChatView';
import KanbanView from './components/KanbanView';
import SettingsView from './components/SettingsView';
import { supabase } from './lib/supabase';
import type { Lead } from './lib/supabase';

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      borderRadius: '12px',
      width: '100%',
      backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text-secondary)',
      fontWeight: active ? '600' : '500',
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      outline: 'none'
    }}
  >
    <Icon size={20} />
    <span style={{ fontSize: '0.9rem' }}>{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, color, trend }: any) => (
  <div className="glass-card stat-card fade-in">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div className="stat-icon" style={{ backgroundColor: `${color}12`, color: color }}>
        <Icon size={22} />
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '20px', backgroundColor: trend.startsWith('+') ? '#ecfdf5' : '#fff1f2', color: trend.startsWith('+') ? '#059669' : '#e11d48', fontWeight: '700' }}>
          {trend}
        </div>
      )}
    </div>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      console.log('Buscando leads na tabela sp3chat...');
      const { data, error } = await supabase
        .from('sp3chat')
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        console.error('Erro Supabase:', error);
        setError(error.message);
      } else {
        console.log('Leads encontrados:', data?.length || 0);
        setLeads(data || []);
        setError(null);
      }
    } catch (e: any) {
      console.error('Erro de conexão:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();

    // Polling a cada 30 segundos para manter os dados atualizados
    const interval = setInterval(() => {
      fetchLeads();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div style={{ padding: '0.5rem 1rem', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color="white" />
            </div>
            SP3 CRM
          </h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SidebarItem icon={LayoutDashboard} label="Visão Geral" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={MessageSquare} label="Conversas Ativas" active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} />
          <SidebarItem icon={Kanban} label="Kanban" active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} />
          <SidebarItem icon={Calendar} label="Agenda" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          <SidebarItem icon={Users} label="Base de Leads" active={activeTab === 'leads'} onClick={() => setActiveTab('leads')} />
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border-soft)', paddingTop: '1.5rem' }}>
          <SidebarItem icon={Settings} label="Configurações" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <SidebarItem icon={LogOut} label="Sair" />
        </div>
      </aside>

      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: '800' }}>Olá, Juan Lourenço 👋</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {error ? 'Erro de conexão com o banco.' : `Sistema conectado. ${leads.length} leads encontrados.`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={fetchLeads}
              style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
            >
              Atualizar
            </button>
            <div className="search-bar">
              <Search size={18} color="var(--text-muted)" />
              <input type="text" placeholder="Buscar..." />
            </div>
          </div>
        </header>

        {error && (
          <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <AlertCircle size={20} />
            <div>
              <p style={{ fontWeight: 'bold' }}>Atenção: Erro no Supabase</p>
              <p style={{ fontSize: '0.85rem' }}>{error}. Verifique se a tabela 'sp3chat' existe e se o RLS permite leitura.</p>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="fade-in">
            <div className="metric-grid">
              <StatCard label="Leads Ativos" value={leads.length} icon={Users} color="#0ea5e9" trend="Online" />
              <StatCard label="Qualificados" value="0" icon={CheckCircle2} color="#10b981" />
              <StatCard label="Agendamentos" value="0" icon={Calendar} color="#6366f1" />
              <StatCard label="Status DB" value={loading ? '...' : 'OK'} icon={Activity} color="#f59e0b" />
            </div>

            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontWeight: '800', marginBottom: '2rem' }}>Leads na Tabela 'sp3chat'</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-soft)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Nome</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Telefone</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr><td colSpan={3} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum lead apareceu ainda. Mande um 'Olá' no WhatsApp!</td></tr>
                    ) : (
                      leads.map(lead => (
                        <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                          <td style={{ padding: '16px 12px', fontWeight: '700' }}>{lead.nome || 'Sem Nome'}</td>
                          <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>{lead.telefone}</td>
                          <td style={{ padding: '16px 12px' }}>
                            <button onClick={() => setActiveTab('chats')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: '600' }}>Abrir Chat</button>
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

        {activeTab === 'chats' && <ChatView initialLeads={leads} />}
        {activeTab === 'kanban' && <KanbanView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export default App;
