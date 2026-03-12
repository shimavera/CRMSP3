import { useState, useEffect, useRef, lazy, Suspense } from 'react';
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
  Trash2,
  Sun,
  Moon,
  Instagram,
  GitBranch,
  Calendar as CalendarIcon
} from 'lucide-react';
// Lazy Load Componentes
const LazyChatView = lazy(() => import('./components/ChatView'));
const LazyKanbanView = lazy(() => import('./components/KanbanView'));
const LazySettingsView = lazy(() => import('./components/SettingsView'));
const LazyLoginView = lazy(() => import('./components/LoginView'));
const LazyDashboardView = lazy(() => import('./components/DashboardView'));
const LazyInstagramView = lazy(() => import('./components/InstagramView'));
const LazyFlowBuilderView = lazy(() => import('./components/FlowBuilder/FlowBuilderView'));
const LazyCalendarView = lazy(() => import('./components/CalendarView'));
import { supabase } from './lib/supabase';
import type { Lead, UserProfile } from './lib/supabase';

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`sidebar-nav-item ${active ? 'active' : ''}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 12px',
      borderRadius: 'var(--radius-md)',
      width: '100%',
      backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      fontWeight: active ? '600' : '400',
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      outline: 'none'
    }}
  >
    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
    <span style={{ fontSize: '0.85rem', letterSpacing: '-0.01em' }}>{label}</span>
  </button>
);

// ─── NOTIFICAÇÃO SONORA GLOBAL ──────────────────────────────────────────────
export const playNotificationSound = () => {
  try {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = context.currentTime;
    playTone(600, now, 0.15);
    playTone(800, now + 0.1, 0.15);
  } catch (error) { }
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [openChatWithPhone, setOpenChatWithPhone] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  // ─── ADICIONAR / EDITAR LEAD ────────────────────────────────────────────────
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadNome, setNewLeadNome] = useState('');
  const [newLeadTelefone, setNewLeadTelefone] = useState('');
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [addLeadError, setAddLeadError] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastSync, setLastSync] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Atalhos de teclado
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setDialog(null);
        setShowAddLead(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  const filteredLeads = leads.filter(l =>
  (l.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefone.includes(searchTerm))
  );

  const handleExportLeads = () => {
    const headers = ['ID', 'Nome', 'Telefone', 'Email', 'Status', 'Forecast', 'Criado Em'];
    const rows = filteredLeads.map(l => [
      l.id,
      l.nome || 'N/A',
      l.telefone,
      (l.custom_fields as any)?.email || 'N/A',
      l.status || 'Novo',
      (l.custom_fields as any)?.proposta_valor || 0,
      l.created_at
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'leads_crm_sp3.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const showAlert = (message: string) => new Promise<void>((resolve) => {
    setDialog({ type: 'alert', title: 'Aviso', message, onConfirm: () => { setDialog(null); resolve(); }, onCancel: () => { setDialog(null); resolve(); } });
  });

  const showConfirm = (message: string) => new Promise<boolean>((resolve) => {
    setDialog({ type: 'confirm', title: 'Confirmação', message, onConfirm: () => { setDialog(null); resolve(true); }, onCancel: () => { setDialog(null); resolve(false); } });
  });


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
      
      const userPerms = userData.permissions || {};
      if (userPerms.calendar === undefined) {
        userPerms.calendar = true;
        supabase.from('sp3_users').update({ permissions: userPerms }).eq('id', userId).then();
      }

      setAuthUser({
        ...userData,
        permissions: userPerms,
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
    if (!authUser) return;
    setLeadsLoading(true);
    try {
      let query = supabase
        .from('sp3chat')
        .select('*')
        .eq('company_id', authUser.company_id)
        .order('id', { ascending: false })
        .limit(2000);

      const { data, error } = await query;

      if (error) {
        setError(error.message);
      } else {
        setLeads(data || []);
        setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        setError(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    if (!authUser) return;
    fetchLeads();

    // Realtime: novos leads aparecem instantaneamente
    const channel = supabase
      .channel('app-leads-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sp3chat',
        filter: `company_id=eq.${authUser.company_id}`
      }, (payload) => {
        const newLead = payload.new as Lead;
        setLeads(prev => {
          if (prev.some(l => l.id === newLead.id)) return prev;
          return [newLead, ...prev];
        });
        setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sp3chat',
        filter: `company_id=eq.${authUser.company_id}`
      }, (payload) => {
        const updated = payload.new as Lead;
        setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'sp3chat',
        filter: `company_id=eq.${authUser.company_id}`
      }, (payload) => {
        const deleted = payload.old as any;
        setLeads(prev => prev.filter(l => l.id !== deleted.id));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'n8n_chat_histories',
        filter: `company_id=eq.${authUser.company_id}`
      }, (payload) => {
        const newMsg = payload.new as any;
        try {
          const parsed = typeof newMsg.message === 'string' ? JSON.parse(newMsg.message) : newMsg.message;
          const isHuman = parsed.type === 'human' && !parsed.sentByCRM;
          if (isHuman) {
            playNotificationSound();
          }
        } catch (e) { }
      })
      .subscribe();

    // Polling como fallback (10s)
    const interval = setInterval(fetchLeads, 10000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // ─── GUARD DE TAB POR PERMISSÃO ─────────────────────────────────────────────
  const setTabSafe = (tab: string) => {
    if (!authUser) return;
    const permKey = tab as keyof UserProfile['permissions'];
    if (authUser.permissions[permKey] === false) return;
    setActiveTab(tab);
  };

  // ─── LOADING ────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', gap: '16px' }}>
      <Loader2 className="animate-spin" size={48} color="var(--accent)" />
      <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Sincronizando SP3 CRMSP3...</span>
    </div>
  );

  if (!authUser) return (
    <Suspense fallback={null}>
      <LazyLoginView />
    </Suspense>
  );

  // ─── APP PRINCIPAL ───────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Normaliza telefone: remove tudo exceto dígitos + adiciona 9º dígito BR se ausente
  const normalizePhone = (raw: string): string => {
    let phone = raw.replace(/\D/g, '');
    // Celular BR: 55 + DD(2) + 8 dígitos = 12 → inserir 9 após o DDD
    if (phone.length === 12 && phone.startsWith('55')) {
      phone = phone.slice(0, 4) + '9' + phone.slice(4);
    }
    return phone;
  };

  const handleSaveLead = async () => {
    const phone = normalizePhone(newLeadTelefone);
    if (!phone) {
      setAddLeadError('O telefone é obrigatório.');
      return;
    }
    if (phone.length < 10 || phone.length > 15) {
      setAddLeadError('Telefone inválido. Use o formato: 5511999999999');
      return;
    }
    setIsAddingLead(true);
    setAddLeadError(null);

    if (editingLeadId) {
      // Checar se já existe outro lead com esse telefone
      const { data: existing } = await supabase
        .from('sp3chat')
        .select('id')
        .eq('telefone', phone)
        .eq('company_id', authUser!.company_id)
        .neq('id', editingLeadId)
        .limit(1);
      if (existing && existing.length > 0) {
        setAddLeadError('Já existe um lead com esse telefone.');
        setIsAddingLead(false);
        return;
      }
      const { error } = await supabase.from('sp3chat').update({
        nome: newLeadNome.trim() || null,
        telefone: phone
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
      // Checar se já existe lead com esse telefone
      const { data: existing } = await supabase
        .from('sp3chat')
        .select('id')
        .eq('telefone', phone)
        .eq('company_id', authUser!.company_id)
        .limit(1);
      if (existing && existing.length > 0) {
        setAddLeadError('Já existe um lead com esse telefone. Edite o existente.');
        setIsAddingLead(false);
        return;
      }
      const { error } = await supabase.from('sp3chat').insert([{
        company_id: authUser.company_id,
        nome: newLeadNome.trim() || null,
        telefone: phone,
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
    if (!await showConfirm('Tem certeza que deseja excluir este Lead?\n\nIsso vai apagar TODO o histórico de conversas, follow-ups, automações e anotações desse número. O lead entrará como novo se entrar em contato novamente.')) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead) { await showAlert('Lead não encontrado.'); return; }

    try {
      // 1. Apagar histórico de conversas (n8n_chat_histories)
      await supabase
        .from('n8n_chat_histories')
        .delete()
        .eq('session_id', lead.telefone)
        .eq('company_id', lead.company_id);

      // 2. Apagar estado de follow-up (sp3_followup_state)
      await supabase
        .from('sp3_followup_state')
        .delete()
        .eq('telefone', lead.telefone);

      // 3. Cancelar execuções de fluxo ativas
      await supabase
        .from('sp3_flow_executions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('lead_id', leadId)
        .in('status', ['running', 'paused']);

      // 4. Apagar o lead (sp3_flow_executions com FK CASCADE também são removidas)
      const { error } = await supabase.from('sp3chat').delete().eq('id', leadId);
      if (error) {
        await showAlert('Erro ao excluir: ' + error.message);
      } else {
        await fetchLeads();
      }
    } catch (err: any) {
      await showAlert('Erro ao excluir lead: ' + (err.message || err));
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
    <div className={`dashboard-container ${!desktopSidebarOpen && !isMobile ? 'desktop-sidebar-closed' : ''}`}>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''} ${!desktopSidebarOpen && !isMobile ? ' desktop-sidebar-closed' : ''}`}>
        <div className="logo-container" style={{ padding: '0.5rem 0.75rem', marginBottom: '2rem' }}>
          <div className="logo-icon-wrapper" style={{ padding: '4px', background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)' }}>
            <img
              src="/favicon.png"
              alt="Saúde IA Symbol"
              style={{ height: '24px', width: '24px', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
          <span className="logo-text" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Saúde IA
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
          <SidebarItem icon={Instagram} label="Instagram" active={activeTab === 'instagram'} onClick={() => navigate('instagram')} />
          {authUser.permissions.calendar !== false && (
            <SidebarItem icon={CalendarIcon} label="Agenda" active={activeTab === 'calendar'} onClick={() => navigate('calendar')} />
          )}
          {authUser.permissions.settings && (
            <SidebarItem icon={GitBranch} label="Fluxos" active={activeTab === 'flows'} onClick={() => navigate('flows')} />
          )}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          {authUser.permissions.settings && (
            <SidebarItem icon={Settings} label="Configurações" active={activeTab === 'settings'} onClick={() => navigate('settings')} />
          )}
          {/* Perfil do usuário logado */}
          <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: '4px', marginTop: '4px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1px' }}>{authUser.nome}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>{authUser.role === 'master' ? '⭐ Administrador Master' : 'Operador'}</div>
          </div>
          <SidebarItem icon={LogOut} label="Sair" onClick={handleLogout} />

          <div style={{ textAlign: 'center', marginTop: '0.75rem', opacity: 0.4, fontSize: '0.6rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            SAÚDE IA v1.0
          </div>
        </div>
      </aside>

      <main className="main-content" style={activeTab === 'chats' ? { padding: 0, overflow: 'hidden' } : activeTab !== 'dashboard' ? { paddingTop: '1.5rem' } : undefined}>
        {activeTab !== 'chats' && (
          <header className="main-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeTab === 'dashboard' ? '3rem' : '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="desktop-only"
                onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                style={{ background: 'var(--accent-soft)', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '8px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                title={desktopSidebarOpen ? "Ocultar Menu" : "Mostrar Menu"}
              >
                <Menu size={22} />
              </button>
              <button
                className="mobile-only"
                onClick={() => setSidebarOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '6px', borderRadius: '8px', alignItems: 'center' }}
              >
                <Menu size={26} />
              </button>
              {activeTab === 'dashboard' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.85rem', fontWeight: '800' }}>Olá, {authUser.nome.split(' ')[0]} 👋</h2>
                    {lastSync && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', animation: 'fadeIn 0.5s ease-out' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
                        <span style={{ fontSize: '0.6rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sincronizado {lastSync}</span>
                      </div>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {error ? 'Erro de conexão com o banco.' : `Sistema conectado. ${leads.length} leads encontrados.`}
                  </p>
                </div>
              )}
            </div>

            {activeTab === 'dashboard' && (
              <div className="desktop-only" style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  style={{ padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
                >
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button
                  onClick={handleExportLeads}
                  style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📥 Exportar
                </button>
                <button
                  onClick={fetchLeads}
                  style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                >
                  Atualizar
                </button>
                <div className="search-bar">
                  <Search size={18} color="var(--text-muted)" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar Lead (pressione /)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            )}
          </header>
        )}

        {error && (
          <div style={{ padding: '1rem', background: '#fee2e2', border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <AlertCircle size={20} />
            <div>
              <p style={{ fontWeight: 'bold' }}>Atenção: Erro no Supabase</p>
              <p style={{ fontSize: '0.85rem' }}>{error}. Verifique se a tabela 'sp3chat' existe e se o RLS permite leitura.</p>
            </div>
          </div>
        )}

        <Suspense fallback={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <Loader2 className="animate-spin" size={32} color="var(--accent)" />
            <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>Iniciando módulo...</span>
          </div>
        }>
          {activeTab === 'dashboard' && authUser.permissions.dashboard && (
            <LazyDashboardView
              leads={leads}
              onOpenChat={(phone: string) => handleOpenChatFromLeads(phone)}
            />
          )}

          {activeTab === 'chats' && authUser.permissions.chats && (
            <LazyChatView
              initialLeads={leads}
              authUser={authUser}
              openPhone={openChatWithPhone}
              onPhoneOpened={() => setOpenChatWithPhone(null)}
            />
          )}

          {activeTab === 'kanban' && authUser.permissions.kanban && (
            <LazyKanbanView />
          )}

          {activeTab === 'settings' && authUser.permissions.settings && (
            <LazySettingsView authUser={authUser} />
          )}

          {activeTab === 'instagram' && (
            <LazyInstagramView authUser={authUser} />
          )}

          {activeTab === 'calendar' && authUser.permissions.calendar !== false && (
            <LazyCalendarView authUser={authUser} />
          )}

          {activeTab === 'flows' && authUser.permissions.settings && (
            <LazyFlowBuilderView authUser={authUser} isDarkMode={isDarkMode} />
          )}
        </Suspense>
        {activeTab === 'leads' && authUser.permissions.leads && (
          <div className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontWeight: '700', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.02em' }}><Users size={20} color="var(--text-primary)" /> Base de Leads</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>{leads.length} leads cadastrados</p>
              </div>
              <button
                onClick={() => { setNewLeadNome(''); setNewLeadTelefone(''); setEditingLeadId(null); setShowAddLead(true); setAddLeadError(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
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
                  <button onClick={() => { setShowAddLead(false); setAddLeadError(null); setEditingLeadId(null); }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveLead}
                    disabled={isAddingLead}
                    style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: isAddingLead ? 'var(--accent-muted)' : 'var(--accent)', color: 'var(--bg-primary)', fontWeight: '700', fontSize: '0.85rem', cursor: isAddingLead ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
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
                    {leadsLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                          <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '34px', width: '180px', borderRadius: '8px' }} /></td>
                          <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '20px', width: '100px' }} /></td>
                          <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '20px' }} /></td>
                          <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '20px', width: '100px' }} /></td>
                          <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '32px', width: '80px', borderRadius: '8px' }} /></td>
                        </tr>
                      ))
                    ) : filteredLeads.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum lead encontrado.</td></tr>
                    ) : (
                      filteredLeads.map(lead => (
                        <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-soft)', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '14px 16px', fontWeight: '700' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.85rem', flexShrink: 0 }}>
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
                                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--error-soft)', backgroundColor: 'var(--bg-primary)', color: 'var(--error)', cursor: 'pointer' }}
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

      {dialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{dialog.title}</h3>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>{dialog.message}</p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {dialog.type !== 'alert' && (
                <button
                  onClick={dialog.onCancel}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500' }}
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => dialog.onConfirm()}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer', fontWeight: '500' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
