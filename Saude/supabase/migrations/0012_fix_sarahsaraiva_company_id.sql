-- Migration: Corrigir company_id dos leads e mensagens que foram criados
-- com o company_id do master (v1) antes da instância SarahSaraiva existir.
--
-- Problema: Antes do tenant SarahSaraiva ser criado, as mensagens do WhatsApp
-- passavam pela instância "v1" (master), então os leads e mensagens foram salvos
-- com company_id do master. Quando a cliente faz login, RLS filtra por seu
-- company_id real e ela vê "0 leads".
--
-- Esta migration move os dados para o company_id correto baseado na instância.

DO $$
DECLARE
  v_master_company_id UUID;
  v_sarah_company_id UUID;
  v_updated_leads INT;
  v_updated_messages INT;
BEGIN
  -- Buscar company_id do master (SP3 Company - Master)
  SELECT id INTO v_master_company_id FROM sp3_companies WHERE name = 'SP3 Company - Master' LIMIT 1;

  -- Buscar company_id da SarahSaraiva (pela instância)
  SELECT company_id INTO v_sarah_company_id FROM sp3_instances WHERE instance_name = 'SarahSaraiva' LIMIT 1;

  IF v_sarah_company_id IS NULL THEN
    RAISE NOTICE 'Instância SarahSaraiva não encontrada. Pulando migration.';
    RETURN;
  END IF;

  IF v_master_company_id = v_sarah_company_id THEN
    RAISE NOTICE 'company_ids são iguais. Nada a corrigir.';
    RETURN;
  END IF;

  -- Listar telefones dos leads que pertencem à SarahSaraiva mas estão no master
  -- Critério: leads no master que têm mensagens salvas com o company_id da SarahSaraiva
  -- OU leads cujos telefones receberam mensagens pela instância SarahSaraiva

  -- 1. Corrigir leads no sp3chat
  UPDATE sp3chat
  SET company_id = v_sarah_company_id
  WHERE company_id = v_master_company_id
  AND telefone IN (
    -- Telefones que têm mensagens com o company_id da SarahSaraiva
    SELECT DISTINCT session_id FROM n8n_chat_histories
    WHERE company_id = v_sarah_company_id
  );
  GET DIAGNOSTICS v_updated_leads = ROW_COUNT;

  -- 2. Corrigir mensagens no n8n_chat_histories
  UPDATE n8n_chat_histories
  SET company_id = v_sarah_company_id
  WHERE company_id = v_master_company_id
  AND session_id IN (
    -- Telefones que já têm leads com o company_id correto da SarahSaraiva
    SELECT DISTINCT telefone FROM sp3chat
    WHERE company_id = v_sarah_company_id
  );
  GET DIAGNOSTICS v_updated_messages = ROW_COUNT;

  RAISE NOTICE 'Migração SarahSaraiva: % leads e % mensagens corrigidos.',
    v_updated_leads, v_updated_messages;
END $$;
