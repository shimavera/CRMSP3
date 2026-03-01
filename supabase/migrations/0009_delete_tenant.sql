-- =============================================
-- 0009: Excluir tenant e todos os dados associados
-- =============================================
-- Remove empresa, usuários, leads, histórico de chat,
-- configurações, prompts, vídeos, mensagens rápidas e instâncias.
-- Libera espaço no banco de dados.

CREATE OR REPLACE FUNCTION delete_tenant(
  p_company_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_is_master TEXT;
  v_company_name TEXT;
  v_user_ids UUID[];
BEGIN
  -- Verificar se caller é da SP3 Company - Master
  SELECT c.name INTO v_is_master
  FROM sp3_users u
  JOIN sp3_companies c ON u.company_id = c.id
  WHERE u.id = auth.uid();

  IF v_is_master IS NULL OR v_is_master != 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Apenas o Super Admin (SP3) pode excluir clientes.';
  END IF;

  -- Buscar nome da empresa (para retorno)
  SELECT name INTO v_company_name FROM sp3_companies WHERE id = p_company_id;

  IF v_company_name IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada: %', p_company_id;
  END IF;

  -- Impedir exclusão da própria empresa Master
  IF v_company_name = 'SP3 Company - Master' THEN
    RAISE EXCEPTION 'Não é possível excluir a empresa Master.';
  END IF;

  -- Coletar IDs dos usuários para excluir do auth.users
  SELECT ARRAY_AGG(id) INTO v_user_ids
  FROM sp3_users
  WHERE company_id = p_company_id;

  -- 1. Excluir histórico de chat
  DELETE FROM n8n_chat_histories WHERE company_id = p_company_id;

  -- 2. Excluir leads/chats
  DELETE FROM sp3chat WHERE company_id = p_company_id;

  -- 3. Excluir configurações de follow-up
  DELETE FROM sp3_followup_settings WHERE company_id = p_company_id;

  -- 4. Excluir prompts
  DELETE FROM sp3_prompts WHERE company_id = p_company_id;

  -- 5. Excluir vídeos de prova social
  DELETE FROM sp3_social_proof_videos WHERE company_id = p_company_id;

  -- 6. Excluir mensagens rápidas
  DELETE FROM sp3_quick_messages WHERE company_id = p_company_id;

  -- 7. Excluir instâncias WhatsApp
  DELETE FROM sp3_instances WHERE company_id = p_company_id;

  -- 8. Excluir usuários da tabela sp3_users
  DELETE FROM sp3_users WHERE company_id = p_company_id;

  -- 9. Excluir auth.identities e auth.users
  IF v_user_ids IS NOT NULL THEN
    DELETE FROM auth.identities WHERE user_id = ANY(v_user_ids);
    DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  END IF;

  -- 10. Excluir a empresa
  DELETE FROM sp3_companies WHERE id = p_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_company', v_company_name,
    'deleted_users', COALESCE(array_length(v_user_ids, 1), 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
