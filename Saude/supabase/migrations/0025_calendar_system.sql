-- =============================================
-- Migration 0025: Sistema de Agenda e Integração Google Calendar
-- =============================================

-- 1. Tabela de Configurações de Agenda por Empresa
CREATE TABLE IF NOT EXISTS sp3_calendar_settings (
    company_id UUID PRIMARY KEY REFERENCES sp3_companies(id) ON DELETE CASCADE,
    ai_can_schedule BOOLEAN NOT NULL DEFAULT false,
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expiry TIMESTAMPTZ,
    google_calendar_id TEXT,
    default_meeting_duration INT NOT NULL DEFAULT 30,
    business_hours JSONB NOT NULL DEFAULT '{
      "monday": {"active": true, "start": "09:00", "end": "18:00"},
      "tuesday": {"active": true, "start": "09:00", "end": "18:00"},
      "wednesday": {"active": true, "start": "09:00", "end": "18:00"},
      "thursday": {"active": true, "start": "09:00", "end": "18:00"},
      "friday": {"active": true, "start": "09:00", "end": "18:00"},
      "saturday": {"active": false, "start": "09:00", "end": "13:00"},
      "sunday": {"active": false, "start": "09:00", "end": "13:00"}
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Eventos (Espelho da Agenda)
CREATE TABLE IF NOT EXISTS sp3_calendar_events (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
    lead_id BIGINT REFERENCES sp3chat(id) ON DELETE SET NULL,
    google_event_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed', 'no_show')),
    attendees JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE sp3_calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3_calendar_events ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
DROP POLICY IF EXISTS "Isolate sp3_calendar_settings" ON sp3_calendar_settings;
CREATE POLICY "Isolate sp3_calendar_settings" ON sp3_calendar_settings
    FOR ALL USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Isolate sp3_calendar_events" ON sp3_calendar_events;
CREATE POLICY "Isolate sp3_calendar_events" ON sp3_calendar_events
    FOR ALL USING (company_id = get_my_company_id());

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_calendar_events_company
    ON sp3_calendar_events(company_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_lead
    ON sp3_calendar_events(lead_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date
    ON sp3_calendar_events(start_time);

CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id
    ON sp3_calendar_events(google_event_id);

-- 6. Trigger para updated_at (events)
CREATE OR REPLACE FUNCTION sp3_update_calendar_event_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON sp3_calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
    BEFORE UPDATE ON sp3_calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION sp3_update_calendar_event_updated_at();

-- 7. Trigger para updated_at (settings)
CREATE OR REPLACE FUNCTION sp3_update_calendar_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_settings_updated_at ON sp3_calendar_settings;
CREATE TRIGGER trg_calendar_settings_updated_at
    BEFORE UPDATE ON sp3_calendar_settings
    FOR EACH ROW
    EXECUTE FUNCTION sp3_update_calendar_settings_updated_at();

-- 8. Adicionar calendar_settings para empresas existentes
INSERT INTO sp3_calendar_settings (company_id)
SELECT id FROM sp3_companies
ON CONFLICT (company_id) DO NOTHING;

-- 9. Re-escrever o create_new_tenant para englobar criação do calendar settings
CREATE OR REPLACE FUNCTION create_new_tenant(
  p_company_name TEXT,
  p_evo_instance TEXT,
  p_admin_email TEXT,
  p_password TEXT
) RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_instance_id UUID;
  v_is_master TEXT;
  v_evo_api_url TEXT;
  v_evo_api_key TEXT;
BEGIN
  -- Verificar se caller é da SP3 Company - Master
  SELECT c.name INTO v_is_master
  FROM sp3_users u
  JOIN sp3_companies c ON u.company_id = c.id
  WHERE u.id = auth.uid();

  IF v_is_master IS NULL OR v_is_master != 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Apenas o Super Admin (SP3) pode criar novos clientes.';
  END IF;

  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
    RAISE EXCEPTION 'Email já cadastrado: %', p_admin_email;
  END IF;

  -- Buscar evo_api_url e evo_api_key da instância master (SP3) como padrão
  SELECT i.evo_api_url, i.evo_api_key
  INTO v_evo_api_url, v_evo_api_key
  FROM sp3_instances i
  JOIN sp3_companies c ON i.company_id = c.id
  WHERE c.name = 'SP3 Company - Master' AND i.is_active = true
  LIMIT 1;

  -- Fallback se não encontrou
  v_evo_api_url := COALESCE(v_evo_api_url, 'https://evo.sp3company.shop');

  -- Buscar instance_id correto do projeto Supabase
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
    '{}'::jsonb,
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
  INSERT INTO sp3_companies (name, evo_instance_name)
  VALUES (p_company_name, p_evo_instance)
  RETURNING id INTO v_company_id;

  -- Criar perfil admin
  INSERT INTO sp3_users (id, company_id, email, nome, role, permissions)
  VALUES (
    v_user_id, v_company_id, p_admin_email,
    p_company_name, 'master',
    '{"dashboard":true,"chats":true,"kanban":true,"leads":true,"settings":true,"calendar":true}'::jsonb
  );

  -- Criar instância WhatsApp padrão COM evo_api_url
  INSERT INTO sp3_instances (company_id, instance_name, display_name, is_active, evo_api_url)
  VALUES (v_company_id, p_evo_instance, p_company_name || ' - WhatsApp', true, v_evo_api_url);

  -- Criar configuração de follow-up padrão
  INSERT INTO sp3_followup_settings (company_id, start_time, end_time, active_days, interval_1, interval_2, interval_3, msg_1, msg_2, msg_3, use_visual_flows)
  VALUES (
    v_company_id, '08:00', '18:00', '[1,2,3,4,5]',
    10, 30, 60,
    'Oi! Passando para ver se conseguiu ler minha última mensagem?',
    'Ainda por aí? Se preferir, podemos marcar um papo rápido!',
    'Vi que as coisas devem estar corridas! Vou deixar aqui para quando puder.',
    true
  );

  -- Criar configuração de agenda padrão
  INSERT INTO sp3_calendar_settings (company_id)
  VALUES (v_company_id);

  -- Criar fluxos a partir dos templates globais (is_template = true)
  INSERT INTO sp3_flows (
    company_id, name, description, trigger_type, 
    trigger_config, flow_data, is_active, 
    is_template, template_source_id
  )
  SELECT 
    v_company_id,
    name,
    description,
    trigger_type,
    trigger_config,
    flow_data,
    false,
    false,
    id
  FROM sp3_flows
  WHERE is_template = true;

  -- Criar prompt IA padrão para o novo cliente
  INSERT INTO sp3_prompts (company_id, content)
  VALUES (
    v_company_id,
    'Você é uma assistente virtual de atendimento da empresa ' || p_company_name || '. ' ||
    'Responda sempre em português brasileiro de forma educada, clara e objetiva. ' ||
    'Mantenha respostas curtas (máximo 3 parágrafos). Não use markdown — apenas texto simples. ' ||
    'Se o cliente pedir para falar com humano, diga que vai transferir para a equipe.'
  );

  RETURN jsonb_build_object('success', true, 'company_id', v_company_id, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
