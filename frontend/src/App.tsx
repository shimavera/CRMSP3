import { useState, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  LayoutDashboard,
  Kanban,
  Settings,
  LogOut,
  Search,
  AlertCircle,
  Loader2,
  Plus,
  X,
  Bot,
  Menu,
  Edit2,
  Trash2
} from 'lucide-react';
import ChatView from './components/ChatView';
import KanbanView from './components/KanbanView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import { supabase } from './lib/supabase';
import type { Lead, UserProfile } from './lib/supabase';

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

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openChatWithPhone, setOpenChatWithPhone] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  // ─── ADICIONAR / EDITAR LEAD ────────────────────────────────────────────────
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadNome, setNewLeadNome] = useState('');
  const [newLeadTelefone, setNewLeadTelefone] = useState('');
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [addLeadError, setAddLeadError] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ─── AUTENTICAÇÃO ───────────────────────────────────────────────────────────
  const loadUserProfile = async (userId: string, _userEmail: string) => {
    const { data, error } = await supabase
      .from('sp3_users')
      .select('*, sp3_companies(name)')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar perfil:', error);
      setAuthLoading(false);
      return;
    }

    if (data) {
      const { sp3_companies, ...userData } = data as any;
      setAuthUser({
        ...userData,
        company_name: sp3_companies?.name || ''
      } as UserProfile);
    } else {
      // Usuário não cadastrado — não auto-criar (apenas masters podem cadastrar usuários)
      console.warn('Usuário não encontrado na tabela sp3_users. Acesso negado.');
      await supabase.auth.signOut();
      setAuthUser(null);
    }
    setAuthLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user.id, session.user.email || '');
      } else {
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadUserProfile(session.user.id, session.user.email || '');
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setAuthLoading(false);
        setActiveTab('dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── DADOS ──────────────────────────────────────────────────────────────────
  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('sp3chat')
        .select('*')
        .eq('company_id', authUser?.company_id)
        .order('id', { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setLeads(data || []);
        setError(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (!authUser) return;
    fetchLeads();
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [authUser]);

  // ─── GUARD DE TAB POR PERMISSÃO ─────────────────────────────────────────────
  const setTabSafe = (tab: string) => {
    if (!authUser) return;
    const permKey = tab as keyof UserProfile['permissions'];
    if (authUser.permissions[permKey] === false) return;
    setActiveTab(tab);
  };

  // ─── LOADING ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #001A4D 0%, #003399 50%, #0052CC 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', backdropFilter: 'blur(10px)' }}>
              <img
                src="/favicon.png"
                alt="SP3 Symbol"
                style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)' }}
              />
            </div>
          </div>
          <Loader2 size={28} className="animate-spin" style={{ color: '#ffffff', margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
  if (!authUser) {
    return <LoginView />;
  }

  // ─── APP PRINCIPAL ───────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveLead = async () => {
    if (!newLeadTelefone.trim()) {
      setAddLeadError('O telefone é obrigatório.');
      return;
    }
    setIsAddingLead(true);
    setAddLeadError(null);

    if (editingLeadId) {
      const { error } = await supabase.from('sp3chat').update({
        nome: newLeadNome.trim() || null,
        telefone: newLeadTelefone.trim()
      }).eq('id', editingLeadId);

      if (error) {
        setAddLeadError(error.message);
      } else {
        setNewLeadNome('');
        setNewLeadTelefone('');
        setShowAddLead(false);
        setEditingLeadId(null);
        await fetchLeads();
      }
    } else {
      const { error } = await supabase.from('sp3chat').insert([{
        company_id: authUser.company_id,
        nome: newLeadNome.trim() || null,
        telefone: newLeadTelefone.trim(),
        ia_active: true
      }]);
      if (error) {
        setAddLeadError(error.message);
      } else {
        setNewLeadNome('');
        setNewLeadTelefone('');
        setShowAddLead(false);
        await fetchLeads();
      }
    }
    setIsAddingLead(false);
  };

  const handleDeleteLead = async (leadId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este Lead?')) return;
    const { error } = await supabase.from('sp3chat').delete().eq('id', leadId);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      await fetchLeads();
    }
  };

  const navigate = (tab: string) => {
    setTabSafe(tab);
    setSidebarOpen(false);
  };

  const handleOpenChatFromLeads = (phone: string) => {
    setOpenChatWithPhone(phone);
    setTabSafe('chats');
    setSidebarOpen(false);
  };

  return (
    <div className="dashboard-container">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div style={{ padding: '0.5rem 1rem', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '4px', background: 'var(--accent-soft)', borderRadius: '12px' }}>
            <img
              src="/favicon.png"
              alt="SP3 Symbol"
              style={{ height: '34px', width: '34px', objectFit: 'contain', borderRadius: '8px' }}
            />
          </div>
          <span style={{ fontSize: '1.85rem', fontWeight: '900', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.04em', lineHeight: 1 }}>
            SP3
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {authUser.permissions.dashboard && (
            <SidebarItem icon={LayoutDashboard} label="Visão Geral" active={activeTab === 'dashboard'} onClick={() => navigate('dashboard')} />
          )}
          {authUser.permissions.chats && (
            <SidebarItem icon={MessageSquare} label="Conversas Ativas" active={activeTab === 'chats'} onClick={() => navigate('chats')} />
          )}
          {authUser.permissions.kanban && (
            <SidebarItem icon={Kanban} label="Kanban" active={activeTab === 'kanban'} onClick={() => navigate('kanban')} />
          )}
          {authUser.permissions.leads && (
            <SidebarItem icon={Users} label="Base de Leads" active={activeTab === 'leads'} onClick={() => navigate('leads')} />
          )}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border-soft)', paddingTop: '1.5rem' }}>
          {authUser.permissions.settings && (
            <SidebarItem icon={Settings} label="Configurações" active={activeTab === 'settings'} onClick={() => navigate('settings')} />
          )}
          {/* Perfil do usuário logado */}
          <div style={{ padding: '12px 16px', borderRadius: '14px', background: 'var(--bg-primary)', border: '1px solid var(--border-soft)', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>{authUser.nome}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>{authUser.role === 'master' ? '⭐ Administrador Master' : 'Operador'}</div>
          </div>
          <SidebarItem icon={LogOut} label="Sair" onClick={handleLogout} />
        </div>
      </aside>

      <main className="main-content" style={isMobile && activeTab === 'chats' ? { padding: 0, overflow: 'hidden' } : undefined}>
        {!(isMobile && activeTab === 'chats') && (
          <header className="main-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="mobile-only"
                onClick={() => setSidebarOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '6px', borderRadius: '8px', alignItems: 'center' }}
              >
                <Menu size={26} />
              </button>
              <div>
                <h2 style={{ fontSize: '1.85rem', fontWeight: '800' }}>Olá, {authUser.nome.split(' ')[0]} 👋</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  {error ? 'Erro de conexão com o banco.' : `Sistema conectado. ${leads.length} leads encontrados.`}
                </p>
              </div>
            </div>

            <div className="desktop-only" style={{ display: 'flex', gap: '12px' }}>
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
        )}

        {error && (
          <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <AlertCircle size={20} />
            <div>
              <p style={{ fontWeight: 'bold' }}>Atenção: Erro no Supabase</p>
              <p style={{ fontSize: '0.85rem' }}>{error}. Verifique se a tabela 'sp3chat' existe e se o RLS permite leitura.</p>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && authUser.permissions.dashboard && (
          <DashboardView leads={leads} />
        )}

        {activeTab === 'chats' && authUser.permissions.chats && (
          <ChatView
            initialLeads={leads}
            authUser={authUser}
            openPhone={openChatWithPhone}
            onPhoneOpened={() => setOpenChatWithPhone(null)}
          />
        )}
        {activeTab === 'kanban' && authUser.permissions.kanban && <KanbanView />}
        {activeTab === 'settings' && authUser.permissions.settings && <SettingsView authUser={authUser} />}

        {activeTab === 'leads' && authUser.permissions.leads && (
          <div className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Base de Leads</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>{leads.length} leads cadastrados</p>
              </div>
              <button
                onClick={() => { setNewLeadNome(''); setNewLeadTelefone(''); setEditingLeadId(null); setShowAddLead(true); setAddLeadError(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', border: 'none', backgroundColor: 'var(--accent)', color: 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                <Plus size={16} /> Adicionar Lead
              </button>
            </div>

            {/* Formulário de novo lead */}
            {showAddLead && (
              <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h4 style={{ fontWeight: '800', fontSize: '1rem' }}>{editingLeadId ? 'Editar Lead' : 'Novo Lead'}</h4>
                  <button onClick={() => { setShowAddLead(false); setAddLeadError(null); setEditingLeadId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nome (opcional)</label>
                    <input
                      value={newLeadNome}
                      onChange={(e) => setNewLeadNome(e.target.value)}
                      placeholder="Nome do lead"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--border-soft)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Telefone / WhatsApp *</label>
                    <input
                      value={newLeadTelefone}
                      onChange={(e) => setNewLeadTelefone(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveLead()}
                      placeholder="Ex: 5511999999999"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: addLeadError ? '1.5px solid #fca5a5' : '1.5px solid var(--border-soft)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                {addLeadError && <p style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: '10px', fontWeight: '600' }}>{addLeadError}</p>}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowAddLead(false); setAddLeadError(null); setEditingLeadId(null); }} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveLead}
                    disabled={isAddingLead}
                    style={{ padding: '8px 18px', borderRadius: '10px', border: 'none', backgroundColor: isAddingLead ? '#93c5fd' : 'var(--accent)', color: 'white', fontWeight: '700', fontSize: '0.85rem', cursor: isAddingLead ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isAddingLead ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : (editingLeadId ? 'Salvar Alterações' : 'Criar Lead')}
                  </button>
                </div>
              </div>

            )}

            {/* Tabela de leads */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-soft)', backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '700' }}>Nome</th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '700' }}>Telefone</th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '700' }}>IA</th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '700' }}>Stage</th>
                      <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '700' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum lead cadastrado. Clique em "Adicionar Lead" para começar.</td></tr>
                    ) : (
                      leads.map(lead => (
                        <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-soft)', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '14px 16px', fontWeight: '700' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.85rem', flexShrink: 0 }}>
                                {(lead.nome || lead.telefone)[0].toUpperCase()}
                              </div>
                              {lead.nome || <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Sem nome</span>}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{lead.telefone}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', padding: '4px 10px', borderRadius: '20px', fontWeight: '700', backgroundColor: lead.ia_active ? '#dcfce7' : '#fee2e2', color: lead.ia_active ? '#15803d' : '#b91c1c' }}>
                              <Bot size={11} /> {lead.ia_active ? 'Ativa' : 'Pausada'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            {lead.stage ? (
                              <span style={{ padding: '3px 10px', borderRadius: '6px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', fontWeight: '600' }}>{lead.stage}</span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {authUser.permissions.chats && (
                                <button
                                  onClick={() => handleOpenChatFromLeads(lead.telefone)}
                                  title="Abrir Chat"
                                  style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', cursor: 'pointer' }}
                                >
                                  <MessageSquare size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setNewLeadNome(lead.nome || '');
                                  setNewLeadTelefone(lead.telefone);
                                  setEditingLeadId(lead.id);
                                  setShowAddLead(true);
                                  setAddLeadError(null);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                title="Editar Lead"
                                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-soft)', backgroundColor: 'white', color: 'var(--text-secondary)', cursor: 'pointer' }}
                              >
                                <Edit2 size={14} />
                              </button>
                              {authUser.role === 'master' && (
                                <button
                                  onClick={() => handleDeleteLead(lead.id)}
                                  title="Excluir Lead"
                                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #fee2e2', backgroundColor: 'white', color: '#ef4444', cursor: 'pointer' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
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
      </main>
    </div>
  );
}

export default App;
