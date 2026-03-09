-- =============================================================================
-- Migration 0030: Auto-criar lead em sp3chat quando mensagem chega
--
-- Problema: O workflow SP3CHAT só cria leads no path "dentro do horário".
-- Mensagens recebidas fora do horário são salvas em n8n_chat_histories
-- mas o lead nunca é criado em sp3chat, ficando invisível no frontend.
--
-- Fix: Trigger AFTER INSERT em n8n_chat_histories que auto-cria o lead
-- em sp3chat se não existir. Usa ON CONFLICT DO NOTHING (idempotente).
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_create_lead_on_message()
RETURNS TRIGGER AS $$
DECLARE
  v_msg JSONB;
  v_msg_type TEXT;
BEGIN
  -- Só processar se tiver session_id e company_id
  IF NEW.session_id IS NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ignorar session_ids que não parecem telefone (ex: IDs internos)
  IF LENGTH(NEW.session_id) < 8 THEN
    RETURN NEW;
  END IF;

  -- Tentar parsear mensagem para verificar tipo
  BEGIN
    v_msg := NEW.message::jsonb;
    v_msg_type := v_msg->>'type';
  EXCEPTION WHEN OTHERS THEN
    v_msg_type := NULL;
  END;

  -- Ignorar mensagens system (toggle IA, etc.)
  IF v_msg_type = 'system' THEN
    RETURN NEW;
  END IF;

  -- Inserir lead se não existir (idempotente via UNIQUE constraint)
  INSERT INTO sp3chat (company_id, telefone, nome, ia_active)
  VALUES (
    NEW.company_id,
    NEW.session_id,
    NEW.session_id,  -- Nome temporário = telefone (será atualizado pelo workflow)
    true
  )
  ON CONFLICT (telefone, company_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger (antes do trigger de timestamps para garantir que o lead existe)
DROP TRIGGER IF EXISTS trg_auto_create_lead ON n8n_chat_histories;
CREATE TRIGGER trg_auto_create_lead
  BEFORE INSERT ON n8n_chat_histories
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_lead_on_message();

-- Backfill: criar leads para mensagens órfãs existentes
INSERT INTO sp3chat (company_id, telefone, nome, ia_active)
SELECT DISTINCT h.company_id, h.session_id, h.session_id, true
FROM n8n_chat_histories h
WHERE h.company_id IS NOT NULL
  AND h.session_id IS NOT NULL
  AND LENGTH(h.session_id) >= 8
  AND NOT EXISTS (
    SELECT 1 FROM sp3chat c
    WHERE c.telefone = h.session_id AND c.company_id = h.company_id
  )
ON CONFLICT (telefone, company_id) DO NOTHING;
