import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Phone, MapPin, Building2, DollarSign, Bot, Loader2, Power, PowerOff, Smile, Mic, X, StopCircle, Lock, Unlock } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { supabase } from '../lib/supabase';
import type { Lead, UserProfile } from '../lib/supabase';

interface ChatViewProps {
    initialLeads: Lead[];
    authUser: UserProfile;
    openPhone?: string | null;
    onPhoneOpened?: () => void;
}

const InfoItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ color: 'var(--text-muted)' }}><Icon size={16} /></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500' }}>{label}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{value || 'Pendente...'}</span>
        </div>
    </div>
);

const ChatView = ({ initialLeads, authUser, openPhone, onPhoneOpened }: ChatViewProps) => {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [lastMessagesDates, setLastMessagesDates] = useState<Record<string, string>>({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [observacoesInput, setObservacoesInput] = useState('');
    const [isSavingObs, setIsSavingObs] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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

    // Salvar seleção no localStorage + sincronizar observações
    useEffect(() => {
        if (selectedLead) {
            localStorage.setItem('last_selected_chat', selectedLead.telefone);
            setObservacoesInput(selectedLead.observacoes || '');
        }
    }, [selectedLead?.id]);

    // 3. BUSCAR DATAS DAS ÚLTIMAS MENSAGENS PARA ORDENAÇÃO INICIAL
    const fetchLastMessageDates = async () => {
        const { data, error } = await supabase
            .from('n8n_chat_histories')
            .select('session_id, created_at')
            .order('created_at', { ascending: false });

        if (!error && data) {
            const dates: Record<string, string> = {};
            data.forEach(m => {
                if (!dates[m.session_id]) {
                    dates[m.session_id] = m.created_at || '';
                }
            });
            setLastMessagesDates(dates);
        }
    };

    useEffect(() => {
        fetchLastMessageDates();
    }, [leads]);

    // 4. OUVINTE GLOBAL: Realtime para histórico e status de lead
    useEffect(() => {
        const chatChannel = supabase
            .channel('global-chat-updates')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'n8n_chat_histories'
            }, (payload) => {
                const newMsg = payload.new as any;
                setLastMessagesDates(prev => ({
                    ...prev,
                    [newMsg.session_id]: newMsg.created_at || new Date().toISOString()
                }));

                if (selectedLead && newMsg.session_id === selectedLead.telefone) {
                    fetchMessages();
                }
            })
            .subscribe();

        // Ouvinte para mudanças nos leads (como status da IA)
        const leadChannel = supabase
            .channel('lead-updates')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'sp3chat'
            }, (payload) => {
                const updatedLead = payload.new as Lead;
                setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
                if (selectedLead?.id === updatedLead.id) {
                    setSelectedLead(updatedLead);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(leadChannel);
        };
    }, [selectedLead]);

    // ORDENAÇÃO DINÂMICA
    const sortedLeads = useMemo(() => {
        return [...leads].sort((a, b) => {
            const dateA = new Date(lastMessagesDates[a.telefone] || 0).getTime();
            const dateB = new Date(lastMessagesDates[b.telefone] || 0).getTime();
            return dateB - dateA;
        });
    }, [leads, lastMessagesDates]);

    const fetchMessages = async () => {
        if (!selectedLead) return;
        const { data, error } = await supabase
            .from('n8n_chat_histories')
            .select('*')
            .eq('session_id', selectedLead.telefone)
            .order('id', { ascending: true });

        if (error) {
            setError(`Erro: ${error.message}`);
            setMessages([]);
        } else {
            setError(null);
            const formatted = (data || []).map((m: any) => {
                let type = 'ai';
                let text = '';
                let msgStyle: string | null = null;
                let isImage = false;
                let sender: string | null = null;
                let sentByCRM = false;
                let msgData: any = null;
                try {
                    msgData = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
                    type = msgData.type || 'ai';
                    msgStyle = msgData.msgStyle || null;
                    isImage = msgData.msgStyle === 'image' || msgData.type === 'image';
                    sender = msgData.sender || null;
                    sentByCRM = msgData.sentByCRM || false;

                    if (msgData.messages && Array.isArray(msgData.messages)) {
                        text = msgData.messages.map((item: any) => item.text || item.content || '').join('\n\n');
                    } else if (msgData.content) {
                        text = msgData.content;
                    } else if (typeof msgData === 'string') {
                        text = msgData;
                    } else {
                        text = typeof m.message === 'string' ? m.message : JSON.stringify(m.message);
                    }
                } catch (e) {
                    text = String(m.message);
                }

                // Detectar URLs de imagem no texto
                const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
                if (!isImage && typeof text === 'string' && imageUrlPattern.test(text.trim())) {
                    isImage = true;
                }

                return {
                    id: m.id,
                    type,
                    msgStyle,
                    isImage,
                    sender,
                    sentByCRM,
                    text: typeof text === 'string' ? text : JSON.stringify(text),
                    time: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
            });
            setMessages(formatted);
        }
    };

    // ROLAR PARA O FINAL AUTOMATICAMENTE
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (selectedLead) {
            fetchMessages();
        }
    }, [selectedLead]);

    const handleToggleIA = async () => {
        if (!selectedLead) return;
        const newState = !selectedLead.ia_active;

        const { error } = await supabase
            .from('sp3chat')
            .update({ ia_active: newState })
            .eq('id', selectedLead.id);

        if (error) {
            alert('Erro ao atualizar status da IA: ' + error.message);
        } else {
            setSelectedLead({ ...selectedLead, ia_active: newState });
            const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const firstName = authUser.nome.split(' ')[0];
            await supabase.from('n8n_chat_histories').insert([{
                session_id: selectedLead.telefone,
                message: JSON.stringify({
                    type: 'system',
                    msgStyle: newState ? 'success' : 'error',
                    content: newState ? `✅ IA ativada por ${firstName} em ${now}` : `⛔ IA pausada por ${firstName} em ${now}`
                })
            }]);
        }
    };

    const handleToggleFollowup = async () => {
        if (!selectedLead) return;
        const newLocked = !selectedLead.followup_locked;

        const { error } = await supabase
            .from('sp3chat')
            .update({ followup_locked: newLocked })
            .eq('id', selectedLead.id);

        if (error) {
            alert('Erro ao atualizar follow-up: ' + error.message);
        } else {
            setSelectedLead({ ...selectedLead, followup_locked: newLocked });
            const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const firstName = authUser.nome.split(' ')[0];
            await supabase.from('n8n_chat_histories').insert([{
                session_id: selectedLead.telefone,
                message: JSON.stringify({
                    type: 'system',
                    msgStyle: newLocked ? 'warning' : 'info',
                    content: newLocked ? `🔒 Follow-up travado por ${firstName} em ${now}` : `🔓 Follow-up desbloqueado por ${firstName} em ${now}`
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
            alert('Erro ao salvar observações: ' + error.message);
        } else {
            setSelectedLead({ ...selectedLead, observacoes: observacoesInput });
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || !selectedLead || isSending) return;
        setIsSending(true);
        const messageToSend = inputValue.trim();
        setInputValue('');
        setShowEmojiPicker(false);

        try {
            const response = await fetch('https://evo.sp3company.shop/message/sendText/v1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': 'AD0E503AFBB6-4337-B1F4-E235C7B0F95D' },
                body: JSON.stringify({ number: selectedLead.telefone, text: messageToSend, delay: 500 })
            });

            if (!response.ok) throw new Error('Erro na Evolution API');

            await supabase
                .from('n8n_chat_histories')
                .insert([{
                    session_id: selectedLead.telefone,
                    message: JSON.stringify({ type: 'ai', content: messageToSend, sender: authUser.nome, sentByCRM: true })
                }]);
        } catch (err: any) {
            setError(`Erro ao enviar: ${err.message}`);
        } finally {
            setIsSending(false);
        }
    };

    // LÓGICA DE ÁUDIO
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
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) {
            alert('Erro ao acessar microfone: ' + err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = null; // Ignora o envio
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            audioChunksRef.current = [];
        }
    };

    const sendAudio = async (blob: Blob) => {
        if (!selectedLead) return;
        setIsSending(true);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];

                const response = await fetch('https://evo.sp3company.shop/message/sendWhatsAppAudio/v1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': 'AD0E503AFBB6-4337-B1F4-E235C7B0F95D' },
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
                            session_id: selectedLead.telefone,
                            message: JSON.stringify({ type: 'ai', content: '🎤 Áudio enviado' })
                        }]);
                }
            };
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

    return (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: '1.5rem', height: 'calc(100vh - 180px)' }}>
            {/* Sidebar de Conversas */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-soft)' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Conversas</h4>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {sortedLeads.map(lead => (
                        <div
                            key={lead.id}
                            onClick={() => setSelectedLead(lead)}
                            style={{
                                padding: '1rem',
                                borderBottom: '1px solid var(--border-soft)',
                                cursor: 'pointer',
                                backgroundColor: selectedLead?.id === lead.id ? 'var(--accent-soft)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center', gap: '12px'
                            }}
                        >
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: selectedLead?.id === lead.id ? 'var(--accent)' : '#f1f5f9', color: selectedLead?.id === lead.id ? 'white' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {(lead.nome || 'L')[0].toUpperCase()}
                            </div>
                            <div style={{ overflow: 'hidden', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.nome || 'Lead s/ nome'}</div>
                                    {!lead.ia_active && <PowerOff size={12} color="#ef4444" />}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{lead.telefone}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Janela de Chat */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#efeae2' }}>
                {selectedLead ? (
                    <>
                        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f2f5', zIndex: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                    {(selectedLead.nome || 'L')[0].toUpperCase()}
                                </div>
                                <div>
                                    <h4 style={{ fontWeight: '700', fontSize: '0.95rem', color: '#111b21' }}>{selectedLead.nome || selectedLead.telefone}</h4>
                                    <span style={{ fontSize: '0.75rem', color: '#667781' }}>{selectedLead.telefone}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', backgroundColor: selectedLead.ia_active ? '#dcfce7' : '#fee2e2', color: selectedLead.ia_active ? '#15803d' : '#b91c1c', fontSize: '0.7rem', fontWeight: '800' }}>
                                    <Bot size={14} /> {selectedLead.ia_active ? 'IA ATIVA' : 'IA PAUSADA'}
                                </div>
                            </div>
                        </div>

                        <div ref={scrollRef} style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundColor: '#efeae2', backgroundBlendMode: 'overlay' }}>
                            {messages.map(msg => (
                                msg.type === 'system' ? (
                                    <div key={msg.id} style={{
                                        alignSelf: 'center',
                                        margin: '8px 0',
                                        padding: '6px 18px',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                        ...(msg.msgStyle === 'error'   ? { backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' } :
                                            msg.msgStyle === 'success' ? { backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' } :
                                            msg.msgStyle === 'warning' ? { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' } :
                                            msg.msgStyle === 'info'    ? { backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' } :
                                                                         { backgroundColor: 'rgba(255,255,255,0.85)', color: '#667781', border: '1px solid rgba(0,0,0,0.05)' })
                                    }}>
                                        {msg.text}
                                    </div>
                                ) : (
                                    <div key={msg.id} style={{ alignSelf: msg.type === 'human' ? 'flex-start' : 'flex-end', maxWidth: '85%', position: 'relative', marginBottom: '4px' }}>
                                        <div style={{ position: 'relative', padding: msg.isImage ? '4px 4px 20px 4px' : '8px 12px 18px 12px', borderRadius: '8px', fontSize: '0.92rem', backgroundColor: msg.type === 'human' ? 'white' : '#dcf8c6', boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)', borderTopLeftRadius: msg.type === 'human' ? '0px' : '8px', borderTopRightRadius: msg.type === 'human' ? '8px' : '0px', whiteSpace: 'pre-wrap' }}>
                                            {msg.isImage ? (
                                                <img
                                                    src={msg.text.trim()}
                                                    alt="imagem"
                                                    style={{ maxWidth: '240px', maxHeight: '300px', borderRadius: '6px', display: 'block' }}
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ) : msg.text}
                                            <span style={{ position: 'absolute', bottom: '2px', right: '6px', fontSize: '0.65rem', color: '#667781' }}>{msg.time}</span>
                                        </div>
                                        {msg.sentByCRM && msg.sender && (
                                            <div style={{ fontSize: '0.62rem', color: '#667781', textAlign: 'right', marginTop: '2px', paddingRight: '4px' }}>
                                                ↩ {msg.sender}
                                            </div>
                                        )}
                                    </div>
                                )
                            ))}
                        </div>

                        <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '8px', backgroundColor: '#f0f2f5', alignItems: 'center', position: 'relative' }}>
                            {showEmojiPicker && (
                                <div style={{ position: 'absolute', bottom: '100%', left: '1rem', zIndex: 1000, boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }}>
                                    <EmojiPicker
                                        theme={Theme.LIGHT}
                                        onEmojiClick={(emojiData) => setInputValue(prev => prev + emojiData.emoji)}
                                        width={320}
                                        height={400}
                                    />
                                </div>
                            )}

                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer', padding: '4px' }}
                            >
                                <Smile size={24} />
                            </button>

                            {isRecording ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', borderRadius: '8px', padding: '8px 16px' }}>
                                    <div className="animate-pulse" style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                    <span style={{ flex: 1, fontSize: '0.9rem', color: '#667781', fontWeight: '500' }}>Gravando... {formatTime(recordingTime)}</span>
                                    <button onClick={cancelRecording} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                        <X size={20} />
                                    </button>
                                    <button onClick={stopRecording} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer' }}>
                                        <StopCircle size={24} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: '4px 12px' }}>
                                        <input
                                            type="text"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                            placeholder="Envie uma mensagem (Intervenção)..."
                                            disabled={isSending}
                                            style={{ width: '100%', padding: '8px 0', border: 'none', outline: 'none', fontSize: '0.95rem' }}
                                        />
                                    </div>

                                    {inputValue.trim() ? (
                                        <button onClick={handleSendMessage} disabled={isSending} style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer' }}>
                                            {isSending ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                                        </button>
                                    ) : (
                                        <button
                                            onTouchStart={startRecording}
                                            onMouseDown={startRecording}
                                            style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <Mic size={24} />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667781' }}>Selecione uma conversa para começar</div>
                )}
            </div>

            {/* Painel lateral */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {selectedLead && (
                    <>
                        <div>
                            <h4 style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Perfil do Lead</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <InfoItem icon={Building2} label="Clínica" value={selectedLead.nome || 'Coletando...'} />
                                <InfoItem icon={MapPin} label="Localização" value={(selectedLead as any).cidade || 'Não informada'} />
                                <InfoItem icon={Phone} label="WhatsApp" value={selectedLead.telefone} />
                                <InfoItem icon={DollarSign} label="Status" value={selectedLead.status || 'Qualificando'} />
                            </div>

                            {/* Etiquetas de Follow-up */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px' }}>
                                {!selectedLead.followup_stage || selectedLead.followup_stage === 0 ? (
                                    <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: '700', border: '1px solid #86efac' }}>
                                        ✓ Sem follow-up pendente
                                    </span>
                                ) : selectedLead.followup_stage === 1 ? (
                                    <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '800', border: '1px solid #fca5a5' }}>
                                        ⏱ 1º Follow-up
                                    </span>
                                ) : selectedLead.followup_stage === 2 ? (
                                    <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#fecaca', color: '#991b1b', fontWeight: '800', border: '1px solid #f87171' }}>
                                        ⏱ 2º Follow-up
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#fca5a5', color: '#7f1d1d', fontWeight: '800', border: '1px solid #ef4444' }}>
                                        🚨 3º Follow-up
                                    </span>
                                )}
                                {selectedLead.followup_locked && (
                                    <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '700', border: '1px solid #fcd34d' }}>
                                        🔒 Follow-up travado
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Observações */}
                        <div>
                            <h4 style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Observações</h4>
                            <textarea
                                value={observacoesInput}
                                onChange={(e) => setObservacoesInput(e.target.value)}
                                placeholder="Anotações sobre este lead (URLs, detalhes coletados, etc.)..."
                                rows={5}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-soft)',
                                    backgroundColor: '#f8fafc',
                                    fontSize: '0.82rem',
                                    lineHeight: '1.5',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <button
                                onClick={handleSaveObservacoes}
                                disabled={isSavingObs}
                                style={{
                                    marginTop: '8px',
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: 'var(--accent)',
                                    color: 'white',
                                    fontWeight: '700',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                {isSavingObs ? <Loader2 size={14} className="animate-spin" /> : '💾 Salvar Observações'}
                            </button>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={handleToggleIA}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    backgroundColor: selectedLead.ia_active ? '#fee2e2' : '#dcfce7',
                                    color: selectedLead.ia_active ? '#b91c1c' : '#15803d',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                {selectedLead.ia_active ? <PowerOff size={18} /> : <Power size={18} />}
                                {selectedLead.ia_active ? 'Pausar Sarah para este Lead' : 'Ativar Sarah para este Lead'}
                            </button>

                            <button
                                onClick={handleToggleFollowup}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    backgroundColor: selectedLead.followup_locked ? '#dcfce7' : '#fef3c7',
                                    color: selectedLead.followup_locked ? '#15803d' : '#92400e',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                {selectedLead.followup_locked ? <Unlock size={18} /> : <Lock size={18} />}
                                {selectedLead.followup_locked ? 'Desbloquear Follow-up' : 'Travar Follow-up'}
                            </button>

                            <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: selectedLead.ia_active ? '#f0fdf4' : '#fff7ed', border: '1px solid ' + (selectedLead.ia_active ? '#dcfce7' : '#ffedd5') }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <Bot size={18} color={selectedLead.ia_active ? '#16a34a' : '#ea580c'} />
                                    <span style={{ fontWeight: '800', fontSize: '0.7rem', color: selectedLead.ia_active ? '#16a34a' : '#ea580c' }}>
                                        {selectedLead.ia_active ? 'Sarah está no comando' : 'Humano no comando'}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: selectedLead.ia_active ? '#15803d' : '#9a3412', lineHeight: '1.5' }}>
                                    {selectedLead.ia_active
                                        ? 'Sarah está extraindo dados. Evite intervir agora para não quebrar o fluxo da IA.'
                                        : 'A IA foi pausada. O cliente está esperando sua resposta manual.'}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatView;
