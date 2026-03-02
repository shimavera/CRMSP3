import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

const LoginView = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
            setError('Email ou senha incorretos. Verifique seus dados.');
        }
        setLoading(false);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #001A4D 0%, #003399 50%, #0052CC 100%)',
            padding: '2rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: 'white',
                borderRadius: '24px',
                padding: '3rem 2.5rem',
                boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.05)'
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div className="logo-container" style={{ marginBottom: '1rem' }}>
                        <div className="logo-icon-wrapper">
                            <img
                                src="/favicon.png"
                                alt="SP3 Symbol"
                                style={{ height: '52px', width: '52px', objectFit: 'contain', borderRadius: '12px' }}
                            />
                        </div>
                        <span className="logo-text" style={{ fontSize: '3.25rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1 }}>
                            SP3
                        </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
                        Faça login para acessar o painel
                    </p>
                </div>

                {/* Formulário */}
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            autoComplete="email"
                            disabled={loading}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: error ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0',
                                fontSize: '0.95rem',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                backgroundColor: loading ? '#f8fafc' : 'white'
                            }}
                            onFocus={(e) => { if (!error) e.target.style.borderColor = 'var(--accent)'; }}
                            onBlur={(e) => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Senha
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            disabled={loading}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: error ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0',
                                fontSize: '0.95rem',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                backgroundColor: loading ? '#f8fafc' : 'white'
                            }}
                            onFocus={(e) => { if (!error) e.target.style.borderColor = 'var(--accent)'; }}
                            onBlur={(e) => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fee2e2',
                            color: '#b91c1c',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !email.trim() || !password.trim()}
                        style={{
                            marginTop: '0.5rem',
                            padding: '14px',
                            borderRadius: '12px',
                            border: 'none',
                            backgroundColor: (loading || !email.trim() || !password.trim()) ? '#93c5fd' : 'var(--accent)',
                            color: 'white',
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            cursor: (loading || !email.trim() || !password.trim()) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        {loading ? (
                            <><Loader2 size={18} className="animate-spin" /> Entrando...</>
                        ) : (
                            'Entrar'
                        )}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Acesso restrito a usuários autorizados
                </p>
                <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.65rem', color: '#cbd5e1', fontWeight: '600' }}>
                    V17 - 01/03 - 21:53
                </p>
            </div>
        </div>
    );
};

export default LoginView;
