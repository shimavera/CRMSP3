import { useState } from 'react';
import { Loader2, Lock, AlertTriangle, CreditCard } from 'lucide-react';
import type { SubscriptionStatus } from '../lib/supabase';

const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_BASE || 'https://n8n-webhook.sp3company.shop';

type Props = {
  subscriptionStatus: SubscriptionStatus;
  companyId: string;
  email: string;
  companyName: string;
  onLogout: () => void;
};

const BlockedView = ({ subscriptionStatus, companyId, email, companyName, onLogout }: Props) => {
  const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null);
  const [coupon, setCoupon] = useState('');
  const [taxId, setTaxId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reason = subscriptionStatus.reason || subscriptionStatus.status;

  const getMessage = () => {
    switch (reason) {
      case 'trial_expired':
        return {
          icon: <AlertTriangle size={48} color="#f59e0b" />,
          title: 'Seu periodo de teste terminou',
          subtitle: 'Seus 3 dias de teste gratis acabaram. Assine um plano para continuar usando o Saude IA.'
        };
      case 'trial_leads_exhausted':
        return {
          icon: <Lock size={48} color="#ef4444" />,
          title: 'Limite de leads atingido',
          subtitle: 'Voce usou todos os 20 leads do periodo de teste. Assine para leads ilimitados.'
        };
      case 'payment_failed':
        return {
          icon: <CreditCard size={48} color="#ef4444" />,
          title: 'Problema com o pagamento',
          subtitle: 'Nao conseguimos processar seu pagamento. Atualize seus dados para continuar.'
        };
      case 'canceled':
        return {
          icon: <AlertTriangle size={48} color="#6b7280" />,
          title: 'Assinatura cancelada',
          subtitle: 'Sua assinatura foi cancelada. Assine novamente para reativar.'
        };
      default:
        return {
          icon: <Lock size={48} color="#ef4444" />,
          title: 'Acesso bloqueado',
          subtitle: 'Assine um plano para continuar usando o Saude IA.'
        };
    }
  };

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    const cleanTaxId = taxId.replace(/\D/g, '');
    if (!cleanTaxId || (cleanTaxId.length !== 11 && cleanTaxId.length !== 14)) {
      setError('Informe um CPF (11 digitos) ou CNPJ (14 digitos) valido.');
      return;
    }

    setLoading(plan);
    setError(null);

    try {
      const response = await fetch(`${N8N_WEBHOOK_BASE}/webhook/create-subscription-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          email,
          company_name: companyName,
          plan,
          coupon: coupon.trim() || undefined,
          taxId: cleanTaxId
        })
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Erro ao criar checkout. Tente novamente.');
        setLoading(null);
      }
    } catch (err: any) {
      setError('Erro de conexao. Tente novamente.');
      setLoading(null);
    }
  };

  const msg = getMessage();

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
        maxWidth: '480px',
        background: 'white',
        borderRadius: '24px',
        padding: '3rem 2.5rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>{msg.icon}</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
            {msg.title}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
            {msg.subtitle}
          </p>
        </div>

        {/* Planos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
          {/* Mensal */}
          <button
            onClick={() => handleSubscribe('monthly')}
            disabled={!!loading}
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              border: '2px solid #e2e8f0',
              background: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s',
              opacity: loading && loading !== 'monthly' ? 0.5 : 1
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem' }}>Plano Mensal</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Leads ilimitados</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {loading === 'monthly' ? (
                <Loader2 size={20} className="animate-spin" color="var(--accent)" />
              ) : (
                <>
                  <div style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '1.2rem' }}>R$ 297</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>/mes</div>
                </>
              )}
            </div>
          </button>

          {/* Anual */}
          <button
            onClick={() => handleSubscribe('annual')}
            disabled={!!loading}
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              border: '2px solid #10b981',
              background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s',
              opacity: loading && loading !== 'annual' ? 0.5 : 1,
              position: 'relative'
            }}
          >
            {/* Badge economia */}
            <div style={{
              position: 'absolute',
              top: '-10px',
              right: '16px',
              background: '#10b981',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: '700',
              padding: '3px 10px',
              borderRadius: '20px'
            }}>
              ECONOMIZE 17%
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '700', color: '#065f46', fontSize: '1rem' }}>Plano Anual</div>
              <div style={{ color: '#047857', fontSize: '0.8rem' }}>Leads ilimitados</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {loading === 'annual' ? (
                <Loader2 size={20} className="animate-spin" color="#10b981" />
              ) : (
                <>
                  <div style={{ fontWeight: '800', color: '#065f46', fontSize: '1.2rem' }}>R$ 2.970</div>
                  <div style={{ color: '#047857', fontSize: '0.75rem' }}>/ano</div>
                </>
              )}
            </div>
          </button>
        </div>

        {/* CPF/CNPJ */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>
            CPF ou CNPJ
          </label>
          <input
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value.replace(/[^\d.-/]/g, ''))}
            placeholder="000.000.000-00"
            disabled={!!loading}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Cupom */}
        <div style={{ marginBottom: '1.5rem' }}>
          <input
            type="text"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            placeholder="Cupom de desconto (opcional)"
            disabled={!!loading}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              fontSize: '0.85rem',
              outline: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxSizing: 'border-box'
            }}
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
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {/* Info pagamento */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#94a3b8',
          marginBottom: '1rem'
        }}>
          Pagamento seguro via PIX ou cartao de credito
        </p>

        {/* Logout */}
        <p
          onClick={onLogout}
          style={{
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--accent)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Sair da conta
        </p>
      </div>
    </div>
  );
};

export default BlockedView;
