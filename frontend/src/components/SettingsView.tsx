import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Shield, Smartphone, RefreshCw, CheckCircle, XCircle, Loader2, QrCode, History, Users, Trash2, Plus, Eye, EyeOff, Video, Upload, Power, PowerOff, X, MessageSquareText, Building2, Edit2, Activity, LayoutDashboard } from 'lucide-react';
import { supabase } from "../lib/supabase";
import type { UserProfile, SocialProofVideo, QuickMessage, Instance } from '../lib/supabase';
import PromptBuilderChat from './PromptBuilderChat';

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
    const isSuperAdmin = authUser.company_name === 'SP3 Company - Master';
    const [status, setStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'geral' | 'whatsapp' | 'ia' | 'followup' | 'videos' | 'quickmessages' | 'kanban' | 'profile' | 'usuarios' | 'dados' | 'clientes' | 'logs'>('geral');

    // Estados Gerais
    const [managerPhone, setManagerPhone] = useState('');
    const [isSavingGeral, setIsSavingGeral] = useState(false);
    const [geralSuccess, setGeralSuccess] = useState(false);

    const fetchGeral = async () => {
        try {
            const { data } = await supabase.from('sp3_companies').select('manager_phone').eq('id', authUser.company_id).single();
            if (data?.manager_phone) {
                setManagerPhone(data.manager_phone);
            }
        } catch (err) {
            console.error('Erro ao buscar configs gerais:', err);
        }
    };

    const handleSaveGeral = async () => {
        setIsSavingGeral(true);
        setGeralSuccess(false);
        try {
            await supabase.from('sp3_companies').update({ manager_phone: managerPhone }).eq('id', authUser.company_id);
            setGeralSuccess(true);
            setTimeout(() => setGeralSuccess(false), 3000);
        } catch (err) {
            console.error('Erro ao salvar configs gerais:', err);
            await showAlert('Erro ao salvar configurações gerais.');
        } finally {
            setIsSavingGeral(false);
        }
    };

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

    // Chave global da Evolution API (admin) — persistida em localStorage
    const [evoGlobalKey, setEvoGlobalKey] = useState<string>(() => {
        try { return localStorage.getItem(`sp3_evo_global_key_${authUser.company_id}`) || ''; } catch { return ''; }
    });
    const [showEvoGlobalKey, setShowEvoGlobalKey] = useState(false);

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
    const [promptHistory, setPromptHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Estados do Follow-up
    const [followupConfig, setFollowupConfig] = useState<any>({
        start_time: '08:00',
        end_time: '18:00',
        active_days: [1, 2, 3, 4, 5],
        out_of_hours_message: 'Oi! No momento estamos fora do nosso horário de atendimento. Deixe sua mensagem que retornaremos assim que possível!',
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

    // Estados de Clientes SaaS
    const [saasClientsList, setSaasClientsList] = useState<any[]>([]);
    const [isLoadingSaas, setIsLoadingSaas] = useState(false);
    const [whatsappStatuses, setWhatsappStatuses] = useState<Record<string, 'connected' | 'disconnected' | 'checking' | 'no_key'>>({});
    const [newClientName, setNewClientName] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientPassword, setNewClientPassword] = useState('');
    const [newClientEvo, setNewClientEvo] = useState('');
    const [newClientEvoKey, setNewClientEvoKey] = useState('');
    const [showCreateClient, setShowCreateClient] = useState(false);
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [createClientError, setCreateClientError] = useState<string | null>(null);
    const [createClientSuccess, setCreateClientSuccess] = useState(false);
    const [editingClientId, setEditingClientId] = useState<string | null>(null);
    const [editClientName, setEditClientName] = useState('');
    const [editClientEvo, setEditClientEvo] = useState('');
    const [togglingClientId, setTogglingClientId] = useState<string | null>(null);

    // --- KANBAN CONFIG ---
    const [closingReasons, setClosingReasons] = useState<string[]>([]);
    const [newClosingReason, setNewClosingReason] = useState('');
    const [isSavingReasons, setIsSavingReasons] = useState(false);

    const fetchClosingReasons = async () => {
        try {
            const { data } = await supabase.from('sp3_companies').select('closing_reasons').eq('id', authUser.company_id).single();
            if (data?.closing_reasons) setClosingReasons(data.closing_reasons);
        } catch (err) {
            console.error('Erro ao buscar closing_reasons:', err);
        }
    };

    const handleAddClosingReason = async () => {
        const val = newClosingReason.trim();
        if (!val || closingReasons.includes(val)) return;
        setIsSavingReasons(true);
        const updated = [...closingReasons, val];
        await supabase.from('sp3_companies').update({ closing_reasons: updated }).eq('id', authUser.company_id);
        setClosingReasons(updated);
        setNewClosingReason('');
        setIsSavingReasons(false);
    };

    const handleRemoveClosingReason = async (reason: string) => {
        if (!await showConfirm(`Remover motivo "${reason}"?`)) return;
        setIsSavingReasons(true);
        const updated = closingReasons.filter(r => r !== reason);
        await supabase.from('sp3_companies').update({ closing_reasons: updated }).eq('id', authUser.company_id);
        setClosingReasons(updated);
        setIsSavingReasons(false);
    };

    // --- DIALOG MODAL STATE ---
    const [dialog, setDialog] = useState<{
        type: 'alert' | 'confirm' | 'prompt';
        title: string;
        message: string;
        placeholder?: string;
        onConfirm: (val?: string) => void;
        onCancel: () => void;
    } | null>(null);

    const [promptInput, setPromptInput] = useState('');

    const showAlert = (message: string) => new Promise<void>((resolve) => {
        setDialog({ type: 'alert', title: 'Aviso', message, onConfirm: () => { setDialog(null); resolve(); }, onCancel: () => { setDialog(null); resolve(); } });
    });

    const showConfirm = (message: string) => new Promise<boolean>((resolve) => {
        setDialog({ type: 'confirm', title: 'Confirmação', message, onConfirm: () => { setDialog(null); resolve(true); }, onCancel: () => { setDialog(null); resolve(false); } });
    });

    const showPrompt = (message: string, placeholder?: string) => new Promise<string | null>((resolve) => {
        setPromptInput('');
        setDialog({ type: 'prompt', title: 'Confirmação Exigida', message, placeholder, onConfirm: (val) => { setDialog(null); resolve(val || null); }, onCancel: () => { setDialog(null); resolve(null); } });
    });


    const fetchFollowupConfig = async () => {
        try {
            const { data } = await supabase
                .from('sp3_followup_settings')
                .select('*')
                .eq('company_id', authUser.company_id)
                .limit(1)
                .single();

            if (data) {
                setFollowupConfig({
                    ...data,
                    active_days: data.active_days || [1, 2, 3, 4, 5],
                    start_time: data.start_time || '08:00',
                    end_time: data.end_time || '18:00',
                    out_of_hours_message: data.out_of_hours_message || 'Oi! No momento estamos fora do nosso horário de atendimento. Deixe sua mensagem que retornaremos assim que possível!',
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
            let error;
            if (followupConfig.id) {
                const { error: updateError } = await supabase.from('sp3_followup_settings').update({
                    ...followupConfig,
                    updated_at: new Date()
                }).eq('id', followupConfig.id);
                error = updateError;
            } else {
                const configToInsert = { ...followupConfig };
                delete configToInsert.id;
                const { error: insertError } = await supabase.from('sp3_followup_settings').insert([{
                    company_id: authUser.company_id,
                    ...configToInsert,
                    updated_at: new Date()
                }]);
                error = insertError;
            }

            if (error) throw error;
            setFollowupSuccess(true);
            setTimeout(() => setFollowupSuccess(false), 3000);
        } catch (err: any) {
            console.error('Erro ao salvar follow-up:', err);
            await showAlert(`Erro ao salvar: ${err.message || 'Verifique se a tabela sp3_followup_settings existe e tem as colunas corretas.'}`);
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
            .eq('company_id', authUser.company_id)
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
                    company_id: authUser.company_id,
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
            await showAlert('Erro ao fazer upload: ' + err.message);
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const handleToggleVideo = async (video: SocialProofVideo) => {
        const { error } = await supabase
            .from('sp3_social_proof_videos')
            .update({ active: !video.active })
            .eq('id', video.id);
        if (error) { await showAlert('Erro: ' + error.message); }
        else setVideos(prev => prev.map(v => v.id === video.id ? { ...v, active: !v.active } : v));
    };

    const handleDeleteVideo = async (video: SocialProofVideo) => {
        if (!await showConfirm(`Excluir o vídeo "${video.titulo}"?`)) return;
        // Extrair nome do arquivo da URL
        const urlParts = video.url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from('social-proof-videos').remove([fileName]);
        const { error } = await supabase.from('sp3_social_proof_videos').delete().eq('id', video.id);
        if (error) { await showAlert('Erro: ' + error.message); }
        else setVideos(prev => prev.filter(v => v.id !== video.id));
    };

    // Funções de Mensagens Rápidas
    const fetchQuickMessages = async () => {
        setIsLoadingQuickMessages(true);
        const { data } = await supabase
            .from('sp3_quick_messages')
            .select('*')
            .eq('company_id', authUser.company_id)
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
                    company_id: authUser.company_id,
                    title: newQuickMessageTitle.trim(),
                    content: newQuickMessageContent.trim()
                }]);

            if (error) throw error;

            setNewQuickMessageTitle('');
            setNewQuickMessageContent('');
            setShowAddQuickMessage(false);
            await fetchQuickMessages();
        } catch (err: any) {
            await showAlert('Erro ao salvar mensagem rápida: ' + err.message);
        } finally {
            setIsSavingQuickMessage(false);
        }
    };

    const handleDeleteQuickMessage = async (msgId: string) => {
        if (!await showConfirm('Excluir esta mensagem rápida?')) return;
        const { error } = await supabase.from('sp3_quick_messages').delete().eq('id', msgId);
        if (error) { await showAlert('Erro: ' + error.message); }
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
                .eq('company_id', authUser.company_id)
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                setPromptHistory(data);
            }
            if (error) console.error('Erro ao buscar histórico:', error);
        } catch (err) {
            console.error('Erro:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleRestoreVersion = async (content: string) => {
        if (await showConfirm('Deseja restaurar esta versão como o prompt ativo? Uma nova versão será criada.')) {
            const { error } = await supabase
                .from('sp3_prompts')
                .insert([{ company_id: authUser.company_id, content }]);
            if (!error) await fetchPromptHistory();
        }
    };

    // === Funções de Instâncias WhatsApp ===

    const fetchInstances = async () => {
        try {
            const { data, error } = await supabase
                .from('sp3_instances')
                .select('*')
                .eq('company_id', authUser.company_id)
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
            const apiUrl = await resolveEvoApiUrl(instance);
            const apiKey = instance.evo_api_key || evoGlobalKey || '';

            if (!apiKey) {
                setStatus('disconnected');
                return;
            }

            const response = await fetch(
                `${apiUrl}/instance/connectionState/${instance.instance_name}`,
                { headers: { 'apikey': apiKey } }
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

    const configureInstanceWebhookAndSettings = async (apiUrl: string, instanceName: string, apiKey: string) => {
        // Configurar webhook para o n8n (Evolution API v2 format)
        try {
            await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({
                    webhook: {
                        enabled: true,
                        url: 'https://n8n-webhook.sp3company.shop/webhook/sp3chat',
                        webhookByEvents: false,
                        webhookBase64: true,
                        events: ['MESSAGES_UPSERT']
                    }
                })
            });
        } catch (whErr) {
            console.warn('Webhook config (non-critical):', whErr);
        }

        // Configurar settings da instância (base64 para mídia)
        try {
            await fetch(`${apiUrl}/settings/set/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({
                    rejectCall: true,
                    msgCall: 'Não posso atender ligações. Por favor, envie uma mensagem de texto.',
                    groupsIgnore: true,
                    alwaysOnline: false,
                    readMessages: true,
                    readStatus: false,
                    syncFullHistory: false
                })
            });
        } catch (settingsErr) {
            console.warn('Instance settings config (non-critical):', settingsErr);
        }
    };

    // Resolve a URL da Evolution API a partir de qualquer instância da empresa
    const resolveEvoApiUrl = async (instance: Instance): Promise<string> => {
        if (instance.evo_api_url) return instance.evo_api_url;
        const fromState = instances.find(i => i.evo_api_url);
        if (fromState?.evo_api_url) return fromState.evo_api_url;
        const { data } = await supabase
            .from('sp3_instances')
            .select('evo_api_url')
            .eq('company_id', authUser.company_id)
            .not('evo_api_url', 'is', null)
            .limit(1)
            .maybeSingle();
        return data?.evo_api_url || 'https://evo.sp3company.shop';
    };

    const ensureInstanceExists = async (instance: Instance): Promise<{ ok: boolean; apiUrl: string; apiKey: string }> => {
        try {
            const apiUrl = await resolveEvoApiUrl(instance);
            // Chave da instância para operações (check status, connect, etc.)
            const instanceKey = instance.evo_api_key || '';
            // Chave global para operações admin (criar instância)
            const globalKey = evoGlobalKey;

            // Determinar qual chave usar para verificar status
            const checkKey = instanceKey || globalKey;

            console.log('[EVO] ensureInstanceExists:', {
                apiUrl,
                instanceKey: instanceKey ? '***' + instanceKey.slice(-6) : '(vazio)',
                globalKey: globalKey ? '***' + globalKey.slice(-6) : '(vazio)',
                instanceName: instance.instance_name
            });

            if (!checkKey) {
                throw new Error('Configure a "Chave Global de Automação" para poder criar novas instâncias. Contate o administrador se não tiver acesso.');
            }

            // Salvar evo_api_url se estava vazia
            if (!instance.evo_api_url) {
                await supabase.from('sp3_instances')
                    .update({ evo_api_url: apiUrl })
                    .eq('id', instance.id);
                setActiveInstance(prev => prev?.id === instance.id ? { ...prev, evo_api_url: apiUrl } : prev);
            }

            // Verificar se instância já existe na Evolution API
            const checkRes = await fetch(
                `${apiUrl}/instance/connectionState/${instance.instance_name}`,
                { headers: { 'apikey': checkKey } }
            );

            if (checkRes.ok) {
                // Sempre configurar webhook (pode estar faltando em instâncias existentes)
                await configureInstanceWebhookAndSettings(apiUrl, instance.instance_name, checkKey);
                return { ok: true, apiUrl, apiKey: checkKey };
            }

            // Instância não existe — precisa criar com a CHAVE GLOBAL
            if (!globalKey) {
                throw new Error('Para criar uma nova conexão, configure a "Chave Global" do sistema principal.');
            }

            console.log(`[EVO] Instance check returned ${checkRes.status}, criando com chave global...`);
            const createRes = await fetch(
                `${apiUrl}/instance/create`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': globalKey
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

            // Salvar a chave específica da instância retornada pela API
            const createData = await createRes.json();
            const newInstanceKey = createData?.hash || createData?.token || createData?.instance?.apikey || '';

            await configureInstanceWebhookAndSettings(apiUrl, instance.instance_name, newInstanceKey || globalKey);

            // Persistir a chave da instância no banco
            if (newInstanceKey) {
                const { error: updateErr } = await supabase
                    .from('sp3_instances')
                    .update({ evo_api_key: newInstanceKey, evo_api_url: apiUrl })
                    .eq('id', instance.id);

                if (updateErr) {
                    await supabase.rpc('update_instance_evo_credentials', {
                        p_instance_name: instance.instance_name,
                        p_evo_api_url: apiUrl,
                        p_evo_api_key: newInstanceKey
                    });
                }
                setActiveInstance(prev => prev?.id === instance.id ? { ...prev, evo_api_url: apiUrl, evo_api_key: newInstanceKey } : prev);
                setInstances(prev => prev.map(i => i.id === instance.id ? { ...i, evo_api_url: apiUrl, evo_api_key: newInstanceKey } : i));
            }

            return { ok: true, apiUrl, apiKey: newInstanceKey || globalKey };
        } catch (err: any) {
            console.error('[EVO] Erro ao verificar/criar instancia:', err);
            setEvoError(err.message);
            return { ok: false, apiUrl: '', apiKey: '' };
        }
    };

    const getQrCode = async () => {
        if (!activeInstance) return;
        setIsRefreshing(true);
        setEvoError(null);
        setQrCode(null);

        try {
            const result = await ensureInstanceExists(activeInstance);
            if (!result.ok) {
                // ensureInstanceExists já setou setEvoError com o erro real
                return;
            }

            const response = await fetch(
                `${result.apiUrl}/instance/connect/${activeInstance.instance_name}`,
                { headers: { 'apikey': result.apiKey } }
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
        let qrRefreshCount = 0;
        pollingRef.current = setInterval(async () => {
            if (!activeInstance) return;
            qrRefreshCount++;
            try {
                // A cada 8 ciclos (~24s), buscar novo QR code (eles expiram em ~30s)
                if (qrRefreshCount % 8 === 0) {
                    const qrRes = await fetch(
                        `${activeInstance.evo_api_url}/instance/connect/${activeInstance.instance_name}`,
                        { headers: { 'apikey': activeInstance.evo_api_key } }
                    );
                    if (qrRes.ok) {
                        const qrData = await qrRes.json();
                        if (qrData.base64) {
                            setQrCode(qrData.base64);
                        } else if (qrData.instance?.state === 'open') {
                            setStatus('connected');
                            setQrCode(null);
                            stopConnectionPolling();
                            await supabase.from('sp3_instances')
                                .update({ connection_status: 'connected' })
                                .eq('id', activeInstance.id);
                            return;
                        }
                    }
                } else {
                    // Ciclos normais: só verificar status
                    const response = await fetch(
                        `${activeInstance.evo_api_url}/instance/connectionState/${activeInstance.instance_name}`,
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
        if (!await showConfirm('Deseja realmente desconectar o WhatsApp?')) return;

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
            // Herdar evo_api_url e evo_api_key de uma instância existente da mesma empresa
            const existingWithEvo = instances.find(i => i.evo_api_url);
            const evoUrl = existingWithEvo?.evo_api_url || 'https://evo.sp3company.shop';
            const evoKey = existingWithEvo?.evo_api_key || '';

            const { error } = await supabase
                .from('sp3_instances')
                .insert([{
                    company_id: authUser.company_id,
                    instance_name: sanitizedName,
                    display_name: newInstanceDisplayName.trim(),
                    created_by: authUser.id,
                    evo_api_url: evoUrl,
                    evo_api_key: evoKey
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
                .eq('company_id', authUser.company_id)
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
            await showAlert('Nao e possivel excluir a instancia ativa. Ative outra instancia primeiro.');
            return;
        }
        if (!await showConfirm(`Excluir a instancia "${instance.display_name}"?`)) return;

        try {
            await supabase.from('sp3_instances').delete().eq('id', instance.id);
            await fetchInstances();
        } catch (err: any) {
            console.error('Erro ao excluir instancia:', err);
        }
    };

    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        const { data } = await supabase.from('sp3_users').select('*').eq('company_id', authUser.company_id).order('created_at', { ascending: true });
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
            company_id: authUser.company_id,
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

    const checkWhatsappStatuses = async (clients: any[]) => {
        // Buscar todas as instâncias ativas (RLS permite master ver todas)
        const { data: instances } = await supabase
            .from('sp3_instances')
            .select('company_id, instance_name, evo_api_url, evo_api_key, is_active');

        if (!instances) return;

        const statusMap: Record<string, 'connected' | 'disconnected' | 'checking' | 'no_key'> = {};

        // Marcar todos como "checking" inicialmente
        clients.forEach(c => { statusMap[c.id] = 'checking'; });
        setWhatsappStatuses({ ...statusMap });

        // Verificar cada instância em paralelo
        await Promise.allSettled(instances.map(async (inst) => {
            if (!inst.evo_api_key || !inst.evo_api_url) {
                statusMap[inst.company_id] = 'no_key';
                return;
            }
            try {
                const res = await fetch(
                    `${inst.evo_api_url}/instance/connectionState/${inst.instance_name}`,
                    { headers: { 'apikey': inst.evo_api_key } }
                );
                if (res.ok) {
                    const data = await res.json();
                    const state = data?.instance?.state || data?.state || '';
                    statusMap[inst.company_id] = state === 'open' ? 'connected' : 'disconnected';
                } else {
                    statusMap[inst.company_id] = 'disconnected';
                }
            } catch {
                statusMap[inst.company_id] = 'disconnected';
            }
        }));

        setWhatsappStatuses({ ...statusMap });
    };

    const fetchSaasClients = async () => {
        setIsLoadingSaas(true);
        const { data, error } = await supabase.rpc('get_all_tenants');
        if (data && !error) {
            setSaasClientsList(data);
            // Verificar status do WhatsApp de cada cliente em background
            checkWhatsappStatuses(data);
        }
        setIsLoadingSaas(false);
    };

    const handleCreateClient = async () => {
        if (!newClientName.trim() || !newClientEmail.trim() || !newClientPassword.trim() || !newClientEvo.trim()) return;
        if (newClientPassword.length < 6) {
            setCreateClientError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        setIsCreatingClient(true);
        setCreateClientError(null);

        // RPC cria tudo: auth user (auto-confirmado), empresa, sp3_users, sp3_instances, followup_settings
        const { error: rpcError } = await supabase.rpc('create_new_tenant', {
            p_company_name: newClientName.trim(),
            p_evo_instance: newClientEvo.trim(),
            p_admin_email: newClientEmail.trim(),
            p_password: newClientPassword
        });

        if (rpcError) {
            setCreateClientError('Erro: ' + rpcError.message);
            setIsCreatingClient(false);
            return;
        }

        // Criar instância na Evolution API usando a chave global do servidor
        // A chave global é lida da instância master (SP3) ou da configuração
        const evoUrl = activeInstance?.evo_api_url || 'https://evo.sp3company.shop';
        const evoGlobalKey = newClientEvoKey.trim();

        if (evoGlobalKey) {
            try {
                const evoRes = await fetch(`${evoUrl}/instance/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoGlobalKey },
                    body: JSON.stringify({
                        instanceName: newClientEvo.trim(),
                        qrcode: true,
                        integration: 'WHATSAPP-BAILEYS'
                    })
                });

                if (evoRes.ok) {
                    const evoData = await evoRes.json();
                    // Salvar o token da instância e configurar webhook
                    const instanceToken = evoData?.hash || evoData?.token || evoData?.instance?.apikey || '';

                    if (instanceToken) {
                        // Usar RPC SECURITY DEFINER para bypassar RLS (update direto é bloqueado)
                        await supabase.rpc('update_instance_evo_credentials', {
                            p_instance_name: newClientEvo.trim(),
                            p_evo_api_url: evoUrl,
                            p_evo_api_key: instanceToken
                        });

                        // Configurar webhook e settings da instância
                        await configureInstanceWebhookAndSettings(evoUrl, newClientEvo.trim(), instanceToken);

                        // Salvar chave global no banco para pré-preencher sempre
                        supabase.rpc('save_evo_global_key', { p_key: evoGlobalKey }).then(() => { });
                    }
                } else {
                    const errBody = await evoRes.text();
                    console.warn('Backend instance creation failed:', evoRes.status, errBody);
                    setCreateClientError('Cliente criado, mas a conexão falhou. Verifique a chave de servidor e tente reconectar nas configurações do cliente.');
                }
            } catch (evoErr) {
                console.warn('Backend instance creation error:', evoErr);
                setCreateClientError('Cliente criado, mas não foi possível conectar ao backend. Configure a conexão manualmente.');
            }
        } else {
            setCreateClientError('Cliente criado, mas a chave global não foi informada. A conexão precisará ser criada manualmente.');
        }

        setCreateClientSuccess(true);
        setNewClientName('');
        setNewClientEmail('');
        setNewClientPassword('');
        setNewClientEvo('');
        // Não limpar a chave global — manter para a próxima criação
        setShowCreateClient(false);
        await fetchSaasClients();
        setTimeout(() => setCreateClientSuccess(false), 3000);
        setIsCreatingClient(false);
    };

    const handleToggleClient = async (companyId: string, currentActive: boolean) => {
        setTogglingClientId(companyId);
        const { error } = await supabase.rpc('toggle_tenant', {
            p_company_id: companyId,
            p_active: !currentActive
        });
        if (error) {
            await showAlert('Erro ao alterar status: ' + error.message);
        } else {
            await fetchSaasClients();
        }
        setTogglingClientId(null);
    };

    const handleStartEditClient = (empresa: any) => {
        setEditingClientId(empresa.id);
        setEditClientName(empresa.name);
        setEditClientEvo(empresa.evo_instance_name || '');
    };

    const handleSaveEditClient = async () => {
        if (!editingClientId) return;
        const { error } = await supabase.rpc('update_tenant', {
            p_company_id: editingClientId,
            p_company_name: editClientName.trim() || null,
            p_evo_instance: editClientEvo.trim() || null
        });
        if (error) {
            await showAlert('Erro ao salvar: ' + error.message);
        } else {
            setEditingClientId(null);
            await fetchSaasClients();
        }
    };

    const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

    const handleDeleteClient = async (empresa: any) => {
        const confirmText = `EXCLUIR PERMANENTEMENTE a empresa "${empresa.name}"?\n\nIsso vai remover:\n- Todos os leads e histórico de conversas\n- Todos os usuários da empresa\n- Configurações, prompts, vídeos e mensagens rápidas\n- Instâncias WhatsApp\n\nEssa ação NÃO pode ser desfeita!`;
        if (!await showConfirm(confirmText)) return;

        // Segunda confirmação
        const confirmName = await showPrompt(`Para confirmar, digite o nome da empresa: "${empresa.name}"`);
        if (confirmName !== empresa.name) {
            await showAlert('Nome não confere. Exclusão cancelada.');
            return;
        }

        setDeletingClientId(empresa.id);
        try {
            const { data, error } = await supabase.rpc('delete_tenant', {
                p_company_id: empresa.id
            });
            if (error) {
                await showAlert('Erro ao excluir: ' + error.message);
            } else {
                await showAlert(`Empresa "${empresa.name}" excluída com sucesso! ${data?.deleted_users || 0} usuário(s) removido(s).`);
                await fetchSaasClients();
            }
        } catch (e: any) {
            await showAlert('Erro: ' + e.message);
        }
        setDeletingClientId(null);
    };

    const handleDeleteUser = async (userId: string) => {
        if (!await showConfirm('Remover este usuário do sistema? Ele não conseguirá mais acessar o CRM.')) return;
        await supabase.from('sp3_users').delete().eq('id', userId);
        await fetchUsers();
    };

    const handleResetChats = async () => {
        if (!await showConfirm('CUIDADO: Isso irá apagar todo o histórico de conversas do sistema! Deseja realmente continuar?')) return;
        if (!await showConfirm('TEM CERTEZA ABSOLUTA? Esta ação não pode ser desfeita e irá zerar as conversas da IA.')) return;

        setIsResettingChats(true);
        try {
            const { error } = await supabase
                .from('n8n_chat_histories')
                .delete()
                .eq('company_id', authUser.company_id);

            if (error) throw error;
            await showAlert('Histórico de conversas apagado com sucesso! As próximas mensagens iniciarão uma nova conversa do zero.');
        } catch (err: any) {
            console.error('Erro ao limpar histórico:', err);
            await showAlert('Erro ao apagar histórico: ' + err.message);
        } finally {
            setIsResettingChats(false);
        }
    };

    useEffect(() => {
        fetchInstances(); // Always fetch instances on mount
        fetchClosingReasons();

        // Pré-preencher chave global da Evolution API do banco (se não tem no localStorage)
        if (!evoGlobalKey && authUser.role === 'master') {
            supabase.rpc('get_evo_global_key').then(({ data }) => {
                if (data) {
                    setEvoGlobalKey(data);
                    localStorage.setItem(`sp3_evo_global_key_${authUser.company_id}`, data);
                }
            });
        }

        return () => stopConnectionPolling(); // Cleanup for connection polling
    }, []);

    useEffect(() => {
        if (activeSubTab === 'geral') {
            fetchGeral();
        } else if (activeSubTab === 'usuarios') {
            fetchUsers();
        } else if (activeSubTab === 'ia') {
            fetchPromptHistory();
        } else if (activeSubTab === 'followup') {
            fetchFollowupConfig();
        } else if (activeSubTab === 'videos') {
            fetchVideos();
        } else if (activeSubTab === 'quickmessages') {
            fetchQuickMessages();
        } else if (activeSubTab === 'clientes') {
            fetchSaasClients();
            // Buscar chave global Evolution do banco e sincronizar ambos states
            supabase.rpc('get_evo_global_key').then(({ data }) => {
                if (data) {
                    setNewClientEvoKey(data);
                    if (!evoGlobalKey) {
                        setEvoGlobalKey(data);
                        localStorage.setItem(`sp3_evo_global_key_${authUser.company_id}`, data);
                    }
                }
            });
        }
    }, [activeSubTab]);

    return (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem' }}>
            {/* Sidebar de Configurações */}
            <div className="glass-card" style={{ padding: '1.25rem', height: 'fit-content' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1.5rem' }}>Menu</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        onClick={() => setActiveSubTab('geral')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'geral' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'geral' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'geral' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <SettingsIcon size={18} /> Gerais
                    </button>
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
                        onClick={() => setActiveSubTab('kanban')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'kanban' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'kanban' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'kanban' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <LayoutDashboard size={18} /> Kanban & Pipeline
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
                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveSubTab('clientes')}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'clientes' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'clientes' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'clientes' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                        >
                            <Building2 size={18} /> Franquias / Clientes
                        </button>
                    )}
                    {authUser.role === 'master' && (
                        <button
                            onClick={() => setActiveSubTab('logs')}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'logs' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'logs' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'logs' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                        >
                            <Activity size={18} /> Logs do Webhook
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
                {activeSubTab === 'geral' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Configurações Gerais</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Modifique as preferências básicas do sistema.</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '400px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Número do Gestor (Notificações)</label>
                                <input
                                    value={managerPhone}
                                    onChange={(e) => setManagerPhone(e.target.value)}
                                    placeholder="Ex: 5511999999999"
                                    style={{ padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.9rem' }}
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Este número receberá um alerta cada vez que um novo lead chegar.</p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2rem' }}>
                                <button
                                    onClick={handleSaveGeral}
                                    disabled={isSavingGeral}
                                    style={{
                                        padding: '10px 20px', borderRadius: '10px', border: 'none',
                                        background: 'var(--accent)', color: 'white', fontWeight: '700',
                                        fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    {isSavingGeral ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
                                </button>
                                {geralSuccess && (
                                    <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>Salvo com sucesso!</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'whatsapp' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Card 1: Conexão WhatsApp */}
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Conexão WhatsApp</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gerencie a instância conectada ao seu WhatsApp.</p>
                                </div>
                                <button
                                    onClick={() => activeInstance && checkInstanceStatus(activeInstance)}
                                    style={{ padding: '8px', borderRadius: '50%', border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)' }}
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
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}
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
                                <div style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                                            style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #fee2e2', background: 'var(--bg-secondary)', color: '#ef4444', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
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

                            {/* Erro + campo inline para chave global se necessário */}
                            {evoError && (
                                <div style={{ marginTop: '1rem', padding: '16px', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2' }}>
                                    <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: evoError.includes('Chave Global') ? '12px' : 0 }}>
                                        <strong>Erro:</strong> {evoError}
                                    </div>
                                    {evoError.includes('Chave Global') && authUser.role === 'master' && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <input
                                                    type={showEvoGlobalKey ? 'text' : 'password'}
                                                    value={evoGlobalKey}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEvoGlobalKey(val);
                                                        localStorage.setItem(`sp3_evo_global_key_${authUser.company_id}`, val);
                                                    }}
                                                    placeholder="Cole a Global API Key aqui"
                                                    style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: '10px', border: '1px solid #fca5a5', fontSize: '0.85rem', outline: 'none', fontFamily: 'monospace', background: 'var(--bg-secondary)' }}
                                                />
                                                <button
                                                    onClick={() => setShowEvoGlobalKey(!showEvoGlobalKey)}
                                                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                                                >
                                                    {showEvoGlobalKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => { setEvoError(null); getQrCode(); }}
                                                disabled={!evoGlobalKey}
                                                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: evoGlobalKey ? 'var(--accent)' : '#e5e7eb', color: evoGlobalKey ? 'white' : '#9ca3af', fontWeight: '700', fontSize: '0.8rem', cursor: evoGlobalKey ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                                            >
                                                Tentar Novamente
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* QR Code */}
                            {qrCode && status === 'disconnected' && (
                                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem', borderRadius: '16px', background: '#ffffff', border: '2px solid var(--border-soft)' }}>
                                    <p style={{ fontWeight: '700', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Escaneie o QR Code com o WhatsApp</p>
                                    <div style={{ padding: '16px', background: '#ffffff', borderRadius: '12px' }}>
                                        <img src={qrCode} alt="QR Code WhatsApp" style={{ width: '300px', height: '300px', imageRendering: 'pixelated' }} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Aguardando conexão... O código expira em 60 segundos
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Card 2: Chave Global da Evolution API (Master Only) */}
                        {authUser.role === 'master' && (
                            <div className="glass-card" style={{ padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem' }}>Chave Global de Automação</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                                    Necessária para criar novas instâncias. Encontrada no painel do servidor.
                                </p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1, position: 'relative' }}>
                                        <input
                                            type={showEvoGlobalKey ? 'text' : 'password'}
                                            value={evoGlobalKey}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setEvoGlobalKey(val);
                                                localStorage.setItem(`sp3_evo_global_key_${authUser.company_id}`, val);
                                            }}
                                            placeholder="Cole aqui a Global API Key de automação"
                                            style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: '10px', border: '1px solid var(--border-soft)', fontSize: '0.85rem', outline: 'none', fontFamily: 'monospace' }}
                                        />
                                        <button
                                            onClick={() => setShowEvoGlobalKey(!showEvoGlobalKey)}
                                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                                        >
                                            {showEvoGlobalKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                {evoGlobalKey && (
                                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <CheckCircle size={12} /> Chave salva localmente
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Card 3: Gerenciamento de Instâncias (Master Only) */}
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
                                    <div style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', marginBottom: '1.5rem' }}>
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
                                        <div key={inst.id} style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: inst.is_active ? '#f0f9ff' : 'var(--bg-tertiary)', border: `1px solid ${inst.is_active ? '#bae6fd' : 'var(--border-soft)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                                                        style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }}
                                                    >
                                                        Ativar
                                                    </button>
                                                )}
                                                {!inst.is_active && (
                                                    <button
                                                        onClick={() => handleDeleteInstance(inst)}
                                                        style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'var(--bg-secondary)', color: '#ef4444', cursor: 'pointer' }}
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
                        {/* Chat Builder */}
                        <PromptBuilderChat
                            companyId={authUser.company_id!}
                            currentPrompt={promptHistory.length > 0 ? promptHistory[0].content : ''}
                            onSavePrompt={async (content: string) => {
                                const { error } = await supabase
                                    .from('sp3_prompts')
                                    .insert([{ company_id: authUser.company_id, content }]);
                                if (error) throw error;
                                await fetchPromptHistory();
                            }}
                        />

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
                                            background: i === 0 ? 'var(--accent-soft)' : 'var(--bg-tertiary)',
                                            border: '1px solid',
                                            borderColor: i === 0 ? 'var(--accent-soft)' : 'var(--border-soft)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: i === 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                                                {i === 0 ? 'ATIVA AGORA' : `Versão #${promptHistory.length - i}`}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                {new Date(v.created_at).toLocaleDateString('pt-BR')} {new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                            {v.content.substring(0, 120)}...
                                        </div>
                                    </div>
                                ))}
                                {promptHistory.length === 0 && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Use o chat ao lado para criar seu primeiro prompt.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'followup' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* SEÇÃO 1: Horário de Atendimento */}
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Horário de Atendimento</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configure os dias e horários que sua empresa atende. Fora desse horário, o sistema enviará uma mensagem automática.</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                {/* Horários */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)' }}>Horário</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Início</label>
                                            <input
                                                type="time"
                                                value={followupConfig.start_time}
                                                onChange={(e) => setFollowupConfig({ ...followupConfig, start_time: e.target.value })}
                                                style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-tertiary)', outline: 'none' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fim</label>
                                            <input
                                                type="time"
                                                value={followupConfig.end_time}
                                                onChange={(e) => setFollowupConfig({ ...followupConfig, end_time: e.target.value })}
                                                style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-tertiary)', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)', marginTop: '1rem' }}>Dias de Atendimento</h4>
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

                                {/* Mensagem Fora de Horário */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)' }}>Mensagem Fora de Horário</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '-0.5rem' }}>Enviada automaticamente quando um cliente manda mensagem fora do horário de atendimento.</p>
                                    <textarea
                                        value={followupConfig.out_of_hours_message || ''}
                                        onChange={(e) => setFollowupConfig({ ...followupConfig, out_of_hours_message: e.target.value })}
                                        rows={5}
                                        placeholder="Ex: Oi! Estamos fora do horário de atendimento..."
                                        style={{
                                            padding: '10px 14px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--border-soft)',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.5',
                                            fontFamily: 'inherit',
                                            resize: 'vertical',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Botão Salvar */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                            {followupSuccess && (
                                <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>Configurações salvas!</span>
                            )}
                            <button
                                onClick={handleSaveFollowup}
                                disabled={isSavingFollowup}
                                style={{
                                    padding: '12px 24px', borderRadius: '12px', border: 'none',
                                    background: 'var(--accent)', color: 'white', fontWeight: '700',
                                    fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                {isSavingFollowup ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Alterações'}
                            </button>
                        </div>

                        {/* Banner: Fluxos Visuais */}
                        <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={16} style={{ color: 'var(--accent)' }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Os follow-ups agora funcionam via <strong>Fluxos Visuais</strong>. Gerencie na aba <strong>Fluxos</strong> no menu lateral.
                            </span>
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
                                <div style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                                                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem', background: 'var(--bg-secondary)' }}
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
                                            style={{ padding: '1.5rem', borderRadius: '12px', border: '2px dashed var(--border-soft)', background: 'var(--bg-secondary)', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
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
                                        <div key={video.id} style={{ display: 'flex', gap: '16px', padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', opacity: video.active ? 1 : 0.5 }}>
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
                                                    style={{ padding: '6px', borderRadius: '8px', border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', cursor: 'pointer', color: video.active ? '#f97316' : '#16a34a', display: 'flex', alignItems: 'center' }}
                                                >
                                                    {video.active ? <PowerOff size={14} /> : <Power size={14} />}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteVideo(video)}
                                                    title="Excluir"
                                                    style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'var(--bg-secondary)', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
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
                                <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--accent)' }}>/{msg.title}</span>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteQuickMessage(msg.id)}
                                                    title="Excluir"
                                                    style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'var(--bg-secondary)', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
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
                {activeSubTab === 'kanban' && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <LayoutDashboard size={20} style={{ color: 'var(--accent)' }} />
                                Configurações do Kanban
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Gerencie os motivos pelos quais uma conversa ou lead é fechado/perdido.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>Motivos de Fechamento</h4>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                                    <input
                                        type="text"
                                        placeholder="Novo motivo (ex: Preço alto, Fechou com concorrente)"
                                        value={newClosingReason}
                                        onChange={e => setNewClosingReason(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddClosingReason()}
                                        style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-soft)', outline: 'none', fontSize: '0.9rem' }}
                                    />
                                    <button
                                        onClick={handleAddClosingReason}
                                        disabled={!newClosingReason.trim() || isSavingReasons}
                                        style={{ padding: '0 20px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--accent)', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: (!newClosingReason.trim() || isSavingReasons) ? 0.5 : 1 }}
                                    >
                                        {isSavingReasons ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                        Adicionar
                                    </button>
                                </div>

                                {closingReasons.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-soft)' }}>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nenhum motivo cadastrado. Os usuários verão apenas "Outro".</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {closingReasons.map(reason => (
                                            <div key={reason} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>{reason}</span>
                                                <button
                                                    onClick={() => handleRemoveClosingReason(reason)}
                                                    disabled={isSavingReasons}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                                                    title="Remover"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'profile' && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem' }}>Perfil da conta</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome de Exibição</label>
                                <input type="text" readOnly value={authUser.nome} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: 'var(--bg-tertiary)', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cargo</label>
                                <input type="text" readOnly value={authUser.role === 'master' ? 'Master' : 'Operador'} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: 'var(--bg-tertiary)', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</label>
                                <input type="text" readOnly value={authUser.email} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: 'var(--bg-tertiary)', outline: 'none' }} />
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
                                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)' }}>
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
                                                        style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'var(--bg-secondary)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
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
                {/* TAB CLIENTES SASS — Apenas Super Admin SP3 */}
                {activeSubTab === 'clientes' && isSuperAdmin && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Gerenciar Clientes SaaS</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Apenas usuários da franquia Master possuem acesso a essa tela.</p>
                                </div>
                                <button
                                    onClick={() => setShowCreateClient(!showCreateClient)}
                                    style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: showCreateClient ? '#f1f5f9' : 'var(--accent)', color: showCreateClient ? 'var(--text-secondary)' : 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    {showCreateClient ? <><X size={16} /> Cancelar</> : <><Plus size={16} /> Novo Cliente</>}
                                </button>
                            </div>

                            {showCreateClient && (
                                <div style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nome da Empresa</label>
                                            <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Ex: Odonto Clean" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nome da Instância (Conexão)</label>
                                            <input value={newClientEvo} onChange={(e) => setNewClientEvo(e.target.value)} placeholder="Ex: odonto_clean" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>E-mail do Dono (Admin)</label>
                                            <input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} type="email" placeholder="dono@odontoclean.com" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Senha Inicial</label>
                                            <input value={newClientPassword} onChange={(e) => setNewClientPassword(e.target.value)} type="text" placeholder="Senha Forte" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)' }} />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Chave Global de Automação (AUTHENTICATION_API_KEY do servidor)</label>
                                        <input value={newClientEvoKey} onChange={(e) => setNewClientEvoKey(e.target.value)} type="password" placeholder="Chave do servidor para criar instâncias" style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-soft)', fontFamily: 'monospace' }} />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Encontre em: variáveis de ambiente do servidor. Se deixar vazio, a instância precisará ser criada manualmente.</p>
                                    </div>

                                    {createClientError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: '1rem' }}>{createClientError}</p>}
                                    {createClientSuccess && <p style={{ color: '#15803d', fontSize: '0.85rem', marginBottom: '1rem', background: '#dcfce7', padding: '8px', borderRadius: '8px' }}>Cliente criado com sucesso! O acesso mestre dele já está liberado.</p>}

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button onClick={handleCreateClient} disabled={isCreatingClient} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: 'white', fontWeight: '700', cursor: isCreatingClient ? 'not-allowed' : 'pointer' }}>
                                            {isCreatingClient ? <Loader2 size={16} className="animate-spin" /> : 'Criar Conta Mestre e Empresa'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-soft)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-soft)' }}>
                                        <tr>
                                            <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Empresa</th>
                                            <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Instância (Evo)</th>
                                            <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>WhatsApp</th>
                                            <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cadastro</th>
                                            <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoadingSaas ? (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', marginBottom: '8px' }} />
                                                    Carregando clientes...
                                                </td>
                                            </tr>
                                        ) : saasClientsList.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum cliente SaaS encontrado.</td>
                                            </tr>
                                        ) : (
                                            saasClientsList.map(empresa => (
                                                <tr key={empresa.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                                    <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                                                        {editingClientId === empresa.id ? (
                                                            <input value={editClientName} onChange={(e) => setEditClientName(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--accent)', width: '100%', fontSize: '0.9rem' }} />
                                                        ) : empresa.name}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                        {editingClientId === empresa.id ? (
                                                            <input value={editClientEvo} onChange={(e) => setEditClientEvo(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--accent)', width: '100%', fontSize: '0.9rem' }} />
                                                        ) : empresa.evo_instance_name}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: empresa.active ? '#dcfce7' : '#fee2e2', color: empresa.active ? '#15803d' : '#b91c1c', fontWeight: '700', textTransform: 'uppercase' }}>
                                                            {empresa.active ? 'Ativa' : 'Inativa'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        {(() => {
                                                            const wsStatus = whatsappStatuses[empresa.id];
                                                            if (!wsStatus || wsStatus === 'checking') return <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />;
                                                            if (wsStatus === 'connected') return <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: '#dcfce7', color: '#15803d', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Smartphone size={10} /> Conectado</span>;
                                                            if (wsStatus === 'no_key') return <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: '#fef3c7', color: '#92400e', fontWeight: '700' }}>Sem chave</span>;
                                                            return <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: '#fee2e2', color: '#b91c1c', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><PowerOff size={10} /> Desconectado</span>;
                                                        })()}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                        {new Date(empresa.created_at).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                            {editingClientId === empresa.id ? (
                                                                <>
                                                                    <button onClick={handleSaveEditClient} title="Salvar" style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#dcfce7', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><CheckCircle size={16} /></button>
                                                                    <button onClick={() => setEditingClientId(null)} title="Cancelar" style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
                                                                </>
                                                            ) : (
                                                                <button onClick={() => handleStartEditClient(empresa)} title="Editar" style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Edit2 size={16} /></button>
                                                            )}
                                                            <button
                                                                onClick={() => handleToggleClient(empresa.id, empresa.active)}
                                                                title={empresa.active ? 'Desativar' : 'Ativar'}
                                                                disabled={togglingClientId === empresa.id}
                                                                style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: empresa.active ? '#fee2e2' : '#dcfce7', color: empresa.active ? '#b91c1c' : '#15803d', cursor: togglingClientId === empresa.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '600' }}
                                                            >
                                                                {togglingClientId === empresa.id ? <Loader2 size={14} className="animate-spin" /> : empresa.active ? <><PowerOff size={14} /> Desativar</> : <><Power size={14} /> Ativar</>}
                                                            </button>
                                                            {empresa.name !== 'SP3 Company - Master' && (
                                                                <button
                                                                    onClick={() => handleDeleteClient(empresa)}
                                                                    title="Excluir empresa permanentemente"
                                                                    disabled={deletingClientId === empresa.id}
                                                                    style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: deletingClientId === empresa.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                                                                >
                                                                    {deletingClientId === empresa.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
            </div>

            {dialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: '#111827', fontWeight: 'bold' }}>{dialog.title}</h3>
                        <p style={{ margin: '0 0 20px 0', color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.5' }}>{dialog.message}</p>

                        {dialog.type === 'prompt' && (
                            <input
                                type="text"
                                autoFocus
                                value={promptInput}
                                onChange={(e) => setPromptInput(e.target.value)}
                                placeholder={dialog.placeholder || 'Digite...'}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', marginBottom: '20px', fontSize: '0.95rem', outline: 'none' }}
                                onKeyDown={(e) => { if (e.key === 'Enter') dialog.onConfirm(promptInput); }}
                            />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            {dialog.type !== 'alert' && (
                                <button
                                    onClick={dialog.onCancel}
                                    style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#374151', cursor: 'pointer', fontWeight: '500' }}
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                onClick={() => dialog.onConfirm(promptInput)}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6254f1', color: 'white', cursor: 'pointer', fontWeight: '500' }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {activeSubTab === 'logs' && (
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px' }}>Logs de Execução (Webhook)</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Monitore as comunicações entre o N8N e o servidor de mensagens.</p>
                    </div>

                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                        <div style={{ marginBottom: '1rem', color: 'var(--accent)' }}><Activity size={48} /></div>
                        <h4 style={{ fontWeight: '700', marginBottom: '8px' }}>Monitoramento em Tempo Real</h4>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
                            A tabela de logs do sistema está sendo inicializada. Uma vez ativa, você verá aqui falhas de entrega, payloads e erros de processamento da IA.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsView;
