-- =============================================
-- 0007: Enhanced SaaS Management RPCs
-- =============================================
-- Fixes:
-- 1. create_new_tenant: agora cria auth user auto-confirmado (sem email verification),
--    sp3_instances e sp3_followup_settings automaticamente
-- 2. toggle_tenant: ativar/desativar empresas
-- 3. update_tenant: editar nome e instância

-- Garantir pgcrypto disponível para hash de senha
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remover versão antiga com assinatura diferente (TEXT, TEXT, UUID, TEXT)
DROP FUNCTION IF EXISTS create_new_tenant(TEXT, TEXT, UUID, TEXT);

-- =============================================
-- 1. create_new_tenant (nova versão completa)
-- =============================================
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

  -- Buscar instance_id correto do projeto Supabase
  SELECT au.instance_id INTO v_instance_id FROM auth.users au LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  v_user_id := gen_random_uuid();

  -- Criar auth user (auto-confirmado, sem necessidade de verificação de email)
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

  -- Criar identity record (obrigatório para login funcionar)
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
    'Admin ' || p_company_name, 'master',
    '{"dashboard":true,"chats":true,"kanban":true,"leads":true,"settings":true}'::jsonb
  );

  -- Criar instância WhatsApp padrão
  INSERT INTO sp3_instances (company_id, instance_name, display_name, is_active)
  VALUES (v_company_id, p_evo_instance, p_company_name || ' - WhatsApp', true);

  -- Criar configuração de follow-up padrão
  INSERT INTO sp3_followup_settings (company_id, start_time, end_time, active_days, interval_1, interval_2, interval_3, msg_1, msg_2, msg_3)
  VALUES (
    v_company_id, '08:00', '18:00', '[1,2,3,4,5]',
    10, 30, 60,
    'Oi! Passando para ver se conseguiu ler minha última mensagem?',
    'Ainda por aí? Se preferir, podemos marcar um papo rápido!',
    'Vi que as coisas devem estar corridas! Vou deixar aqui para quando puder.'
  );

  RETURN jsonb_build_object('success', true, 'company_id', v_company_id, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. toggle_tenant: ativar/desativar empresa
-- =============================================
CREATE OR REPLACE FUNCTION toggle_tenant(
  p_company_id UUID,
  p_active BOOLEAN
) RETURNS JSONB AS $$
DECLARE
  v_is_master TEXT;
BEGIN
  SELECT c.name INTO v_is_master
  FROM sp3_users u
  JOIN sp3_companies c ON u.company_id = c.id
  WHERE u.id = auth.uid();

  IF v_is_master IS NULL OR v_is_master != 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Apenas o Super Admin pode ativar/desativar clientes.';
  END IF;

  UPDATE sp3_companies SET active = p_active WHERE id = p_company_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. update_tenant: editar nome/instância
-- =============================================
CREATE OR REPLACE FUNCTION update_tenant(
  p_company_id UUID,
  p_company_name TEXT DEFAULT NULL,
  p_evo_instance TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_is_master TEXT;
BEGIN
  SELECT c.name INTO v_is_master
  FROM sp3_users u
  JOIN sp3_companies c ON u.company_id = c.id
  WHERE u.id = auth.uid();

  IF v_is_master IS NULL OR v_is_master != 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Apenas o Super Admin pode editar clientes.';
  END IF;

  UPDATE sp3_companies SET
    name = COALESCE(p_company_name, name),
    evo_instance_name = COALESCE(p_evo_instance, evo_instance_name)
  WHERE id = p_company_id;

  -- Atualizar também em sp3_instances se instância mudou
  IF p_evo_instance IS NOT NULL THEN
    UPDATE sp3_instances SET
      instance_name = p_evo_instance,
      display_name = COALESCE(p_company_name, (SELECT name FROM sp3_companies WHERE id = p_company_id)) || ' - WhatsApp'
    WHERE company_id = p_company_id AND is_active = true;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
