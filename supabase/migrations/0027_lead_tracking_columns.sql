-- =============================================================================
-- Migration 0027: Colunas de rastreamento de interação no sp3chat
--
-- Problema: check_no_response_leads() referencia last_outbound_at e
-- last_interaction_at mas essas colunas nunca foram criadas.
-- Sem elas, o trigger no_response_timeout NUNCA dispara follow-ups.
--
-- Nota: n8n_chat_histories NÃO tem coluna "type". O tipo da mensagem
-- está dentro do campo "message" como JSON: {"type": "ai"/"human", ...}
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
  v_is_outbound BOOLEAN := false;
  v_session_id TEXT;
  v_company_id UUID;
  v_msg JSONB;
  v_msg_type TEXT;
BEGIN
  v_session_id := NEW.session_id;
  v_company_id := NEW.company_id;

  -- Tentar parsear message como JSON
  BEGIN
    v_msg := NEW.message::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_msg := NULL;
  END;

  IF v_msg IS NOT NULL THEN
    v_msg_type := v_msg->>'type';

    -- Outbound: type='ai' OU sentByCRM=true OU type='system'
    IF v_msg_type = 'ai' OR (v_msg->>'sentByCRM')::text = 'true' THEN
      v_is_outbound := true;
    END IF;

    -- System messages (toggle IA, etc.) — ignorar, não são interação
    IF v_msg_type = 'system' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Atualizar sp3chat
  IF v_is_outbound THEN
    UPDATE sp3chat
    SET last_outbound_at = COALESCE(NEW.created_at, NOW())
    WHERE telefone = v_session_id
      AND company_id = v_company_id;
  ELSE
    UPDATE sp3chat
    SET last_interaction_at = COALESCE(NEW.created_at, NOW())
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
-- last_outbound_at = última mensagem enviada pelo bot/CRM (type='ai' ou sentByCRM dentro do JSON)
UPDATE sp3chat c
SET last_outbound_at = sub.last_out
FROM (
  SELECT h.session_id, h.company_id, MAX(h.created_at) AS last_out
  FROM n8n_chat_histories h
  WHERE h.message::text LIKE '%"type":"ai"%'
     OR h.message::text LIKE '%"type": "ai"%'
     OR (h.message::text LIKE '%sentByCRM%' AND h.message::text LIKE '%true%')
  GROUP BY h.session_id, h.company_id
) sub
WHERE c.telefone = sub.session_id
  AND c.company_id = sub.company_id;

-- last_interaction_at = última mensagem enviada pelo lead (type='human' ou sem type)
UPDATE sp3chat c
SET last_interaction_at = sub.last_in
FROM (
  SELECT h.session_id, h.company_id, MAX(h.created_at) AS last_in
  FROM n8n_chat_histories h
  WHERE (h.message::text LIKE '%"type":"human"%' OR h.message::text LIKE '%"type": "human"%')
    AND NOT (h.message::text LIKE '%sentByCRM%' AND h.message::text LIKE '%true%')
  GROUP BY h.session_id, h.company_id
) sub
WHERE c.telefone = sub.session_id
  AND c.company_id = sub.company_id;
