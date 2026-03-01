-- Migration: Corrigir separação de históricos quando o mesmo telefone
-- contatou múltiplas instâncias (ex: v1 master E SarahSaraiva).
--
-- A migration 0012 moveu TUDO para SarahSaraiva, mas as mensagens antigas
-- que passaram pela instância "v1" (master) devem permanecer no master.
--
-- Regra: Cada empresa mantém apenas as mensagens da SUA instância.
-- Se o mesmo telefone contatou ambas, cada uma tem seu próprio lead e histórico.

DO $$
DECLARE
  v_master_company_id UUID;
  v_sarah_company_id UUID;
  v_sarah_instance_created TIMESTAMP WITH TIME ZONE;
  v_moved_messages INT;
  v_created_leads INT;
BEGIN
  -- Buscar company_ids
  SELECT id INTO v_master_company_id FROM sp3_companies WHERE name = 'SP3 Company - Master' LIMIT 1;
  SELECT company_id INTO v_sarah_company_id FROM sp3_instances WHERE instance_name = 'SarahSaraiva' LIMIT 1;

  IF v_sarah_company_id IS NULL OR v_master_company_id IS NULL THEN
    RAISE NOTICE 'Instâncias não encontradas. Pulando migration.';
    RETURN;
  END IF;

  -- Quando a instância SarahSaraiva foi criada
  SELECT created_at INTO v_sarah_instance_created
  FROM sp3_instances WHERE instance_name = 'SarahSaraiva' LIMIT 1;

  -- Se não tem created_at, usar a data do primeiro registro com company_id da Sarah
  IF v_sarah_instance_created IS NULL THEN
    SELECT MIN(created_at) INTO v_sarah_instance_created
    FROM n8n_chat_histories WHERE company_id = v_sarah_company_id;
  END IF;

  RAISE NOTICE 'Master: %, Sarah: %, Instância criada em: %',
    v_master_company_id, v_sarah_company_id, v_sarah_instance_created;

  -- PASSO 1: Devolver ao master as mensagens que foram criadas ANTES
  -- da instância SarahSaraiva existir (essas vieram pela instância v1/master)
  UPDATE n8n_chat_histories
  SET company_id = v_master_company_id
  WHERE company_id = v_sarah_company_id
  AND created_at < v_sarah_instance_created;
  GET DIAGNOSTICS v_moved_messages = ROW_COUNT;

  RAISE NOTICE 'Passo 1: % mensagens devolvidas ao master (anteriores à criação da instância).', v_moved_messages;

  -- PASSO 2: Garantir que o master tem um lead para telefones que têm mensagens dele
  -- (a migration 0012 pode ter movido o lead do master para SarahSaraiva)
  INSERT INTO sp3chat (company_id, telefone, nome, ia_active)
  SELECT DISTINCT v_master_company_id, h.session_id,
    -- Tentar copiar o nome do lead da SarahSaraiva se existir
    COALESCE(
      (SELECT s.nome FROM sp3chat s WHERE s.telefone = h.session_id AND s.company_id = v_sarah_company_id LIMIT 1),
      h.session_id
    ),
    true
  FROM n8n_chat_histories h
  WHERE h.company_id = v_master_company_id
  AND NOT EXISTS (
    -- Só criar se o master NÃO tem lead para esse telefone
    SELECT 1 FROM sp3chat s
    WHERE s.company_id = v_master_company_id AND s.telefone = h.session_id
  )
  GROUP BY h.session_id;
  GET DIAGNOSTICS v_created_leads = ROW_COUNT;

  RAISE NOTICE 'Passo 2: % leads criados/restaurados no master.', v_created_leads;

  -- PASSO 3: Garantir que SarahSaraiva tem lead para telefones com mensagens dela
  INSERT INTO sp3chat (company_id, telefone, nome, ia_active)
  SELECT DISTINCT v_sarah_company_id, h.session_id,
    COALESCE(
      (SELECT s.nome FROM sp3chat s WHERE s.telefone = h.session_id LIMIT 1),
      h.session_id
    ),
    true
  FROM n8n_chat_histories h
  WHERE h.company_id = v_sarah_company_id
  AND NOT EXISTS (
    SELECT 1 FROM sp3chat s
    WHERE s.company_id = v_sarah_company_id AND s.telefone = h.session_id
  )
  GROUP BY h.session_id;
  GET DIAGNOSTICS v_created_leads = ROW_COUNT;

  RAISE NOTICE 'Passo 3: % leads criados para SarahSaraiva.', v_created_leads;

  RAISE NOTICE 'Migration concluída com sucesso!';
END $$;
