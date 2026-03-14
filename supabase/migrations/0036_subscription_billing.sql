-- =============================================
-- 0036: Sistema de Assinaturas e Billing (Abacate Pay)
-- =============================================
-- Self-signup com trial de 3 dias (max 20 leads).
-- Bloqueio automático quando trial expira ou leads estouram.
-- Integração com Abacate Pay (PIX + Cartão).

-- ─── TABELA sp3_subscriptions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sp3_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,

  -- Abacate Pay
  abacate_customer_id TEXT,
  abacate_subscription_id TEXT,
  abacate_product_id TEXT,

  -- Plano
  plan_type TEXT NOT NULL DEFAULT 'trial',        -- trial | monthly | annual
  status TEXT NOT NULL DEFAULT 'trialing',         -- trialing | active | past_due | canceled | blocked

  -- Trial
  trial_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  trial_lead_limit INT NOT NULL DEFAULT 20,
  trial_leads_used INT NOT NULL DEFAULT 0,

  -- Notificações de trial (evitar duplicatas)
  trial_notified_24h BOOLEAN NOT NULL DEFAULT false,
  trial_notified_15leads BOOLEAN NOT NULL DEFAULT false,

  -- Período ativo (pós-pagamento)
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  -- Bloqueio
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT,  -- trial_expired | trial_leads_exhausted | payment_failed | canceled

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_company_subscription UNIQUE (company_id)
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON sp3_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON sp3_subscriptions(trial_end) WHERE status = 'trialing';
CREATE INDEX IF NOT EXISTS idx_subscriptions_abacate ON sp3_subscriptions(abacate_customer_id) WHERE abacate_customer_id IS NOT NULL;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE sp3_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp3_subscriptions_isolation" ON sp3_subscriptions
  FOR ALL USING (
    company_id = get_my_company_id() OR is_master_admin()
  );

-- ─── RPC: signup_new_tenant (acessível por anon) ─────────────────────────────

CREATE OR REPLACE FUNCTION signup_new_tenant(
  p_company_name TEXT,
  p_admin_email TEXT,
  p_password TEXT,
  p_phone TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_instance_id UUID;
  v_evo_api_url TEXT;
  v_instance_name TEXT;
BEGIN
  -- Validar inputs
  IF p_company_name IS NULL OR LENGTH(TRIM(p_company_name)) < 2 THEN
    RAISE EXCEPTION 'Nome da empresa deve ter pelo menos 2 caracteres.';
  END IF;

  IF p_admin_email IS NULL OR p_admin_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Email inválido.';
  END IF;

  IF p_password IS NULL OR LENGTH(p_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 6 caracteres.';
  END IF;

  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
    RAISE EXCEPTION 'Email já cadastrado: %', p_admin_email;
  END IF;

  -- Gerar instance_name a partir do nome da empresa
  v_instance_name := LOWER(REGEXP_REPLACE(TRIM(p_company_name), '[^a-zA-Z0-9]', '_', 'g'));
  v_instance_name := LEFT(v_instance_name, 30) || '_' || SUBSTR(gen_random_uuid()::text, 1, 8);

  -- Buscar evo_api_url da instância master
  SELECT i.evo_api_url
  INTO v_evo_api_url
  FROM sp3_instances i
  JOIN sp3_companies c ON i.company_id = c.id
  WHERE c.name = 'SP3 Company - Master' AND i.is_active = true
  LIMIT 1;
  v_evo_api_url := COALESCE(v_evo_api_url, 'https://evo.sp3company.shop');

  -- Buscar instance_id do Supabase
  SELECT au.instance_id INTO v_instance_id FROM auth.users au LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  v_user_id := gen_random_uuid();

  -- Criar auth user (auto-confirmado)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    v_instance_id,
    v_user_id,
    'authenticated',
    'authenticated',
    p_admin_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('phone', COALESCE(p_phone, '')),
    NOW(), NOW(),
    '', '', '', ''
  );

  -- Criar identity record
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', p_admin_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(), NOW(), NOW()
  );

  -- Criar empresa
  INSERT INTO sp3_companies (name, evo_instance_name, active)
  VALUES (p_company_name, v_instance_name, true)
  RETURNING id INTO v_company_id;

  -- Criar perfil admin
  INSERT INTO sp3_users (id, company_id, email, nome, role, permissions)
  VALUES (
    v_user_id, v_company_id, p_admin_email,
    p_company_name, 'master',
    '{"dashboard":true,"chats":true,"kanban":true,"leads":true,"settings":true,"calendar":true}'::jsonb
  );

  -- Criar instância WhatsApp padrão
  INSERT INTO sp3_instances (company_id, instance_name, display_name, is_active, evo_api_url)
  VALUES (v_company_id, v_instance_name, p_company_name || ' - WhatsApp', true, v_evo_api_url);

  -- Criar configuração de follow-up padrão
  INSERT INTO sp3_followup_settings (company_id, start_time, end_time, active_days, interval_1, interval_2, interval_3, msg_1, msg_2, msg_3)
  VALUES (
    v_company_id, '08:00', '18:00', '[1,2,3,4,5]',
    10, 30, 60,
    'Oi! Passando para ver se conseguiu ler minha última mensagem?',
    'Ainda por aí? Se preferir, podemos marcar um papo rápido!',
    'Vi que as coisas devem estar corridas! Vou deixar aqui para quando puder.'
  );

  -- Criar prompt IA padrão
  INSERT INTO sp3_prompts (company_id, content)
  VALUES (
    v_company_id,
    'Você é uma assistente virtual de atendimento da empresa ' || p_company_name || '. ' ||
    'Responda sempre em português brasileiro de forma educada, clara e objetiva. ' ||
    'Mantenha respostas curtas (máximo 3 parágrafos). Não use markdown — apenas texto simples. ' ||
    'Se o cliente pedir para falar com humano, diga que vai transferir para a equipe.'
  );

  -- Criar subscription trial
  INSERT INTO sp3_subscriptions (
    company_id, plan_type, status,
    trial_start, trial_end, trial_lead_limit, trial_leads_used
  ) VALUES (
    v_company_id, 'trial', 'trialing',
    NOW(), NOW() + INTERVAL '3 days', 20, 0
  );

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'user_id', v_user_id,
    'instance_name', v_instance_name,
    'trial_end', (NOW() + INTERVAL '3 days')::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir chamada por usuários não autenticados (signup público)
GRANT EXECUTE ON FUNCTION signup_new_tenant(TEXT, TEXT, TEXT, TEXT) TO anon;

-- ─── RPC: check_subscription_status ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_subscription_status(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT * INTO v_sub FROM sp3_subscriptions WHERE company_id = p_company_id;

  -- Empresas legado (sem subscription) = permitir
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'status', 'legacy',
      'plan_type', 'legacy'
    );
  END IF;

  -- Trial: verificar expiração por tempo
  IF v_sub.status = 'trialing' THEN
    IF NOW() > v_sub.trial_end THEN
      UPDATE sp3_subscriptions
      SET status = 'blocked', blocked_at = NOW(), blocked_reason = 'trial_expired', updated_at = NOW()
      WHERE company_id = p_company_id;

      UPDATE sp3_companies SET active = false WHERE id = p_company_id;

      RETURN jsonb_build_object(
        'allowed', false,
        'status', 'blocked',
        'reason', 'trial_expired',
        'plan_type', 'trial'
      );
    END IF;

    -- Trial: verificar limite de leads
    IF v_sub.trial_leads_used >= v_sub.trial_lead_limit THEN
      UPDATE sp3_subscriptions
      SET status = 'blocked', blocked_at = NOW(), blocked_reason = 'trial_leads_exhausted', updated_at = NOW()
      WHERE company_id = p_company_id;

      UPDATE sp3_companies SET active = false WHERE id = p_company_id;

      RETURN jsonb_build_object(
        'allowed', false,
        'status', 'blocked',
        'reason', 'trial_leads_exhausted',
        'plan_type', 'trial'
      );
    END IF;

    -- Trial ativo
    RETURN jsonb_build_object(
      'allowed', true,
      'status', 'trialing',
      'plan_type', 'trial',
      'trial_end', v_sub.trial_end,
      'trial_leads_used', v_sub.trial_leads_used,
      'trial_lead_limit', v_sub.trial_lead_limit,
      'days_remaining', GREATEST(0, EXTRACT(EPOCH FROM (v_sub.trial_end - NOW())) / 86400)::int
    );
  END IF;

  -- Assinatura ativa
  IF v_sub.status = 'active' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'status', 'active',
      'plan_type', v_sub.plan_type,
      'current_period_end', v_sub.current_period_end
    );
  END IF;

  -- Pagamento pendente (grace period)
  IF v_sub.status = 'past_due' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'status', 'past_due',
      'plan_type', v_sub.plan_type,
      'warning', 'Pagamento pendente. Atualize seu método de pagamento.'
    );
  END IF;

  -- Bloqueado ou cancelado
  RETURN jsonb_build_object(
    'allowed', false,
    'status', v_sub.status,
    'reason', COALESCE(v_sub.blocked_reason, v_sub.status),
    'plan_type', v_sub.plan_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RPC: handle_payment_webhook ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_payment_webhook(
  p_event_type TEXT,
  p_customer_id TEXT DEFAULT NULL,
  p_subscription_id TEXT DEFAULT NULL,
  p_product_id TEXT DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_plan_type TEXT;
BEGIN
  -- Encontrar empresa pelo abacate_customer_id ou company_id
  IF p_company_id IS NOT NULL THEN
    v_company_id := p_company_id;
  ELSIF p_customer_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id
    FROM sp3_subscriptions
    WHERE abacate_customer_id = p_customer_id;
  END IF;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Empresa não encontrada');
  END IF;

  -- Determinar tipo de plano pelo product_id
  v_plan_type := 'monthly'; -- default
  IF p_product_id IS NOT NULL THEN
    SELECT CASE
      WHEN abacate_product_id = p_product_id AND plan_type IN ('annual', 'monthly') THEN plan_type
      ELSE 'monthly'
    END INTO v_plan_type
    FROM sp3_subscriptions
    WHERE company_id = v_company_id;
  END IF;

  CASE p_event_type
    WHEN 'billing.paid' THEN
      UPDATE sp3_subscriptions SET
        status = 'active',
        plan_type = COALESCE(v_plan_type, 'monthly'),
        abacate_subscription_id = COALESCE(p_subscription_id, abacate_subscription_id),
        abacate_product_id = COALESCE(p_product_id, abacate_product_id),
        current_period_start = NOW(),
        current_period_end = CASE
          WHEN v_plan_type = 'annual' THEN NOW() + INTERVAL '1 year'
          ELSE NOW() + INTERVAL '30 days'
        END,
        blocked_at = NULL,
        blocked_reason = NULL,
        updated_at = NOW()
      WHERE company_id = v_company_id;

      UPDATE sp3_companies SET active = true WHERE id = v_company_id;

    WHEN 'subscription.canceled' THEN
      UPDATE sp3_subscriptions SET
        status = 'canceled',
        blocked_at = NOW(),
        blocked_reason = 'canceled',
        updated_at = NOW()
      WHERE company_id = v_company_id;

      UPDATE sp3_companies SET active = false WHERE id = v_company_id;

    WHEN 'billing.failed' THEN
      UPDATE sp3_subscriptions SET
        status = 'past_due',
        updated_at = NOW()
      WHERE company_id = v_company_id;

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Tipo de evento desconhecido: ' || p_event_type);
  END CASE;

  RETURN jsonb_build_object('success', true, 'company_id', v_company_id, 'event', p_event_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── TRIGGER: Contar leads durante trial ─────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_count_trial_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT * INTO v_sub FROM sp3_subscriptions WHERE company_id = NEW.company_id;

  -- Sem subscription ou não é trial → ignorar
  IF v_sub IS NULL OR v_sub.status != 'trialing' THEN
    RETURN NEW;
  END IF;

  -- Incrementar contador
  UPDATE sp3_subscriptions
  SET trial_leads_used = trial_leads_used + 1, updated_at = NOW()
  WHERE company_id = NEW.company_id
  RETURNING * INTO v_sub;

  -- Se ultrapassou o limite → bloquear
  IF v_sub.trial_leads_used > v_sub.trial_lead_limit THEN
    UPDATE sp3_subscriptions
    SET status = 'blocked', blocked_at = NOW(), blocked_reason = 'trial_leads_exhausted', updated_at = NOW()
    WHERE company_id = NEW.company_id;

    UPDATE sp3_companies SET active = false WHERE id = NEW.company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_trial_lead_counter ON sp3chat;
CREATE TRIGGER trg_trial_lead_counter
  AFTER INSERT ON sp3chat
  FOR EACH ROW
  EXECUTE FUNCTION trg_count_trial_lead();
