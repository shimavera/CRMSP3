import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Smartphone, RefreshCw, CheckCircle, XCircle, Loader2, QrCode, History } from 'lucide-react';
import { supabase } from "../lib/supabase";

const EVO_URL = 'https://evo.sp3company.shop';
const EVO_KEY = 'AD0E503AFBB6-4337-B1F4-E235C7B0F95D';
const INSTANCE_NAME = 'v1';

const SettingsView = () => {
    const [status, setStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'whatsapp' | 'ia' | 'followup' | 'profile'>('whatsapp');

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
        interval_3: 60
    });
    const [isSavingFollowup, setIsSavingFollowup] = useState(false);
    const [followupSuccess, setFollowupSuccess] = useState(false);

    const fetchFollowupConfig = async () => {
        try {
            const { data, error } = await supabase
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
                    interval_3: data.interval_3 || 60
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
        } catch (err) {
            console.error('Erro ao salvar follow-up:', err);
            alert('Erro ao salvar. Verifique se a tabela sp3_followup_settings existe no banco.');
        } finally {
            setIsSavingFollowup(false);
        }
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

    const checkStatus = async () => {
        setStatus('loading');
        try {
            const response = await fetch(`${EVO_URL}/instance/connectionStatus/${INSTANCE_NAME}`, {
                headers: { 'apikey': EVO_KEY }
            });

            if (!response.ok) {
                setStatus('disconnected');
                return;
            }

            const data = await response.json();
            const state = data?.instance?.state ?? data?.state ?? null;

            if (state === 'open') {
                setStatus('connected');
                setQrCode(null);
            } else {
                setStatus('disconnected');
            }
        } catch (err) {
            console.error('Erro ao buscar status:', err);
            setStatus('disconnected');
        }
    };

    const getQrCode = async () => {
        setIsRefreshing(true);
        try {
            const response = await fetch(`${EVO_URL}/instance/connect/${INSTANCE_NAME}`, {
                headers: { 'apikey': EVO_KEY }
            });
            const data = await response.json();

            if (data.base64) {
                setQrCode(data.base64);
                setStatus('disconnected');
            }
        } catch (err) {
            console.error('Erro ao buscar QR Code:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleLogout = async () => {
        if (!window.confirm('Deseja realmente desconectar o WhatsApp?')) return;

        try {
            await fetch(`${EVO_URL}/instance/logout/${INSTANCE_NAME}`, {
                method: 'DELETE',
                headers: { 'apikey': EVO_KEY }
            });
            checkStatus();
        } catch (err) {
            console.error('Erro ao deslogar:', err);
        }
    };

    useEffect(() => {
        checkStatus();
        fetchPromptHistory();
        fetchFollowupConfig();
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
                        onClick={() => setActiveSubTab('profile')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeSubTab === 'profile' ? 'var(--accent-soft)' : 'transparent', color: activeSubTab === 'profile' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeSubTab === 'profile' ? '600' : '500', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Shield size={18} /> Perfil
                    </button>
                </div>
            </div>

            {/* Conteúdo Principal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {activeSubTab === 'whatsapp' && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Conexão WhatsApp</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gerencie a instância da Evolution API conectada ao seu WhatsApp.</p>
                            </div>
                            <button
                                onClick={checkStatus}
                                style={{ padding: '8px', borderRadius: '50%', border: '1px solid var(--border-soft)', background: 'white', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            >
                                <RefreshCw size={18} className={status === 'loading' ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: status === 'connected' ? '#ecfdf5' : '#fff1f2', color: status === 'connected' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {status === 'connected' ? <CheckCircle size={28} /> : <XCircle size={28} />}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: '800', fontSize: '1rem' }}>Sessão: {INSTANCE_NAME}</span>
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

                        {/* QR Code */}
                        {qrCode && status === 'disconnected' && (
                            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderRadius: '16px', background: '#f8fafc', border: '1px dashed var(--border-soft)' }}>
                                <p style={{ fontWeight: '700', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Escaneie o QR Code com o WhatsApp</p>
                                <img src={qrCode} alt="QR Code WhatsApp" style={{ width: '200px', height: '200px', borderRadius: '12px' }} />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>O código expira em 60 segundos</p>
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

                {activeSubTab === 'profile' && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem' }}>Perfil da conta</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome de Exibição</label>
                                <input type="text" readOnly value="Juan Lourenço" style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: '#f8fafc', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cargo</label>
                                <input type="text" readOnly value="Administrador" style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-soft)', background: '#f8fafc', outline: 'none' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsView;
