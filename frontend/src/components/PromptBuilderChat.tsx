import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, X, Loader2, Bot, CheckCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
    timestamp: string;
}

interface PromptBuilderChatProps {
    companyId: string;
    currentPrompt: string;
    onSavePrompt: (content: string) => Promise<void>;
}

const WEBHOOK_URL = `${import.meta.env.VITE_N8N_WEBHOOK_BASE}/webhook/prompt-builder`;

// Clean --- delimited blocks and [PROMPT_FINAL] markers from message content
function cleanMessageContent(content: string): string {
    return content
        .replace(/\[PROMPT_FINAL\][\s\S]*?\[\/PROMPT_FINAL\]/g, '')
        .replace(/\[PROMPT_FINAL\][\s\S]*/g, '')
        .replace(/\[\/PROMPT_FINAL\]/g, '')
        .replace(/---[\s\S]*?---/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export default function PromptBuilderChat({ companyId, currentPrompt, onSavePrompt }: PromptBuilderChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const storageKey = `sp3_prompt_builder_chat_${companyId}`;

    // Load saved conversation from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                    return;
                }
            } catch { /* ignore */ }
        }
        // No saved conversation — show greeting
        const greeting = currentPrompt.trim()
            ? 'Olá! Seu prompt está ativo e funcionando. O que você gostaria de ajustar? Pode me descrever a mudança desejada ou enviar um print de uma conversa que não ficou boa.'
            : 'Olá! Vou te ajudar a criar o prompt personalizado da sua IA de atendimento. Vamos começar: **qual o nome da sua empresa ou clínica?**';
        setMessages([{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }]);
    }, []);

    // Save conversation to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(messages));
        }
    }, [messages, storageKey]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async () => {
        if ((!inputValue.trim() && !imageFile) || isLoading) return;

        let imageUrl: string | undefined;

        // Upload image if present
        if (imageFile) {
            const ext = imageFile.name.split('.').pop() || 'png';
            const fileName = `${companyId}/${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('prompt-builder-images')
                .upload(fileName, imageFile, { contentType: imageFile.type });
            if (!uploadError) {
                const { data: urlData } = supabase.storage
                    .from('prompt-builder-images')
                    .getPublicUrl(fileName);
                imageUrl = urlData.publicUrl;
            }
        }

        // Add user message
        const userMsg: ChatMessage = {
            role: 'user',
            content: inputValue.trim(),
            imageUrl,
            timestamp: new Date().toISOString(),
        };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInputValue('');
        setImageFile(null);
        setImagePreview(null);
        setIsLoading(true);

        // Build API messages
        let apiMessages = updatedMessages.map(msg => {
            if (msg.role === 'user' && msg.imageUrl) {
                return {
                    role: 'user' as const,
                    content: [
                        { type: 'text' as const, text: msg.content || 'Analise esta imagem:' },
                        { type: 'image_url' as const, image_url: { url: msg.imageUrl } },
                    ],
                };
            }
            return { role: msg.role, content: msg.content };
        });

        // Trim to 20 messages max
        if (apiMessages.length > 20) {
            apiMessages = [...apiMessages.slice(0, 2), ...apiMessages.slice(-18)];
        }

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages, currentPrompt, companyId }),
            });
            const data = await response.json();
            const aiReply = data.reply || 'Desculpe, ocorreu um erro ao processar. Tente novamente.';

            // Check for [PROMPT_FINAL] markers
            const promptMatch = aiReply.match(/\[PROMPT_FINAL\]([\s\S]*?)\[\/PROMPT_FINAL\]/);
            if (promptMatch) {
                setPendingPrompt(promptMatch[1].trim());
            }

            // Display reply without markers and clean up --- delimited blocks (prompt snippets)
            const displayReply = aiReply
                .replace(/\[PROMPT_FINAL\][\s\S]*?\[\/PROMPT_FINAL\]/, '')
                .replace(/---[\s\S]*?---/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: displayReply || 'Prompt pronto! Clique em "Salvar Prompt" abaixo para ativar.',
                timestamp: new Date().toISOString(),
            }]);
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Desculpe, houve um erro de conexão. Tente novamente em alguns segundos.',
                timestamp: new Date().toISOString(),
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSavePrompt = async () => {
        if (!pendingPrompt || isSaving) return;
        setIsSaving(true);
        try {
            await onSavePrompt(pendingPrompt);
            setPendingPrompt(null);
            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Prompt atualizado com sucesso! Você pode continuar ajustando aqui se precisar.',
                    timestamp: new Date().toISOString(),
                }]);
            }, 1500);
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Erro ao salvar o prompt. Tente novamente.',
                timestamp: new Date().toISOString(),
            }]);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    return (
        <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <Bot size={20} style={{ color: 'var(--accent)' }} />
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>Assistente de Prompt</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Converse para criar ou ajustar o prompt da sua IA</p>
                </div>
                <button
                    onClick={() => {
                        if (confirm('Limpar conversa? O histórico será apagado.')) {
                            localStorage.removeItem(storageKey);
                            setPendingPrompt(null);
                            const greeting = currentPrompt.trim()
                                ? 'Olá! Seu prompt está ativo e funcionando. O que você gostaria de ajustar? Pode me descrever a mudança desejada ou enviar um print de uma conversa que não ficou boa.'
                                : 'Olá! Vou te ajudar a criar o prompt personalizado da sua IA de atendimento. Vamos começar: **qual o nome da sua empresa ou clínica?**';
                            setMessages([{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }]);
                        }
                    }}
                    title="Limpar conversa"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px', color: 'var(--text-muted)', flexShrink: 0 }}
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                            maxWidth: '80%',
                            padding: '10px 14px',
                            borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
                            color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                            fontSize: '0.88rem',
                            lineHeight: '1.5',
                            wordBreak: 'break-word',
                        }}>
                            {msg.imageUrl && (
                                <img
                                    src={msg.imageUrl}
                                    alt="Screenshot"
                                    style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px', maxHeight: '200px', objectFit: 'contain' }}
                                />
                            )}
                            {(msg.role === 'assistant' ? cleanMessageContent(msg.content) : msg.content).split('\n').map((line, j) => (
                                <span key={j}>
                                    {line.split(/(\*\*.*?\*\*)/).map((part, k) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={k}>{part.slice(2, -2)}</strong>;
                                        }
                                        return part;
                                    })}
                                    {j < msg.content.split('\n').length - 1 && <br />}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pensando...</span>
                        </div>
                    </div>
                )}

                {saveSuccess && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ padding: '10px 20px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle size={16} style={{ color: '#10b981' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#10b981' }}>Prompt salvo com sucesso!</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Pending prompt banner */}
            {pendingPrompt && (
                <div style={{
                    padding: '12px 20px',
                    background: 'rgba(99,102,241,0.08)',
                    borderTop: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexShrink: 0,
                }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: '600' }}>
                        Prompt pronto para salvar!
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setPendingPrompt(null)}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-soft)', background: 'transparent', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                            Descartar
                        </button>
                        <button
                            onClick={handleSavePrompt}
                            disabled={isSaving}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--accent)',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            Salvar Prompt
                        </button>
                    </div>
                </div>
            )}

            {/* Image preview */}
            {imagePreview && (
                <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <img src={imagePreview} alt="Preview" style={{ height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1 }}>{imageFile?.name}</span>
                    <button
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Input area */}
            <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-soft)',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '8px',
                flexShrink: 0,
            }}>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        color: imageFile ? 'var(--accent)' : 'var(--text-muted)',
                        borderRadius: '8px',
                        flexShrink: 0,
                    }}
                    title="Anexar screenshot"
                >
                    <Paperclip size={18} />
                </button>
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    disabled={isLoading}
                    rows={1}
                    style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-soft)',
                        backgroundColor: 'var(--bg-tertiary)',
                        fontSize: '0.88rem',
                        resize: 'none',
                        fontFamily: 'inherit',
                        outline: 'none',
                        maxHeight: '120px',
                        overflowY: 'auto',
                        lineHeight: '1.4',
                    }}
                    onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || (!inputValue.trim() && !imageFile)}
                    style={{
                        background: inputValue.trim() || imageFile ? 'var(--accent)' : 'var(--bg-tertiary)',
                        border: 'none',
                        cursor: inputValue.trim() || imageFile ? 'pointer' : 'default',
                        padding: '8px',
                        borderRadius: '10px',
                        color: inputValue.trim() || imageFile ? 'white' : 'var(--text-muted)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}
