-- =============================================================================
-- Migration 0029: Corrigir trigger de timestamps de interação
--
-- Problema: A trigger update_lead_interaction_timestamps() tratava QUALQUER
-- mensagem que não fosse type='ai' ou type='system' como inbound, atualizando
-- last_interaction_at incorretamente. Isso inclui:
--   - Mensagens plain text do chatbot (não parseáveis como JSON)
--   - Status updates do WhatsApp
--   - Mensagens com type desconhecido
--
-- Fix: Usar whitelist — só atualizar last_interaction_at quando type='human'
-- =============================================================================

CREATE OR REPLACE FUNCTION update_lead_interaction_timestamps()
RETURNS TRIGGER AS $$
DECLARE
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
    -- Mensagem não é JSON (ex: plain text do chatbot) — ignorar
    RETURN NEW;
  END;

  IF v_msg IS NULL THEN
    RETURN NEW;
  END IF;

  v_msg_type := v_msg->>'type';

  -- System messages — ignorar completamente
  IF v_msg_type = 'system' THEN
    RETURN NEW;
  END IF;

  -- Outbound: type='ai' OU sentByCRM=true
  IF v_msg_type = 'ai' OR (v_msg->>'sentByCRM')::text = 'true' THEN
    UPDATE sp3chat
    SET last_outbound_at = COALESCE(NEW.created_at, NOW())
    WHERE telefone = v_session_id
      AND company_id = v_company_id;
    RETURN NEW;
  END IF;

  -- Inbound: SOMENTE type='human' (whitelist)
  IF v_msg_type = 'human' THEN
    UPDATE sp3chat
    SET last_interaction_at = COALESCE(NEW.created_at, NOW())
    WHERE telefone = v_session_id
      AND company_id = v_company_id;
    RETURN NEW;
  END IF;

  -- Qualquer outro tipo — ignorar (não atualiza nenhum timestamp)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
