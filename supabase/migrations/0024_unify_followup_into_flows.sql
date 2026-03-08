-- =============================================
-- Migration 0024: Unificar Follow-up no Motor de Fluxos Visuais
--
-- 1. Definir sp3_adjust_to_business_hours() (referenciada em 0023 mas nunca criada)
-- 2. Agendar check_no_response_leads() via pg_cron
-- 3. Desabilitar pg_cron do motor SQL (n8n assume execução)
-- 4. Migrar etapas lineares para fluxos visuais
-- =============================================

-- 1. Função para ajustar horário ao horário comercial
-- Limpar overloads anteriores (caso migration tenha rodado parcialmente)
DROP FUNCTION IF EXISTS sp3_adjust_to_business_hours(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS sp3_adjust_to_business_hours(TIMESTAMPTZ, UUID);

CREATE FUNCTION sp3_adjust_to_business_hours(
  p_target_time TIMESTAMPTZ,
  p_company_id UUID DEFAULT NULL
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_start_time TIME;
  v_end_time TIME;
  v_active_days JSONB;
  v_local_time TIMESTAMPTZ;
  v_local_time_of_day TIME;
  v_dow INT;
  v_attempt INT := 0;
BEGIN
  -- Buscar config da empresa
  IF p_company_id IS NOT NULL THEN
    SELECT start_time::time, end_time::time, active_days::jsonb
    INTO v_start_time, v_end_time, v_active_days
    FROM sp3_followup_settings
    WHERE company_id = p_company_id
    LIMIT 1;
  END IF;

  -- Se não encontrou config, retornar horário original
  IF v_start_time IS NULL OR v_end_time IS NULL OR v_active_days IS NULL THEN
    RETURN p_target_time;
  END IF;

  v_local_time := p_target_time AT TIME ZONE 'America/Sao_Paulo';

  LOOP
    EXIT WHEN v_attempt >= 14;
    v_attempt := v_attempt + 1;

    v_local_time_of_day := v_local_time::time;
    v_dow := EXTRACT(DOW FROM v_local_time)::int;

    -- Verificar se é dia ativo
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_active_days) AS d
      WHERE d::int = v_dow
    ) THEN
      -- Dentro do horário comercial
      IF v_local_time_of_day >= v_start_time AND v_local_time_of_day <= v_end_time THEN
        RETURN (v_local_time AT TIME ZONE 'America/Sao_Paulo');
      END IF;
      -- Antes do horário: ajustar para início
      IF v_local_time_of_day < v_start_time THEN
        RETURN ((v_local_time::date + v_start_time) AT TIME ZONE 'America/Sao_Paulo');
      END IF;
    END IF;

    -- Avançar para o início do próximo dia
    v_local_time := (v_local_time::date + interval '1 day' + v_start_time);
  END LOOP;

  -- Fallback: retornar original
  RETURN p_target_time;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION sp3_adjust_to_business_hours(TIMESTAMPTZ, UUID) IS
  'Ajusta um horário para cair dentro do horário comercial configurado em sp3_followup_settings';

-- 2. Agendar check_no_response_leads() a cada 2 minutos
-- (cria execuções de fluxo para leads sem resposta)
DO $$
BEGIN
  -- Remover agendamento anterior se existir (evita erro de duplicata)
  PERFORM cron.unschedule('check-no-response-leads');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-no-response-leads',
  '*/2 * * * *',
  $$SELECT check_no_response_leads()$$
);

-- 3. Desabilitar pg_cron do motor SQL (n8n workflow assume a execução)
-- O motor n8n (KWbbXXwCMorQDLqd) já está ativo e processa fluxos visuais
DO $$
BEGIN
  PERFORM cron.unschedule('process-flow-executions');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron job process-flow-executions nao encontrado, ignorando';
END $$;

-- 4. Função para migrar etapas lineares para fluxo visual
DROP FUNCTION IF EXISTS migrate_followup_steps_to_flow(UUID);
CREATE FUNCTION migrate_followup_steps_to_flow(p_company_id UUID)
RETURNS BIGINT AS $$
DECLARE
  v_step RECORD;
  v_msg RECORD;
  v_nodes JSONB := '[]'::jsonb;
  v_edges JSONB := '[]'::jsonb;
  v_prev_node_id TEXT;
  v_trigger_id TEXT;
  v_end_success_id TEXT;
  v_end_cold_id TEXT;
  v_send_id TEXT;
  v_wait_id TEXT;
  v_cond_id TEXT;
  v_action_lock_id TEXT;
  v_y INT := 50;
  v_x_center INT := 300;
  v_x_branch INT := 600;
  v_y_step INT := 120;
  v_step_count INT := 0;
  v_total_steps INT;
  v_messages JSONB;
  v_flow_id BIGINT;
  v_settings RECORD;
  v_delay_value INT;
  v_delay_unit TEXT;
BEGIN
  -- Verificar se já existe fluxo migrado
  IF EXISTS (
    SELECT 1 FROM sp3_flows
    WHERE company_id = p_company_id
      AND trigger_type = 'no_response_timeout'
      AND name LIKE '%Follow-up Automatico%'
  ) THEN
    RETURN NULL;
  END IF;

  -- Buscar configurações de follow-up
  SELECT * INTO v_settings
  FROM sp3_followup_settings
  WHERE company_id = p_company_id
  LIMIT 1;

  -- Contar etapas ativas
  SELECT COUNT(*) INTO v_total_steps
  FROM sp3_followup_steps
  WHERE company_id = p_company_id AND active = true;

  IF v_total_steps = 0 THEN
    RETURN NULL;
  END IF;

  -- Criar nó Trigger
  v_trigger_id := gen_random_uuid()::text;
  v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
    'id', v_trigger_id,
    'type', 'trigger',
    'position', jsonb_build_object('x', v_x_center, 'y', v_y),
    'data', jsonb_build_object(
      'label', 'Sem Resposta',
      'triggerType', 'no_response_timeout',
      'config', jsonb_build_object(
        'timeout_value', COALESCE(v_settings.start_time, '30'),
        'timeout_unit', 'minutes'
      )
    )
  ));
  v_y := v_y + v_y_step;

  -- Nó Fim (Converteu)
  v_end_success_id := gen_random_uuid()::text;
  v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
    'id', v_end_success_id,
    'type', 'end',
    'position', jsonb_build_object('x', v_x_branch, 'y', v_y_step * 3),
    'data', jsonb_build_object('label', 'Converteu', 'outcome', 'success')
  ));

  -- Nó Fim (Frio) - será posicionado ao final
  v_end_cold_id := gen_random_uuid()::text;

  v_prev_node_id := v_trigger_id;

  FOR v_step IN
    SELECT s.*, ROW_NUMBER() OVER (ORDER BY s.step_number) as rn
    FROM sp3_followup_steps s
    WHERE s.company_id = p_company_id AND s.active = true
    ORDER BY s.step_number
  LOOP
    v_step_count := v_step_count + 1;

    -- Montar mensagens do step
    v_messages := '[]'::jsonb;
    FOR v_msg IN
      SELECT * FROM sp3_followup_step_messages
      WHERE step_id = v_step.id
      ORDER BY sort_order
    LOOP
      v_messages := v_messages || jsonb_build_array(jsonb_build_object(
        'message_type', v_msg.message_type,
        'text_content', COALESCE(
          regexp_replace(
            regexp_replace(
              regexp_replace(v_msg.text_content, '\[Lead: Nome\]', '{{lead_nome}}', 'g'),
              '\[Lead: Telefone\]', '{{lead_telefone}}', 'g'),
            '\[Sauda[çc][aã]o\]', '{{saudacao}}', 'gi'),
          ''),
        'media_url', COALESCE(v_msg.media_url, ''),
        'media_name', COALESCE(v_msg.media_name, ''),
        'media_mime', COALESCE(v_msg.media_mime, ''),
        'caption', COALESCE(
          regexp_replace(
            regexp_replace(
              regexp_replace(v_msg.caption, '\[Lead: Nome\]', '{{lead_nome}}', 'g'),
              '\[Lead: Telefone\]', '{{lead_telefone}}', 'g'),
            '\[Sauda[çc][aã]o\]', '{{saudacao}}', 'gi'),
          '')
      ));
    END LOOP;

    -- Nó: Enviar Mensagem
    v_send_id := gen_random_uuid()::text;
    v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
      'id', v_send_id,
      'type', 'send_message',
      'position', jsonb_build_object('x', v_x_center, 'y', v_y),
      'data', jsonb_build_object(
        'label', v_step.step_number || 'º Follow-up',
        'messages', v_messages
      )
    ));
    v_edges := v_edges || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'source', v_prev_node_id,
      'target', v_send_id
    ));
    v_y := v_y + v_y_step;

    -- Determinar delay: usar o delay do PRÓXIMO step, ou 1 dia como padrão
    v_delay_value := COALESCE(v_step.delay_days, 1);
    v_delay_unit := COALESCE(v_step.delay_unit, 'days');

    -- Nó: Aguardar (com business_hours)
    v_wait_id := gen_random_uuid()::text;
    v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
      'id', v_wait_id,
      'type', 'wait_delay',
      'position', jsonb_build_object('x', v_x_center, 'y', v_y),
      'data', jsonb_build_object(
        'label', 'Aguardar ' || v_delay_value || ' ' ||
          CASE v_delay_unit
            WHEN 'minutes' THEN 'min'
            WHEN 'hours' THEN 'h'
            ELSE 'dia(s)'
          END,
        'delay_value', v_delay_value,
        'delay_unit', v_delay_unit,
        'business_hours', true
      )
    ));
    v_edges := v_edges || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'source', v_send_id,
      'target', v_wait_id
    ));
    v_y := v_y + v_y_step;

    -- Nó: Condição (respondeu?)
    v_cond_id := gen_random_uuid()::text;
    v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
      'id', v_cond_id,
      'type', 'condition',
      'position', jsonb_build_object('x', v_x_center, 'y', v_y),
      'data', jsonb_build_object(
        'label', 'Respondeu?',
        'condition_type', 'lead_responded',
        'config', '{}'::jsonb
      )
    ));
    v_edges := v_edges || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'source', v_wait_id,
      'target', v_cond_id
    ));

    -- Edge "Sim" → Fim (Converteu)
    v_edges := v_edges || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'source', v_cond_id,
      'target', v_end_success_id,
      'sourceHandle', 'true',
      'label', 'Sim'
    ));

    IF v_step_count = v_total_steps THEN
      -- Último step: "Não" → Action(lock) → End(Frio)
      v_action_lock_id := gen_random_uuid()::text;
      v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
        'id', v_action_lock_id,
        'type', 'action',
        'position', jsonb_build_object('x', v_x_center, 'y', v_y + v_y_step),
        'data', jsonb_build_object(
          'label', 'Desativar IA',
          'action_type', 'lock_followup',
          'config', '{}'::jsonb
        )
      ));
      v_edges := v_edges || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'source', v_cond_id,
        'target', v_action_lock_id,
        'sourceHandle', 'false',
        'label', 'Nao'
      ));

      v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
        'id', v_end_cold_id,
        'type', 'end',
        'position', jsonb_build_object('x', v_x_center, 'y', v_y + v_y_step * 2),
        'data', jsonb_build_object('label', 'Frio', 'outcome', 'failed')
      ));
      v_edges := v_edges || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'source', v_action_lock_id,
        'target', v_end_cold_id
      ));
    END IF;

    v_y := v_y + v_y_step;
    v_prev_node_id := v_cond_id;
  END LOOP;

  -- Adicionar edges "Não" intermediárias (conectam condição ao próximo SendMessage)
  -- Feito implicitamente: v_prev_node_id é atualizado a cada iteração
  -- As edges intermediárias "Não" já são criadas pelo fato de v_prev_node_id ser
  -- o conditionNode e o próximo edge conecta ao sendMessage

  -- Nota: O loop acima conecta v_prev_node_id → v_send_id a cada iteração,
  -- mas v_prev_node_id é o condId do step anterior.
  -- Precisamos adicionar sourceHandle='false' nessas edges intermediárias.
  -- Vamos corrigir: remover as edges de condição→sendMessage sem sourceHandle
  -- e adicionar com sourceHandle='false'

  -- Na verdade, as edges estão corretas: a edge source=prevNodeId target=sendId
  -- é criada no início de cada loop. Quando prevNodeId é um conditionNode (todos
  -- exceto o primeiro, que é o trigger), essa edge precisa do sourceHandle='false'.
  -- Vamos reconstruir essas edges:

  -- Recriar edges intermediárias com sourceHandle correto
  DECLARE
    v_fixed_edges JSONB := '[]'::jsonb;
    v_edge_item JSONB;
    v_source_type TEXT;
  BEGIN
    FOR v_edge_item IN SELECT * FROM jsonb_array_elements(v_edges)
    LOOP
      -- Verificar se a source é um condition node (que não tem sourceHandle definido)
      SELECT n->>'type' INTO v_source_type
      FROM jsonb_array_elements(v_nodes) AS n
      WHERE n->>'id' = v_edge_item->>'source';

      IF v_source_type = 'condition' AND v_edge_item->>'sourceHandle' IS NULL THEN
        -- Adicionar sourceHandle='false' (é a edge "Não" intermediária)
        v_fixed_edges := v_fixed_edges || jsonb_build_array(
          v_edge_item || jsonb_build_object('sourceHandle', 'false', 'label', 'Nao')
        );
      ELSE
        v_fixed_edges := v_fixed_edges || jsonb_build_array(v_edge_item);
      END IF;
    END LOOP;
    v_edges := v_fixed_edges;
  END;

  -- Ajustar posição do Fim (Converteu) para ficar centralizado
  DECLARE
    v_updated_nodes JSONB := '[]'::jsonb;
    v_node_item JSONB;
  BEGIN
    FOR v_node_item IN SELECT * FROM jsonb_array_elements(v_nodes)
    LOOP
      IF v_node_item->>'id' = v_end_success_id THEN
        v_updated_nodes := v_updated_nodes || jsonb_build_array(
          jsonb_set(v_node_item, '{position,y}', to_jsonb(v_y / 2))
        );
      ELSE
        v_updated_nodes := v_updated_nodes || jsonb_build_array(v_node_item);
      END IF;
    END LOOP;
    v_nodes := v_updated_nodes;
  END;

  -- Inserir o fluxo
  INSERT INTO sp3_flows (company_id, name, description, trigger_type, trigger_config, flow_data, is_active)
  VALUES (
    p_company_id,
    'Follow-up Automatico',
    'Fluxo migrado das etapas lineares de follow-up. Envia mensagens quando lead não responde.',
    'no_response_timeout',
    jsonb_build_object('timeout_value', '30', 'timeout_unit', 'minutes'),
    jsonb_build_object('nodes', v_nodes, 'edges', v_edges),
    false  -- Inativo até ativação manual
  )
  RETURNING id INTO v_flow_id;

  RETURN v_flow_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION migrate_followup_steps_to_flow(UUID) IS
  'Migra etapas lineares de follow-up para um fluxo visual equivalente com trigger no_response_timeout';

-- 5. Executar migração para empresas existentes com etapas ativas
DO $$
DECLARE
  v_company RECORD;
  v_flow_id BIGINT;
BEGIN
  FOR v_company IN
    SELECT DISTINCT s.company_id
    FROM sp3_followup_steps s
    WHERE s.active = true
      AND NOT EXISTS (
        SELECT 1 FROM sp3_flows f
        WHERE f.company_id = s.company_id
          AND f.trigger_type = 'no_response_timeout'
      )
  LOOP
    v_flow_id := migrate_followup_steps_to_flow(v_company.company_id);
    IF v_flow_id IS NOT NULL THEN
      RAISE NOTICE 'Fluxo % criado para empresa %', v_flow_id, v_company.company_id;
    END IF;
  END LOOP;
END $$;

-- 6. Ativar os fluxos migrados (executar SOMENTE após verificar que o motor n8n está funcionando)
-- UPDATE sp3_flows SET is_active = true WHERE name = 'Follow-up Automatico' AND is_active = false;
