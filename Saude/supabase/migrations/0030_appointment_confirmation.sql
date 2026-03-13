-- =============================================
-- Migration 0030: Sistema de Confirmação de Consulta
--
-- 1. Adiciona confirmation_status em sp3_calendar_events
-- 2. Adiciona trigger_type 'meeting_scheduled' em sp3_flows
-- 3. Trigger PostgreSQL para disparar fluxos ao agendar reunião
-- 4. Expande flow_replace_variables com variáveis de reunião
-- 5. Novo condition_type 'message_contains' no motor
-- 6. Novo action_type 'update_calendar_confirmation' no motor
-- 7. Template "Confirmação de Consulta" para todas as empresas
-- =============================================

-- ================================================
-- 1. Adicionar confirmation_status em sp3_calendar_events
-- ================================================
ALTER TABLE sp3_calendar_events
ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'pending'
CHECK (confirmation_status IN ('pending', 'confirmed', 'unconfirmed'));

-- ================================================
-- 2. Expandir trigger_type CHECK em sp3_flows
-- ================================================
ALTER TABLE sp3_flows DROP CONSTRAINT IF EXISTS sp3_flows_trigger_type_check;
ALTER TABLE sp3_flows ADD CONSTRAINT sp3_flows_trigger_type_check
  CHECK (trigger_type IN (
    'manual', 'stage_change', 'new_lead', 'no_response_timeout',
    'external_lead', 'meeting_scheduled'
  ));

-- ================================================
-- 3. Trigger: disparar fluxos ao definir meeting_datetime
-- ================================================
CREATE OR REPLACE FUNCTION trigger_flow_on_meeting_scheduled()
RETURNS TRIGGER AS $$
BEGIN
  -- Disparar apenas quando meeting_datetime muda para valor não-nulo
  IF (OLD.meeting_datetime IS DISTINCT FROM NEW.meeting_datetime)
     AND NEW.meeting_datetime IS NOT NULL THEN

    -- Cancelar fluxos de meeting anteriores para esse lead
    UPDATE sp3_flow_executions
    SET status = 'cancelled', completed_at = NOW()
    WHERE lead_id = NEW.id
      AND status IN ('running', 'paused')
      AND flow_id IN (
        SELECT id FROM sp3_flows
        WHERE trigger_type = 'meeting_scheduled'
          AND company_id = NEW.company_id
      );

    -- Iniciar novas execuções para todos os fluxos meeting_scheduled ativos
    INSERT INTO sp3_flow_executions (
      company_id, flow_id, lead_id, current_node_id, next_run_at
    )
    SELECT
      f.company_id,
      f.id,
      NEW.id,
      (SELECT n->>'id' FROM jsonb_array_elements(f.flow_data->'nodes') AS n
       WHERE n->>'type' = 'trigger' LIMIT 1),
      NOW()
    FROM sp3_flows f
    WHERE f.company_id = NEW.company_id
      AND f.is_active = true
      AND f.trigger_type = 'meeting_scheduled';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_flow_meeting_scheduled ON sp3chat;
CREATE TRIGGER trg_flow_meeting_scheduled
  AFTER UPDATE OF meeting_datetime ON sp3chat
  FOR EACH ROW
  EXECUTE FUNCTION trigger_flow_on_meeting_scheduled();

-- ================================================
-- 4. Expandir flow_replace_variables com variáveis de reunião
-- ================================================
CREATE OR REPLACE FUNCTION flow_replace_variables(
  template TEXT,
  p_lead_nome TEXT,
  p_lead_telefone TEXT,
  p_lead_email TEXT,
  p_lead_observacoes TEXT,
  p_company_name TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT := template;
  v_clinica TEXT;
  v_melhor_horario TEXT;
  v_score TEXT;
  v_origem TEXT;
  v_meeting_datetime TIMESTAMPTZ;
  v_meeting_link TEXT;
BEGIN
  -- Extrair dados das observações (formato "Campo: valor\n")
  v_clinica := (regexp_match(p_lead_observacoes, 'Clínica: ([^\n]+)'))[1];
  v_melhor_horario := (regexp_match(p_lead_observacoes, 'Melhor horário: ([^\n]+)'))[1];
  v_score := (regexp_match(p_lead_observacoes, 'Score: ([^\n]+)'))[1];
  v_origem := (regexp_match(p_lead_observacoes, 'Origem: ([^\n]+)'))[1];

  -- Alias para nome
  v_result := replace(v_result, '{{lead_nome}}', COALESCE(p_lead_nome, ''));
  v_result := replace(v_result, '{{lead_name}}', COALESCE(p_lead_nome, ''));
  v_result := replace(v_result, '{{nome}}', COALESCE(p_lead_nome, ''));

  -- Outros campos
  v_result := replace(v_result, '{{lead_telefone}}', COALESCE(p_lead_telefone, ''));
  v_result := replace(v_result, '{{lead_email}}', COALESCE(p_lead_email, ''));
  v_result := replace(v_result, '{{lead_clinica}}', COALESCE(v_clinica, ''));
  v_result := replace(v_result, '{{lead_melhor_horario}}', COALESCE(v_melhor_horario, ''));
  v_result := replace(v_result, '{{lead_score}}', COALESCE(v_score, ''));
  v_result := replace(v_result, '{{lead_origem}}', COALESCE(v_origem, ''));
  v_result := replace(v_result, '{{company_name}}', COALESCE(p_company_name, ''));

  -- Saudação
  v_result := regexp_replace(v_result, '\{\{saudação.*?\}\}|\{\{saudacao.*?\}\}',
    CASE
      WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 12 THEN 'Bom dia'
      WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 18 THEN 'Boa tarde'
      ELSE 'Boa noite'
    END
  , 'gi');

  -- Variáveis de reunião (busca no lead pelo telefone)
  IF v_result LIKE '%{{meeting_%' THEN
    SELECT meeting_datetime, meeting_link
    INTO v_meeting_datetime, v_meeting_link
    FROM sp3chat
    WHERE telefone = p_lead_telefone
    LIMIT 1;

    IF v_meeting_datetime IS NOT NULL THEN
      v_result := replace(v_result, '{{meeting_datetime}}',
        to_char(v_meeting_datetime AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'));
      v_result := replace(v_result, '{{meeting_date}}',
        to_char(v_meeting_datetime AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'));
      v_result := replace(v_result, '{{meeting_time}}',
        to_char(v_meeting_datetime AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
    ELSE
      v_result := replace(v_result, '{{meeting_datetime}}', '');
      v_result := replace(v_result, '{{meeting_date}}', '');
      v_result := replace(v_result, '{{meeting_time}}', '');
    END IF;
    v_result := replace(v_result, '{{meeting_link}}', COALESCE(v_meeting_link, ''));
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================
-- 5 e 6. Atualizar motor de execução com message_contains e update_calendar_confirmation
-- ================================================
CREATE OR REPLACE FUNCTION process_flow_executions()
RETURNS JSONB AS $$
DECLARE
  v_exec RECORD;
  v_flow_data JSONB;
  v_current_node_id TEXT;
  v_node JSONB;
  v_node_type TEXT;
  v_node_data JSONB;
  v_next_node_id TEXT;
  v_edge JSONB;
  v_instance RECORD;
  v_lead RECORD;
  v_company RECORD;
  v_log JSONB;
  v_processed INT := 0;
  v_should_stop BOOLEAN;
  v_msg_item JSONB;
  v_msg_text TEXT;
  v_msg_type TEXT;
  v_delay_value INT;
  v_delay_unit TEXT;
  v_condition_result BOOLEAN;
  v_action_type TEXT;
  v_iterations INT;
BEGIN
  FOR v_exec IN
    SELECT e.id, e.flow_id, e.lead_id, e.company_id,
           e.current_node_id, e.execution_log, e.started_at,
           f.flow_data
    FROM sp3_flow_executions e
    JOIN sp3_flows f ON f.id = e.flow_id
    WHERE e.status = 'running'
      AND e.next_run_at <= NOW()
    ORDER BY e.next_run_at ASC
    LIMIT 20
    FOR UPDATE OF e SKIP LOCKED
  LOOP
    v_flow_data := v_exec.flow_data;
    v_current_node_id := v_exec.current_node_id;
    v_log := COALESCE(v_exec.execution_log, '[]'::jsonb);
    v_should_stop := false;
    v_iterations := 0;

    SELECT * INTO v_lead FROM sp3chat WHERE id = v_exec.lead_id;
    IF v_lead IS NULL THEN
      UPDATE sp3_flow_executions
      SET status = 'failed', completed_at = NOW(),
          execution_log = v_log || jsonb_build_array(
            jsonb_build_object('node_id', v_current_node_id, 'action', 'Erro: lead não encontrado', 'timestamp', NOW()::text)
          )
      WHERE id = v_exec.id;
      CONTINUE;
    END IF;

    SELECT * INTO v_instance
    FROM sp3_instances
    WHERE company_id = v_exec.company_id AND is_active = true
    LIMIT 1;

    SELECT * INTO v_company FROM sp3_companies WHERE id = v_exec.company_id;

    WHILE NOT v_should_stop AND v_iterations < 50 LOOP
      v_iterations := v_iterations + 1;

      SELECT n INTO v_node
      FROM jsonb_array_elements(v_flow_data->'nodes') AS n
      WHERE n->>'id' = v_current_node_id
      LIMIT 1;

      IF v_node IS NULL THEN
        v_log := v_log || jsonb_build_array(
          jsonb_build_object('node_id', v_current_node_id, 'action', 'Erro: nó não encontrado no fluxo', 'timestamp', NOW()::text)
        );
        UPDATE sp3_flow_executions
        SET status = 'failed', completed_at = NOW(), execution_log = v_log
        WHERE id = v_exec.id;
        v_should_stop := true;
        CONTINUE;
      END IF;

      v_node_type := v_node->>'type';
      v_node_data := v_node->'data';

      -- ==========================================
      -- TRIGGER
      -- ==========================================
      IF v_node_type = 'trigger' THEN
        v_log := v_log || jsonb_build_array(
          jsonb_build_object(
            'node_id', v_current_node_id,
            'action', 'Trigger processado',
            'timestamp', NOW()::text,
            'result', COALESCE(v_node_data->>'label', 'Gatilho')
          )
        );

        SELECT e->>'target' INTO v_next_node_id
        FROM jsonb_array_elements(v_flow_data->'edges') AS e
        WHERE e->>'source' = v_current_node_id
        LIMIT 1;

        IF v_next_node_id IS NULL THEN
          v_should_stop := true;
          UPDATE sp3_flow_executions
          SET status = 'completed', completed_at = NOW(), execution_log = v_log
          WHERE id = v_exec.id;
        ELSE
          v_current_node_id := v_next_node_id;
        END IF;

      -- ==========================================
      -- SEND_MESSAGE
      -- ==========================================
      ELSIF v_node_type = 'send_message' THEN
        IF v_instance IS NULL THEN
          v_log := v_log || jsonb_build_array(
            jsonb_build_object('node_id', v_current_node_id, 'action', 'Erro: instância Evolution não configurada', 'timestamp', NOW()::text)
          );
          UPDATE sp3_flow_executions
          SET status = 'failed', completed_at = NOW(), execution_log = v_log
          WHERE id = v_exec.id;
          v_should_stop := true;
          CONTINUE;
        END IF;

        FOR v_msg_item IN SELECT jsonb_array_elements(COALESCE(v_node_data->'messages', '[]'::jsonb))
        LOOP
          v_msg_type := COALESCE(v_msg_item->>'message_type', v_msg_item->>'type', 'text');
          v_msg_text := COALESCE(v_msg_item->>'text_content', '');

          v_msg_text := flow_replace_variables(
            v_msg_text,
            v_lead.nome,
            v_lead.telefone,
            COALESCE((regexp_match(COALESCE(v_lead.observacoes, ''), 'Email: ([^\n]+)'))[1], ''),
            COALESCE(v_lead.observacoes, ''),
            COALESCE(v_company.name, '')
          );

          IF v_msg_type = 'text' AND v_msg_text != '' THEN
            PERFORM net.http_post(
              url := v_instance.evo_api_url || '/message/sendText/' || v_instance.instance_name,
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', v_instance.evo_api_key
              ),
              body := jsonb_build_object(
                'number', v_lead.telefone,
                'text', v_msg_text,
                'delay', 500
              )
            );

            INSERT INTO n8n_chat_histories (company_id, session_id, message)
            VALUES (
              v_exec.company_id,
              v_lead.telefone,
              jsonb_build_object(
                'type', 'ai',
                'content', v_msg_text,
                'sender', 'Flow: ' || COALESCE(v_node_data->>'label', 'Automação'),
                'sentByCRM', true
              )
            );

          ELSIF v_msg_type IN ('image', 'video') AND (v_msg_item->>'media_url') IS NOT NULL THEN
            PERFORM net.http_post(
              url := v_instance.evo_api_url || '/message/sendMedia/' || v_instance.instance_name,
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', v_instance.evo_api_key
              ),
              body := jsonb_build_object(
                'number', v_lead.telefone,
                'mediatype', v_msg_type,
                'mimetype', COALESCE(v_msg_item->>'media_mime', 'image/jpeg'),
                'caption', COALESCE(
                  flow_replace_variables(
                    COALESCE(v_msg_item->>'caption', ''),
                    v_lead.nome, v_lead.telefone, '',
                    COALESCE(v_lead.observacoes, ''),
                    COALESCE(v_company.name, '')
                  ), ''
                ),
                'media', v_msg_item->>'media_url',
                'fileName', COALESCE(v_msg_item->>'media_name', 'media'),
                'delay', 500
              )
            );

            INSERT INTO n8n_chat_histories (company_id, session_id, message)
            VALUES (
              v_exec.company_id,
              v_lead.telefone,
              jsonb_build_object(
                'type', 'ai',
                'content', COALESCE(v_msg_item->>'caption', '[Mídia enviada]'),
                'sender', 'Flow: ' || COALESCE(v_node_data->>'label', 'Automação'),
                'sentByCRM', true,
                'msgStyle', v_msg_type
              )
            );
          END IF;
        END LOOP;

        v_log := v_log || jsonb_build_array(
          jsonb_build_object(
            'node_id', v_current_node_id,
            'action', 'Mensagem enviada',
            'timestamp', NOW()::text,
            'result', v_lead.nome || ' ← ' || LEFT(COALESCE(v_msg_text, '[mídia]'), 60)
          )
        );

        SELECT e->>'target' INTO v_next_node_id
        FROM jsonb_array_elements(v_flow_data->'edges') AS e
        WHERE e->>'source' = v_current_node_id
        LIMIT 1;

        IF v_next_node_id IS NULL THEN
          v_should_stop := true;
          UPDATE sp3_flow_executions
          SET status = 'completed', completed_at = NOW(),
              current_node_id = v_current_node_id, execution_log = v_log
          WHERE id = v_exec.id;
        ELSE
          v_current_node_id := v_next_node_id;
        END IF;

      -- ==========================================
      -- WAIT_DELAY
      -- ==========================================
      ELSIF v_node_type = 'wait_delay' THEN
        v_delay_value := COALESCE((v_node_data->>'delay_value')::int, 1);
        v_delay_unit := COALESCE(v_node_data->>'delay_unit', 'hours');

        DECLARE
          v_target_time TIMESTAMPTZ := NULL;
          v_is_meeting_based BOOLEAN := false;
        BEGIN
          IF v_delay_unit IN ('minutes_before_meeting', 'hours_before_meeting', 'days_before_meeting') THEN
            v_is_meeting_based := true;
            IF v_lead.meeting_datetime IS NULL THEN
              v_target_time := NOW() + interval '10 minutes';
            ELSE
              v_target_time := v_lead.meeting_datetime -
                CASE
                  WHEN v_delay_unit = 'minutes_before_meeting' THEN (v_delay_value || ' minutes')::interval
                  WHEN v_delay_unit = 'hours_before_meeting' THEN (v_delay_value || ' hours')::interval
                  WHEN v_delay_unit = 'days_before_meeting' THEN (v_delay_value || ' days')::interval
                END;
            END IF;
          ELSE
            v_target_time := NOW() +
                CASE v_delay_unit
                  WHEN 'minutes' THEN (v_delay_value || ' minutes')::interval
                  WHEN 'hours' THEN (v_delay_value || ' hours')::interval
                  WHEN 'days' THEN (v_delay_value || ' days')::interval
                  ELSE '1 hour'::interval
                END;
          END IF;

          IF COALESCE(v_node_data->>'business_hours', 'false') = 'true' THEN
            v_target_time := sp3_adjust_to_business_hours(v_target_time);
          END IF;

          IF v_is_meeting_based AND v_lead.meeting_datetime IS NOT NULL AND v_target_time < NOW() - interval '10 minutes' THEN
            v_log := v_log || jsonb_build_array(jsonb_build_object(
              'node_id', v_current_node_id, 'action', 'Ignorado (já passou do prazo de lembrete)', 'timestamp', NOW()::text
            ));
            SELECT e->>'target' INTO v_next_node_id FROM jsonb_array_elements(v_flow_data->'edges') AS e WHERE e->>'source' = v_current_node_id LIMIT 1;
            IF v_next_node_id IS NOT NULL THEN
              SELECT e2->>'target' INTO v_next_node_id FROM jsonb_array_elements(v_flow_data->'edges') AS e2 WHERE e2->>'source' = v_next_node_id LIMIT 1;
            END IF;

            IF v_next_node_id IS NOT NULL THEN
              v_current_node_id := v_next_node_id;
              CONTINUE;
            ELSE
              v_should_stop := true;
              UPDATE sp3_flow_executions SET status = 'completed', completed_at = NOW(), execution_log = v_log WHERE id = v_exec.id;
            END IF;

          ELSE
            SELECT e->>'target' INTO v_next_node_id
            FROM jsonb_array_elements(v_flow_data->'edges') AS e
            WHERE e->>'source' = v_current_node_id
            LIMIT 1;

            v_log := v_log || jsonb_build_array(
              jsonb_build_object(
                'node_id', v_current_node_id,
                'action', 'Aguardando ' || v_delay_value || ' ' || REPLACE(v_delay_unit, '_meeting', ''),
                'timestamp', NOW()::text
              )
            );

            UPDATE sp3_flow_executions
            SET current_node_id = COALESCE(v_next_node_id, v_current_node_id),
                next_run_at = v_target_time,
                execution_log = v_log
            WHERE id = v_exec.id;

            v_should_stop := true;
          END IF;
        END;

      -- ==========================================
      -- CONDITION (inclui novo message_contains)
      -- ==========================================
      ELSIF v_node_type = 'condition' THEN
        v_condition_result := false;

        CASE COALESCE(v_node_data->>'condition_type', '')
          WHEN 'lead_responded' THEN
            SELECT EXISTS (
              SELECT 1 FROM n8n_chat_histories
              WHERE session_id = v_lead.telefone
                AND company_id = v_exec.company_id
                AND message::jsonb->>'sentByCRM' IS DISTINCT FROM 'true'
                AND created_at > (v_exec.started_at)::timestamptz
            ) INTO v_condition_result;

          WHEN 'message_contains' THEN
            -- NOVO: Verifica se alguma mensagem do lead contém a keyword
            SELECT EXISTS (
              SELECT 1 FROM n8n_chat_histories
              WHERE session_id = v_lead.telefone
                AND company_id = v_exec.company_id
                AND message::jsonb->>'sentByCRM' IS DISTINCT FROM 'true'
                AND (message::jsonb->>'type' = 'human' OR message::jsonb->>'type' IS NULL)
                AND created_at > (v_exec.started_at)::timestamptz
                AND LOWER(COALESCE(message::jsonb->>'content', '')) LIKE '%' || LOWER(COALESCE(v_node_data->'config'->>'keyword', 'confirmo')) || '%'
            ) INTO v_condition_result;

          WHEN 'stage_check' THEN
            v_condition_result := (v_lead.stage = COALESCE(v_node_data->'config'->>'stage', ''));

          WHEN 'field_check' THEN
            CASE COALESCE(v_node_data->'config'->>'operator', 'equals')
              WHEN 'equals' THEN
                v_condition_result := (
                  CASE v_node_data->'config'->>'field'
                    WHEN 'nome' THEN v_lead.nome
                    WHEN 'telefone' THEN v_lead.telefone
                    WHEN 'stage' THEN v_lead.stage
                    WHEN 'status' THEN v_lead.status
                    ELSE ''
                  END = COALESCE(v_node_data->'config'->>'value', '')
                );
              WHEN 'not_equals' THEN
                v_condition_result := (
                  CASE v_node_data->'config'->>'field'
                    WHEN 'nome' THEN v_lead.nome
                    WHEN 'telefone' THEN v_lead.telefone
                    WHEN 'stage' THEN v_lead.stage
                    WHEN 'status' THEN v_lead.status
                    ELSE ''
                  END != COALESCE(v_node_data->'config'->>'value', '')
                );
              WHEN 'contains' THEN
                v_condition_result := (
                  CASE v_node_data->'config'->>'field'
                    WHEN 'nome' THEN v_lead.nome
                    WHEN 'telefone' THEN v_lead.telefone
                    WHEN 'observacoes' THEN v_lead.observacoes
                    ELSE ''
                  END ILIKE '%' || COALESCE(v_node_data->'config'->>'value', '') || '%'
                );
              WHEN 'exists' THEN
                v_condition_result := (
                  CASE v_node_data->'config'->>'field'
                    WHEN 'nome' THEN v_lead.nome IS NOT NULL AND v_lead.nome != ''
                    WHEN 'telefone' THEN v_lead.telefone IS NOT NULL AND v_lead.telefone != ''
                    ELSE false
                  END
                );
              ELSE
                v_condition_result := false;
            END CASE;

          ELSE
            v_condition_result := false;
        END CASE;

        v_log := v_log || jsonb_build_array(
          jsonb_build_object(
            'node_id', v_current_node_id,
            'action', 'Condição avaliada',
            'timestamp', NOW()::text,
            'result', CASE WHEN v_condition_result THEN 'Sim (verdadeiro)' ELSE 'Não (falso)' END
          )
        );

        SELECT e->>'target' INTO v_next_node_id
        FROM jsonb_array_elements(v_flow_data->'edges') AS e
        WHERE e->>'source' = v_current_node_id
          AND e->>'sourceHandle' = CASE WHEN v_condition_result THEN 'true' ELSE 'false' END
        LIMIT 1;

        IF v_next_node_id IS NULL THEN
          v_should_stop := true;
          UPDATE sp3_flow_executions
          SET status = 'completed', completed_at = NOW(),
              current_node_id = v_current_node_id, execution_log = v_log
          WHERE id = v_exec.id;
        ELSE
          v_current_node_id := v_next_node_id;
        END IF;

      -- ==========================================
      -- ACTION (inclui novo update_calendar_confirmation)
      -- ==========================================
      ELSIF v_node_type = 'action' THEN
        v_action_type := COALESCE(v_node_data->>'action_type', '');

        CASE v_action_type
          WHEN 'move_stage' THEN
            UPDATE sp3chat SET stage = COALESCE(v_node_data->'config'->>'stage', stage)
            WHERE id = v_exec.lead_id;

          WHEN 'update_field' THEN
            CASE v_node_data->'config'->>'field'
              WHEN 'nome' THEN UPDATE sp3chat SET nome = v_node_data->'config'->>'value' WHERE id = v_exec.lead_id;
              WHEN 'observacoes' THEN UPDATE sp3chat SET observacoes = COALESCE(observacoes, '') || E'\n' || COALESCE(v_node_data->'config'->>'value', '') WHERE id = v_exec.lead_id;
              ELSE NULL;
            END CASE;

          WHEN 'lock_followup' THEN
            UPDATE sp3chat SET ia_active = false WHERE id = v_exec.lead_id;

          WHEN 'unlock_followup' THEN
            UPDATE sp3chat SET ia_active = true WHERE id = v_exec.lead_id;

          WHEN 'close_conversation' THEN
            UPDATE sp3chat SET status = 'closed' WHERE id = v_exec.lead_id;

          -- NOVO: Atualizar confirmação no calendário
          WHEN 'update_calendar_confirmation' THEN
            UPDATE sp3_calendar_events
            SET confirmation_status = COALESCE(v_node_data->'config'->>'confirmation_status', 'confirmed'),
                updated_at = NOW()
            WHERE lead_id = v_exec.lead_id
              AND company_id = v_exec.company_id
              AND start_time > NOW()
              AND status = 'scheduled';

          ELSE NULL;
        END CASE;

        v_log := v_log || jsonb_build_array(
          jsonb_build_object(
            'node_id', v_current_node_id,
            'action', 'Ação executada: ' || v_action_type,
            'timestamp', NOW()::text,
            'result', COALESCE(v_node_data->>'label', v_action_type)
          )
        );

        SELECT e->>'target' INTO v_next_node_id
        FROM jsonb_array_elements(v_flow_data->'edges') AS e
        WHERE e->>'source' = v_current_node_id
        LIMIT 1;

        IF v_next_node_id IS NULL THEN
          v_should_stop := true;
          UPDATE sp3_flow_executions
          SET status = 'completed', completed_at = NOW(),
              current_node_id = v_current_node_id, execution_log = v_log
          WHERE id = v_exec.id;
        ELSE
          v_current_node_id := v_next_node_id;
        END IF;

      -- ==========================================
      -- END
      -- ==========================================
      ELSIF v_node_type = 'end' THEN
        v_log := v_log || jsonb_build_array(
          jsonb_build_object(
            'node_id', v_current_node_id,
            'action', 'Fluxo finalizado',
            'timestamp', NOW()::text,
            'result', COALESCE(v_node_data->>'outcome', 'neutral')
          )
        );

        UPDATE sp3_flow_executions
        SET status = 'completed', completed_at = NOW(),
            current_node_id = v_current_node_id, execution_log = v_log
        WHERE id = v_exec.id;
        v_should_stop := true;

      -- ==========================================
      -- TIPO DESCONHECIDO
      -- ==========================================
      ELSE
        v_log := v_log || jsonb_build_array(
          jsonb_build_object('node_id', v_current_node_id, 'action', 'Tipo desconhecido: ' || v_node_type, 'timestamp', NOW()::text)
        );
        v_should_stop := true;
        UPDATE sp3_flow_executions
        SET status = 'failed', completed_at = NOW(), execution_log = v_log
        WHERE id = v_exec.id;
      END IF;
    END LOOP;

    IF NOT v_should_stop THEN
      UPDATE sp3_flow_executions
      SET current_node_id = v_current_node_id,
          next_run_at = NOW(),
          execution_log = v_log
      WHERE id = v_exec.id;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'timestamp', NOW()::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 7. Template "Confirmação de Consulta" para todas as empresas
-- ================================================

-- Inserir como template global (master) E também para cada empresa existente
INSERT INTO sp3_flows (company_id, name, description, trigger_type, trigger_config, flow_data, is_active, is_template)
SELECT
  c.id,
  'Confirmação de Consulta',
  'Envia lembretes 72h, 24h e 2h antes da consulta. Na marca de 24h pede confirmação. Se o paciente responder CONFIRMO, marca como confirmado no calendário.',
  'meeting_scheduled',
  '{}'::jsonb,
  '{
    "nodes": [
      {
        "id": "trigger-conf",
        "type": "trigger",
        "position": {"x": 250, "y": 0},
        "data": {
          "label": "Reunião Agendada",
          "triggerType": "meeting_scheduled",
          "config": {}
        }
      },
      {
        "id": "wait-72h",
        "type": "wait_delay",
        "position": {"x": 250, "y": 120},
        "data": {
          "label": "72h antes da consulta",
          "delay_value": 72,
          "delay_unit": "hours_before_meeting",
          "business_hours": true
        }
      },
      {
        "id": "msg-72h",
        "type": "send_message",
        "position": {"x": 250, "y": 240},
        "data": {
          "label": "Lembrete 72h",
          "messages": [{"message_type": "text", "text_content": "Olá {{lead_nome}}, lembramos que sua consulta está agendada para {{meeting_date}} às {{meeting_time}}. Qualquer dúvida, estamos à disposição!"}]
        }
      },
      {
        "id": "wait-24h",
        "type": "wait_delay",
        "position": {"x": 250, "y": 360},
        "data": {
          "label": "24h antes da consulta",
          "delay_value": 24,
          "delay_unit": "hours_before_meeting",
          "business_hours": true
        }
      },
      {
        "id": "msg-24h",
        "type": "send_message",
        "position": {"x": 250, "y": 480},
        "data": {
          "label": "Pedir Confirmação",
          "messages": [{"message_type": "text", "text_content": "{{lead_nome}}, sua consulta é amanhã, dia {{meeting_date}} às {{meeting_time}}! Por favor, confirme sua presença respondendo *CONFIRMO*."}]
        }
      },
      {
        "id": "wait-response",
        "type": "wait_delay",
        "position": {"x": 250, "y": 600},
        "data": {
          "label": "Aguardar resposta (2h)",
          "delay_value": 2,
          "delay_unit": "hours",
          "business_hours": false
        }
      },
      {
        "id": "check-confirmo",
        "type": "condition",
        "position": {"x": 250, "y": 720},
        "data": {
          "label": "Respondeu CONFIRMO?",
          "condition_type": "message_contains",
          "config": {"keyword": "confirmo"}
        }
      },
      {
        "id": "action-confirmed",
        "type": "action",
        "position": {"x": 50, "y": 870},
        "data": {
          "label": "Marcar Confirmado",
          "action_type": "update_calendar_confirmation",
          "config": {"confirmation_status": "confirmed"}
        }
      },
      {
        "id": "msg-confirmed",
        "type": "send_message",
        "position": {"x": 50, "y": 990},
        "data": {
          "label": "Confirmar Recebimento",
          "messages": [{"message_type": "text", "text_content": "Perfeito, {{lead_nome}}! Sua consulta está confirmada para {{meeting_date}} às {{meeting_time}}. Esperamos você!"}]
        }
      },
      {
        "id": "end-confirmed",
        "type": "end",
        "position": {"x": 50, "y": 1110},
        "data": {"label": "Consulta Confirmada", "outcome": "success"}
      },
      {
        "id": "action-unconfirmed",
        "type": "action",
        "position": {"x": 450, "y": 870},
        "data": {
          "label": "Marcar Não Confirmado",
          "action_type": "update_calendar_confirmation",
          "config": {"confirmation_status": "unconfirmed"}
        }
      },
      {
        "id": "msg-not-confirmed",
        "type": "send_message",
        "position": {"x": 450, "y": 990},
        "data": {
          "label": "Aviso Não Confirmou",
          "messages": [{"message_type": "text", "text_content": "{{lead_nome}}, notamos que você ainda não confirmou sua consulta de amanhã. Se precisar reagendar, é só nos avisar."}]
        }
      },
      {
        "id": "wait-2h-before",
        "type": "wait_delay",
        "position": {"x": 450, "y": 1110},
        "data": {
          "label": "2h antes da consulta",
          "delay_value": 2,
          "delay_unit": "hours_before_meeting",
          "business_hours": false
        }
      },
      {
        "id": "msg-final-reminder",
        "type": "send_message",
        "position": {"x": 450, "y": 1230},
        "data": {
          "label": "Lembrete Final",
          "messages": [{"message_type": "text", "text_content": "{{lead_nome}}, sua consulta é em 2 horas ({{meeting_time}}). Esperamos você!"}]
        }
      },
      {
        "id": "end-neutral",
        "type": "end",
        "position": {"x": 450, "y": 1350},
        "data": {"label": "Fluxo Finalizado", "outcome": "neutral"}
      }
    ],
    "edges": [
      {"id": "e-t-w72", "source": "trigger-conf", "target": "wait-72h"},
      {"id": "e-w72-m72", "source": "wait-72h", "target": "msg-72h"},
      {"id": "e-m72-w24", "source": "msg-72h", "target": "wait-24h"},
      {"id": "e-w24-m24", "source": "wait-24h", "target": "msg-24h"},
      {"id": "e-m24-wr", "source": "msg-24h", "target": "wait-response"},
      {"id": "e-wr-chk", "source": "wait-response", "target": "check-confirmo"},
      {"id": "e-chk-yes", "source": "check-confirmo", "target": "action-confirmed", "sourceHandle": "true"},
      {"id": "e-chk-no", "source": "check-confirmo", "target": "action-unconfirmed", "sourceHandle": "false"},
      {"id": "e-conf-msg", "source": "action-confirmed", "target": "msg-confirmed"},
      {"id": "e-conf-end", "source": "msg-confirmed", "target": "end-confirmed"},
      {"id": "e-unconf-msg", "source": "action-unconfirmed", "target": "msg-not-confirmed"},
      {"id": "e-msg-w2h", "source": "msg-not-confirmed", "target": "wait-2h-before"},
      {"id": "e-w2h-final", "source": "wait-2h-before", "target": "msg-final-reminder"},
      {"id": "e-final-end", "source": "msg-final-reminder", "target": "end-neutral"}
    ]
  }'::jsonb,
  false,
  true
FROM sp3_companies c
WHERE NOT EXISTS (
  SELECT 1 FROM sp3_flows f
  WHERE f.company_id = c.id
    AND f.name = 'Confirmação de Consulta'
);
