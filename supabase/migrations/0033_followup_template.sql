-- =============================================================================
-- Migration 0033: Template padrão de Follow-Up (mensagem não respondida)
--
-- Cria um template de fluxo visual para todas as empresas existentes.
-- Sequência: 30min → msg1 → 1h → msg2 → 2h → msg3 → 4h → msg4 → 6h → msg5
-- Respeita horário comercial. Se lead responder, IA retoma automaticamente.
-- =============================================================================

INSERT INTO sp3_flows (company_id, name, description, trigger_type, trigger_config, flow_data, is_active, is_template)
SELECT
  c.id,
  'Follow-Up Automático (Não Respondeu)',
  'Sequência de 5 mensagens para leads que não responderam. Intervalos: 30min, 1h, 2h, 4h, 6h. Respeita horário comercial. Se o lead responder, a IA retoma automaticamente.',
  'no_response_timeout',
  '{"timeout_value": "30", "timeout_unit": "minutes"}'::jsonb,
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "position": {"x": 0, "y": 0},
        "data": {
          "label": "Lead não respondeu (30 min)",
          "triggerType": "no_response_timeout",
          "config": {"timeout_value": "30", "timeout_unit": "minutes"}
        }
      },
      {
        "id": "msg-1",
        "type": "send_message",
        "position": {"x": 0, "y": 150},
        "data": {
          "label": "Mensagem 1 — Retomada",
          "messages": [{"message_type": "text", "text_content": "Oi, {{lead_nome}}! Vi que você ficou interessado(a) mas não deu tempo de continuar. Posso te ajudar com algo? 😊"}]
        }
      },
      {
        "id": "wait-1h",
        "type": "wait_delay",
        "position": {"x": 0, "y": 300},
        "data": {
          "label": "Aguardar 1 hora",
          "delay_value": 1,
          "delay_unit": "hours",
          "business_hours": true
        }
      },
      {
        "id": "check-1",
        "type": "condition",
        "position": {"x": 0, "y": 450},
        "data": {
          "label": "Respondeu?",
          "condition_type": "lead_responded",
          "config": {}
        }
      },
      {
        "id": "end-ok-1",
        "type": "end",
        "position": {"x": 300, "y": 450},
        "data": {"label": "Lead respondeu ✓", "outcome": "success"}
      },
      {
        "id": "msg-2",
        "type": "send_message",
        "position": {"x": 0, "y": 600},
        "data": {
          "label": "Mensagem 2 — Disponibilidade",
          "messages": [{"message_type": "text", "text_content": "{{lead_nome}}, ainda estou por aqui! Se tiver qualquer dúvida, pode mandar que respondo na hora 💬"}]
        }
      },
      {
        "id": "wait-2h",
        "type": "wait_delay",
        "position": {"x": 0, "y": 750},
        "data": {
          "label": "Aguardar 2 horas",
          "delay_value": 2,
          "delay_unit": "hours",
          "business_hours": true
        }
      },
      {
        "id": "check-2",
        "type": "condition",
        "position": {"x": 0, "y": 900},
        "data": {
          "label": "Respondeu?",
          "condition_type": "lead_responded",
          "config": {}
        }
      },
      {
        "id": "end-ok-2",
        "type": "end",
        "position": {"x": 300, "y": 900},
        "data": {"label": "Lead respondeu ✓", "outcome": "success"}
      },
      {
        "id": "msg-3",
        "type": "send_message",
        "position": {"x": 0, "y": 1050},
        "data": {
          "label": "Mensagem 3 — Prova Social",
          "messages": [{"message_type": "text", "text_content": "Ei, {{lead_nome}}! Só passando para lembrar que estamos à disposição. Muitas pessoas como você já tiveram resultados incríveis com a gente! ✨"}]
        }
      },
      {
        "id": "wait-4h",
        "type": "wait_delay",
        "position": {"x": 0, "y": 1200},
        "data": {
          "label": "Aguardar 4 horas",
          "delay_value": 4,
          "delay_unit": "hours",
          "business_hours": true
        }
      },
      {
        "id": "check-3",
        "type": "condition",
        "position": {"x": 0, "y": 1350},
        "data": {
          "label": "Respondeu?",
          "condition_type": "lead_responded",
          "config": {}
        }
      },
      {
        "id": "end-ok-3",
        "type": "end",
        "position": {"x": 300, "y": 1350},
        "data": {"label": "Lead respondeu ✓", "outcome": "success"}
      },
      {
        "id": "msg-4",
        "type": "send_message",
        "position": {"x": 0, "y": 1500},
        "data": {
          "label": "Mensagem 4 — Sem pressão",
          "messages": [{"message_type": "text", "text_content": "{{lead_nome}}, sei que o dia a dia é corrido! Quando puder, me responde e a gente continua de onde parou. Sem compromisso! 🤝"}]
        }
      },
      {
        "id": "wait-6h",
        "type": "wait_delay",
        "position": {"x": 0, "y": 1650},
        "data": {
          "label": "Aguardar 6 horas",
          "delay_value": 6,
          "delay_unit": "hours",
          "business_hours": true
        }
      },
      {
        "id": "check-4",
        "type": "condition",
        "position": {"x": 0, "y": 1800},
        "data": {
          "label": "Respondeu?",
          "condition_type": "lead_responded",
          "config": {}
        }
      },
      {
        "id": "end-ok-4",
        "type": "end",
        "position": {"x": 300, "y": 1800},
        "data": {"label": "Lead respondeu ✓", "outcome": "success"}
      },
      {
        "id": "msg-5",
        "type": "send_message",
        "position": {"x": 0, "y": 1950},
        "data": {
          "label": "Mensagem 5 — Despedida",
          "messages": [{"message_type": "text", "text_content": "Última mensagem por hoje, {{lead_nome}}! Se em algum momento quiser retomar, é só mandar um oi que estarei aqui. Até mais! 👋"}]
        }
      },
      {
        "id": "end-neutral",
        "type": "end",
        "position": {"x": 0, "y": 2100},
        "data": {"label": "Sequência finalizada", "outcome": "neutral"}
      }
    ],
    "edges": [
      {"id": "e-trigger-msg1", "source": "trigger-1", "target": "msg-1"},
      {"id": "e-msg1-wait1", "source": "msg-1", "target": "wait-1h"},
      {"id": "e-wait1-check1", "source": "wait-1h", "target": "check-1"},
      {"id": "e-check1-yes", "source": "check-1", "target": "end-ok-1", "sourceHandle": "true", "label": "Sim", "animated": true},
      {"id": "e-check1-no", "source": "check-1", "target": "msg-2", "sourceHandle": "false", "label": "Não"},
      {"id": "e-msg2-wait2", "source": "msg-2", "target": "wait-2h"},
      {"id": "e-wait2-check2", "source": "wait-2h", "target": "check-2"},
      {"id": "e-check2-yes", "source": "check-2", "target": "end-ok-2", "sourceHandle": "true", "label": "Sim", "animated": true},
      {"id": "e-check2-no", "source": "check-2", "target": "msg-3", "sourceHandle": "false", "label": "Não"},
      {"id": "e-msg3-wait4", "source": "msg-3", "target": "wait-4h"},
      {"id": "e-wait4-check3", "source": "wait-4h", "target": "check-3"},
      {"id": "e-check3-yes", "source": "check-3", "target": "end-ok-3", "sourceHandle": "true", "label": "Sim", "animated": true},
      {"id": "e-check3-no", "source": "check-3", "target": "msg-4", "sourceHandle": "false", "label": "Não"},
      {"id": "e-msg4-wait6", "source": "msg-4", "target": "wait-6h"},
      {"id": "e-wait6-check4", "source": "wait-6h", "target": "check-4"},
      {"id": "e-check4-yes", "source": "check-4", "target": "end-ok-4", "sourceHandle": "true", "label": "Sim", "animated": true},
      {"id": "e-check4-no", "source": "check-4", "target": "msg-5", "sourceHandle": "false", "label": "Não"},
      {"id": "e-msg5-end", "source": "msg-5", "target": "end-neutral"}
    ]
  }'::jsonb,
  false,
  true
FROM sp3_companies c
WHERE NOT EXISTS (
  SELECT 1 FROM sp3_flows f
  WHERE f.company_id = c.id
    AND f.is_template = true
    AND f.name = 'Follow-Up Automático (Não Respondeu)'
);
