-- =============================================
-- Migration 0020: Melhorias no Flow Builder Visual
--
-- 1. Novo trigger_type: no_response_timeout
-- 2. Sistema de templates (is_template, template_source_id)
-- 3. Storage policies para followup-media
-- =============================================

-- 1. Expandir trigger_type para incluir no_response_timeout
ALTER TABLE sp3_flows DROP CONSTRAINT IF EXISTS sp3_flows_trigger_type_check;
ALTER TABLE sp3_flows ADD CONSTRAINT sp3_flows_trigger_type_check
  CHECK (trigger_type IN ('manual', 'stage_change', 'new_lead', 'no_response_timeout'));

-- 2. Colunas para sistema de templates
ALTER TABLE sp3_flows
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE sp3_flows
  ADD COLUMN IF NOT EXISTS template_source_id BIGINT REFERENCES sp3_flows(id) ON DELETE SET NULL;

-- 3. Índice para busca rápida de templates por empresa
CREATE INDEX IF NOT EXISTS idx_flows_templates
  ON sp3_flows (company_id, is_template)
  WHERE is_template = true;

-- 4. Storage policies para bucket followup-media (garantir uploads funcionam)
-- Usar DO block para evitar erro se policies já existem
DO $$
BEGIN
  -- Upload: qualquer usuário autenticado pode fazer upload no bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'followup_media_insert' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "followup_media_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'followup-media');
  END IF;

  -- Leitura: qualquer um pode ler (bucket é público)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'followup_media_select' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "followup_media_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'followup-media');
  END IF;

  -- Delete: qualquer usuário autenticado pode deletar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'followup_media_delete' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "followup_media_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'followup-media');
  END IF;
END $$;

-- 5. Function para verificar leads sem resposta e criar execuções
-- Chamada periodicamente pelo motor n8n via RPC
CREATE OR REPLACE FUNCTION check_no_response_leads()
RETURNS JSONB AS $$
DECLARE
  v_flow RECORD;
  v_lead RECORD;
  v_trigger_node_id TEXT;
  v_count INT := 0;
BEGIN
  -- Para cada fluxo ativo com trigger no_response_timeout
  FOR v_flow IN
    SELECT f.id, f.company_id, f.flow_data, f.trigger_config
    FROM sp3_flows f
    WHERE f.is_active = true
      AND f.trigger_type = 'no_response_timeout'
  LOOP
    -- Calcular intervalo do timeout
    -- trigger_config: { timeout_value: "30", timeout_unit: "minutes" }
    -- Buscar leads que não responderam dentro do timeout
    FOR v_lead IN
      SELECT c.id AS lead_id
      FROM sp3chat c
      WHERE c.company_id = v_flow.company_id
        AND c.last_outbound_at IS NOT NULL
        AND (c.last_interaction_at IS NULL OR c.last_interaction_at < c.last_outbound_at)
        AND c.last_outbound_at + (
          (COALESCE(v_flow.trigger_config->>'timeout_value', '30'))::int *
          CASE COALESCE(v_flow.trigger_config->>'timeout_unit', 'minutes')
            WHEN 'hours' THEN INTERVAL '1 hour'
            WHEN 'days' THEN INTERVAL '1 day'
            ELSE INTERVAL '1 minute'
          END
        ) <= NOW()
        -- Não criar se já existe execução ativa desse fluxo para esse lead
        AND NOT EXISTS (
          SELECT 1 FROM sp3_flow_executions e
          WHERE e.flow_id = v_flow.id AND e.lead_id = c.id AND e.status IN ('running', 'paused')
        )
    LOOP
      -- Encontrar o nó trigger no flow_data
      SELECT n->>'id' INTO v_trigger_node_id
      FROM jsonb_array_elements(v_flow.flow_data->'nodes') AS n
      WHERE n->>'type' = 'trigger'
      LIMIT 1;

      IF v_trigger_node_id IS NOT NULL THEN
        INSERT INTO sp3_flow_executions (company_id, flow_id, lead_id, current_node_id, next_run_at)
        VALUES (v_flow.company_id, v_flow.id, v_lead.lead_id, v_trigger_node_id, NOW());
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('created', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN sp3_flows.is_template IS 'Fluxos marcados como template ficam disponíveis como modelo para todos os usuários da empresa';
COMMENT ON COLUMN sp3_flows.template_source_id IS 'Referência ao template original quando o fluxo foi criado a partir de um modelo';
