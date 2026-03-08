-- =============================================
-- Migration 0021: Trigger para Leads Externos (Site/Formulário)
--
-- 1. Colunas de tracking na leads_sp3
-- 2. Novo trigger_type: external_lead
-- 3. Função check_external_leads() para o motor n8n
-- =============================================

-- 1. Adicionar colunas de tracking na leads_sp3
ALTER TABLE leads_sp3 ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;
ALTER TABLE leads_sp3 ADD COLUMN IF NOT EXISTS sp3chat_id INTEGER;
ALTER TABLE leads_sp3 ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES sp3_companies(id);

CREATE INDEX IF NOT EXISTS idx_leads_sp3_unprocessed
  ON leads_sp3 (processed, company_id)
  WHERE processed = false;

-- 2. Expandir trigger_type para incluir external_lead
ALTER TABLE sp3_flows DROP CONSTRAINT IF EXISTS sp3_flows_trigger_type_check;
ALTER TABLE sp3_flows ADD CONSTRAINT sp3_flows_trigger_type_check
  CHECK (trigger_type IN ('manual', 'stage_change', 'new_lead', 'no_response_timeout', 'external_lead'));

-- 3. Função para verificar leads externos e criar execuções + lead no CRM
CREATE OR REPLACE FUNCTION check_external_leads()
RETURNS JSONB AS $$
DECLARE
  v_flow RECORD;
  v_lead RECORD;
  v_trigger_node_id TEXT;
  v_new_chat_id INTEGER;
  v_count INT := 0;
  v_lead_name TEXT;
  v_lead_phone TEXT;
  v_observacoes TEXT;
BEGIN
  -- Para cada fluxo ativo com trigger external_lead
  FOR v_flow IN
    SELECT f.id, f.company_id, f.flow_data, f.trigger_config
    FROM sp3_flows f
    WHERE f.is_active = true
      AND f.trigger_type = 'external_lead'
  LOOP
    -- Buscar leads não processados dessa empresa
    FOR v_lead IN
      SELECT el.*
      FROM leads_sp3 el
      WHERE el.processed = false
        AND (el.company_id = v_flow.company_id OR el.company_id IS NULL)
      ORDER BY el.created_at ASC
      LIMIT 50
    LOOP
      -- Preparar dados do lead
      v_lead_name := COALESCE(v_lead.name, v_lead.clinic_name, 'Lead Site');
      v_lead_phone := COALESCE(v_lead.whatsapp, '');

      -- Pular se não tem telefone
      IF v_lead_phone = '' THEN
        UPDATE leads_sp3 SET processed = true WHERE id = v_lead.id;
        CONTINUE;
      END IF;

      -- Limpar telefone: apenas dígitos, garantir 55 na frente
      v_lead_phone := regexp_replace(v_lead_phone, '[^0-9]', '', 'g');
      IF length(v_lead_phone) <= 11 THEN
        v_lead_phone := '55' || v_lead_phone;
      END IF;

      -- Montar observações com dados do formulário
      v_observacoes := 'LEAD DO SITE' || E'\n';
      IF v_lead.name IS NOT NULL THEN v_observacoes := v_observacoes || 'Nome: ' || v_lead.name || E'\n'; END IF;
      IF v_lead.clinic_name IS NOT NULL THEN v_observacoes := v_observacoes || 'Clínica: ' || v_lead.clinic_name || E'\n'; END IF;
      IF v_lead.email IS NOT NULL THEN v_observacoes := v_observacoes || 'Email: ' || v_lead.email || E'\n'; END IF;
      IF v_lead.best_contact_time IS NOT NULL THEN v_observacoes := v_observacoes || 'Melhor horário: ' || v_lead.best_contact_time || E'\n'; END IF;
      IF v_lead.answers IS NOT NULL AND v_lead.answers != '{}'::jsonb THEN
        v_observacoes := v_observacoes || 'Respostas: ' || v_lead.answers::text || E'\n';
      END IF;
      IF v_lead.lead_score > 0 THEN v_observacoes := v_observacoes || 'Score: ' || v_lead.lead_score::text || E'\n'; END IF;
      IF v_lead.source IS NOT NULL THEN v_observacoes := v_observacoes || 'Origem: ' || v_lead.source || E'\n'; END IF;

      -- Verificar se lead já existe no sp3chat pelo telefone
      SELECT id INTO v_new_chat_id
      FROM sp3chat
      WHERE company_id = v_flow.company_id
        AND (telefone = v_lead_phone OR telefone = right(v_lead_phone, 11))
      LIMIT 1;

      IF v_new_chat_id IS NULL THEN
        -- Criar novo lead no sp3chat (aparece no Kanban)
        INSERT INTO sp3chat (
          company_id, nome, telefone, status,
          stage, ia_active, observacoes, created_at
        ) VALUES (
          v_flow.company_id,
          v_lead_name,
          v_lead_phone,
          'active',
          'Novo Lead',
          true,
          v_observacoes,
          NOW()
        )
        RETURNING id INTO v_new_chat_id;
      ELSE
        -- Atualizar observações do lead existente
        UPDATE sp3chat
        SET observacoes = COALESCE(observacoes, '') || E'\n---\n' || v_observacoes,
            stage = COALESCE(NULLIF(stage, ''), 'Novo Lead')
        WHERE id = v_new_chat_id;
      END IF;

      -- Marcar lead externo como processado
      UPDATE leads_sp3
      SET processed = true, sp3chat_id = v_new_chat_id
      WHERE id = v_lead.id;

      -- Encontrar nó trigger no flow_data
      SELECT n->>'id' INTO v_trigger_node_id
      FROM jsonb_array_elements(v_flow.flow_data->'nodes') AS n
      WHERE n->>'type' = 'trigger'
      LIMIT 1;

      IF v_trigger_node_id IS NOT NULL THEN
        -- Não criar execução duplicada
        IF NOT EXISTS (
          SELECT 1 FROM sp3_flow_executions e
          WHERE e.flow_id = v_flow.id AND e.lead_id = v_new_chat_id AND e.status IN ('running', 'paused')
        ) THEN
          INSERT INTO sp3_flow_executions (company_id, flow_id, lead_id, current_node_id, next_run_at)
          VALUES (v_flow.company_id, v_flow.id, v_new_chat_id, v_trigger_node_id, NOW());
          v_count := v_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('created', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_external_leads() IS 'Verifica leads_sp3 não processados, cria no sp3chat e inicia execução do fluxo';
