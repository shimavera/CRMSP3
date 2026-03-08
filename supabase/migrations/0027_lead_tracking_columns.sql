-- =============================================================================
-- Migration 0027: Colunas de rastreamento de interação no sp3chat
--
-- Problema: check_no_response_leads() referencia last_outbound_at e
-- last_interaction_at mas essas colunas nunca foram criadas.
-- Sem elas, o trigger no_response_timeout NUNCA dispara follow-ups.
--
-- Solução:
-- 1. Adicionar as colunas
-- 2. Criar trigger em n8n_chat_histories para atualizá-las automaticamente
-- 3. Backfill com dados existentes
-- =============================================================================

-- 1. Adicionar colunas ao sp3chat
ALTER TABLE sp3chat
  ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- Índice para a query de check_no_response_leads()
CREATE INDEX IF NOT EXISTS idx_sp3chat_outbound_tracking
  ON sp3chat (company_id, last_outbound_at)
  WHERE last_outbound_at IS NOT NULL;

-- 2. Trigger function: atualizar timestamps quando mensagens são inseridas
CREATE OR REPLACE FUNCTION update_lead_interaction_timestamps()
RETURNS TRIGGER AS $$
DECLARE
  v_is_outbound BOOLEAN;
  v_session_id TEXT;
  v_company_id UUID;
  v_msg JSONB;
BEGIN
  v_session_id := NEW.session_id;
  v_company_id := NEW.company_id;

  -- Tentar parsear message como JSON
  BEGIN
    v_msg := NEW.message::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_msg := NULL;
  END;

  -- Determinar se é mensagem de saída (bot/CRM) ou entrada (lead)
  -- Outbound: sentByCRM=true OU type nativo do n8n = 'ai'
  v_is_outbound := false;

  -- Checar sentByCRM (usado pelo flow execution engine)
  IF v_msg IS NOT NULL AND (v_msg->>'sentByCRM')::text = 'true' THEN
    v_is_outbound := true;
  END IF;

  -- Checar type do n8n memory (ai = resposta do bot)
  IF NEW.type = 'ai' THEN
    v_is_outbound := true;
  END IF;

  -- Atualizar sp3chat
  IF v_is_outbound THEN
    UPDATE sp3chat
    SET last_outbound_at = NEW.created_at
    WHERE telefone = v_session_id
      AND company_id = v_company_id;
  ELSE
    UPDATE sp3chat
    SET last_interaction_at = NEW.created_at
    WHERE telefone = v_session_id
      AND company_id = v_company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger
DROP TRIGGER IF EXISTS trg_update_lead_timestamps ON n8n_chat_histories;
CREATE TRIGGER trg_update_lead_timestamps
  AFTER INSERT ON n8n_chat_histories
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_interaction_timestamps();

-- 4. Backfill: preencher com dados existentes
-- last_outbound_at = última mensagem enviada pelo bot/CRM
UPDATE sp3chat c
SET last_outbound_at = sub.last_out
FROM (
  SELECT h.session_id, h.company_id, MAX(h.created_at) AS last_out
  FROM n8n_chat_histories h
  WHERE h.type = 'ai'
     OR (h.message::text LIKE '%sentByCRM%' AND h.message::text LIKE '%true%')
  GROUP BY h.session_id, h.company_id
) sub
WHERE c.telefone = sub.session_id
  AND c.company_id = sub.company_id;

-- last_interaction_at = última mensagem enviada pelo lead
UPDATE sp3chat c
SET last_interaction_at = sub.last_in
FROM (
  SELECT h.session_id, h.company_id, MAX(h.created_at) AS last_in
  FROM n8n_chat_histories h
  WHERE (h.type IS NULL OR h.type = 'human')
    AND NOT (h.message::text LIKE '%sentByCRM%' AND h.message::text LIKE '%true%')
  GROUP BY h.session_id, h.company_id
) sub
WHERE c.telefone = sub.session_id
  AND c.company_id = sub.company_id;
