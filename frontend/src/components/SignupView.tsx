import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle } from 'lucide-react';

const SignupView = ({ onBackToLogin }: { onBackToLogin: () => void }) => {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !email.trim() || !password.trim()) return;

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc('signup_new_tenant', {
        p_company_name: companyName.trim(),
        p_admin_email: email.trim().toLowerCase(),
        p_password: password,
        p_phone: phone.replace(/\D/g, '') || null
      });

      if (rpcError) {
        const msg = rpcError.message;
        if (msg.includes('já cadastrado') || msg.includes('already')) {
          setError('Este email já está cadastrado. Tente fazer login.');
        } else {
          setError(msg);
        }
        setLoading(false);
        return;
      }

      // Auto-login
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (loginError) {
        setSuccess(true);
        setLoading(false);
        return;
      }
      // Se login OK, App.tsx onAuthStateChange redireciona automaticamente
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
    }
    setLoading(false);
  };

  if (success) {
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
          textAlign: 'center'
        }}>
          <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
            Conta criada!
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Sua conta foi criada com sucesso. Faça login para acessar.
          </p>
          <button
            onClick={onBackToLogin}
            style={{
              padding: '12px 32px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'var(--accent)',
              color: 'white',
              fontWeight: '700',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}
          >
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  const isValid = companyName.trim().length >= 2 && email.trim() && password.length >= 6;

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
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div style={{ padding: '4px', background: 'var(--accent-soft)', borderRadius: '12px' }}>
              <img
                src="/favicon.png"
                alt="Saude IA"
                style={{ height: '52px', width: '52px', objectFit: 'contain', borderRadius: '12px' }}
              />
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0f172a', margin: 0, lineHeight: 1 }}>
              Saude IA
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
            Crie sua conta e comece agora
          </p>
        </div>

        {/* Badge trial */}
        <div style={{
          background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
          border: '1px solid #6ee7b740',
          borderRadius: '12px',
          padding: '10px 16px',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#065f46' }}>
            3 dias gratis - ate 20 leads para testar
          </span>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nome da Empresa
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Minha Empresa"
              disabled={loading}
              style={inputStyle(loading, !!error)}
              onFocus={(e) => { if (!error) e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
            />
          </div>

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
              style={inputStyle(loading, !!error)}
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
              placeholder="Minimo 6 caracteres"
              autoComplete="new-password"
              disabled={loading}
              style={inputStyle(loading, !!error)}
              onFocus={(e) => { if (!error) e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              WhatsApp <span style={{ fontWeight: '400', textTransform: 'none', color: '#94a3b8' }}>(opcional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              disabled={loading}
              style={inputStyle(loading, false)}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
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
            disabled={loading || !isValid}
            style={{
              marginTop: '0.25rem',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: (loading || !isValid) ? '#93c5fd' : 'var(--accent)',
              color: 'white',
              fontWeight: '700',
              fontSize: '0.95rem',
              cursor: (loading || !isValid) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Criando conta...</>
            ) : (
              'Criar Conta Gratis'
            )}
          </button>
        </form>

        <p
          onClick={onBackToLogin}
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            fontSize: '0.85rem',
            color: 'var(--accent)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Ja tem conta? Fazer login
        </p>

        <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.65rem', color: '#cbd5e1', fontWeight: '600' }}>
          Saude IA v1.0
        </p>
      </div>
    </div>
  );
};

const inputStyle = (loading: boolean, hasError: boolean): React.CSSProperties => ({
  padding: '12px 16px',
  borderRadius: '12px',
  border: hasError ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0',
  fontSize: '0.95rem',
  outline: 'none',
  transition: 'border-color 0.2s',
  backgroundColor: loading ? '#f8fafc' : 'white'
});

export default SignupView;
