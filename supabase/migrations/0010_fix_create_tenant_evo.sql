-- =============================================
-- 0010: Fix create_new_tenant — preencher evo_api_url e configurar webhook
-- =============================================
-- Problema: create_new_tenant não preenchia evo_api_url nem evo_api_key,
-- fazendo com que o n8n não conseguisse enviar mensagens para novos clientes.

-- Remover versão anterior
DROP FUNCTION IF EXISTS create_new_tenant(TEXT, TEXT, TEXT, TEXT);

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
    '{"dashboard":true,"chats":true,"kanban":true,"leads":true,"settings":true}'::jsonb
  );

  -- Criar instância WhatsApp padrão COM evo_api_url
  INSERT INTO sp3_instances (company_id, instance_name, display_name, is_active, evo_api_url)
  VALUES (v_company_id, p_evo_instance, p_company_name || ' - WhatsApp', true, v_evo_api_url);

  -- Criar configuração de follow-up padrão
  INSERT INTO sp3_followup_settings (company_id, start_time, end_time, active_days, interval_1, interval_2, interval_3, msg_1, msg_2, msg_3)
  VALUES (
    v_company_id, '08:00', '18:00', '[1,2,3,4,5]',
    10, 30, 60,
    'Oi! Passando para ver se conseguiu ler minha última mensagem?',
    'Ainda por aí? Se preferir, podemos marcar um papo rápido!',
    'Vi que as coisas devem estar corridas! Vou deixar aqui para quando puder.'
  );

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

-- =============================================
-- RPC para Super Admin atualizar evo_api_key/url de qualquer instância
-- Necessário porque o RLS impede o Super Admin de editar instâncias de outros clientes
-- =============================================
CREATE OR REPLACE FUNCTION update_instance_evo_credentials(
  p_instance_name TEXT,
  p_evo_api_url TEXT DEFAULT NULL,
  p_evo_api_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_is_master TEXT;
  v_updated INT;
BEGIN
  -- Verificar se caller é da SP3 Company - Master
  SELECT c.name INTO v_is_master
  FROM sp3_users u
  JOIN sp3_companies c ON u.company_id = c.id
  WHERE u.id = auth.uid();

  IF v_is_master IS NULL OR v_is_master != 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Apenas o Super Admin pode atualizar credenciais de instâncias.';
  END IF;

  UPDATE sp3_instances SET
    evo_api_url = COALESCE(p_evo_api_url, evo_api_url),
    evo_api_key = COALESCE(p_evo_api_key, evo_api_key)
  WHERE instance_name = p_instance_name;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'updated', v_updated);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
