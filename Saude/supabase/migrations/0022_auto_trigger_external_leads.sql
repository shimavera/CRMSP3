-- =============================================
-- Migration 0022: Trigger automático para leads externos
--
-- CORRIGE: A função check_external_leads() da migration 0021
-- precisa ser chamada manualmente. Este trigger dispara
-- automaticamente quando um registro é inserido na leads_sp3.
--
-- TAMBÉM ADICIONA: FK entre sp3_flow_executions.lead_id e sp3chat.id
-- para que queries com join funcionem corretamente.
-- =============================================

-- 1. Adicionar FK para permitir joins no Supabase PostgREST
ALTER TABLE sp3_flow_executions
  DROP CONSTRAINT IF EXISTS fk_flow_exec_lead;
ALTER TABLE sp3_flow_executions
  ADD CONSTRAINT fk_flow_exec_lead
  FOREIGN KEY (lead_id) REFERENCES sp3chat(id) ON DELETE CASCADE;

-- 2. Garantir colunas da migration 0021 existem
ALTER TABLE leads_sp3 ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;
ALTER TABLE leads_sp3 ADD COLUMN IF NOT EXISTS sp3chat_id INTEGER;
ALTER TABLE leads_sp3 ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES sp3_companies(id);

-- 3. Função trigger para processar leads automaticamente no INSERT
CREATE OR REPLACE FUNCTION trigger_flow_on_external_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_flow RECORD;
  v_trigger_node_id TEXT;
  v_new_chat_id INTEGER;
  v_lead_name TEXT;
  v_lead_phone TEXT;
  v_observacoes TEXT;
BEGIN
  v_lead_name := COALESCE(NEW.name, NEW.clinic_name, 'Lead Site');
  v_lead_phone := COALESCE(NEW.whatsapp, '');

  IF v_lead_phone = '' THEN
    NEW.processed := true;
    RETURN NEW;
  END IF;

  -- Limpar telefone: apenas dígitos, garantir 55 na frente
  v_lead_phone := regexp_replace(v_lead_phone, '[^0-9]', '', 'g');
  IF length(v_lead_phone) <= 11 THEN
    v_lead_phone := '55' || v_lead_phone;
  END IF;

  -- Montar observações com dados do formulário
  v_observacoes := 'LEAD DO SITE' || E'\n';
  IF NEW.name IS NOT NULL THEN v_observacoes := v_observacoes || 'Nome: ' || NEW.name || E'\n'; END IF;
  IF NEW.clinic_name IS NOT NULL THEN v_observacoes := v_observacoes || 'Clínica: ' || NEW.clinic_name || E'\n'; END IF;
  IF NEW.email IS NOT NULL THEN v_observacoes := v_observacoes || 'Email: ' || NEW.email || E'\n'; END IF;
  IF NEW.best_contact_time IS NOT NULL THEN v_observacoes := v_observacoes || 'Melhor horário: ' || NEW.best_contact_time || E'\n'; END IF;
  IF NEW.answers IS NOT NULL AND NEW.answers != '{}'::jsonb THEN
    v_observacoes := v_observacoes || 'Respostas: ' || NEW.answers::text || E'\n';
  END IF;
  IF NEW.lead_score > 0 THEN v_observacoes := v_observacoes || 'Score: ' || NEW.lead_score::text || E'\n'; END IF;
  IF NEW.source IS NOT NULL THEN v_observacoes := v_observacoes || 'Origem: ' || NEW.source || E'\n'; END IF;

  FOR v_flow IN
    SELECT f.id, f.company_id, f.flow_data
    FROM sp3_flows f
    WHERE f.is_active = true
      AND f.trigger_type = 'external_lead'
      AND (NEW.company_id = f.company_id OR NEW.company_id IS NULL)
  LOOP
    -- O cliente deseja que cada disparo/entrada crie um lead SEPARADO no Pipedrive/Kanban/Sistema,
    -- mesmo que o telefone já exista.
    INSERT INTO sp3chat (
      company_id, nome, telefone,
      stage, ia_active, observacoes, created_at
    ) VALUES (
      v_flow.company_id, v_lead_name, v_lead_phone,
      'Novo Lead', true, v_observacoes, NOW()
    )
    RETURNING id INTO v_new_chat_id;

    NEW.processed := true;
    NEW.sp3chat_id := v_new_chat_id;

    SELECT n->>'id' INTO v_trigger_node_id
    FROM jsonb_array_elements(v_flow.flow_data->'nodes') AS n
    WHERE n->>'type' = 'trigger'
    LIMIT 1;

    IF v_trigger_node_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM sp3_flow_executions e
        WHERE e.flow_id = v_flow.id AND e.lead_id = v_new_chat_id AND e.status IN ('running', 'paused')
      ) THEN
        INSERT INTO sp3_flow_executions (
          company_id, flow_id, lead_id, current_node_id, next_run_at, status,
          execution_log
        ) VALUES (
          v_flow.company_id, v_flow.id, v_new_chat_id, v_trigger_node_id, NOW(), 'running',
          jsonb_build_array(
            jsonb_build_object(
              'node_id', v_trigger_node_id,
              'action', 'Gatilho disparado — Lead externo',
              'timestamp', NOW()::text,
              'result', 'Lead: ' || v_lead_name || ' | Tel: ' || v_lead_phone
            )
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar trigger no INSERT da leads_sp3
DROP TRIGGER IF EXISTS trg_external_lead_auto ON leads_sp3;
CREATE TRIGGER trg_external_lead_auto
  BEFORE INSERT ON leads_sp3
  FOR EACH ROW
  EXECUTE FUNCTION trigger_flow_on_external_lead();

-- 5. Processar leads existentes não processados (re-insert para disparar trigger)
DO $$
DECLARE
  v_lead RECORD;
BEGIN
  FOR v_lead IN
    SELECT * FROM leads_sp3 WHERE processed = false OR processed IS NULL
  LOOP
    DELETE FROM leads_sp3 WHERE id = v_lead.id;
    INSERT INTO leads_sp3 (lead_id, name, clinic_name, whatsapp, email, company_id)
    VALUES (v_lead.lead_id, v_lead.name, v_lead.clinic_name, v_lead.whatsapp, v_lead.email, v_lead.company_id);
  END LOOP;
END;
$$;
