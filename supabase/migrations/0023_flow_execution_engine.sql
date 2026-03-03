-- =============================================
-- Migration 0023: Motor de Execução de Fluxos Visuais
--
-- Processa sp3_flow_executions com status='running',
-- percorrendo os nós do grafo e executando cada ação:
--   trigger    → avança para próximo nó
--   send_message → envia WhatsApp via Evolution API (pg_net)
--   wait_delay → pausa execução por tempo definido
--   condition  → avalia condição e escolhe caminho
--   action     → move stage, atualiza campo, etc.
--   end        → marca execução como concluída
--
-- Usa pg_net para chamadas HTTP assíncronas à Evolution API
-- Usa pg_cron para executar a cada 30 segundos
-- =============================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Função auxiliar: substituir variáveis nas mensagens
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
BEGIN
  -- Extrair dados das observações (formato "Campo: valor\n")
  v_clinica := (regexp_match(p_lead_observacoes, 'Clínica: ([^\n]+)'))[1];
  v_melhor_horario := (regexp_match(p_lead_observacoes, 'Melhor horário: ([^\n]+)'))[1];
  v_score := (regexp_match(p_lead_observacoes, 'Score: ([^\n]+)'))[1];
  v_origem := (regexp_match(p_lead_observacoes, 'Origem: ([^\n]+)'))[1];

  v_result := replace(v_result, '{{lead_nome}}', COALESCE(p_lead_nome, ''));
  v_result := replace(v_result, '{{lead_telefone}}', COALESCE(p_lead_telefone, ''));
  v_result := replace(v_result, '{{lead_email}}', COALESCE(p_lead_email, ''));
  v_result := replace(v_result, '{{lead_clinica}}', COALESCE(v_clinica, ''));
  v_result := replace(v_result, '{{lead_melhor_horario}}', COALESCE(v_melhor_horario, ''));
  v_result := replace(v_result, '{{lead_score}}', COALESCE(v_score, ''));
  v_result := replace(v_result, '{{lead_origem}}', COALESCE(v_origem, ''));
  v_result := replace(v_result, '{{company_name}}', COALESCE(p_company_name, ''));
  v_result := replace(v_result, '{{saudacao}}',
    CASE
      WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 12 THEN 'Bom dia'
      WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 18 THEN 'Boa tarde'
      ELSE 'Boa noite'
    END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Motor principal de execução
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
  -- Buscar execuções pendentes (com lock para evitar duplicatas)
  FOR v_exec IN
    SELECT e.id, e.flow_id, e.lead_id, e.company_id,
           e.current_node_id, e.execution_log,
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

    -- Carregar dados do lead
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

    -- Carregar instância Evolution API
    SELECT * INTO v_instance
    FROM sp3_instances
    WHERE company_id = v_exec.company_id AND is_active = true
    LIMIT 1;

    -- Carregar dados da empresa
    SELECT * INTO v_company FROM sp3_companies WHERE id = v_exec.company_id;

    -- Processar nós em sequência até atingir wait_delay ou end
    WHILE NOT v_should_stop AND v_iterations < 50 LOOP
      v_iterations := v_iterations + 1;

      -- Encontrar nó atual
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
      -- TRIGGER: apenas avança para o próximo nó
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

        -- Próximo nó
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
      -- SEND_MESSAGE: envia via Evolution API
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

        -- Processar cada mensagem do nó
        FOR v_msg_item IN SELECT jsonb_array_elements(COALESCE(v_node_data->'messages', '[]'::jsonb))
        LOOP
          v_msg_type := COALESCE(v_msg_item->>'message_type', v_msg_item->>'type', 'text');
          v_msg_text := COALESCE(v_msg_item->>'text_content', '');

          -- Substituir variáveis
          v_msg_text := flow_replace_variables(
            v_msg_text,
            v_lead.nome,
            v_lead.telefone,
            COALESCE((regexp_match(COALESCE(v_lead.observacoes, ''), 'Email: ([^\n]+)'))[1], ''),
            COALESCE(v_lead.observacoes, ''),
            COALESCE(v_company.name, '')
          );

          IF v_msg_type = 'text' AND v_msg_text != '' THEN
            -- Enviar texto via pg_net
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

            -- Salvar no histórico de chat (para aparecer na interface)
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
            -- Enviar mídia via pg_net
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

        -- Próximo nó
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
      -- WAIT_DELAY: pausa execução
      -- ==========================================
      ELSIF v_node_type = 'wait_delay' THEN
        v_delay_value := COALESCE((v_node_data->>'delay_value')::int, 1);
        v_delay_unit := COALESCE(v_node_data->>'delay_unit', 'hours');

        -- Próximo nó (será retomado depois do delay)
        SELECT e->>'target' INTO v_next_node_id
        FROM jsonb_array_elements(v_flow_data->'edges') AS e
        WHERE e->>'source' = v_current_node_id
        LIMIT 1;

        v_log := v_log || jsonb_build_array(
          jsonb_build_object(
            'node_id', v_current_node_id,
            'action', 'Aguardando ' || v_delay_value || ' ' ||
              CASE v_delay_unit
                WHEN 'minutes' THEN 'minuto(s)'
                WHEN 'hours' THEN 'hora(s)'
                WHEN 'days' THEN 'dia(s)'
                ELSE v_delay_unit
              END,
            'timestamp', NOW()::text
          )
        );

        UPDATE sp3_flow_executions
        SET current_node_id = COALESCE(v_next_node_id, v_current_node_id),
            next_run_at = NOW() +
              CASE v_delay_unit
                WHEN 'minutes' THEN (v_delay_value || ' minutes')::interval
                WHEN 'hours' THEN (v_delay_value || ' hours')::interval
                WHEN 'days' THEN (v_delay_value || ' days')::interval
                ELSE '1 hour'::interval
              END,
            execution_log = v_log
        WHERE id = v_exec.id;

        v_should_stop := true;

      -- ==========================================
      -- CONDITION: avalia e escolhe caminho
      -- ==========================================
      ELSIF v_node_type = 'condition' THEN
        v_condition_result := false;

        CASE COALESCE(v_node_data->>'condition_type', '')
          WHEN 'lead_responded' THEN
            -- Verificar se lead respondeu (tem mensagem recente não enviada pelo CRM)
            SELECT EXISTS (
              SELECT 1 FROM n8n_chat_histories
              WHERE session_id = v_lead.telefone
                AND company_id = v_exec.company_id
                AND message::jsonb->>'sentByCRM' IS DISTINCT FROM 'true'
                AND created_at > (v_exec.started_at)::timestamptz
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

        -- Encontrar edge baseado no sourceHandle (true/false)
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
      -- ACTION: executa ação no lead
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

        -- Próximo nó
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
      -- END: finaliza execução
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

    -- Se saiu do loop sem stop explícito (limite de iterações), salvar estado
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

-- 4. Agendar execução a cada minuto via pg_cron
SELECT cron.schedule(
  'process-flow-executions',
  '* * * * *',
  $$SELECT process_flow_executions()$$
);

COMMENT ON FUNCTION process_flow_executions() IS 'Motor de execução de fluxos visuais. Processa nós pendentes, envia mensagens WhatsApp e avança no grafo.';
