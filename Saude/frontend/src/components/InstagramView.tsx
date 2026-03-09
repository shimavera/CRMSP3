import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Instagram,
  Plus,
  Trash2,
  Edit2,
  X,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Link,
  Image,
  Type,
  MessageCircle,
  Power,
  PowerOff,
  AlertCircle,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  UserProfile,
  InstagramAccount,
  InstagramAutomation,
  InstagramAutomationMessage,
  InstagramPost
} from '../lib/supabase';

const N8N_WEBHOOK_BASE = 'https://n8n-webhook.sp3company.shop';

interface Props {
  authUser: UserProfile;
}

export default function InstagramView({ authUser }: Props) {
  // === Estados: Configuração Meta App ===
  const [igAppId, setIgAppId] = useState('');
  const [igAppSecret, setIgAppSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // === Estados: Conta Instagram ===
  const [igAccount, setIgAccount] = useState<InstagramAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // === Estados: Automações ===
  const [automations, setAutomations] = useState<InstagramAutomation[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(false);

  // === Estados: Editor de Automação ===
  const [showEditor, setShowEditor] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Partial<InstagramAutomation> | null>(null);
  const [savingAutomation, setSavingAutomation] = useState(false);

  // === Estados: Seletor de Posts ===
  const [showPostSelector, setShowPostSelector] = useState(false);
  const [igPosts, setIgPosts] = useState<InstagramPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // === Estados: Upload de mídia ===
  const [uploadingMedia, setUploadingMedia] = useState<number | null>(null);

  // === Estados: Feedback ===
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const popupRef = useRef<Window | null>(null);

  // ============================================================
  // CARREGAMENTO INICIAL
  // ============================================================
  useEffect(() => {
    fetchCredentials();
    fetchIgAccount();
  }, []);

  useEffect(() => {
    if (igAccount) {
      fetchAutomations();
    }
  }, [igAccount]);

  // Listener para mensagem do popup OAuth
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'ig_connected') {
        setConnecting(false);
        fetchIgAccount();
        showFeedback('success', 'Instagram conectado com sucesso!');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ============================================================
  // FUNÇÕES: Credenciais Meta App
  // ============================================================
  const fetchCredentials = async () => {
    try {
      const { data } = await supabase.rpc('get_ig_app_credentials', {
        p_company_id: authUser.company_id
      });
      if (data && data.length > 0) {
        setIgAppId(data[0].app_id || '');
        setIgAppSecret(data[0].app_secret || '');
      }
    } catch (err) {
      console.warn('Erro ao buscar credenciais IG:', err);
    }
  };

  const handleSaveCredentials = async () => {
    if (!igAppId.trim() || !igAppSecret.trim()) {
      showFeedback('error', 'Preencha App ID e App Secret');
      return;
    }
    setSavingCredentials(true);
    try {
      const { error } = await supabase.rpc('save_ig_app_credentials', {
        p_company_id: authUser.company_id,
        p_app_id: igAppId.trim(),
        p_app_secret: igAppSecret.trim()
      });
      if (error) throw error;
      showFeedback('success', 'Credenciais salvas!');
    } catch (err: any) {
      showFeedback('error', 'Erro ao salvar: ' + err.message);
    } finally {
      setSavingCredentials(false);
    }
  };

  // ============================================================
  // FUNÇÕES: Conta Instagram
  // ============================================================
  const fetchIgAccount = async () => {
    setLoadingAccount(true);
    try {
      const { data } = await supabase
        .from('sp3_instagram_accounts')
        .select('*')
        .eq('company_id', authUser.company_id)
        .eq('is_active', true)
        .limit(1)
        .single();
      setIgAccount(data as InstagramAccount | null);
    } catch {
      setIgAccount(null);
    } finally {
      setLoadingAccount(false);
    }
  };

  const handleConnectInstagram = () => {
    if (!igAppId.trim()) {
      showFeedback('error', 'Configure o App ID do Meta antes de conectar');
      return;
    }
    setConnecting(true);

    const redirectUri = encodeURIComponent(`${N8N_WEBHOOK_BASE}/webhook/instagram-oauth`);
    const scope = encodeURIComponent('instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_manage_metadata,pages_show_list');
    const state = encodeURIComponent(authUser.company_id || '');

    const oauthUrl = `https://www.facebook.com/dialog/oauth?client_id=${igAppId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`;

    const w = 600, h = 700;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    popupRef.current = window.open(oauthUrl, 'ig_oauth', `width=${w},height=${h},left=${left},top=${top}`);

    // Verificar se popup foi fechado sem conectar
    const checkClosed = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(checkClosed);
        setConnecting(false);
        fetchIgAccount(); // Tenta buscar mesmo assim
      }
    }, 1000);
  };

  const handleDisconnectInstagram = async () => {
    if (!igAccount) return;
    if (!window.confirm('Desconectar a conta Instagram? As automações ficarão inativas.')) return;
    try {
      await supabase
        .from('sp3_instagram_accounts')
        .update({ is_active: false })
        .eq('id', igAccount.id);
      setIgAccount(null);
      setAutomations([]);
      showFeedback('success', 'Instagram desconectado');
    } catch (err: any) {
      showFeedback('error', 'Erro: ' + err.message);
    }
  };

  // ============================================================
  // FUNÇÕES: Automações
  // ============================================================
  const fetchAutomations = async () => {
    setLoadingAutomations(true);
    try {
      const { data: auts } = await supabase
        .from('sp3_instagram_automations')
        .select('*')
        .eq('company_id', authUser.company_id)
        .order('created_at', { ascending: false });

      if (!auts) { setAutomations([]); return; }

      // Buscar mensagens para cada automação
      const ids = auts.map(a => a.id);
      const { data: msgs } = await supabase
        .from('sp3_instagram_automation_messages')
        .select('*')
        .in('automation_id', ids)
        .order('sort_order', { ascending: true });

      const enriched = auts.map(a => ({
        ...a,
        messages: (msgs || []).filter(m => m.automation_id === a.id)
      })) as InstagramAutomation[];

      setAutomations(enriched);
    } catch (err) {
      console.error('Erro fetchAutomations:', err);
    } finally {
      setLoadingAutomations(false);
    }
  };

  const handleNewAutomation = () => {
    setEditingAutomation({
      name: '',
      post_id: '',
      post_url: '',
      post_thumbnail_url: '',
      post_caption: '',
      keyword: '',
      active: true,
      reply_comment: true,
      reply_comment_text: 'Te mandei no Direct! 🔥',
      messages: [
        { sort_order: 0, message_type: 'text', text_content: '', delay_seconds: 0 }
      ]
    });
    setShowEditor(true);
  };

  const handleEditAutomation = (automation: InstagramAutomation) => {
    setEditingAutomation({ ...automation });
    setShowEditor(true);
  };

  const handleDeleteAutomation = async (id: number) => {
    if (!window.confirm('Excluir esta automação? Esta ação não pode ser desfeita.')) return;
    try {
      await supabase.from('sp3_instagram_automations').delete().eq('id', id);
      setAutomations(prev => prev.filter(a => a.id !== id));
      showFeedback('success', 'Automação excluída');
    } catch (err: any) {
      showFeedback('error', 'Erro: ' + err.message);
    }
  };

  const handleToggleAutomation = async (id: number, currentActive: boolean) => {
    try {
      await supabase
        .from('sp3_instagram_automations')
        .update({ active: !currentActive })
        .eq('id', id);
      setAutomations(prev => prev.map(a =>
        a.id === id ? { ...a, active: !currentActive } : a
      ));
    } catch (err: any) {
      showFeedback('error', 'Erro: ' + err.message);
    }
  };

  const handleSaveAutomation = async () => {
    if (!editingAutomation || !igAccount) return;
    if (!editingAutomation.name?.trim()) {
      showFeedback('error', 'Dê um nome para a automação');
      return;
    }
    if (!editingAutomation.post_id) {
      showFeedback('error', 'Selecione um post');
      return;
    }
    if (!editingAutomation.keyword?.trim()) {
      showFeedback('error', 'Defina uma palavra-chave');
      return;
    }
    if (!editingAutomation.messages?.length) {
      showFeedback('error', 'Adicione pelo menos uma mensagem');
      return;
    }

    setSavingAutomation(true);
    try {
      const isEdit = !!editingAutomation.id;
      let automationId = editingAutomation.id;

      const automationData = {
        company_id: authUser.company_id,
        instagram_account_id: igAccount.id,
        name: editingAutomation.name!.trim(),
        post_id: editingAutomation.post_id!,
        post_url: editingAutomation.post_url || '',
        post_thumbnail_url: editingAutomation.post_thumbnail_url || '',
        post_caption: editingAutomation.post_caption || '',
        keyword: editingAutomation.keyword!.trim().toUpperCase(),
        active: editingAutomation.active ?? true,
        reply_comment: editingAutomation.reply_comment ?? true,
        reply_comment_text: editingAutomation.reply_comment_text || 'Te mandei no Direct! 🔥'
      };

      if (isEdit) {
        const { error } = await supabase
          .from('sp3_instagram_automations')
          .update(automationData)
          .eq('id', automationId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('sp3_instagram_automations')
          .insert([automationData])
          .select('id')
          .single();
        if (error) throw error;
        automationId = data.id;
      }

      // Salvar mensagens: deletar existentes e reinserir
      await supabase
        .from('sp3_instagram_automation_messages')
        .delete()
        .eq('automation_id', automationId);

      const messagesData = (editingAutomation.messages || []).map((msg, idx) => ({
        automation_id: automationId,
        company_id: authUser.company_id,
        sort_order: idx,
        message_type: msg.message_type,
        text_content: msg.text_content || null,
        media_url: msg.media_url || null,
        button_title: msg.button_title || null,
        button_url: msg.button_url || null,
        delay_seconds: msg.delay_seconds || 0
      }));

      if (messagesData.length > 0) {
        const { error: msgError } = await supabase
          .from('sp3_instagram_automation_messages')
          .insert(messagesData);
        if (msgError) throw msgError;
      }

      showFeedback('success', isEdit ? 'Automação atualizada!' : 'Automação criada!');
      setShowEditor(false);
      setEditingAutomation(null);
      await fetchAutomations();
    } catch (err: any) {
      showFeedback('error', 'Erro ao salvar: ' + err.message);
    } finally {
      setSavingAutomation(false);
    }
  };

  // ============================================================
  // FUNÇÕES: Seletor de Posts
  // ============================================================
  const fetchInstagramPosts = async () => {
    if (!igAccount?.access_token) return;
    setLoadingPosts(true);
    try {
      const res = await fetch(
        `https://graph.instagram.com/v21.0/${igAccount.ig_user_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25&access_token=${igAccount.access_token}`
      );
      const data = await res.json();
      if (data.data) {
        setIgPosts(data.data as InstagramPost[]);
      }
    } catch (err) {
      console.error('Erro ao buscar posts:', err);
      showFeedback('error', 'Erro ao buscar posts do Instagram');
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleSelectPost = (post: InstagramPost) => {
    if (!editingAutomation) return;
    setEditingAutomation({
      ...editingAutomation,
      post_id: post.id,
      post_url: post.permalink,
      post_thumbnail_url: post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url,
      post_caption: (post.caption || '').substring(0, 100)
    });
    setShowPostSelector(false);
  };

  // ============================================================
  // FUNÇÕES: Mensagens da automação
  // ============================================================
  const addMessage = (type: 'text' | 'image' | 'link_button') => {
    if (!editingAutomation) return;
    const msgs = [...(editingAutomation.messages || [])];
    msgs.push({
      sort_order: msgs.length,
      message_type: type,
      text_content: '',
      media_url: '',
      button_title: '',
      button_url: '',
      delay_seconds: 0
    });
    setEditingAutomation({ ...editingAutomation, messages: msgs });
  };

  const removeMessage = (idx: number) => {
    if (!editingAutomation) return;
    const msgs = (editingAutomation.messages || []).filter((_, i) => i !== idx);
    setEditingAutomation({ ...editingAutomation, messages: msgs });
  };

  const updateMessage = (idx: number, updates: Partial<InstagramAutomationMessage>) => {
    if (!editingAutomation) return;
    const msgs = [...(editingAutomation.messages || [])];
    msgs[idx] = { ...msgs[idx], ...updates };
    setEditingAutomation({ ...editingAutomation, messages: msgs });
  };

  const handleMediaUpload = async (file: File, msgIdx: number) => {
    setUploadingMedia(msgIdx);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${authUser.company_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { error } = await supabase.storage
        .from('instagram-media')
        .upload(fileName, file, { cacheControl: '31536000', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('instagram-media')
        .getPublicUrl(fileName);

      updateMessage(msgIdx, { media_url: urlData.publicUrl });
    } catch (err: any) {
      showFeedback('error', 'Erro no upload: ' + err.message);
    } finally {
      setUploadingMedia(null);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================
  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="fade-in" style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontWeight: '900', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Instagram size={22} color="var(--accent)" /> Instagram Automações
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
          Automações estilo ManyChat — comentário com palavra-chave dispara DMs automáticas
        </p>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '12px',
          background: feedback.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: feedback.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          fontWeight: '600', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: 'var(--shadow-md)', animation: 'fadeIn 0.3s ease-out'
        }}>
          {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {feedback.message}
        </div>
      )}

      {/* ============================== */}
      {/* Card 1: Configuração Meta App */}
      {/* ============================== */}
      {authUser.role === 'master' && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #E1306C, #F77737)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Instagram size={18} color="white" />
            </div>
            <div>
              <h4 style={{ fontWeight: '800', fontSize: '1rem' }}>Configuração Meta App</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>App ID e Secret do Facebook Developers</p>
            </div>
          </div>

          {/* Guia rápido */}
          <div style={{
            padding: '12px 16px', borderRadius: '10px',
            background: 'var(--accent-soft)', marginBottom: '1rem',
            fontSize: '0.78rem', color: 'var(--accent)', lineHeight: '1.5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '4px' }}>
              <Info size={14} /> Como configurar
            </div>
            1. Acesse <strong>developers.facebook.com</strong> e crie um App tipo "Business"<br />
            2. Adicione os produtos <strong>Instagram</strong> e <strong>Webhooks</strong><br />
            3. Copie o <strong>App ID</strong> e <strong>App Secret</strong> de Settings {'>'} Basic<br />
            4. Em Webhooks: Instagram → comments → Callback: <code style={{ fontSize: '0.72rem' }}>{N8N_WEBHOOK_BASE}/webhook/instagram-events</code><br />
            5. Verify Token: <code style={{ fontSize: '0.72rem' }}>sp3_instagram_verify_2026</code>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>App ID</label>
              <input
                type="text"
                value={igAppId}
                onChange={(e) => setIgAppId(e.target.value)}
                placeholder="Ex: 123456789012345"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  fontSize: '0.85rem', outline: 'none', color: 'var(--text-primary)'
                }}
              />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>App Secret</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={igAppSecret}
                  onChange={(e) => setIgAppSecret(e.target.value)}
                  placeholder="Ex: abc123def456..."
                  style={{
                    width: '100%', padding: '10px 40px 10px 14px', borderRadius: '10px',
                    border: '1px solid var(--border)', background: 'var(--bg-primary)',
                    fontSize: '0.85rem', outline: 'none', color: 'var(--text-primary)'
                  }}
                />
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px'
                  }}
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveCredentials}
            disabled={savingCredentials}
            style={{
              marginTop: '12px', padding: '10px 20px', borderRadius: '10px',
              border: 'none', background: 'var(--accent)', color: 'white',
              fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
              opacity: savingCredentials ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            {savingCredentials ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Salvar Credenciais
          </button>
        </div>
      )}

      {/* ============================== */}
      {/* Card 2: Conexão Instagram */}
      {/* ============================== */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h4 style={{ fontWeight: '800', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Power size={18} color="var(--accent)" /> Conexão Instagram
        </h4>

        {loadingAccount ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
            <Loader2 size={18} className="animate-spin" /> Verificando conexão...
          </div>
        ) : igAccount ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #E1306C, #F77737, #FCAF45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Instagram size={22} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>@{igAccount.ig_username}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {igAccount.page_name} • Conectado
                </div>
              </div>
              <div style={{
                padding: '3px 10px', borderRadius: '20px',
                background: 'var(--success-soft)', color: 'var(--success)',
                fontSize: '0.7rem', fontWeight: '800'
              }}>
                ATIVO
              </div>
            </div>
            <button
              onClick={handleDisconnectInstagram}
              style={{
                padding: '8px 16px', borderRadius: '10px',
                border: '1px solid var(--error-soft)', background: 'var(--bg-tertiary)',
                color: 'var(--error)', fontWeight: '600', fontSize: '0.8rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <PowerOff size={14} /> Desconectar
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Conecte sua conta Instagram Business para criar automações de comentários.
            </p>
            <button
              onClick={handleConnectInstagram}
              disabled={connecting || !igAppId}
              style={{
                padding: '12px 24px', borderRadius: '12px', border: 'none',
                background: connecting ? 'var(--text-muted)' : 'linear-gradient(135deg, #E1306C, #F77737)',
                color: 'white', fontWeight: '700', fontSize: '0.9rem',
                cursor: connecting || !igAppId ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                opacity: !igAppId ? 0.5 : 1
              }}
            >
              {connecting ? (
                <><Loader2 size={18} className="animate-spin" /> Conectando...</>
              ) : (
                <><Instagram size={18} /> Conectar Instagram</>
              )}
            </button>
            {!igAppId && (
              <p style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '6px' }}>
                Configure o App ID do Meta acima antes de conectar
              </p>
            )}
          </div>
        )}
      </div>

      {/* ============================== */}
      {/* Card 3: Automações */}
      {/* ============================== */}
      {igAccount && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h4 style={{ fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageCircle size={18} color="var(--accent)" /> Suas Automações
            </h4>
            <button
              onClick={handleNewAutomation}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none',
                background: 'var(--accent)', color: 'white',
                fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Plus size={14} /> Nova Automação
            </button>
          </div>

          {loadingAutomations ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              Carregando automações...
            </div>
          ) : automations.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)',
              border: '2px dashed var(--border)', borderRadius: '12px'
            }}>
              <Instagram size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontWeight: '600', marginBottom: '4px' }}>Nenhuma automação criada</p>
              <p style={{ fontSize: '0.8rem' }}>Clique em "Nova Automação" para começar</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {automations.map(automation => (
                <div
                  key={automation.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px', borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Thumbnail do Post */}
                  {automation.post_thumbnail_url ? (
                    <img
                      src={automation.post_thumbnail_url}
                      alt="Post"
                      style={{
                        width: '56px', height: '56px', borderRadius: '10px',
                        objectFit: 'cover', flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '10px',
                      background: 'var(--border)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Image size={20} color="var(--text-muted)" />
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '2px' }}>
                      {automation.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        background: 'var(--accent-soft)', color: 'var(--accent)',
                        fontSize: '0.72rem', fontWeight: '700'
                      }}>
                        {automation.keyword}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {automation.messages?.length || 0} msg{(automation.messages?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Toggle ativo */}
                  <button
                    onClick={() => handleToggleAutomation(automation.id, automation.active)}
                    style={{
                      padding: '4px 12px', borderRadius: '20px',
                      border: 'none', cursor: 'pointer',
                      background: automation.active ? 'var(--success-soft)' : 'var(--bg-tertiary)',
                      color: automation.active ? 'var(--success)' : 'var(--text-muted)',
                      fontSize: '0.7rem', fontWeight: '800'
                    }}
                  >
                    {automation.active ? 'ATIVA' : 'PAUSADA'}
                  </button>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleEditAutomation(automation)}
                      style={{
                        padding: '8px', borderRadius: '8px', border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteAutomation(automation.id)}
                      style={{
                        padding: '8px', borderRadius: '8px', border: '1px solid var(--error-soft)',
                        background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--error)',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================== */}
      {/* Modal: Editor de Automação */}
      {/* ============================== */}
      {showEditor && editingAutomation && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }} onClick={(e) => { if (e.target === e.currentTarget) { setShowEditor(false); setEditingAutomation(null); } }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px',
            width: '100%', maxWidth: '640px', maxHeight: '90vh',
            overflow: 'auto', padding: '1.5rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {/* Header do modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '800', fontSize: '1.1rem' }}>
                {editingAutomation.id ? 'Editar Automação' : 'Nova Automação'}
              </h3>
              <button
                onClick={() => { setShowEditor(false); setEditingAutomation(null); }}
                style={{
                  background: 'var(--bg-primary)', border: 'none', cursor: 'pointer',
                  padding: '8px', borderRadius: '8px', color: 'var(--text-secondary)'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Nome */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Nome da Automação</label>
              <input
                type="text"
                value={editingAutomation.name || ''}
                onChange={(e) => setEditingAutomation({ ...editingAutomation, name: e.target.value })}
                placeholder="Ex: Promo Verão, Black Friday..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  fontSize: '0.85rem', outline: 'none', color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Palavra-chave */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Palavra-chave (trigger)</label>
              <input
                type="text"
                value={editingAutomation.keyword || ''}
                onChange={(e) => setEditingAutomation({ ...editingAutomation, keyword: e.target.value.toUpperCase() })}
                placeholder="Ex: QUERO, PROMO, EU..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  fontSize: '0.85rem', outline: 'none', color: 'var(--text-primary)',
                  textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px'
                }}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Quando alguém comentar esta palavra no post, a DM será enviada
              </p>
            </div>

            {/* Post selecionado */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Post do Instagram</label>
              {editingAutomation.post_id ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px', borderRadius: '10px', border: '1px solid var(--border)',
                  background: 'var(--bg-primary)'
                }}>
                  {editingAutomation.post_thumbnail_url && (
                    <img
                      src={editingAutomation.post_thumbnail_url}
                      alt="Post"
                      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {editingAutomation.post_caption || 'Post selecionado'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      ID: {editingAutomation.post_id}
                    </div>
                  </div>
                  <button
                    onClick={() => { fetchInstagramPosts(); setShowPostSelector(true); }}
                    style={{
                      padding: '6px 12px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                      cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent)'
                    }}
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { fetchInstagramPosts(); setShowPostSelector(true); }}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '10px',
                    border: '2px dashed var(--border)', background: 'var(--bg-primary)',
                    cursor: 'pointer', color: 'var(--text-muted)',
                    fontWeight: '600', fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <Image size={18} /> Selecionar Post
                </button>
              )}
            </div>

            {/* Reply no comentário */}
            <div style={{
              marginBottom: '1.25rem', padding: '12px', borderRadius: '10px',
              border: '1px solid var(--border)', background: 'var(--bg-primary)'
            }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: '600'
              }}>
                <input
                  type="checkbox"
                  checked={editingAutomation.reply_comment ?? true}
                  onChange={(e) => setEditingAutomation({ ...editingAutomation, reply_comment: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Responder no próprio comentário
              </label>
              {editingAutomation.reply_comment && (
                <input
                  type="text"
                  value={editingAutomation.reply_comment_text || ''}
                  onChange={(e) => setEditingAutomation({ ...editingAutomation, reply_comment_text: e.target.value })}
                  placeholder="Ex: Te mandei no Direct! 🔥"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    fontSize: '0.8rem', outline: 'none', marginTop: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
              )}
            </div>

            {/* Sequência de Mensagens DM */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                Sequência de DMs ({editingAutomation.messages?.length || 0} mensagen{(editingAutomation.messages?.length || 0) !== 1 ? 's' : ''})
              </label>

              {(editingAutomation.messages || []).map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px', borderRadius: '10px',
                    border: '1px solid var(--border)', background: 'var(--bg-primary)',
                    marginBottom: '8px', position: 'relative'
                  }}
                >
                  {/* Header da mensagem */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px',
                        background: msg.message_type === 'text' ? 'var(--accent-soft)' :
                          msg.message_type === 'image' ? 'var(--warning-soft)' : 'var(--accent-soft)',
                        color: msg.message_type === 'text' ? 'var(--accent)' :
                          msg.message_type === 'image' ? 'var(--warning)' : 'var(--accent)',
                        fontSize: '0.7rem', fontWeight: '800'
                      }}>
                        {msg.message_type === 'text' ? 'TEXTO' : msg.message_type === 'image' ? 'IMAGEM' : 'LINK'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Msg {idx + 1}</span>
                    </div>
                    {(editingAutomation.messages?.length || 0) > 1 && (
                      <button
                        onClick={() => removeMessage(idx)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--error)', padding: '4px'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Conteúdo por tipo */}
                  {msg.message_type === 'text' && (
                    <div>
                      <textarea
                        value={msg.text_content || ''}
                        onChange={(e) => updateMessage(idx, { text_content: e.target.value })}
                        placeholder="Digite a mensagem... Use {username} para o @ do comentarista"
                        rows={3}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '8px',
                          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                          fontSize: '0.85rem', outline: 'none', resize: 'vertical',
                          fontFamily: 'inherit', color: 'var(--text-primary)'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                        <button
                          onClick={() => {
                            const current = msg.text_content || '';
                            updateMessage(idx, { text_content: current + '{username}' });
                          }}
                          style={{
                            padding: '3px 8px', borderRadius: '6px',
                            border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                            cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600', color: 'var(--accent)'
                          }}
                        >
                          {'+ {username}'}
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.message_type === 'image' && (
                    <div>
                      {msg.media_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={msg.media_url}
                            alt="Preview"
                            style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }}
                          />
                          <button
                            onClick={() => updateMessage(idx, { media_url: '' })}
                            style={{
                              padding: '6px 12px', borderRadius: '8px',
                              border: '1px solid var(--error-soft)', background: 'var(--bg-tertiary)',
                              cursor: 'pointer', color: 'var(--error)', fontSize: '0.75rem', fontWeight: '600'
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <label style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          padding: '16px', borderRadius: '8px', border: '2px dashed var(--border)',
                          cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem'
                        }}>
                          {uploadingMedia === idx ? (
                            <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                          ) : (
                            <><Image size={16} /> Fazer upload da imagem</>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleMediaUpload(file, idx);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {msg.message_type === 'link_button' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea
                        value={msg.text_content || ''}
                        onChange={(e) => updateMessage(idx, { text_content: e.target.value })}
                        placeholder="Texto da mensagem antes do botão..."
                        rows={2}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '8px',
                          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                          fontSize: '0.85rem', outline: 'none', resize: 'vertical',
                          fontFamily: 'inherit', color: 'var(--text-primary)'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={msg.button_title || ''}
                          onChange={(e) => updateMessage(idx, { button_title: e.target.value })}
                          placeholder="Texto do botão (ex: Ver Oferta)"
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                            fontSize: '0.8rem', outline: 'none', color: 'var(--text-primary)'
                          }}
                        />
                        <input
                          type="url"
                          value={msg.button_url || ''}
                          onChange={(e) => updateMessage(idx, { button_url: e.target.value })}
                          placeholder="https://..."
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                            fontSize: '0.8rem', outline: 'none', color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Delay */}
                  {idx > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Delay:</span>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={msg.delay_seconds}
                        onChange={(e) => updateMessage(idx, { delay_seconds: parseInt(e.target.value) || 0 })}
                        style={{
                          width: '60px', padding: '4px 8px', borderRadius: '6px',
                          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                          fontSize: '0.75rem', textAlign: 'center', outline: 'none',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>segundos</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Botão adicionar mensagem */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button
                  onClick={() => addMessage('text')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: '1px dashed var(--border)', background: 'var(--bg-primary)',
                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                    color: 'var(--accent)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '4px'
                  }}
                >
                  <Type size={14} /> Texto
                </button>
                <button
                  onClick={() => addMessage('image')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: '1px dashed var(--border)', background: 'var(--bg-primary)',
                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                    color: '#92400e', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '4px'
                  }}
                >
                  <Image size={14} /> Imagem
                </button>
                <button
                  onClick={() => addMessage('link_button')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: '1px dashed var(--border)', background: 'var(--bg-primary)',
                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
                    color: '#1e40af', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '4px'
                  }}
                >
                  <Link size={14} /> Link
                </button>
              </div>
            </div>

            {/* Botão salvar */}
            <button
              onClick={handleSaveAutomation}
              disabled={savingAutomation}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                border: 'none', background: 'var(--accent-gradient)',
                color: 'white', fontWeight: '800', fontSize: '0.95rem',
                cursor: savingAutomation ? 'not-allowed' : 'pointer',
                opacity: savingAutomation ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              {savingAutomation ? (
                <><Loader2 size={18} className="animate-spin" /> Salvando...</>
              ) : (
                <><Check size={18} /> Salvar Automação</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* Modal: Seletor de Posts */}
      {/* ============================== */}
      {showPostSelector && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowPostSelector(false); }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px',
            width: '100%', maxWidth: '640px', maxHeight: '80vh',
            overflow: 'auto', padding: '1.5rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '800', fontSize: '1rem' }}>Selecionar Post</h3>
              <button
                onClick={() => setShowPostSelector(false)}
                style={{
                  background: 'var(--bg-primary)', border: 'none', cursor: 'pointer',
                  padding: '8px', borderRadius: '8px', color: 'var(--text-secondary)'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {loadingPosts ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                Carregando posts do Instagram...
              </div>
            ) : igPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Instagram size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>Nenhum post encontrado</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}>
                {igPosts.map(post => (
                  <button
                    key={post.id}
                    onClick={() => handleSelectPost(post)}
                    style={{
                      padding: 0, border: '2px solid transparent', borderRadius: '10px',
                      cursor: 'pointer', overflow: 'hidden', background: 'var(--bg-primary)',
                      transition: 'all 0.2s', position: 'relative', aspectRatio: '1'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                  >
                    <img
                      src={post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url}
                      alt={post.caption || 'Post'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {post.media_type === 'VIDEO' && (
                      <div style={{
                        position: 'absolute', top: '6px', right: '6px',
                        background: 'rgba(0,0,0,0.6)', color: 'white',
                        padding: '2px 6px', borderRadius: '4px',
                        fontSize: '0.6rem', fontWeight: '700'
                      }}>
                        VIDEO
                      </div>
                    )}
                    {post.caption && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                        color: 'white', padding: '20px 6px 6px', fontSize: '0.65rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {post.caption.substring(0, 60)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
