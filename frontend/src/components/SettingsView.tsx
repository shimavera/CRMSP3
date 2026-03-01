import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Shield, Smartphone, RefreshCw, CheckCircle, XCircle, Loader2, QrCode, History, Users, Trash2, Plus, Eye, EyeOff, Video, Upload, Power, PowerOff, X, MessageSquareText } from 'lucide-react';
import { supabase } from "../lib/supabase";
import type { UserProfile, SocialProofVideo, QuickMessage, Instance } from '../lib/supabase';

interface SettingsViewProps {
    authUser: UserProfile;
}

const SECTION_LABELS: Record<string, string> = {
    dashboard: 'Visão Geral',
    chats: 'Conversas Ativas',
    kanban: 'Kanban',
    leads: 'Base de Leads',
    settings: 'Configurações'
};

const SettingsView = ({ authUser }: SettingsViewProps) => {
    const [status, setStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'whatsapp' | 'ia' | 'followup' | 'videos' | 'quickmessages' | 'profile' | 'usuarios' | 'dados'>('whatsapp');

    // Estados de Instâncias WhatsApp
    const [instances, setInstances] = useState<Instance[]>([]);
    const [activeInstance, setActiveInstance] = useState<Instance | null>(null);
    const [showCreateInstance, setShowCreateInstance] = useState(false);
    const [newInstanceName, setNewInstanceName] = useState('');
    const [newInstanceDisplayName, setNewInstanceDisplayName] = useState('');
    const [isCreatingInstance, setIsCreatingInstance] = useState(false);
    const [createInstanceError, setCreateInstanceError] = useState<string | null>(null);
    const [evoError, setEvoError] = useState<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Estados de Dados
    const [isResettingChats, setIsResettingChats] = useState(false);

    // Estados de Usuários
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [newUserNome, setNewUserNome] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [newUserPermissions, setNewUserPermissions] = useState({
        dashboard: true, chats: true, kanban: true, leads: true, settings: false
    });
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [createUserError, setCreateUserError] = useState<string | null>(null);
    const [createUserSuccess, setCreateUserSuccess] = useState(false);

    // Estados do Prompt da IA
    const [aiPrompt, setAiPrompt] = useState<string>('');
    const [promptHistory, setPromptHistory] = useState<any[]>([]);
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Estados do Follow-up
    const [followupConfig, setFollowupConfig] = useState<any>({
        start_time: '08:00',
        end_time: '18:00',
        active_days: [1, 2, 3, 4, 5],
        interval_1: 10,
        interval_2: 30,
        interval_3: 60,
        msg_1: 'Oi! Passando para ver se conseguiu ler minha última mensagem? 👀',
        msg_2: 'Ainda por aí? Se preferir, podemos marcar um papo rápido para eu tirar suas dúvidas! 📲',
        msg_3: 'Vi que as coisas devem estar corridas! Vou deixar nosso link de agenda aqui para quando você puder. 🤝'
    });
    const [isSavingFollowup, setIsSavingFollowup] = useState(false);
    const [followupSuccess, setFollowupSuccess] = useState(false);

    // Estados de Vídeos de Prova Social
    const [videos, setVideos] = useState<SocialProofVideo[]>([]);
    const [isLoadingVideos, setIsLoadingVideos] = useState(false);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [showAddVideo, setShowAddVideo] = useState(false);
    const [newVideoTitulo, setNewVideoTitulo] = useState('');
    const [newVideoDescricao, setNewVideoDescricao] = useState('');
    const [newVideoContexto, setNewVideoContexto] = useState('Depoimento');
    const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
    const videoFileRef = useRef<HTMLInputElement>(null);

    // Estados de Mensagens Rápidas
    const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
    const [isLoadingQuickMessages, setIsLoadingQuickMessages] = useState(false);
    const [showAddQuickMessage, setShowAddQuickMessage] = useState(false);
    const [newQuickMessageTitle, setNewQuickMessageTitle] = useState('');
    const [newQuickMessageContent, setNewQuickMessageContent] = useState('');
    const [isSavingQuickMessage, setIsSavingQuickMessage] = useState(false);

    const fetchFollowupConfig = async () => {
        try {
            const { data } = await supabase
                .from('sp3_followup_settings')
                .select('*')
                .limit(1)
                .single();

            if (data) {
                setFollowupConfig({
                    ...data,
                    active_days: data.active_days || [1, 2, 3, 4, 5],
                    start_time: data.start_time || '08:00',
                    end_time: data.end_time || '18:00',
                    interval_1: data.interval_1 || 10,
                    interval_2: data.interval_2 || 30,
                    interval_3: data.interval_3 || 60,
                    msg_1: data.msg_1 || 'Oi! Passando para ver se conseguiu ler minha última mensagem? 👀',
                    msg_2: data.msg_2 || 'Ainda por aí? Se preferir, podemos marcar um papo rápido para eu tirar suas dúvidas! 📲',
                    msg_3: data.msg_3 || 'Vi que as coisas devem estar corridas! Vou deixar nosso link de agenda aqui para quando você puder. 🤝'
                });
            }
        } catch (err) {
            console.error('Erro ao carregar follow-up:', err);
        }
    };

    const handleSaveFollowup = async () => {
        setIsSavingFollowup(true);
        setFollowupSuccess(false);
        try {
            // Tenta dar update no ID 1 ou inserir se não houver
            const { error } = await supabase
                .from('sp3_followup_settings')
                .upsert([
                    {
                        id: followupConfig.id || 1,
                        ...followupConfig,
                        updated_at: new Date()
                    }
                ]);

            if (error) throw error;
            setFollowupSuccess(true);
            setTimeout(() => setFollowupSuccess(false), 3000);
        } catch (err: any) {
            console.error('Erro ao salvar follow-up:', err);
            alert(`Erro ao salvar: ${err.message || 'Verifique se a tabela sp3_followup_settings existe e tem as colunas corretas.'}`);
        } finally {
            setIsSavingFollowup(false);
        }
    };

    // Funções de Vídeos de Prova Social
    const fetchVideos = async () => {
        setIsLoadingVideos(true);
        const { data } = await supabase
            .from('sp3_social_proof_videos')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setVideos(data as SocialProofVideo[]);
        setIsLoadingVideos(false);
    };

    const handleUploadVideo = async () => {
        if (!newVideoFile || !newVideoTitulo.trim() || !newVideoDescricao.trim()) return;
        setIsUploadingVideo(true);

        try {
            const ext = newVideoFile.name.split('.').pop() || 'mp4';
            const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('social-proof-videos')
                .upload(fileName, newVideoFile, { contentType: newVideoFile.type });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('social-proof-videos')
                .getPublicUrl(fileName);

            const { error: insertError } = await supabase
                .from('sp3_social_proof_videos')
                .insert([{
                    titulo: newVideoTitulo.trim(),
                    descricao: newVideoDescricao.trim(),
                    contexto: newVideoContexto,
                    url: urlData.publicUrl,
                    mimetype: newVideoFile.type
                }]);

            if (insertError) throw insertError;

            setNewVideoTitulo('');
            setNewVideoDescricao('');
            setNewVideoContexto('Depoimento');
            setNewVideoFile(null);
            if (videoFileRef.current) videoFileRef.current.value = '';
            await fetchVideos();
        } catch (err: any) {
            alert('Erro ao fazer upload: ' + err.message);
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const handleToggleVideo = async (video: SocialProofVideo) => {
        const { error } = await supabase
            .from('sp3_social_proof_videos')
            .update({ active: !video.active })
            .eq('id', video.id);
        if (error) alert('Erro: ' + error.message);
        else setVideos(prev => prev.map(v => v.id === video.id ? { ...v, active: !v.active } : v));
    };

    const handleDeleteVideo = async (video: SocialProofVideo) => {
        if (!window.confirm(`Excluir o vídeo "${video.titulo}"?`)) return;
        // Extrair nome do arquivo da URL
        const urlParts = video.url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from('social-proof-videos').remove([fileName]);
        const { error } = await supabase.from('sp3_social_proof_videos').delete().eq('id', video.id);
        if (error) alert('Erro: ' + error.message);
        else setVideos(prev => prev.filter(v => v.id !== video.id));
    };

    // Funções de Mensagens Rápidas
    const fetchQuickMessages = async () => {
        setIsLoadingQuickMessages(true);
        const { data } = await supabase
            .from('sp3_quick_messages')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setQuickMessages(data as QuickMessage[]);
        setIsLoadingQuickMessages(false);
    };

    const handleSaveQuickMessage = async () => {
        if (!newQuickMessageTitle.trim() || !newQuickMessageContent.trim()) return;
        setIsSavingQuickMessage(true);

        try {
            const { error } = await supabase
                .from('sp3_quick_messages')
                .insert([{
                    title: newQuickMessageTitle.trim(),
                    content: newQuickMessageContent.trim()
                }]);

            if (error) throw error;

            setNewQuickMessageTitle('');
            setNewQuickMessageContent('');
            setShowAddQuickMessage(false);
            await fetchQuickMessages();
        } catch (err: any) {
            alert('Erro ao salvar mensagem rápida: ' + err.message);
        } finally {
            setIsSavingQuickMessage(false);
        }
    };

    const handleDeleteQuickMessage = async (msgId: string) => {
        if (!window.confirm('Excluir esta mensagem rápida?')) return;
        const { error } = await supabase.from('sp3_quick_messages').delete().eq('id', msgId);
        if (error) alert('Erro: ' + error.message);
        else setQuickMessages(prev => prev.filter(m => m.id !== msgId));
    };

    const toggleDay = (day: number) => {
        const currentDays = [...followupConfig.active_days];
        const index = currentDays.indexOf(day);
        if (index > -1) {
            currentDays.splice(index, 1);
        } else {
            currentDays.push(day);
        }
        setFollowupConfig({ ...followupConfig, active_days: currentDays.sort() });
    };

    const fetchPromptHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('sp3_prompts')
                .select('*')
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                setPromptHistory(data);
                // Se o editor estiver vazio, carrega o mais recente
                if (!aiPrompt) setAiPrompt(data[0].content);
            }
            if (error) console.error('Erro ao buscar histórico:', error);
        } catch (err) {
            console.error('Erro:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleSavePrompt = async () => {
        if (!aiPrompt.trim()) return;
        setIsSavingPrompt(true);
        setSaveSuccess(false);
        try {
            const { error } = await supabase
                .from('sp3_prompts')
                .insert([{ content: aiPrompt }]);

            if (error) throw error;
            setSaveSuccess(true);
            await fetchPromptHistory(); // Atualiza a lista
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Erro ao salvar prompt:', err);
            alert('Erro ao salvar no banco. Verifique se criou a tabela sp3_prompts via SQL no Supabase.');
        } finally {
            setIsSavingPrompt(false);
        }
    };

    const handleRestoreVersion = (content: string) => {
        if (window.confirm('Deseja carregar esta versão no editor? (Você precisará clicar em Salvar para ativá-la como a principal)')) {
            setAiPrompt(content);
        }
    };

    // === Funções de Instâncias WhatsApp ===

    const fetchInstances = async () => {
        try {
            const { data, error } = await supabase
                .from('sp3_instances')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            const list = (data || []) as Instance[];
            setInstances(list);

            const active = list.find(i => i.is_active) || null;
            setActiveInstance(active);

            if (active) {
                await checkInstanceStatus(active);
            } else {
                setStatus('disconnected');
            }
        } catch (err: any) {
            console.error('Erro ao carregar instancias:', err);
            setStatus('disconnected');
        }
    };

    const checkInstanceStatus = async (instance: Instance) => {
        setStatus('loading');
        setEvoError(null);
        try {
            const response = await fetch(
                `${instance.evo_api_url}/instance/connectionStatus/${instance.instance_name}`,
                { headers: { 'apikey': instance.evo_api_key } }
            );

            if (!response.ok) {
                setStatus('disconnected');
                await supabase.from('sp3_instances')
                    .update({ connection_status: 'disconnected' })
                    .eq('id', instance.id);
                return;
            }

            const data = await response.json();
            const state = data?.instance?.state ?? data?.state ?? null;

            if (state === 'open') {
                setStatus('connected');
                setQrCode(null);
                await supabase.from('sp3_instances')
                    .update({ connection_status: 'connected' })
                    .eq('id', instance.id);
            } else {
                setStatus('disconnected');
                await supabase.from('sp3_instances')
                    .update({ connection_status: 'disconnected' })
                    .eq('id', instance.id);
            }
        } catch (err: any) {
            console.error('Erro ao buscar status:', err);
            setStatus('disconnected');
            setEvoError(err.message);
        }
    };

    const ensureInstanceExists = async (instance: Instance): Promise<boolean> => {
        try {
            // Verificar se instância já existe
            const checkRes = await fetch(
                `${instance.evo_api_url}/instance/connectionStatus/${instance.instance_name}`,
                { headers: { 'apikey': instance.evo_api_key } }
            );

            if (checkRes.ok) return true;

            // Qualquer erro = tentar criar a instância
            console.log(`Instance check returned ${checkRes.status}, tentando criar...`);
            const createRes = await fetch(
                `${instance.evo_api_url}/instance/create`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': instance.evo_api_key
                    },
                    body: JSON.stringify({
                        instanceName: instance.instance_name,
                        qrcode: true,
                        integration: 'WHATSAPP-BAILEYS'
                    })
                }
            );

            if (!createRes.ok) {
                const errBody = await createRes.text();
                throw new Error(`Falha ao criar instancia (${createRes.status}): ${errBody}`);
            }
            return true;
        } catch (err: any) {
            console.error('Erro ao verificar/criar instancia:', err);
            setEvoError(err.message);
            return false;
        }
    };

    const getQrCode = async () => {
        if (!activeInstance) return;
        setIsRefreshing(true);
        setEvoError(null);
        setQrCode(null);

        try {
            const exists = await ensureInstanceExists(activeInstance);
            if (!exists) {
                throw new Error('Nao foi possivel criar/verificar a instancia na Evolution API.');
            }

            const response = await fetch(
                `${activeInstance.evo_api_url}/instance/connect/${activeInstance.instance_name}`,
                { headers: { 'apikey': activeInstance.evo_api_key } }
            );

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Erro ao gerar QR Code: ${response.status} ${errBody}`);
            }

            const data = await response.json();

            if (data.base64) {
                setQrCode(data.base64);
                setStatus('disconnected');
                startConnectionPolling();
            } else if (data.instance?.state === 'open') {
                setStatus('connected');
                await supabase.from('sp3_instances')
                    .update({ connection_status: 'connected' })
                    .eq('id', activeInstance.id);
            } else {
                throw new Error('QR Code nao retornado pela API. Tente novamente.');
            }
        } catch (err: any) {
            console.error('Erro ao buscar QR Code:', err);
            setEvoError(err.message);
        } finally {
            setIsRefreshing(false);
        }
    };

    const startConnectionPolling = () => {
        stopConnectionPolling();
        pollingRef.current = setInterval(async () => {
            if (!activeInstance) return;
            try {
                const response = await fetch(
                    `${activeInstance.evo_api_url}/instance/connectionStatus/${activeInstance.instance_name}`,
                    { headers: { 'apikey': activeInstance.evo_api_key } }
                );
                if (response.ok) {
                    const data = await response.json();
                    const state = data?.instance?.state ?? data?.state ?? null;
                    if (state === 'open') {
                        setStatus('connected');
                        setQrCode(null);
                        stopConnectionPolling();
                        await supabase.from('sp3_instances')
                            .update({ connection_status: 'connected' })
                            .eq('id', activeInstance.id);
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 3000);
    };

    const stopConnectionPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const handleLogout = async () => {
        if (!activeInstance) return;
        if (!window.confirm('Deseja realmente desconectar o WhatsApp?')) return;

        try {
            await fetch(
                `${activeInstance.evo_api_url}/instance/logout/${activeInstance.instance_name}`,
                {
                    method: 'DELETE',
                    headers: { 'apikey': activeInstance.evo_api_key }
                }
            );
            await supabase.from('sp3_instances')
                .update({ connection_status: 'disconnected' })
                .eq('id', activeInstance.id);
            setStatus('disconnected');
            setQrCode(null);
        } catch (err: any) {
            console.error('Erro ao deslogar:', err);
            setEvoError(err.message);
        }
    };

    const handleCreateInstance = async () => {
        if (!newInstanceName.trim() || !newInstanceDisplayName.trim()) return;
        setIsCreatingInstance(true);
        setCreateInstanceError(null);

        const sanitizedName = newInstanceName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (sanitizedName !== newInstanceName.trim().toLowerCase()) {
            setCreateInstanceError('O nome da instancia deve conter apenas letras minusculas, numeros e hifens.');
            setIsCreatingInstance(false);
            return;
        }

        try {
            const { error } = await supabase
                .from('sp3_instances')
                .insert([{
                    instance_name: sanitizedName,
                    display_name: newInstanceDisplayName.trim(),
                    created_by: authUser.id
                }]);

            if (error) throw error;

            setNewInstanceName('');
            setNewInstanceDisplayName('');
            setShowCreateInstance(false);
            await fetchInstances();
        } catch (err: any) {
            setCreateInstanceError(err.message?.includes('unique')
                ? 'Ja existe uma instancia com esse nome.'
                : err.message);
        } finally {
            setIsCreatingInstance(false);
        }
    };

    const handleSetActiveInstance = async (instance: Instance) => {
        try {
            await supabase.from('sp3_instances')
                .update({ is_active: false })
                .neq('id', instance.id);

            await supabase.from('sp3_instances')
                .update({ is_active: true })
                .eq('id', instance.id);

            await fetchInstances();
        } catch (err: any) {
            console.error('Erro ao ativar instancia:', err);
        }
    };

    const handleDeleteInstance = async (instance: Instance) => {
        if (instance.is_active) {
            alert('Nao e possivel excluir a instancia ativa. Ative outra instancia primeiro.');
            return;
        }
        if (!window.confirm(`Excluir a instancia "${instance.display_name}"?`)) return;

        try {
            await supabase.from('sp3_instances').delete().eq('id', instance.id);
            await fetchInstances();
        } catch (err: any) {
            console.error('Erro ao excluir instancia:', err);
        }
    };

    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        const { data } = await supabase.from('sp3_users').select('*').order('created_at', { ascending: true });
        if (data) setUsersList(data as UserProfile[]);
        setIsLoadingUsers(false);
    };

    const handleCreateUser = async () => {
        if (!newUserNome.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;
        setIsCreatingUser(true);
        setCreateUserError(null);

        // 1. Salvar sessão do master
        const { data: { session: masterSession } } = await supabase.auth.getSession();
        if (!masterSession) { setIsCreatingUser(false); return; }

        // 2. Criar o usuário via signUp
        const { data, error } = await supabase.auth.signUp({ email: newUserEmail.trim(), password: newUserPassword });

        // 3. Restaurar sessão do master imediatamente
        await supabase.auth.setSession({ access_token: masterSession.access_token, refresh_token: masterSession.refresh_token });

        if (error || !data.user) {
            setCreateUserError(error?.message || 'Erro ao criar usuário. Verifique se o email já existe.');
            setIsCreatingUser(false);
            return;
        }

        // 4. Inserir perfil
        const { error: insertError } = await supabase.from('sp3_users').insert([{
            id: data.user.id,
            email: newUserEmail.trim(),
            nome: newUserNome.trim(),
            role: 'user',
            permissions: newUserPermissions
        }]);

        if (insertError) {
            setCreateUserError(insertError.message);
        } else {
            setCreateUserSuccess(true);
            setNewUserNome('');
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserPermissions({ dashboard: true, chats: true, kanban: true, leads: true, settings: false });
            await fetchUsers();
            setTimeout(() => setCreateUserSuccess(false), 3000);
        }
        setIsCreatingUser(false);
    };

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm('Remover este usuário do sistema? Ele não conseguirá mais acessar o CRM.')) return;
        await supabase.from('sp3_users').delete().eq('id', userId);
        await fetchUsers();
    };

    const handleResetChats = async () => {
        if (!window.confirm('CUIDADO: Isso irá apagar todo o histórico de conversas do sistema! Deseja realmente continuar?')) return;
        if (!window.confirm('TEM CERTEZA ABSOLUTA? Esta ação não pode ser desfeita e irá zerar as conversas da IA.')) return;

        setIsResettingChats(true);
        try {
            const { error } = await supabase
                .from('n8n_chat_histories')
                .delete()
                .neq('id', 0); // Deleta todos

            if (error) throw error;
            alert('Histórico de conversas apagado com sucesso! As próximas mensagens iniciarão uma nova conversa do zero.');
        } catch (err: any) {
            console.error('Erro ao limpar histórico:', err);
            alert('Erro ao apagar histórico: ' + err.message);
        } finally {
            setIsResettingChats(false);
        }
    };

    useEffect(() => {
        fetchInstances();
        fetchPromptHistory();
        fetchFollowupConfig();
        fetchVideos();
        fetchQuickMessages();
        if (authUser.role === 'master') fetchUsers();
        return () => stopConnectionPolling();
    }, []);

    return (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem' }}>
            {/* Sidebar de Configurações */}
            <div className="glass-card" style={{ padding: '1.25rem', height: 'fit-content' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1.5rem' }}>Menu</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        onClick={() => setActiveSubTab('whatsapp')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'whatsapp' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'whatsapp' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'whatsapp' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Smartphone size={18} /> WhatsApp
                    </button>
                    <button
                        onClick={() => setActiveSubTab('ia')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'ia' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'ia' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'ia' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <SettingsIcon size={18} /> Configuração da IA
                    </button>
                    <button
                        onClick={() => setActiveSubTab('followup')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'followup' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'followup' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'followup' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <History size={18} /> Follow-up (Auto)
                    </button>
                    <button
                        onClick={() => setActiveSubTab('videos')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'videos' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'videos' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'videos' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Video size={18} /> Prova Social
                    </button>
                    <button
                        onClick={() => setActiveSubTab('quickmessages')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'quickmessages' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'quickmessages' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'quickmessages' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <MessageSquareText size={18} /> Mensagens Rápidas
                    </button>
                    <button
                        onClick={() => setActiveSubTab('profile')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'profile' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'profile' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'profile' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Shield size={18} /> Perfil
                    </button>
                    {authUser.role === 'master' && (
                        <button
                            onClick={() => setActiveSubTab('usuarios')}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'usuarios' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'usuarios' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'usuarios' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                        >
                            <Users size={18} /> Usuários
                        </button>
                    )}
                    {authUser.role === 'master' && (
                        <button
                            onClick={() => setActiveSubTab('dados')}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'dados' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'dados' ? '#ef4444' : 'var(--text-secondary)', fontWeight: activeSubTab === 'dados' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                        >
                            <Trash2 size={18} /> Gerenciar Dados
                        </button>
                    )}
                </div>
            </div>

            {/* Conteúdo Principal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {activeSubTab === 'whatsapp' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Card 1: Conexão WhatsApp */}
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Conexão WhatsApp</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gerencie a instância da Evolution API conectada ao seu WhatsApp.</p>
                                </div>
                                <button
                                    onClick={() => activeInstance && checkInstanceStatus(activeInstance)}
                                    style={{ padding: '8px', borderRadius: '50%', border: '1px solid var(--border-soft)', background: 'white', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                >
                                    <RefreshCw size={18} className={status === 'loading' ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            {/* Seletor de Instância */}
                            {instances.length > 1 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                                        Instância Ativa
                                    </label>
                                    <select
                                        value={activeInstance?.id || ''}
                                        onChange={(e) => {
                                            const inst = instances.find(i => i.id === e.target.value);
                                            if (inst) handleSetActiveInstance(inst);
                                        }}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: 'white', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                        {instances.map(inst => (
                                            <option key={inst.id} value={inst.id}>
                                                {inst.display_name} ({inst.instance_name})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Status Card */}
                            {activeInstance ? (
                                <div style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: status === 'connected' ? '#ecfdf5' : '#fff1f2', color: status === 'connected' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {status === 'connected' ? <CheckCircle size={28} /> : <XCircle size={28} />}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: '800', fontSize: '1rem' }}>Sessão: {activeInstance.instance_name}</span>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: status === 'connected' ? '#dcfce7' : '#fee2e2', color: status === 'connected' ? '#15803d' : '#b91c1c', fontWeight: '700', textTransform: 'uppercase' }}>
                                                    {status === 'connected' ? 'Conectado' : status === 'loading' ? 'Verificando...' : 'Desconectado'}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                {status === 'connected' ? 'Seu WhatsApp está pronto para enviar e receber mensagens.' : 'Conecte seu WhatsApp para habilitar as automações.'}
                                            </p>
                                        </div>
                                    </div>

                                    {status === 'connected' ? (
                                        <button
                                            onClick={handleLogout}
                                            style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #fee2e2', background: 'white', color: '#ef4444', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                                        >
                                            Desconectar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={getQrCode}
                                            disabled={isRefreshing}
                                            style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            {isRefreshing ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
                                            Gerar QR Code
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    <Smartphone size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                    <p style={{ fontWeight: '600' }}>Nenhuma instância configurada.</p>
                                    <p style={{ fontSize: '0.85rem' }}>Crie uma instância abaixo para começar.</p>
                                </div>
                            )}

                            {/* Erro */}
                            {evoError && (
                                <div style={{ marginTop: '1rem', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', fontSize: '0.85rem' }}>
                                    <strong>Erro:</strong> {evoError}
                                </div>
                            )}

                            {/* QR Code */}
                            {qrCode && status === 'disconnected' && (
                                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderRadius: '16px', background: '#f8fafc', border: '1px dashed var(--border-soft)' }}>
                                    <p style={{ fontWeight: '700', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Escaneie o QR Code com o WhatsApp</p>
                                    <img src={qrCode} alt="QR Code WhatsApp" style={{ width: '200px', height: '200px', borderRadius: '12px' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Aguardando conexão... O código expira em 60 segundos
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Card 2: Gerenciamento de Instâncias (Master Only) */}
                        {authUser.role === 'master' && (
                            <div className="glass-card" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Instâncias</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            {instances.length} instância(s) configurada(s)
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowCreateInstance(!showCreateInstance)}
                                        style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: showCreateInstance ? '#f1f5f9' : 'var(--accent)', color: showCreateInstance ? 'var(--text-secondary)' : 'white', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        {showCreateInstance ? <><X size={16} /> Cancelar</> : <><Plus size={16} /> Nova Instância</>}
                                    </button>
                                </div>

                                {/* Formulário Nova Instância */}
                                {showCreateInstance && (
                                    <div style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-soft)', marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nome de Exibição</label>
                                                <input
                                                    value={newInstanceDisplayName}
                                                    onChange={(e) => setNewInstanceDisplayName(e.target.value)}
                                                    placeholder="Ex: WhatsApp Vendas"
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-soft)', fontSize: '0.9rem' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nome Técnico (slug)</label>
                                                <input
                                                    value={newInstanceName}
                                                    onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                                    placeholder="Ex: vendas-01"
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-soft)', fontSize: '0.9rem', fontFamily: 'monospace' }}
                                                />
                                            </div>
                                        </div>
                                        {createInstanceError && (
                                            <div style={{ marginBottom: '1rem', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', fontSize: '0.85rem' }}>
                                                {createInstanceError}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={handleCreateInstance}
                                                disabled={isCreatingInstance || !newInstanceName.trim() || !newInstanceDisplayName.trim()}
                                                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', opacity: isCreatingInstance ? 0.6 : 1 }}
                                            >
                                                {isCreatingInstance ? 'Criando...' : 'Criar Instância'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Lista de Instâncias */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {instances.map(inst => (
                                        <div key={inst.id} style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: inst.is_active ? '#f0f9ff' : '#f8fafc', border: `1px solid ${inst.is_active ? '#bae6fd' : 'var(--border-soft)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: inst.connection_status === 'connected' ? '#10b981' : '#ef4444' }} />
                                                <div>
                                                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{inst.display_name}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginLeft: '8px' }}>{inst.instance_name}</span>
                                                </div>
                                                {inst.is_active && (
                                                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', background: '#dbeafe', color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase' }}>Ativa</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {!inst.is_active && (
                                                    <button
                                                        onClick={() => handleSetActiveInstance(inst)}
                                                        style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-soft)', background: 'white', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }}
                                                    >
                                                        Ativar
                                                    </button>
                                                )}
                                                {!inst.is_active && (
                                                    <button
                                                        onClick={() => handleDeleteInstance(inst)}
                                                        style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'white', color: '#ef4444', cursor: 'pointer' }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeSubTab === 'ia' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', height: 'calc(100vh - 200px)' }}>
                        {/* Editor do Prompt */}
                        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Prompt da Sarah</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Edite as instruções abaixo para treinar o comportamento da IA.</p>
                            </div>

                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="A Sarah é uma assistente da clínica Allegra..."
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    padding: '1.5rem',
                                    borderRadius: '16px',
                                    border: '1px solid var(--border-soft)',
                                    backgroundColor: '#f8fafc',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.6',
                                    fontFamily: 'inherit',
                                    resize: 'none',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', marginTop: '1.5rem' }}>
                                {saveSuccess && (
                                    <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>✓ Versão salva com sucesso!</span>
                                )}
                                <button
                                    onClick={handleSavePrompt}
                                    disabled={isSavingPrompt}
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: 'var(--accent)',
                                        color: 'white',
                                        fontWeight: '700',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        boxShadow: '0 4px 12px var(--accent-light)'
                                    }}
                                >
                                    {isSavingPrompt ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Nova Versão'}
                                </button>
                            </div>
                        </div>

                        {/* Histórico Lateral */}
                        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                                <History size={18} style={{ color: 'var(--accent)' }} />
                                <h4 style={{ fontSize: '0.9rem', fontWeight: '800' }}>Histórico de Versões</h4>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {isLoadingHistory ? (
                                    <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
                                ) : promptHistory.map((v, i) => (
                                    <div
                                        key={v.id}
                                        onClick={() => handleRestoreVersion(v.content)}
                                        style={{
                                            padding: '12px',
                                            borderRadius: '12px',
                                            background: i === 0 ? 'var(--accent-soft)' : '#f8fafc',
                                            border: '1px solid',
                                            borderColor: i === 0 ? 'var(--accent-soft)' : 'var(--border-soft)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: i === 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                                                {i === 0 ? '🚀 ATIVA AGORA' : `Versão #${promptHistory.length - i}`}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                {new Date(v.created_at).toLocaleDateString('pt-BR')} {new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                            {v.content}
                                        </div>
                                    </div>
                                ))}
                                {promptHistory.length === 0 && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Salve sua primeira versão para iniciar o histórico.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'followup' && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Configurações de Follow-up</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Defina quando e como o sistema deve cobrar seus leads automaticamente.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Horários */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)' }}>Horário de Disparo</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Início</label>
                                        <input
                                            type="time"
                                            value={followupConfig.start_time}
                                            onChange={(e) => setFollowupConfig({ ...followupConfig, start_time: e.target.value })}
                                            style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)', backgroundColor: '#f8fafc', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fim</label>
                                        <input
                                            type="time"
                                            value={followupConfig.end_time}
                                            onChange={(e) => setFollowupConfig({ ...followupConfig, end_time: e.target.value })}
                                            style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)', backgroundColor: '#f8fafc', outline: 'none' }}
                                        />
                                    </div>
                                </div>

                                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)', marginTop: '1rem' }}>Dias Ativos</h4>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => {
                                        const isActive = followupConfig.active_days.includes(i);
                                        return (
                                            <button
                                                key={day}
                                                onClick={() => toggleDay(i)}
                                                style={{
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid',
                                                    borderColor: isActive ? 'var(--accent)' : 'var(--border-soft)',
                                                    backgroundColor: isActive ? 'var(--accent-soft)' : 'white',
                                                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Intervalos */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)' }}>Intervalos (em minutos)</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>1ª Cobrança (Minutos)</span>
                                        <input
                                            type="number"
                                            value={followupConfig.interval_1}
                                            onChange={(e) => setFollowupConfig({ ...followupConfig, interval_1: parseInt(e.target.value) })}
                                            style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-soft)', textAlign: 'center' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>2ª Cobrança (Minutos)</span>
                                        <input
                                            type="number"
                                            value={followupConfig.interval_2}
                                            onChange={(e) => setFollowupConfig({ ...followupConfig, interval_2: parseInt(e.target.value) })}
                                            style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-soft)', textAlign: 'center' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>3ª Cobrança (Minutos)</span>
                                        <input
                                            type="number"
                                            value={followupConfig.interval_3}
                                            onChange={(e) => setFollowupConfig({ ...followupConfig, interval_3: parseInt(e.target.value) })}
                                            style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-soft)', textAlign: 'center' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mensagens */}
                        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-soft)', paddingTop: '2rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)', marginBottom: '1.5rem' }}>Mensagens de Follow-up</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {[
                                    { key: 'msg_1', label: '1ª Mensagem (quando não responde pela 1ª vez)' },
                                    { key: 'msg_2', label: '2ª Mensagem (quando continua sem responder)' },
                                    { key: 'msg_3', label: '3ª Mensagem (último follow-up)' }
                                ].map(({ key, label }) => (
                                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</label>
                                        <textarea
                                            value={followupConfig[key] || ''}
                                            onChange={(e) => setFollowupConfig({ ...followupConfig, [key]: e.target.value })}
                                            rows={3}
                                            style={{
                                                padding: '10px 14px',
                                                borderRadius: '10px',
                                                border: '1px solid var(--border-soft)',
                                                backgroundColor: '#f8fafc',
                                                fontSize: '0.9rem',
                                                lineHeight: '1.5',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', marginTop: '2.5rem', borderTop: '1px solid var(--border-soft)', paddingTop: '1.5rem' }}>
                            {followupSuccess && (
                                <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>✓ Configurações salvas!</span>
                            )}
                            <button
                                onClick={handleSaveFollowup}
                                disabled={isSavingFollowup}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'var(--accent)',
                                    color: 'white',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isSavingFollowup ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                )}

                {activeSubTab === 'videos' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Prova Social</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gerencie os vídeos de depoimentos que a Sarah pode enviar aos leads.</p>
                                </div>
                                <button
                                    onClick={() => setShowAddVideo(!showAddVideo)}
                                    style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: showAddVideo ? '#f1f5f9' : 'var(--accent)', color: showAddVideo ? 'var(--text-secondary)' : 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {showAddVideo ? <><X size={16} /> Cancelar</> : <><Plus size={16} /> Adicionar Vídeo</>}
                                </button>
                            </div>

                            {/* Formulário de Upload */}
                            {showAddVideo && (
                                <div style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-soft)', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Título</label>
                                            <input
                                                type="text"
                                                value={newVideoTitulo}
                                                onChange={(e) => setNewVideoTitulo(e.target.value)}
                                                placeholder="Ex: Depoimento da Dra. Maria"
                                                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Categoria</label>
                                            <select
                                                value={newVideoContexto}
                                                onChange={(e) => setNewVideoContexto(e.target.value)}
                                                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem', backgroundColor: 'white' }}
                                            >
                                                <option value="Depoimento">Depoimento</option>
                                                <option value="Resultado">Resultado</option>
                                                <option value="Antes/Depois">Antes/Depois</option>
                                                <option value="Institucional">Institucional</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição (a IA usará isso para decidir quando enviar)</label>
                                        <textarea
                                            value={newVideoDescricao}
                                            onChange={(e) => setNewVideoDescricao(e.target.value)}
                                            placeholder="Descreva o conteúdo do vídeo para a IA entender o contexto. Ex: Depoimento da Dra. Maria da Clínica Estética Bela, falando sobre como o sistema aumentou o agendamento em 40%."
                                            rows={3}
                                            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Arquivo de Vídeo</label>
                                        <div
                                            onClick={() => videoFileRef.current?.click()}
                                            style={{ padding: '1.5rem', borderRadius: '12px', border: '2px dashed var(--border-soft)', backgroundColor: 'white', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            {newVideoFile ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                    <Video size={20} style={{ color: 'var(--accent)' }} />
                                                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{newVideoFile.name}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({(newVideoFile.size / 1024 / 1024).toFixed(1)}MB)</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                    <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Clique para selecionar um vídeo</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MP4, MOV, WebM</span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            ref={videoFileRef}
                                            onChange={(e) => setNewVideoFile(e.target.files?.[0] || null)}
                                            accept="video/*"
                                            style={{ display: 'none' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={handleUploadVideo}
                                            disabled={isUploadingVideo || !newVideoTitulo.trim() || !newVideoDescricao.trim() || !newVideoFile}
                                            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', backgroundColor: (isUploadingVideo || !newVideoTitulo.trim() || !newVideoDescricao.trim() || !newVideoFile) ? '#93c5fd' : 'var(--accent)', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            {isUploadingVideo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                            {isUploadingVideo ? 'Enviando...' : 'Fazer Upload'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Lista de Vídeos */}
                            {isLoadingVideos ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
                            ) : videos.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    <Video size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                    <p style={{ fontSize: '0.9rem' }}>Nenhum vídeo cadastrado ainda.</p>
                                    <p style={{ fontSize: '0.8rem' }}>Adicione vídeos de depoimentos para a Sarah enviar aos leads.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {videos.map(video => (
                                        <div key={video.id} style={{ display: 'flex', gap: '16px', padding: '16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid var(--border-soft)', opacity: video.active ? 1 : 0.5 }}>
                                            <video
                                                src={video.url}
                                                style={{ width: '140px', height: '100px', objectFit: 'cover', borderRadius: '8px', backgroundColor: '#000', flexShrink: 0 }}
                                            />
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{video.titulo}</span>
                                                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', backgroundColor: video.active ? '#dcfce7' : '#fee2e2', color: video.active ? '#15803d' : '#b91c1c', fontWeight: '700' }}>
                                                        {video.active ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '700', width: 'fit-content' }}>
                                                    {video.contexto}
                                                </span>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '2px' }}>{video.descricao}</p>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => handleToggleVideo(video)}
                                                    title={video.active ? 'Desativar' : 'Ativar'}
                                                    style={{ padding: '6px', borderRadius: '8px', border: '1px solid var(--border-soft)', background: 'white', cursor: 'pointer', color: video.active ? '#f97316' : '#16a34a', display: 'flex', alignItems: 'center' }}
                                                >
                                                    {video.active ? <PowerOff size={14} /> : <Power size={14} />}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteVideo(video)}
                                                    title="Excluir"
                                                    style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'white', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeSubTab === 'quickmessages' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Mensagens Rápidas</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cadastre atalhos (/) para enviar mensagens rapidamente no chat.</p>
                                </div>
                                <button
                                    onClick={() => setShowAddQuickMessage(!showAddQuickMessage)}
                                    style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: showAddQuickMessage ? '#f1f5f9' : 'var(--accent)', color: showAddQuickMessage ? 'var(--text-secondary)' : 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {showAddQuickMessage ? <><X size={16} /> Cancelar</> : <><Plus size={16} /> Nova Mensagem</>}
                                </button>
                            </div>

                            {/* Formulário de Nova Mensagem Rápida */}
                            {showAddQuickMessage && (
                                <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Título / Atalho (Ex: boas_vindas)</label>
                                        <input
                                            type="text"
                                            value={newQuickMessageTitle}
                                            onChange={(e) => setNewQuickMessageTitle(e.target.value)}
                                            placeholder="Ex: boas_vindas"
                                            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Conteúdo da Mensagem</label>
                                        <textarea
                                            value={newQuickMessageContent}
                                            onChange={(e) => setNewQuickMessageContent(e.target.value)}
                                            placeholder="Olá! Tudo bem? Como posso te ajudar?"
                                            rows={4}
                                            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dica: Você pode usar variáveis como {'{{nome}}'} se desejar e substituir antes de enviar.</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={handleSaveQuickMessage}
                                            disabled={isSavingQuickMessage || !newQuickMessageTitle.trim() || !newQuickMessageContent.trim()}
                                            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', backgroundColor: (isSavingQuickMessage || !newQuickMessageTitle.trim() || !newQuickMessageContent.trim()) ? '#93c5fd' : 'var(--accent)', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            {isSavingQuickMessage ? <Loader2 size={16} className="animate-spin" /> : <MessageSquareText size={16} />}
                                            {isSavingQuickMessage ? 'Salvando...' : 'Salvar Mensagem'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Lista de Mensagens Rápidas */}
                            {isLoadingQuickMessages ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
                            ) : quickMessages.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    <MessageSquareText size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                    <p style={{ fontSize: '0.9rem' }}>Nenhuma mensagem rápida cadastrada.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {quickMessages.map(msg => (
                                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid var(--border-soft)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--accent)' }}>/{msg.title}</span>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteQuickMessage(msg.id)}
                                                    title="Excluir"
                                                    style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'white', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeSubTab === 'profile' && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem' }}>Perfil da conta</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome de Exibição</label>
                                <input type="text" readOnly value={authUser.nome} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: '#f8fafc', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cargo</label>
                                <input type="text" readOnly value={authUser.role === 'master' ? 'Master' : 'Operador'} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: '#f8fafc', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</label>
                                <input type="text" readOnly value={authUser.email} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: '#f8fafc', outline: 'none' }} />
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'usuarios' && authUser.role === 'master' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Lista de usuários */}
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem' }}>Usuários do Sistema</h3>
                            {isLoadingUsers ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {usersList.map(u => (
                                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid var(--border-soft)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: u.role === 'master' ? 'var(--accent)' : '#e2e8f0', color: u.role === 'master' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.9rem' }}>
                                                    {u.nome[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{u.nome}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email} • {u.role === 'master' ? '⭐ Master' : 'Operador'}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {Object.entries(u.permissions).filter(([, v]) => v).map(([k]) => (
                                                        <span key={k} style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: '20px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '700' }}>
                                                            {SECTION_LABELS[k] || k}
                                                        </span>
                                                    ))}
                                                </div>
                                                {u.role !== 'master' && (
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'white', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                        title="Remover usuário"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {usersList.length === 0 && (
                                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0', fontSize: '0.9rem' }}>Nenhum usuário cadastrado ainda.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Formulário de criação */}
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem' }}>Adicionar Novo Usuário</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome</label>
                                        <input
                                            type="text"
                                            value={newUserNome}
                                            onChange={(e) => setNewUserNome(e.target.value)}
                                            placeholder="Nome completo"
                                            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</label>
                                        <input
                                            type="email"
                                            value={newUserEmail}
                                            onChange={(e) => setNewUserEmail(e.target.value)}
                                            placeholder="email@exemplo.com"
                                            style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Senha inicial</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={newUserPassword}
                                            onChange={(e) => setNewUserPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                            style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Permissões de acesso</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {(Object.keys(SECTION_LABELS) as Array<keyof typeof newUserPermissions>).map(key => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setNewUserPermissions(prev => ({ ...prev, [key]: !prev[key] }))}
                                                style={{ padding: '6px 14px', borderRadius: '20px', border: '1.5px solid', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', backgroundColor: newUserPermissions[key] ? 'var(--accent)' : 'white', color: newUserPermissions[key] ? 'white' : 'var(--text-secondary)', borderColor: newUserPermissions[key] ? 'var(--accent)' : 'var(--border-soft)' }}
                                            >
                                                {SECTION_LABELS[key]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {createUserError && (
                                    <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', fontSize: '0.85rem', fontWeight: '600' }}>
                                        {createUserError}
                                    </div>
                                )}
                                {createUserSuccess && (
                                    <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', color: '#15803d', fontSize: '0.85rem', fontWeight: '600' }}>
                                        ✓ Usuário criado com sucesso!
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={handleCreateUser}
                                        disabled={isCreatingUser || !newUserNome.trim() || !newUserEmail.trim() || newUserPassword.length < 6}
                                        style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', backgroundColor: (isCreatingUser || !newUserNome.trim() || !newUserEmail.trim() || newUserPassword.length < 6) ? '#93c5fd' : 'var(--accent)', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {isCreatingUser ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                        {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'dados' && authUser.role === 'master' && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem', color: '#ef4444' }}>Zona de Perigo</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ações destrutivas para gerenciamento de dados do sistema.</p>
                        </div>

                        <div style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #fee2e2', backgroundColor: '#fef2f2', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#b91c1c' }}>Zerar Histórico de Conversas (IA)</h4>
                                <p style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: '4px' }}>
                                    Apaga permanentemente <strong>todo o histórico de conversas</strong> do banco de dados (n8n_chat_histories).
                                    Isso fará com que a IA esqueça todas as conversas anteriores e inicie os atendimentos totalmente do zero. Útil para limpar dados de ambiente de teste.
                                </p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <button
                                    onClick={handleResetChats}
                                    disabled={isResettingChats}
                                    style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#ef4444', color: 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {isResettingChats ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    {isResettingChats ? 'Apagando...' : 'Apagar Todo o Histórico'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsView;
