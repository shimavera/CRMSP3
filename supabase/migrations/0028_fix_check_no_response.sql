-- =============================================================================
-- Migration 0028: Corrigir check_no_response_leads()
--
-- Problema: trigger_config.timeout_value pode conter "00:01" (formato hora)
-- em vez de um inteiro, causando erro:
-- "invalid input syntax for type integer: '00:01'"
-- =============================================================================

CREATE OR REPLACE FUNCTION check_no_response_leads()
RETURNS JSONB AS $$
DECLARE
  v_flow RECORD;
  v_lead RECORD;
  v_trigger_node_id TEXT;
  v_count INT := 0;
  v_timeout_val INT;
  v_timeout_unit TEXT;
BEGIN
  -- Para cada fluxo ativo com trigger no_response_timeout
  FOR v_flow IN
    SELECT f.id, f.company_id, f.flow_data, f.trigger_config
    FROM sp3_flows f
    WHERE f.is_active = true
      AND f.trigger_type = 'no_response_timeout'
  LOOP
    -- Parsear timeout_value com tratamento de erro
    BEGIN
      v_timeout_val := (COALESCE(v_flow.trigger_config->>'timeout_value', '30'))::int;
    EXCEPTION WHEN OTHERS THEN
      -- Se não é número (ex: "00:01"), usar default de 30 minutos
      v_timeout_val := 30;
    END;

    v_timeout_unit := COALESCE(v_flow.trigger_config->>'timeout_unit', 'minutes');

    -- Buscar leads que não responderam dentro do timeout
    FOR v_lead IN
      SELECT c.id AS lead_id
      FROM sp3chat c
      WHERE c.company_id = v_flow.company_id
        AND c.last_outbound_at IS NOT NULL
        AND (c.last_interaction_at IS NULL OR c.last_interaction_at < c.last_outbound_at)
        AND c.last_outbound_at + (
          v_timeout_val *
          CASE v_timeout_unit
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
