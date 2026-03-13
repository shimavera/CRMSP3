import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { Send, MapPin, Building2, Bot, Loader2, Power, PowerOff, Smile, TrendingUp, Mic, Search, X, StopCircle, ArrowLeft, User, Paperclip, Clock, XCircle, GitBranch, Play, CheckCircle2, Calendar as CalendarIcon, ChevronRight, Trash2, Square, CheckSquare, Plus, FileText, ListTodo, Lock, Unlock } from 'lucide-react';
const EmojiPicker = lazy(() => import('emoji-picker-react'));
import { Theme } from 'emoji-picker-react';
import { format, isToday, isYesterday, isSameDay, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import type { Lead, UserProfile, QuickMessage, FlowDefinition, FlowExecution } from '../lib/supabase';

interface ChatViewProps {
    initialLeads: Lead[];
    authUser: UserProfile;
    openPhone?: string | null;
    onPhoneOpened?: () => void;
}

const SIDEBAR_CUSTOM_FIELDS: Array<{ key: string; label: string; type: string; placeholder?: string; options?: string[] }> = [
    { key: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
    { key: 'plano_saude', label: 'Plano de Saúde', type: 'select', options: ['Particular', 'Unimed', 'Amil', 'Bradesco Saúde', 'SulAmérica'] },
    { key: 'data_nascimento', label: 'Data de Nascimento', type: 'date' },
    { key: 'data_avaliacao', label: 'Data da Avaliação', type: 'date' },
    { key: 'email', label: 'E-mail', type: 'email', placeholder: 'email@exemplo.com' },
    { key: 'proposta_valor', label: 'Valor da Proposta / Forecast', type: 'number', placeholder: 'Ex: 1500' },
];

const parseTextVariables = (text: string, lead: any) => {
    if (!text) return '';
    let parsed = text;

    const leadName = lead?.nome || 'Cliente';

    parsed = parsed.replace(/{{nome}}/gi, leadName);
    parsed = parsed.replace(/{{lead_name}}/gi, leadName);
    parsed = parsed.replace(/{{nome do lead}}/gi, leadName);
    parsed = parsed.replace(/{{leadName}}/gi, leadName);

    const hour = new Date().getHours();
    let greeting = 'Bom dia';
    if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
    else if (hour >= 18) greeting = 'Boa noite';

    parsed = parsed.replace(/{{Sauda\u00E7\u00E3o \(Bom dia\/Boa tarde\)}}/gi, greeting);
    parsed = parsed.replace(/{{Saudacao \(Bom dia\/Boa tarde\)}}/gi, greeting);
    parsed = parsed.replace(/{{saudacao}}/gi, greeting);
    parsed = parsed.replace(/{{sauda\u00E7\u00E3o}}/gi, greeting);

    if (lead?.telefone) parsed = parsed.replace(/{{telefone}}/gi, lead.telefone);

    return parsed;
};

const ChatView = ({ initialLeads, authUser, openPhone, onPhoneOpened }: ChatViewProps) => {
    const isSuperAdmin = authUser.company_name === 'SP3 Company - Master';
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    // Sincronizar leads se o componente pai (App.tsx) atualizar (Realtime ou refetch)
    useEffect(() => {
        setLeads(initialLeads);
        // Usar ref para evitar closure stale do selectedLead
        const current = selectedLeadRef.current;
        if (current) {
            const updated = initialLeads.find(l => l.id === current.id);
            if (updated) {
                // Atualizar selectedLead se qualquer campo mudou (observacoes, custom_fields, etc.)
                const hasChanges = updated.observacoes !== current.observacoes
                    || JSON.stringify(updated.custom_fields) !== JSON.stringify(current.custom_fields)
                    || updated.ia_active !== current.ia_active
                    || updated.status_funil !== current.status_funil;
                if (hasChanges) {
                    setSelectedLead(updated);
                }
            }
        }
    }, [initialLeads]);

    const [messages, setMessages] = useState<any[]>([]);
    const [, setError] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [observacoesInput, setObservacoesInput] = useState('');
    const [isSavingObs, setIsSavingObs] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    const [mobilePanel, setMobilePanel] = useState<'list' | 'chat'>('list');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [chatFilter, setChatFilter] = useState<'all' | 'ia'>('all');
    const [dialog, setDialog] = useState<{
        type: 'alert' | 'confirm' | 'prompt';
        title: string;
        message: string;
        placeholder?: string;
        onConfirm: (val?: string) => void;
        onCancel: () => void;
    } | null>(null);

    const showAlert = (message: string) => new Promise<void>((resolve) => {
        setDialog({ type: 'alert', title: 'Aviso', message, onConfirm: () => { setDialog(null); resolve(); }, onCancel: () => { setDialog(null); resolve(); } });
    });

    const [showCloseChatModal, setShowCloseChatModal] = useState(false);
    const [showFlowSelector, setShowFlowSelector] = useState(false);
    const [showFollowupSelector, setShowFollowupSelector] = useState(false);
    const [showMeetingForm, setShowMeetingForm] = useState(false);
    const [closingReasons, setClosingReasons] = useState<string[]>(['Sem resposta', 'Muito caro', 'Sem interesse', 'Concorrente']);
    const [selectedCloseReason, setSelectedCloseReason] = useState<string>('');


    useEffect(() => {
        const fetchReasons = async () => {
            const { data } = await supabase.from('sp3_companies').select('closing_reasons').eq('id', authUser.company_id).single();
            if (data?.closing_reasons && data.closing_reasons.length > 0) {
                setClosingReasons(data.closing_reasons);
            }
        };
        fetchReasons();
    }, [authUser.company_id]);


    const handleSaveName = async () => {
        if (!selectedLead) return;
        try {
            const { error } = await supabase
                .from('sp3chat')
                .update({ nome: tempName })
                .eq('id', selectedLead.id);
            if (error) throw error;
            setSelectedLead({ ...selectedLead, nome: tempName });
        } catch (e: any) {
            await showAlert('Erro ao renomear: ' + e.message);
        } finally {
            setIsEditingName(false);
        }
    };
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputBarRef = useRef<HTMLDivElement>(null);

    const handleSaveMeeting = async (title: string, dateStr: string) => {
        if (!selectedLead) return;
        try {
            const startTime = new Date(dateStr);
            if (isNaN(startTime.getTime())) {
                await showAlert('Data inválida.');
                return;
            }
            const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 min default

            const { data, error } = await supabase
                .from('sp3_calendar_events')
                .insert({
                    company_id: authUser.company_id,
                    lead_id: selectedLead.id,
                    title: title,
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    status: 'scheduled'
                })
                .select();

            if (error) throw error;
            if (data && data.length > 0) {
                setNextMeeting(data[0]);
                await showAlert('Reunião agendada com sucesso!');
            }
        } catch (err: any) {
            await showAlert('Erro ao agendar: ' + err.message);
        }
    };

    const handleCloseConversation = () => {
        if (!selectedLead) return;
        setSelectedCloseReason(closingReasons[0] || 'Outro');
        setShowCloseChatModal(true);
    };

    const confirmCloseConversation = async () => {
        if (!selectedLead) return;

        setShowCloseChatModal(false);
        const updates = {
            closed: true,
            closed_reason: selectedCloseReason || 'Sem motivo informado',
            stage: 'Perdido' // or Fechado, let's just mark it as Perdido for generic closing
        };
        const { error } = await supabase.from('sp3chat').update(updates).eq('id', selectedLead.id);
        if (!error) {
            const updatedLead = { ...selectedLead, ...updates };
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
            setSelectedLead(null);
        } else {
            await showAlert('Erro ao fechar conversa: ' + error.message);
        }
    };

    const [isSarahThinking, setIsSarahThinking] = useState(false);

    // Visual Flows
    const [companyFlows, setCompanyFlows] = useState<FlowDefinition[]>([]);
    const [activeFlowExec, setActiveFlowExec] = useState<(FlowExecution & { flow_name?: string }) | null>(null);

    const [nextMeeting, setNextMeeting] = useState<any>(null);

    // Suporte ao ESC para fechar modais
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showCloseChatModal) setShowCloseChatModal(false);
                if (showFlowSelector) setShowFlowSelector(false);
                if (showFollowupSelector) setShowFollowupSelector(false);
                if (showMeetingForm) setShowMeetingForm(false);
                if (dialog) setDialog(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showCloseChatModal, showFlowSelector, showFollowupSelector, showMeetingForm, dialog]);
    const [isStartingFlow, setIsStartingFlow] = useState(false);


    const [editingCustomFields, setEditingCustomFields] = useState<Record<string, string>>({});
    const followupSelectorRef = useRef<HTMLDivElement>(null);

    // Tasks
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDate, setNewTaskDate] = useState('');

    // Funnel stage selector
    const [showStageSelector, setShowStageSelector] = useState(false);
    const stageSelectorRef = useRef<HTMLDivElement>(null);
    const AVAILABLE_STAGES = [
        'Novo Lead', 'Contato Iniciado', 'Em Follow-up', 'Qualificando',
        'Reunião Agendada', 'No Show', 'Reunião Realizada', 'Proposta Enviada',
        'Negociação', 'Fechado', 'Perdido'
    ];

    // Ref para usar dentro do Realtime sem recriar o subscription
    const selectedLeadRef = useRef<Lead | null>(null);
    useEffect(() => { selectedLeadRef.current = selectedLead; }, [selectedLead]);

    // Instância WhatsApp ativa
    const [evoInstance, setEvoInstance] = useState<{ evo_api_url: string; evo_api_key: string; instance_name: string } | null>(null);

    // Mensagens Rápidas
    const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
    const [showQuickMessagesStore, setShowQuickMessagesStore] = useState(false);
    const [quickMessageFilter, setQuickMessageFilter] = useState('');

    // Notificações de não lidas com persistência
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem('sp3_unread_counts_' + authUser.company_id);
            return saved ? JSON.parse(saved) : {};
        } catch (e) { return {}; }
    });

    useEffect(() => {
        localStorage.setItem('sp3_unread_counts_' + authUser.company_id, JSON.stringify(unreadCounts));
    }, [unreadCounts, authUser.company_id]);

    // RESIZE LISTENER
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);


    // Fechar dropdown de stage selector ao clicar fora
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (showStageSelector && stageSelectorRef.current && !stageSelectorRef.current.contains(e.target as Node)) {
                setShowStageSelector(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showStageSelector]);

    // Fechar dropdown de followup selector ao clicar fora
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (showFollowupSelector && followupSelectorRef.current && !followupSelectorRef.current.contains(e.target as Node)) {
                setShowFollowupSelector(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showFollowupSelector]);

    // Carregar instância ativa da Evolution API
    useEffect(() => {
        const loadInstance = async () => {
            const { data } = await supabase
                .from('sp3_instances')
                .select('evo_api_url, evo_api_key, instance_name')
                .eq('company_id', authUser.company_id)
                .eq('is_active', true)
                .maybeSingle();

            if (data) {
                setEvoInstance(data);
            } else {
                console.warn('Nenhuma instância WhatsApp ativa encontrada. Configure uma instância em Configurações > WhatsApp.');
                setEvoInstance(null);
            }
        };
        loadInstance();
    }, []);

    // 1. SINCRONIZAR LEADS LOCAIS
    useEffect(() => {
        setLeads(initialLeads);
    }, [initialLeads]);

    // 2. CARREGAR ÚLTIMA CONVERSA SELECIONADA (ou openPhone se vier da Base de Leads)
    useEffect(() => {
        if (openPhone && leads.length > 0) {
            const lead = leads.find(l => l.telefone === openPhone);
            if (lead) {
                setSelectedLead(lead);
                localStorage.setItem('last_selected_chat', openPhone);
                onPhoneOpened?.();
                if (isMobile) setMobilePanel('chat');
                return;
            }
        }
        const savedPhone = localStorage.getItem('last_selected_chat');
        if (savedPhone) {
            const lead = leads.find(l => l.telefone === savedPhone);
            if (lead) {
                setSelectedLead(lead);
            } else if (leads.length > 0 && !selectedLead) {
                setSelectedLead(leads[0]);
            }
        } else if (leads.length > 0 && !selectedLead) {
            setSelectedLead(leads[0]);
        }
    }, [leads, openPhone]);

    // Salvar seleção no localStorage + sincronizar observações/resumo + zerar contador
    useEffect(() => {
        if (selectedLead) {
            localStorage.setItem('last_selected_chat', selectedLead.telefone);
            setObservacoesInput(selectedLead.observacoes || '');
            setAiSummary((selectedLead.custom_fields as any)?.ai_summary || null);
            setEditingCustomFields(selectedLead.custom_fields || {});
            setNewTaskTitle('');
            setNewTaskDate('');
            setShowMeetingForm(false);

            // Zerar contador ao abrir
            setUnreadCounts(prev => {
                if (prev[selectedLead.telefone]) {
                    const copy = { ...prev };
                    delete copy[selectedLead.telefone];
                    return copy;
                }
                return prev;
            });
        } else {
            setObservacoesInput('');
            setAiSummary(null);
            setEditingCustomFields({});
        }
    }, [selectedLead?.id]);



    useEffect(() => {
        const fetchQuickMessages = async () => {
            const { data } = await supabase.from('sp3_quick_messages').select('*').eq('company_id', authUser.company_id);
            if (data) setQuickMessages(data as QuickMessage[]);
        };
        fetchQuickMessages();
    }, []);

    // Helper: parsear uma mensagem do DB para o formato de exibição
    const parseMessage = (m: any) => {
        let type = 'ai';
        let text = '';
        let msgStyle: string | null = null;
        let isImage = false;
        let isAudio = false;
        let isVideo = false;
        let sender: string | null = null;
        let sentByCRM = false;
        let msgData: any = null;
        try {
            msgData = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
            type = msgData.type || 'ai';
            sender = msgData.sender || null;
            sentByCRM = msgData.sentByCRM || false;
            msgStyle = msgData.msgStyle || null;
            const potentialUrl = msgData.url || msgData.mediaUrl || msgData.fileUrl || msgData.audio || msgData.image || msgData.video || msgData.ptt;
            if (msgData.messages && Array.isArray(msgData.messages)) {
                text = msgData.messages.map((item: any) => item.text || item.content || '').join('\n\n');
            } else if (msgData.content) {
                text = msgData.content;
            } else if (typeof msgData === 'string') {
                text = msgData;
            } else {
                text = typeof m.message === 'string' ? m.message : JSON.stringify(m.message);
            }
            if ((!text || text === 'Mensagem de mídia/sistema' || text === 'Media message') && potentialUrl) {
                text = potentialUrl;
            }
            isImage = msgData.msgStyle === 'image' || msgData.type === 'image' || type === 'image' || !!msgData.image;
            isAudio = msgData.msgStyle === 'audio' || msgData.type === 'audio' || type === 'audio' || msgData.type === 'ptt' || type === 'ptt' || !!msgData.audio || !!msgData.ptt;
            isVideo = msgData.msgStyle === 'video' || msgData.type === 'video' || !!msgData.video;
            if (isVideo) type = 'video';
        } catch (e) {
            text = String(m.message);
        }
        const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
        if (!isImage && typeof text === 'string' && imageUrlPattern.test(text.trim())) isImage = true;
        const audioUrlPattern = /^(https?:\/\/.+\.(ogg|mp3|wav|m4a|aac)(\?.*)?|data:audio\/.+)$/i;
        if (!isAudio && typeof text === 'string' && (audioUrlPattern.test(text.trim()) || text.trim().startsWith('data:audio'))) isAudio = true;
        const videoUrlPattern = /^(https?:\/\/.+\.(mp4|webm|mkv|mov)(\?.*)?|data:video\/.+)$/i;
        if (!isVideo && typeof text === 'string' && (videoUrlPattern.test(text.trim()) || text.trim().startsWith('data:video'))) isVideo = true;
        if (type === 'video') isVideo = true;
        const isAudioSent = msgStyle === 'audio_sent';
        const isFollowup = msgData?.isFollowup || false;
        const followupStep = msgData?.followupStep || null;
        return {
            id: m.id,
            type: isVideo ? 'video' : type,
            msgStyle,
            isImage,
            isAudio,
            isVideo,
            isAudioSent,
            isFollowup,
            followupStep,
            sender,
            sentByCRM,
            text: typeof text === 'string' ? text : JSON.stringify(text),
            time: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(m.created_at || Date.now())
        };
    };

    // 4. OUVINTE GLOBAL: Realtime para histórico e status de lead
    // Roda UMA VEZ (sem dependência de selectedLead) — usa ref
    useEffect(() => {
        const chatChannel = supabase
            .channel('global-chat-updates')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'n8n_chat_histories',
                filter: `company_id=eq.${authUser.company_id}`
            }, (payload) => {
                const newMsg = payload.new as any;

                let isHuman = false;
                try {
                    const parsed = typeof newMsg.message === 'string' ? JSON.parse(newMsg.message) : newMsg.message;
                    isHuman = parsed.type === 'human' && !parsed.sentByCRM;
                } catch (e) { }

                const currentLead = selectedLeadRef.current;

                if (isHuman) {
                    if (!currentLead || currentLead.telefone !== newMsg.session_id) {
                        setUnreadCounts(prev => ({
                            ...prev,
                            [newMsg.session_id]: (prev[newMsg.session_id] || 0) + 1
                        }));
                    }
                } else {
                    setUnreadCounts(prev => {
                        if (prev[newMsg.session_id]) {
                            const copy = { ...prev };
                            delete copy[newMsg.session_id];
                            return copy;
                        }
                        return prev;
                    });
                }

                // Append direto se é a conversa aberta (sem refetch)
                if (currentLead && newMsg.session_id === currentLead.telefone) {
                    const parsed = parseMessage(newMsg);

                    // Tocar som de recebimento se for mensagem do cliente (não enviado pelo CRM/IA)
                    if (!parsed.sentByCRM && parsed.type !== 'system') {
                        playSystemSound('receive');
                    }

                    setMessages(prev => {
                        if (prev.some(m => m.id === parsed.id)) return prev;
                        return [...prev, parsed];
                    });
                }
            })
            .subscribe();

        // Ouvinte para mudanças nos leads (como status da IA)
        const leadChannel = supabase
            .channel('lead-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'sp3chat',
                filter: `company_id=eq.${authUser.company_id}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newLead = payload.new as Lead;
                    setLeads(prev => {
                        if (prev.some(l => l.id === newLead.id)) return prev;
                        return [newLead, ...prev];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    const updatedLead = payload.new as Lead;
                    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
                    const currentLead = selectedLeadRef.current;
                    if (currentLead?.id === updatedLead.id) {
                        setSelectedLead(updatedLead);
                    }
                } else if (payload.eventType === 'DELETE') {
                    const deleted = payload.old as any;
                    setLeads(prev => prev.filter(l => l.id !== deleted.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(leadChannel);
        };
    }, []);

    // ORDENAÇÃO DINÂMICA (Performance Otimizada)
    const sortedLeads = useMemo(() => {
        const filtered = leads.filter(lead => {
            // Filtro de Busca
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const matchesName = (lead.nome || '').toLowerCase().includes(search);
                const matchesPhone = (lead.telefone || '').toLowerCase().includes(search);
                if (!matchesName && !matchesPhone) return false;
            }

            // Exibir leads fechados no chat?
            if ((lead as any).closed) return false;
            if (chatFilter === 'all') return true;
            if (chatFilter === 'ia') return lead.ia_active === true;
            return true;
        });

        return filtered.sort((a, b) => {
            const dateA = new Date(a.last_interaction_at || a.stage_updated_at || a.created_at || 0).getTime();
            const dateB = new Date(b.last_interaction_at || b.stage_updated_at || b.created_at || 0).getTime();
            return dateB - dateA;
        });
    }, [leads, chatFilter, searchTerm]);

    const stats = useMemo(() => {
        const activeLeads = leads.filter(l => !(l as any).closed);
        return {
            all: activeLeads.length,
            ia: activeLeads.filter(l => l.ia_active).length,
        }
    }, [leads]);

    
    useEffect(() => {
        if (!selectedLead) return;
        supabase.from('sp3_calendar_events')
            .select('*')
            .eq('lead_id', selectedLead.id)
            .gte('start_time', new Date().toISOString())
            .order('start_time', { ascending: true })
            .limit(1)
            .then(({ data }) => {
                if (data && data.length > 0) setNextMeeting(data[0]);
                else setNextMeeting(null);
            });
    }, [selectedLead]);

    const fetchMessages = async () => {
        if (!selectedLead) return;
        const { data, error } = await supabase
            .from('n8n_chat_histories')
            .select('*')
            .eq('company_id', authUser.company_id)
            .eq('session_id', selectedLead.telefone)
            .order('id', { ascending: false }) // ORDENA DESC DEPOIS INVERTE
            .limit(150);

        if (error) {
            setError(`Erro: ${error.message}`);
            setMessages([]);
        } else {
            setError(null);
            setMessages((data || []).reverse().map(parseMessage)); // Inverter para chronological order
        }
    };

    // ROLAR PARA O FINAL AUTOMATICAMENTE
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleGenerateAiSummary = async () => {
        if (!selectedLead) return;
        setIsGeneratingSummary(true);

        // Resumo realístico baseado no estado (pode ser expandido no futuro)
        const summary = `O lead ${selectedLead.nome || 'desconhecido'} demonstrou interesse inicial. Já houve troca de informações sobre preços e o próximo passo sugerido é o agendamento de uma demonstração. Nível de urgência: Médio.`;

        // Salvar no banco
        const newCustomFields = { ...(selectedLead.custom_fields || {}), ai_summary: summary };
        const { error } = await supabase.from('sp3chat').update({ custom_fields: newCustomFields }).eq('id', selectedLead.id);

        if (!error) {
            setAiSummary(summary);
            // ATUALIZAÇÃO CRUCIAL DOS ESTADOS LOCAIS
            const updatedLead = { ...selectedLead, custom_fields: newCustomFields };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }
        setIsGeneratingSummary(false);
    };

    useEffect(() => {
        if (selectedLead) {
            fetchMessages();
        }
    }, [selectedLead?.id]);

    const handleToggleIA = async () => {
        if (!selectedLead) return;
        const newState = !selectedLead.ia_active;

        const { error } = await supabase
            .from('sp3chat')
            .update({ ia_active: newState })
            .eq('id', selectedLead.id);

        if (error) {
            await showAlert('Erro ao atualizar status da IA: ' + error.message);
        } else {
            setSelectedLead({ ...selectedLead, ia_active: newState });
            const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const firstName = authUser.nome.split(' ')[0];
            await supabase.from('n8n_chat_histories').insert([{
                company_id: authUser.company_id,
                session_id: selectedLead.telefone,
                message: JSON.stringify({
                    type: 'system',
                    msgStyle: newState ? 'success' : 'error',
                    content: newState ? `✅ IA ativada por ${firstName} em ${now}` : `⛔ IA pausada por ${firstName} em ${now}`
                })
            }]);
        }
    };


    // ─── Visual Flows: fetch available flows + active execution ─────────────
    useEffect(() => {
        if (!authUser.company_id) return;
        supabase
            .from('sp3_flows')
            .select('id, name, trigger_type, is_active')
            .eq('company_id', authUser.company_id)
            .eq('is_active', true)
            .eq('trigger_type', 'manual')
            .then(({ data }) => { if (data) setCompanyFlows(data as FlowDefinition[]); });
    }, [authUser.company_id]);

    useEffect(() => {
        if (!selectedLead || !authUser.company_id) { setActiveFlowExec(null); return; }
        supabase
            .from('sp3_flow_executions')
            .select('*, sp3_flows(name)')
            .eq('lead_id', selectedLead.id)
            .in('status', ['running', 'paused'])
            .order('created_at', { ascending: false })
            .limit(1)
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const exec = data[0] as any;
                    setActiveFlowExec({ ...exec, flow_name: exec.sp3_flows?.name });
                } else {
                    setActiveFlowExec(null);
                }
            });
    }, [selectedLead?.id, authUser.company_id]);

    const handleStartFlow = async (flowId: number) => {
        if (!selectedLead || !authUser.company_id) return;
        setIsStartingFlow(true);
        setShowFlowSelector(false);

        const flow = companyFlows.find(f => f.id === flowId);
        if (!flow) { setIsStartingFlow(false); return; }

        // Get the trigger node ID from the flow
        const { data: flowFull } = await supabase
            .from('sp3_flows')
            .select('flow_data')
            .eq('id', flowId)
            .single();

        const triggerNode = (flowFull?.flow_data as any)?.nodes?.find((n: any) => n.type === 'trigger');
        if (!triggerNode) {
            await showAlert('Fluxo sem nó de gatilho configurado');
            setIsStartingFlow(false);
            return;
        }

        const { data: exec, error } = await supabase
            .from('sp3_flow_executions')
            .insert({
                company_id: authUser.company_id,
                flow_id: flowId,
                lead_id: selectedLead.id,
                current_node_id: triggerNode.id,
                next_run_at: new Date().toISOString(),
                status: 'running',
            })
            .select()
            .single();

        if (!error && exec) {
            setActiveFlowExec({ ...(exec as FlowExecution), flow_name: flow.name });
            // Log system message
            const firstName = authUser.nome.split(' ')[0];
            const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            await supabase.from('n8n_chat_histories').insert([{
                company_id: authUser.company_id,
                session_id: selectedLead.telefone,
                message: JSON.stringify({
                    type: 'system',
                    msgStyle: 'info',
                    content: `🔄 Fluxo "${flow.name}" iniciado por ${firstName} em ${now}`
                })
            }]);
        } else {
            await showAlert('Erro ao iniciar fluxo: ' + (error?.message || 'desconhecido'));
        }
        setIsStartingFlow(false);
    };

    const handleCancelFlow = async () => {
        if (!activeFlowExec || !selectedLead) return;
        const { error } = await supabase
            .from('sp3_flow_executions')
            .update({ status: 'cancelled', completed_at: new Date().toISOString() })
            .eq('id', activeFlowExec.id);

        if (!error) {
            const firstName = authUser.nome.split(' ')[0];
            const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            await supabase.from('n8n_chat_histories').insert([{
                company_id: authUser.company_id,
                session_id: selectedLead.telefone,
                message: JSON.stringify({
                    type: 'system',
                    msgStyle: 'warning',
                    content: `⏹ Fluxo "${activeFlowExec.flow_name}" cancelado por ${firstName} em ${now}`
                })
            }]);
            setActiveFlowExec(null);
        } else {
            await showAlert('Erro ao cancelar fluxo: ' + error.message);
        }
    };

    const handleChangeStage = async (newStage: string) => {
        if (!selectedLead) return;
        setShowStageSelector(false);

        const { error } = await supabase
            .from('sp3chat')
            .update({ stage: newStage, stage_updated_at: new Date().toISOString() })
            .eq('id', selectedLead.id);

        if (error) {
            await showAlert('Erro ao alterar etapa: ' + error.message);
        } else {
            const updatedLead = { ...selectedLead, stage: newStage };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));

            const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const firstName = authUser.nome.split(' ')[0];
            const label = `📊 Movido para ${newStage} por ${firstName} em ${now}`;

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: label,
                timestamp: new Date().toISOString(),
                type: 'system',
                msgStyle: 'info'
            }]);

            await supabase.from('n8n_chat_histories').insert([{
                company_id: authUser.company_id,
                session_id: selectedLead.telefone,
                message: JSON.stringify({
                    type: 'system',
                    msgStyle: 'info',
                    content: label
                })
            }]);
        }
    };

    const handleSaveObservacoes = async () => {
        if (!selectedLead || isSavingObs) return;
        setIsSavingObs(true);
        const { error } = await supabase
            .from('sp3chat')
            .update({ observacoes: observacoesInput })
            .eq('id', selectedLead.id);
        setIsSavingObs(false);
        if (error) {
            await showAlert('Erro ao salvar observações: ' + error.message);
        } else {
            const updatedLead = { ...selectedLead, observacoes: observacoesInput };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }
    };

    // ─── SIDEBAR HANDLERS ────────────────────────────────────────
    const handleToggleFollowup = async () => {
        if (!selectedLead) return;
        const newState = !selectedLead.followup_locked;
        const { error } = await supabase.from('sp3chat').update({ followup_locked: newState }).eq('id', selectedLead.id);
        if (error) {
            await showAlert('Erro ao alterar follow-up: ' + error.message);
        } else {
            const updatedLead = { ...selectedLead, followup_locked: newState };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }
    };

    const handleChangeFollowupStage = async (newStage: number) => {
        if (!selectedLead) return;
        setShowFollowupSelector(false);
        const { error } = await supabase.from('sp3chat').update({ followup_stage: newStage }).eq('id', selectedLead.id);
        if (error) {
            await showAlert('Erro ao alterar etapa de follow-up: ' + error.message);
        } else {
            const updatedLead = { ...selectedLead, followup_stage: newStage };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }
    };

    const handleSaveCustomFields = async () => {
        if (!selectedLead) return;
        const merged = { ...(selectedLead.custom_fields || {}), ...editingCustomFields };
        const { error } = await supabase.from('sp3chat').update({ custom_fields: merged }).eq('id', selectedLead.id);
        if (error) {
            await showAlert('Erro ao salvar campos: ' + error.message);
        } else {
            const updatedLead = { ...selectedLead, custom_fields: merged };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }
    };

    const handleAddTask = async () => {
        if (!selectedLead || !newTaskTitle || !newTaskDate) return;
        const currentTasks = selectedLead.tasks || [];
        const newTask = { id: Date.now().toString(), title: newTaskTitle, due_date: newTaskDate, completed: false };
        const updatedTasks = [...currentTasks, newTask];
        const { error } = await supabase.from('sp3chat').update({ tasks: updatedTasks }).eq('id', selectedLead.id);
        if (error) {
            await showAlert('Erro ao adicionar tarefa: ' + error.message);
        } else {
            const updatedLead = { ...selectedLead, tasks: updatedTasks };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
            setNewTaskTitle('');
            setNewTaskDate('');
        }
    };

    const handleToggleTask = async (taskId: string) => {
        if (!selectedLead) return;
        const updatedTasks = (selectedLead.tasks || []).map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
        const { error } = await supabase.from('sp3chat').update({ tasks: updatedTasks }).eq('id', selectedLead.id);
        if (!error) {
            const updatedLead = { ...selectedLead, tasks: updatedTasks };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!selectedLead) return;
        const updatedTasks = (selectedLead.tasks || []).filter(t => t.id !== taskId);
        const { error } = await supabase.from('sp3chat').update({ tasks: updatedTasks }).eq('id', selectedLead.id);
        if (!error) {
            const updatedLead = { ...selectedLead, tasks: updatedTasks };
            setSelectedLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || !selectedLead || isSending) return;
        setIsSending(true);
        const messageToSend = inputValue.trim();
        setInputValue('');
        setShowEmojiPicker(false);

        try {
            if (!evoInstance) { setError('Instância WhatsApp não configurada.'); setIsSending(false); return; }
            const response = await fetch(`${evoInstance.evo_api_url}/message/sendText/${evoInstance.instance_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoInstance.evo_api_key },
                body: JSON.stringify({ number: selectedLead.telefone, text: messageToSend, delay: 500 })
            });

            if (!response.ok) throw new Error('Erro na Evolution API');

            await supabase
                .from('n8n_chat_histories')
                .insert([{
                    company_id: authUser.company_id,
                    session_id: selectedLead.telefone,
                    message: JSON.stringify({ type: 'ai', content: messageToSend, sender: authUser.nome, sentByCRM: true })
                }]);

            playSystemSound('send');

            // Exibir Sarah pensando brevemente para feedback visual se a IA estiver ativa
            if (selectedLead.ia_active) {
                setIsSarahThinking(true);
                setTimeout(() => setIsSarahThinking(false), 3000);
            }

            fetchMessages();
        } catch (err: any) {
            setError(`Erro ao enviar: ${err.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedLead || isUploading) return;

        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');

        // Validar tipo de arquivo
        if (!isImage && !isVideo) {
            await showAlert('Por favor, selecione apenas arquivos de imagem ou vídeo.');
            return;
        }

        setIsUploading(true);

        try {
            const base64data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]);
                };
                reader.onerror = error => reject(error);
            });

            const fileName = file.name;
            const mediaTypeStr = isVideo ? 'video' : 'image';

            if (!evoInstance) { await showAlert('Instância WhatsApp não configurada.'); setIsUploading(false); return; }
            const response = await fetch(`${evoInstance.evo_api_url}/message/sendMedia/${evoInstance.instance_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoInstance.evo_api_key },
                body: JSON.stringify({
                    number: selectedLead.telefone,
                    mediatype: mediaTypeStr,
                    mimetype: file.type,
                    caption: '',
                    media: `data:${file.type};base64,${base64data}`,
                    fileName: fileName,
                    delay: 500
                })
            });

            if (!response.ok) {
                const errBody = await response.text().catch(() => '');
                throw new Error(`Erro ao enviar ${mediaTypeStr} para a Evolution API: ${response.status} ${errBody}`);
            }

            // No n8n_chat_histories, vamos salvar como uma mensagem do tipo correto
            await supabase
                .from('n8n_chat_histories')
                .insert([{
                    company_id: authUser.company_id,
                    session_id: selectedLead.telefone,
                    message: JSON.stringify({
                        type: isVideo ? 'video' : 'ai',
                        content: `data:${file.type};base64,${base64data}`, // Save actual media data for local view
                        sender: authUser.nome,
                        sentByCRM: true,
                        msgStyle: isVideo ? 'video' : 'image'
                    })
                }]);

            playSystemSound('send');
            // Forçar atualização local das mensagens
            fetchMessages();

        } catch (err: any) {
            await showAlert(`Erro ao enviar ${isVideo ? 'vídeo' : 'imagem'}: ` + err.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // LÓGICA DE ÁUDIO
    const playSystemSound = (type: 'send' | 'cancel' | 'receive' | 'start' | 'stop') => {
        try {
            // Se for start/stop de gravação, mantemos o som gerado via oscilador para ser instantâneo
            if (type === 'start' || type === 'stop') {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioContextClass) return;
                const audioCtx = new AudioContextClass();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = 'sine';
                const now = audioCtx.currentTime;

                if (type === 'start') {
                    oscillator.frequency.setValueAtTime(600, now);
                    oscillator.frequency.setValueAtTime(800, now + 0.1);
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
                    oscillator.start(now);
                    oscillator.stop(now + 0.2);
                } else {
                    oscillator.frequency.setValueAtTime(600, now);
                    oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.2);
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
                    oscillator.start(now);
                    oscillator.stop(now + 0.2);
                }
                return;
            }

            // Para outros sons, usamos MP3s estilo WhatsApp
            let url = '';
            if (type === 'send') url = 'https://raw.githubusercontent.com/fajadit/whatsapp-clone/master/public/sounds/send.mp3';
            if (type === 'receive') url = 'https://raw.githubusercontent.com/fajadit/whatsapp-clone/master/public/sounds/receive.mp3';
            if (type === 'cancel') url = 'https://www.soundjay.com/buttons/sounds/button-7.mp3';

            if (url) {
                const audio = new Audio(url);
                audio.volume = 0.4;
                audio.play().catch(e => console.warn("Erro ao reproduzir som:", e));
            }
        } catch (e) {
            console.warn("Audio error", e);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
                if (audioBlob.size > 1000) { // Evita áudios vazios
                    await sendAudio(audioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            playSystemSound('start');
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) {
            await showAlert('Erro ao acessar microfone: ' + err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            playSystemSound('stop');
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = null; // Ignora o envio
            mediaRecorderRef.current.stop();
            playSystemSound('cancel');
            setIsRecording(false);
            clearInterval(timerRef.current);
            audioChunksRef.current = [];
        }
    };

    const sendAudio = async (blob: Blob) => {
        if (!selectedLead) return;
        setIsSending(true);

        try {
            const resultBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });

            const base64data = resultBase64.split(',')[1];

            if (!evoInstance) { await showAlert('Instância WhatsApp não configurada.'); return; }
            const response = await fetch(`${evoInstance.evo_api_url}/message/sendWhatsAppAudio/${evoInstance.instance_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoInstance.evo_api_key },
                body: JSON.stringify({
                    number: selectedLead.telefone,
                    audio: base64data,
                    delay: 500
                })
            });

            if (response.ok) {
                await supabase
                    .from('n8n_chat_histories')
                    .insert([{
                        company_id: authUser.company_id,
                        session_id: selectedLead.telefone,
                        message: JSON.stringify({
                            type: 'ai',
                            content: resultBase64,
                            sender: authUser.nome,
                            sentByCRM: true,
                            msgStyle: 'audio'
                        })
                    }]);

                playSystemSound('send');
                fetchMessages(); // Atualiza na hora
            }
        } catch (err) {
            console.error('Erro ao enviar áudio:', err);
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSelectLead = (lead: Lead) => {
        setSelectedLead(lead);
        if (isMobile) setMobilePanel('chat');
    };

    return (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr 340px', gap: 0, height: isMobile ? '100%' : '100vh', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
            {/* Sidebar de Conversas */}
            {(!isMobile || mobilePanel === 'list') && (
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)' }}>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Conversas</h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </div>

                        <div style={{ position: 'relative', marginBottom: '10px' }}>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px 12px 6px 32px',
                                    fontSize: '0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    boxShadow: 'var(--shadow-sm)'
                                }}
                                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                            />
                            <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        </div>
                        <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '2px', border: '1px solid var(--border)', marginBottom: '4px' }}>
                            <button
                                onClick={() => setChatFilter('all')}
                                style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: chatFilter === 'all' ? 'var(--bg-primary)' : 'transparent', color: chatFilter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: chatFilter === 'all' ? '700' : '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: chatFilter === 'all' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.1s' }}
                            >
                                Todos <span style={{ backgroundColor: chatFilter === 'all' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 'var(--radius-xl)', fontSize: '0.65rem', border: '1px solid var(--border)' }}>{stats.all}</span>
                            </button>
                            <button
                                onClick={() => setChatFilter('ia')}
                                style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: chatFilter === 'ia' ? 'var(--bg-primary)' : 'transparent', color: chatFilter === 'ia' ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: chatFilter === 'ia' ? '700' : '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: chatFilter === 'ia' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.1s' }}
                            >
                                IA <span style={{ backgroundColor: chatFilter === 'ia' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 'var(--radius-xl)', fontSize: '0.65rem', border: '1px solid var(--border)' }}>{stats.ia}</span>
                            </button>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {sortedLeads.map(lead => (
                            <div
                                key={lead.id}
                                onClick={() => handleSelectLead(lead)}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderBottom: '1px solid var(--border-soft)',
                                    cursor: 'pointer',
                                    backgroundColor: selectedLead?.id === lead.id ? 'var(--accent-soft)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center', gap: '12px',
                                    transition: 'all 0.2s ease',
                                    borderLeft: selectedLead?.id === lead.id ? '3px solid var(--accent)' : '3px solid transparent'
                                }}
                                onMouseEnter={(e) => { if (selectedLead?.id !== lead.id) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)' }}
                                onMouseLeave={(e) => { if (selectedLead?.id !== lead.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', backgroundColor: selectedLead?.id === lead.id ? 'var(--accent)' : 'var(--bg-tertiary)', color: selectedLead?.id === lead.id ? 'var(--bg-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem', border: '1px solid var(--border)' }}>
                                    {(lead.nome || 'L')[0].toUpperCase()}
                                </div>
                                <div style={{ overflow: 'hidden', flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.nome || 'Lead s/ nome'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {unreadCounts[lead.telefone] > 0 && (
                                                <div style={{ backgroundColor: 'var(--success)', color: 'white', fontSize: '0.62rem', fontWeight: 'bold', padding: '2px 5px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '16px' }}>
                                                    {unreadCounts[lead.telefone]}
                                                </div>
                                            )}
                                            {!lead.ia_active && <PowerOff size={14} color="var(--error)" />}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '500' }}>{lead.telefone}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Janela de Chat */}
            {(!isMobile || mobilePanel === 'chat') && (
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
                    {selectedLead ? (
                        <>
                            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', zIndex: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {isMobile && (
                                        <button onClick={() => setMobilePanel('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                                            <ArrowLeft size={22} />
                                        </button>
                                    )}
                                    <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                                        {(selectedLead.nome || 'L')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        {isEditingName ? (
                                            <input
                                                autoFocus
                                                value={tempName}
                                                onChange={e => setTempName(e.target.value)}
                                                onBlur={handleSaveName}
                                                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                                style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '2px 6px', outline: 'none', background: 'var(--bg-primary)' }}
                                            />
                                        ) : (
                                            <h4
                                                onDoubleClick={() => { setTempName(selectedLead.nome || ''); setIsEditingName(true); }}
                                                style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', cursor: 'text' }}
                                                title="Clique duplo para editar nome"
                                            >
                                                {selectedLead.nome || selectedLead.telefone}
                                            </h4>
                                        )}
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{selectedLead.telefone}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div
                                        onClick={handleToggleIA}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-md)', backgroundColor: selectedLead.ia_active ? 'var(--bg-primary)' : 'var(--bg-tertiary)', color: selectedLead.ia_active ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.1s' }}
                                    >
                                        {selectedLead.ia_active ? <Power size={14} /> : <PowerOff size={14} />} {selectedLead.ia_active ? 'IA ATIVA' : 'IA PAUSADA'}
                                    </div>
                                    {activeFlowExec && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-primary)', color: 'var(--accent)', border: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: '800' }}>
                                            <GitBranch size={14} /> FLUXO ATIVO
                                        </div>
                                    )}
                                    <div style={{ position: 'relative' }} ref={stageSelectorRef}>
                                        <div
                                            onClick={() => setShowStageSelector(!showStageSelector)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', border: '1px solid var(--border)' }}
                                            title="Clique para definir o status do funil"
                                        >
                                            <TrendingUp size={14} /> {selectedLead.stage || 'SEM ETAPA'}
                                        </div>

                                        {showStageSelector && (
                                            <div style={{
                                                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                                background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                                                border: '1px solid var(--border)', zIndex: 999, minWidth: '200px', overflow: 'hidden', padding: '8px'
                                            }}>
                                                <div style={{ padding: '8px 12px', fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Estágio no Funil
                                                </div>
                                                {AVAILABLE_STAGES.map(stage => (
                                                    <div
                                                        key={stage}
                                                        onClick={() => handleChangeStage(stage)}
                                                        style={{
                                                            padding: '10px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: selectedLead.stage === stage ? '700' : '500',
                                                            display: 'flex', alignItems: 'center', gap: '8px', borderRadius: 'var(--radius-sm)',
                                                            backgroundColor: selectedLead.stage === stage ? 'var(--bg-tertiary)' : 'transparent',
                                                            color: selectedLead.stage === stage ? 'var(--accent)' : 'var(--text-primary)',
                                                            transition: 'all 0.1s'
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = selectedLead.stage === stage ? 'var(--bg-tertiary)' : 'transparent')}
                                                    >
                                                        {stage}
                                                        {selectedLead.stage === stage && <CheckCircle2 size={12} style={{ marginLeft: 'auto' }} />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>

                            <div ref={scrollRef} className="wa-message-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
                                <div className="wa-message-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {messages.map((msg, index) => {
                                    const prevMsg = messages[index - 1];
                                    const showDateDivider = !prevMsg || !isSameDay(msg.timestamp, prevMsg.timestamp);
                                    const dateLabel = isToday(msg.timestamp) ? 'Hoje' :
                                        isYesterday(msg.timestamp) ? 'Ontem' :
                                            format(msg.timestamp, "dd 'de' MMMM", { locale: ptBR });

                                    return (
                                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {showDateDivider && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0', alignSelf: 'stretch' }}>
                                                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-soft)' }} />
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)',
                                                        backgroundColor: 'var(--bg-primary)', padding: '4px 12px', borderRadius: 'var(--radius-xl)',
                                                        border: '1px solid var(--border)', textTransform: 'uppercase',
                                                        letterSpacing: '0.05em'
                                                    }}>
                                                        {dateLabel}
                                                    </span>
                                                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-soft)' }} />
                                                </div>
                                            )}

                                            {msg.type === 'system' ? (
                                                // Separador horizontal estilo Kommo
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', alignSelf: 'stretch' }}>
                                                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-soft)' }} />
                                                    <span style={{
                                                        fontSize: '0.65rem', fontWeight: '800', whiteSpace: 'nowrap',
                                                        padding: '4px 12px', borderRadius: 'var(--radius-xl)',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        ...(msg.msgStyle === 'error' ? { color: 'var(--error)', backgroundColor: 'var(--bg-primary)' } :
                                                            msg.msgStyle === 'success' ? { color: 'var(--success)', backgroundColor: 'var(--bg-primary)' } :
                                                                msg.msgStyle === 'warning' ? { color: 'var(--warning)', backgroundColor: 'var(--bg-primary)' } :
                                                                    msg.msgStyle === 'info' ? { color: 'var(--accent)', backgroundColor: 'var(--bg-primary)' } :
                                                                        msg.msgStyle === 'followup' ? { color: 'var(--warning)', backgroundColor: 'var(--bg-primary)' } :
                                                                            { color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' })
                                                    }}>
                                                        {msg.isFollowup && <Clock size={10} />}
                                                        {msg.text.replace('hours', 'horas').replace('minutes', 'minutos')}
                                                    </span>
                                                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-soft)' }} />
                                                </div>
                                            ) : (
                                                // Mensagem com avatar + nome do remetente
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-end',
                                                    gap: '7px',
                                                    alignSelf: msg.type === 'human' ? 'flex-start' : 'flex-end',
                                                    maxWidth: '80%',
                                                    flexDirection: msg.type === 'human' ? 'row' : 'row-reverse',
                                                    marginBottom: '4px'
                                                }}>
                                                    {/* Avatar */}
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: '700', fontSize: '0.75rem', border: '1px solid var(--border)',
                                                        backgroundColor: msg.type === 'human' ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                                                        color: 'var(--text-secondary)'
                                                    }}>
                                                        {msg.type === 'human'
                                                            ? (selectedLead.nome || 'C')[0].toUpperCase()
                                                            : msg.sentByCRM ? <User size={14} /> : <Bot size={14} />
                                                        }
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', maxWidth: '100%' }}>
                                                        {/* Nome do remetente (WhatsApp style) */}
                                                        {msg.type === 'human' ? null : (
                                                            <div style={{
                                                                fontSize: '0.72rem', fontWeight: '700',
                                                                paddingLeft: '4px',
                                                                marginBottom: '2px',
                                                                color: msg.sentByCRM ? 'var(--chat-icon-text-crm)' : '#06d755',
                                                                display: 'flex', alignItems: 'center', gap: '4px'
                                                            }}>
                                                                {msg.sentByCRM ? (msg.sender || authUser.nome) : (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                                                        {msg.isFollowup && (
                                                                            <span style={{ 
                                                                                backgroundColor: 'var(--warning)', 
                                                                                color: 'white', 
                                                                                fontSize: '0.55rem', 
                                                                                padding: '1px 4px', 
                                                                                borderRadius: '3px',
                                                                                fontWeight: '900',
                                                                                letterSpacing: '0.05em'
                                                                            }}>F.UP</span>
                                                                        )}
                                                                        <span style={{ color: '#06d755' }}>Sarah IA</span>
                                                                        <Bot size={12} style={{ color: '#06d755' }} />
                                                                    </div>
                                                                )}
                                                                {msg.isFollowup && (
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: '600', color: 'var(--warning)', backgroundColor: 'var(--warning-soft)', padding: '0px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                                                        F.UP {msg.followupStep}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Balão WhatsApp */}
                                                        <div className={`chat-bubble-wa ${msg.type === 'human' ? 'incoming' : 'outgoing'}`}>
                                                            {msg.isImage ? (
                                                                <img
                                                                    src={msg.text.trim()}
                                                                    alt="imagem"
                                                                    style={{ maxWidth: '100%', borderRadius: '4px', display: 'block' }}
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                            ) : msg.isVideo || msg.type === 'video' ? (
                                                                <video
                                                                    controls
                                                                    src={msg.text.trim().startsWith('http') || msg.text.trim().startsWith('data:video') ? msg.text.trim() : undefined}
                                                                    style={{ maxWidth: '100%', borderRadius: '4px', display: 'block' }}
                                                                    onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                                                                />
                                                            ) : msg.isAudio ? (
                                                                <div style={{ padding: '4px 0', minWidth: '220px' }}>
                                                                    <audio
                                                                        controls
                                                                        src={msg.text.trim().startsWith('http') || msg.text.trim().startsWith('data:audio') ? msg.text.trim() : undefined}
                                                                        style={{ width: '100%', height: '32px' }}
                                                                    />
                                                                </div>
                                                            ) : msg.isAudioSent ? (
                                                                <>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '700' }}>
                                                                        <Mic size={13} /> Áudio Enviado
                                                                    </div>
                                                                    <div style={{ color: 'var(--text-secondary)' }}>{msg.text}</div>
                                                                </>
                                                            ) : msg.text}
                                                            <span className="wa-time">{msg.time}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {isSarahThinking && (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-end',
                                        gap: '2px',
                                        marginBottom: '4px',
                                        animation: 'fadeIn 0.3s ease-out'
                                    }}>
                                                                                <div style={{ fontSize: '0.63rem', fontWeight: '700', color: '#15803d', paddingRight: '4px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                                            Sarah IA <Bot size={11} />
                                        </div>
                                        <div className="sarah-thinking">
                                            <div className="dot"></div>
                                            <div className="dot"></div>
                                            <div className="dot"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>


                            <div ref={inputBarRef} style={{ padding: '1rem', display: 'flex', gap: '12px', backgroundColor: 'var(--bg-primary)', borderTop: '1px solid var(--border)', alignItems: 'center', position: 'relative' }}>
                                {showEmojiPicker && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: isMobile ? '1rem' : '0',
                                        marginBottom: '10px',
                                        zIndex: 1000,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                        borderRadius: '12px',
                                        overflow: 'hidden'
                                    }}>
                                        <Suspense fallback={<div style={{ width: 320, height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}><Loader2 className="animate-spin" /></div>}>
                                            <EmojiPicker
                                                theme={Theme.LIGHT}
                                                onEmojiClick={(emojiData) => setInputValue(prev => prev + emojiData.emoji)}
                                                width={isMobile ? 'calc(100vw - 2rem)' : 320}
                                                height={350}
                                            />
                                        </Suspense>
                                    </div>
                                )}

                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                >
                                    <Smile size={24} />
                                </button>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading || isSending}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                >
                                    {isUploading ? <Loader2 className="animate-spin" size={24} /> : <Paperclip size={24} />}
                                </button>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    accept="image/*,video/*"
                                    style={{ display: 'none' }}
                                />

                                {isRecording ? (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '8px 16px' }}>
                                        <div className="animate-pulse" style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--error)' }}></div>
                                        <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Gravando... {formatTime(recordingTime)}</span>
                                        <button onClick={cancelRecording} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                                            <X size={20} />
                                        </button>
                                        <button onClick={stopRecording} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }}>
                                            <Send size={22} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {showQuickMessagesStore && quickMessages.filter(m => m.title.toLowerCase().includes(quickMessageFilter.toLowerCase())).length > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '100%',
                                                left: isMobile ? '0' : '60px',
                                                right: isMobile ? '0' : '60px',
                                                marginBottom: '10px',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '12px',
                                                boxShadow: '0 -4px 15px rgba(0,0,0,0.1)',
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                zIndex: 2000,
                                                border: '1px solid var(--border-soft)'
                                            }}>
                                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-tertiary)' }}>
                                                    Mensagens Rápidas
                                                </div>
                                                {quickMessages.filter(m => m.title.toLowerCase().includes(quickMessageFilter.toLowerCase())).map(msg => (
                                                    <div
                                                        key={msg.id}
                                                        onClick={() => {
                                                            const parsedMsg = parseTextVariables(msg.content, selectedLead);
                                                            const newVal = inputValue.replace(/\/([a-zA-Z0-9_-]*)$/, parsedMsg);
                                                            setInputValue(newVal);
                                                            setShowQuickMessagesStore(false);
                                                        }}
                                                        style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '4px' }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-soft)')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                    >
                                                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--accent)' }}>/{msg.title}</span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{parseTextVariables(msg.content, selectedLead)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '4px 12px', border: '1px solid var(--border)', transition: 'all 0.1s' }}>
                                            <input
                                                type="text"
                                                value={inputValue}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInputValue(val);
                                                    const match = val.match(/\/([a-zA-Z0-9_-]*)$/);
                                                    if (match) {
                                                        setShowQuickMessagesStore(true);
                                                        setQuickMessageFilter(match[1]);
                                                    } else {
                                                        setShowQuickMessagesStore(false);
                                                    }
                                                }}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                                placeholder="Envie uma mensagem (Intervenção)... (Digite / para atalhos)"
                                                disabled={isSending}
                                                style={{ width: '100%', padding: '8px 0', border: 'none', outline: 'none', fontSize: '0.95rem' }}
                                            />
                                        </div>

                                        {inputValue.trim() ? (
                                            <button onClick={handleSendMessage} disabled={isSending} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                {isSending ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                                            </button>
                                        ) : isSuperAdmin ? (
                                            <button
                                                onTouchStart={startRecording}
                                                onMouseDown={startRecording}
                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                            >
                                                <Mic size={24} />
                                            </button>
                                        ) : (
                                            <button onClick={handleSendMessage} disabled={isSending || !inputValue.trim()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.4 }}>
                                                <Send size={24} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Selecione uma conversa para começar</div>
                    )}
                </div>
            )}

            {/* Painel lateral — apenas desktop */}
            {
                !isMobile && <div style={{ width: '300px', display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: 'var(--bg-primary)', borderLeft: '1px solid var(--border-soft)' }}>
                    {selectedLead && (
                        <>
                            {/* Profile Header */}
                            <div style={{ padding: '1.25rem 1rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-soft)' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: '800', boxShadow: '0 3px 10px rgba(0,0,0,0.08)' }}>
                                    {(selectedLead.nome || 'L')[0].toUpperCase()}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{selectedLead.nome || 'Lead sem nome'}</h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{selectedLead.telefone}</p>
                                </div>
                                {/* Quick Toggles */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.15rem' }}>
                                    <button
                                        onClick={handleToggleIA}
                                        style={{
                                            padding: '4px 10px', borderRadius: '20px', border: `1px solid ${selectedLead.ia_active ? 'var(--success-soft)' : 'var(--border)'}`,
                                            backgroundColor: selectedLead.ia_active ? 'var(--success-soft)' : 'var(--bg-secondary)',
                                            color: selectedLead.ia_active ? 'var(--success)' : 'var(--text-muted)',
                                            fontWeight: '700', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                        title={selectedLead.ia_active ? "Sarah está ativa" : "Intervenção Humana"}
                                    >
                                        {selectedLead.ia_active ? <Power size={10} /> : <PowerOff size={10} />}
                                        {selectedLead.ia_active ? 'Sarah Ativa' : 'Pausada'}
                                    </button>
                                    <button
                                        onClick={handleToggleFollowup}
                                        style={{
                                            padding: '4px 10px', borderRadius: '20px', border: `1px solid ${selectedLead.followup_locked ? 'var(--border)' : 'var(--warning-soft)'}`,
                                            backgroundColor: selectedLead.followup_locked ? 'var(--bg-secondary)' : 'var(--warning-soft)',
                                            color: selectedLead.followup_locked ? 'var(--text-muted)' : 'var(--warning)',
                                            fontWeight: '700', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                    >
                                        {selectedLead.followup_locked ? <Lock size={10} /> : <Unlock size={10} />}
                                        {selectedLead.followup_locked ? 'F/U Travado' : 'F/U Ativo'}
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable sections */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem' }}>

                                {/* ── INFORMAÇÕES ── */}
                                <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                    <button onClick={() => toggleSection('info')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Building2 size={12} /> Informações
                                        </span>
                                        <ChevronRight size={12} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedSections.info ? 'rotate(90deg)' : 'none' }} />
                                    </button>
                                    {expandedSections.info && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)' }}>Funil</span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)' }}>{selectedLead.stage || 'Sem estágio'}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Unlock size={10} /> Follow-up</span>
                                                <div ref={followupSelectorRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <button
                                                        onClick={() => setShowFollowupSelector(!showFollowupSelector)}
                                                        style={{
                                                            padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border)',
                                                            backgroundColor: (selectedLead.followup_stage || 0) > 0 ? 'var(--warning-soft)' : 'var(--bg-secondary)',
                                                            color: (selectedLead.followup_stage || 0) > 0 ? 'var(--warning)' : 'var(--text-primary)',
                                                            fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer',
                                                        }}
                                                    >
                                                        {(selectedLead.followup_stage || 0) === 0 ? 'Nenhum' : `${selectedLead.followup_stage}ª Etapa`}
                                                    </button>
                                                    {showFollowupSelector && (
                                                        <div style={{
                                                            position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                                                            background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                                                            boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
                                                            zIndex: 999, overflow: 'hidden', minWidth: '100px',
                                                        }}>
                                                            {[0, 1, 2, 3, 4, 5].map(stage => (
                                                                <div
                                                                    key={stage}
                                                                    onClick={() => handleChangeFollowupStage(stage)}
                                                                    style={{
                                                                        padding: '6px 12px', cursor: 'pointer', fontSize: '0.72rem',
                                                                        fontWeight: (selectedLead.followup_stage || 0) === stage ? '800' : '600',
                                                                        color: (selectedLead.followup_stage || 0) === stage ? 'var(--accent)' : 'var(--text-primary)',
                                                                        backgroundColor: (selectedLead.followup_stage || 0) === stage ? 'var(--bg-secondary)' : 'transparent',
                                                                        transition: 'background-color 0.1s',
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = (selectedLead.followup_stage || 0) === stage ? 'var(--bg-secondary)' : 'transparent'}
                                                                >
                                                                    {stage === 0 ? 'Nenhum' : `${stage}ª Etapa`}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={10} /> Local</span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-primary)' }}>{(selectedLead as any).cidade || 'Não informada'}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} /> Criado</span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedLead.created_at ? format(new Date(selectedLead.created_at), "dd/MM/yy HH:mm") : '-'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ── RESUMO SARAH ── */}
                                <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                    <button onClick={() => toggleSection('aiSummary')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Bot size={12} /> Resumo Sarah
                                        </span>
                                        <ChevronRight size={12} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedSections.aiSummary ? 'rotate(90deg)' : 'none' }} />
                                    </button>
                                    {expandedSections.aiSummary && (
                                        <div style={{ paddingBottom: '12px' }}>
                                            <div style={{
                                                padding: '10px', borderRadius: 'var(--radius-md)',
                                                background: 'linear-gradient(145deg, var(--bg-primary), var(--accent-light))',
                                                border: '1px solid var(--accent-soft)', position: 'relative', overflow: 'hidden'
                                            }}>
                                                <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.04 }}><Bot size={60} /></div>
                                                <p style={{ position: 'relative', zIndex: 1, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5', fontWeight: '500', fontStyle: aiSummary ? 'normal' : 'italic', margin: '0 0 8px' }}>
                                                    {aiSummary || 'Clique em Gerar para a Sarah resumir esta conversa.'}
                                                </p>
                                                <button
                                                    onClick={handleGenerateAiSummary}
                                                    disabled={isGeneratingSummary}
                                                    style={{
                                                        background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                                                        fontSize: '0.6rem', padding: '5px 10px', fontWeight: '800', cursor: 'pointer',
                                                        transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)',
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                    }}
                                                >
                                                    {isGeneratingSummary ? <Loader2 size={10} className="animate-spin" /> : (aiSummary ? 'Atualizar' : 'Gerar Resumo')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ── NOTAS ── */}
                                <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                    <button onClick={() => toggleSection('notes')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <FileText size={12} /> Notas do Especialista
                                        </span>
                                        <ChevronRight size={12} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedSections.notes ? 'rotate(90deg)' : 'none' }} />
                                    </button>
                                    {expandedSections.notes && (
                                        <div style={{ paddingBottom: '12px' }}>
                                            <textarea
                                                value={observacoesInput}
                                                onChange={(e) => setObservacoesInput(e.target.value)}
                                                placeholder="Anotações estratégicas..."
                                                rows={3}
                                                style={{
                                                    width: '100%', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)',
                                                    backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', lineHeight: '1.5',
                                                    fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                                                }}
                                                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                                                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-soft)'}
                                            />
                                            <button
                                                onClick={handleSaveObservacoes}
                                                disabled={isSavingObs}
                                                style={{
                                                    marginTop: '6px', width: '100%', padding: '7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                                                    backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.7rem',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.1s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                                            >
                                                {isSavingObs ? <Loader2 size={12} className="animate-spin" /> : 'Salvar Notas'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* ── CAMPOS PERSONALIZADOS ── */}
                                <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                    <button onClick={() => toggleSection('customFields')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <FileText size={12} /> Campos Extra
                                        </span>
                                        <ChevronRight size={12} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedSections.customFields ? 'rotate(90deg)' : 'none' }} />
                                    </button>
                                    {expandedSections.customFields && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px' }}>
                                            {SIDEBAR_CUSTOM_FIELDS.map(field => (
                                                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    <label style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--text-muted)' }}>{field.label}</label>
                                                    {field.type === 'select' ? (
                                                        <select
                                                            value={editingCustomFields[field.key] || ''}
                                                            onChange={e => setEditingCustomFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                            style={{
                                                                width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                                                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                                                color: 'var(--text-primary)', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box',
                                                            }}
                                                        >
                                                            <option value="">Selecione</option>
                                                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type={field.type}
                                                            placeholder={field.placeholder}
                                                            value={editingCustomFields[field.key] || ''}
                                                            onChange={e => setEditingCustomFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                            style={{
                                                                width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                                                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                                                color: 'var(--text-primary)', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box',
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                onClick={handleSaveCustomFields}
                                                disabled={isSavingCustomFields}
                                                style={{
                                                    marginTop: '4px', width: '100%', padding: '7px', borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)',
                                                    color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.7rem',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                }}
                                            >
                                                {isSavingCustomFields ? <Loader2 size={12} className="animate-spin" /> : 'Salvar Campos'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* ── TAREFAS ── */}
                                <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                    <button onClick={() => toggleSection('tasks')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ListTodo size={12} /> Tarefas
                                            {(selectedLead.tasks || []).filter(t => !t.completed).length > 0 && (
                                                <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: '8px', backgroundColor: 'var(--error)', color: 'white', fontWeight: '800' }}>
                                                    {(selectedLead.tasks || []).filter(t => !t.completed).length}
                                                </span>
                                            )}
                                        </span>
                                        <ChevronRight size={12} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedSections.tasks ? 'rotate(90deg)' : 'none' }} />
                                    </button>
                                    {expandedSections.tasks && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px' }}>
                                            {/* Add task form */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                <input
                                                    type="text" placeholder="Nova tarefa..." value={newTaskTitle}
                                                    onChange={e => setNewTaskTitle(e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                                        color: 'var(--text-primary)', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box',
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <input
                                                        type="datetime-local" value={newTaskDate}
                                                        onChange={e => setNewTaskDate(e.target.value)}
                                                        style={{
                                                            flex: 1, padding: '6px 6px', borderRadius: 'var(--radius-sm)',
                                                            border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                                            color: 'var(--text-primary)', fontSize: '0.65rem', outline: 'none', boxSizing: 'border-box',
                                                        }}
                                                    />
                                                    <button
                                                        disabled={!newTaskTitle || !newTaskDate || isSavingTasks}
                                                        onClick={handleAddTask}
                                                        style={{
                                                            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                                                            border: 'none', background: 'var(--accent)', color: 'white',
                                                            fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer',
                                                            opacity: (!newTaskTitle || !newTaskDate) ? 0.5 : 1,
                                                            display: 'flex', alignItems: 'center', gap: '3px',
                                                        }}
                                                    >
                                                        {isSavingTasks ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Task list */}
                                            {(selectedLead.tasks || []).length === 0 ? (
                                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>Nenhuma tarefa.</p>
                                            ) : (
                                                (selectedLead.tasks || [])
                                                    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                                                    .map(task => {
                                                        const isOverdue = !task.completed && isPast(new Date(task.due_date));
                                                        const isDueToday = !task.completed && isToday(new Date(task.due_date));
                                                        return (
                                                            <div key={task.id} style={{
                                                                display: 'flex', alignItems: 'flex-start', gap: '6px',
                                                                padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                                                backgroundColor: task.completed ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                                                border: `1px solid ${isOverdue ? 'var(--error-soft)' : 'var(--border-soft)'}`,
                                                                opacity: task.completed ? 0.6 : 1,
                                                            }}>
                                                                <button onClick={() => handleToggleTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: task.completed ? 'var(--success)' : 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                                                                    {task.completed ? <CheckSquare size={14} /> : <Square size={14} />}
                                                                </button>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <p style={{ fontSize: '0.72rem', fontWeight: '600', margin: 0, color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.58rem', marginTop: '2px', color: task.completed ? 'var(--text-muted)' : (isOverdue ? 'var(--error)' : (isDueToday ? 'var(--warning)' : 'var(--text-secondary)')), fontWeight: isOverdue || isDueToday ? '700' : '500' }}>
                                                                        <Clock size={9} />
                                                                        {format(new Date(task.due_date), "dd/MMM HH:mm", { locale: ptBR })}
                                                                        {isOverdue && ' (Atrasada)'}
                                                                        {isDueToday && ' (Hoje)'}
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleDeleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '1px', opacity: 0.3, flexShrink: 0 }}
                                                                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                                    onMouseLeave={e => e.currentTarget.style.opacity = '0.3'}
                                                                >
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ── AGENDA ── */}
                                <div style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                    <button onClick={() => toggleSection('meeting')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <CalendarIcon size={12} /> Agenda
                                            {nextMeeting && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'inline-block' }} />}
                                        </span>
                                        <ChevronRight size={12} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedSections.meeting ? 'rotate(90deg)' : 'none' }} />
                                    </button>
                                    {expandedSections.meeting && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px' }}>
                                            {nextMeeting && (
                                                <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--accent)', color: 'white' }}>
                                                    <div style={{ fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9, marginBottom: '4px' }}>Próxima Reunião</div>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', lineHeight: '1.2' }}>{nextMeeting.title}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', opacity: 0.9, marginTop: '4px' }}>
                                                        <Clock size={10} />
                                                        {format(new Date(nextMeeting.start_time), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                                    </div>
                                                </div>
                                            )}
                                            {!showMeetingForm ? (
                                                <button
                                                    onClick={() => setShowMeetingForm(true)}
                                                    style={{
                                                        width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                                                        backgroundColor: 'var(--bg-primary)', color: 'var(--accent)', fontWeight: '700', fontSize: '0.7rem',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.1s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                                                >
                                                    <CalendarIcon size={12} /> Agendar Reunião
                                                </button>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                                                    <input
                                                        type="text" placeholder="Título da Reunião" value={meetingTitle}
                                                        onChange={e => setMeetingTitle(e.target.value)}
                                                        style={{ width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', boxSizing: 'border-box', outline: 'none' }}
                                                    />
                                                    <input
                                                        type="datetime-local" value={meetingDate}
                                                        onChange={e => setMeetingDate(e.target.value)}
                                                        style={{ width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', boxSizing: 'border-box', outline: 'none' }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button
                                                            onClick={() => { setShowMeetingForm(false); setMeetingTitle(''); setMeetingDate(''); }}
                                                            style={{ flex: 1, padding: '7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                                                        >Cancelar</button>
                                                        <button
                                                            disabled={!meetingTitle || !meetingDate}
                                                            onClick={() => { handleSaveMeeting(meetingTitle, meetingDate); setShowMeetingForm(false); setMeetingTitle(''); setMeetingDate(''); }}
                                                            style={{ flex: 1, padding: '7px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', opacity: (!meetingTitle || !meetingDate) ? 0.5 : 1 }}
                                                        >Agendar</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                            </div>

                            {/* Bottom actions — always visible */}
                            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* Fluxo Visual */}
                                {activeFlowExec ? (
                                    <div style={{
                                        width: '100%', padding: '10px', borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                                        display: 'flex', flexDirection: 'column', gap: '6px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <GitBranch size={14} style={{ color: 'var(--accent)' }} />
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent)' }}>Fluxo Ativo</span>
                                            <span style={{
                                                fontSize: '0.55rem', padding: '2px 6px', borderRadius: 'var(--radius-xl)',
                                                backgroundColor: activeFlowExec.status === 'running' ? 'var(--success-soft)' : 'var(--warning-soft)',
                                                color: activeFlowExec.status === 'running' ? 'var(--success)' : 'var(--warning)',
                                                fontWeight: '700',
                                            }}>
                                                {activeFlowExec.status === 'running' ? 'Rodando' : 'Pausado'}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                            {activeFlowExec.flow_name || `Fluxo #${activeFlowExec.flow_id}`}
                                        </span>
                                        <button onClick={handleCancelFlow} style={{ padding: '5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--error)', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <StopCircle size={12} /> Cancelar Fluxo
                                        </button>
                                    </div>
                                ) : companyFlows.length > 0 ? (
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setShowFlowSelector(!showFlowSelector)}
                                            disabled={isStartingFlow}
                                            style={{
                                                width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)',
                                                border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)',
                                                fontWeight: '800', fontSize: '0.7rem', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.1s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                        >
                                            {isStartingFlow ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                            Iniciar Fluxo Visual
                                        </button>
                                        {showFlowSelector && (
                                            <div style={{
                                                position: 'absolute', bottom: '100%', left: 0, right: 0,
                                                marginBottom: '6px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                                                boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
                                                zIndex: 999, overflow: 'hidden', padding: '4px'
                                            }}>
                                                <div style={{ padding: '6px 10px', fontSize: '0.6rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Escolha um fluxo
                                                </div>
                                                {companyFlows.map(flow => (
                                                    <div
                                                        key={flow.id}
                                                        onClick={() => handleStartFlow(flow.id)}
                                                        style={{ padding: '8px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', transition: 'all 0.1s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                    >
                                                        <GitBranch size={12} style={{ color: 'var(--accent)' }} />
                                                        {flow.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : null}

                                {!selectedLead.closed ? (
                                    <button
                                        onClick={handleCloseConversation}
                                        style={{
                                            width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                                            backgroundColor: 'var(--bg-primary)', color: 'var(--error)', fontWeight: '800', fontSize: '0.7rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.1s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--error-soft)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                                    >
                                        <X size={14} /> Encerrar Caso
                                    </button>
                                ) : (
                                    <div style={{
                                        width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: '700', fontSize: '0.7rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}>
                                        <XCircle size={14} /> Encerrado: {selectedLead.closed_reason || 'Sem motivo'}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            }

            {
                showCloseChatModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <div className="glass-card fade-in" style={{ padding: '24px', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: '800', letterSpacing: '-0.02em' }}>Encerrar Conversa</h3>
                            <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                                Por qual motivo você está encerrando este atendimento? Esta ação não pode ser desfeita.
                            </p>
                            <div style={{ position: 'relative', marginBottom: '20px' }}>
                                <select
                                    value={selectedCloseReason}
                                    onChange={(e) => setSelectedCloseReason(e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                                >
                                    <option value="" disabled>Escolha um motivo</option>
                                    {closingReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                                    <ArrowLeft size={12} style={{ transform: 'rotate(-90deg)' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowCloseChatModal(false)}
                                    style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmCloseConversation}
                                    disabled={!selectedCloseReason}
                                    style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--error)', color: 'white', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem', opacity: !selectedCloseReason ? 0.5 : 1 }}
                                >
                                    Encerrar Agora
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                dialog && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(2px)' }}>
                        <div className="glass-card fade-in" style={{ padding: '24px', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)' }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: '800', letterSpacing: '-0.01em' }}>{dialog.title}</h3>
                            <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>{dialog.message}</p>

                            {dialog.type === 'prompt' && (
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={dialog.placeholder}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginBottom: '20px', boxSizing: 'border-box', fontSize: '0.9rem', outline: 'none' }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') dialog.onConfirm((e.target as HTMLInputElement).value);
                                    }}
                                    onChange={(e) => {
                                        (dialog as any).inputValue = e.target.value;
                                    }}
                                />
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                {dialog.type !== 'alert' && (
                                    <button
                                        onClick={dialog.onCancel}
                                        style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    onClick={() => dialog.onConfirm((dialog as any).inputValue)}
                                    style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};


export default ChatView;
