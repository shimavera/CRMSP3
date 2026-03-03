-- =============================================
-- Migration 0019: Flow Builder Visual para Follow-up
--
-- Substitui o sistema linear de etapas por um grafo visual
-- que permite ramificação, condições e múltiplos caminhos.
-- Mantém compatibilidade total com o sistema antigo.
-- =============================================

-- 1. Tabela de definição de fluxos
CREATE TABLE IF NOT EXISTS sp3_flows (
  id             BIGSERIAL PRIMARY KEY,
  company_id     UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  name           TEXT NOT NULL DEFAULT 'Novo Fluxo',
  description    TEXT,
  trigger_type   TEXT NOT NULL DEFAULT 'manual'
                 CHECK (trigger_type IN ('manual', 'stage_change', 'new_lead')),
  trigger_config JSONB DEFAULT '{}'::jsonb,
  flow_data      JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  is_active      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de execuções ativas por lead
CREATE TABLE IF NOT EXISTS sp3_flow_executions (
  id              BIGSERIAL PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  flow_id         BIGINT NOT NULL REFERENCES sp3_flows(id) ON DELETE CASCADE,
  lead_id         BIGINT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
  current_node_id TEXT NOT NULL,
  next_run_at     TIMESTAMPTZ,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  pause_reason    TEXT,
  execution_log   JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE sp3_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3_flow_executions ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS (mesmo padrão do projeto)
DROP POLICY IF EXISTS "Isolate sp3_flows" ON sp3_flows;
CREATE POLICY "Isolate sp3_flows" ON sp3_flows
  FOR ALL USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Isolate sp3_flow_executions" ON sp3_flow_executions;
CREATE POLICY "Isolate sp3_flow_executions" ON sp3_flow_executions
  FOR ALL USING (company_id = get_my_company_id());

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_flows_company_active
  ON sp3_flows (company_id, is_active);

-- Query principal do motor de execução
CREATE INDEX IF NOT EXISTS idx_flow_exec_next_run
  ON sp3_flow_executions (next_run_at, status)
  WHERE status = 'running';

-- Lookup por lead (ver execuções ativas de um lead)
CREATE INDEX IF NOT EXISTS idx_flow_exec_lead
  ON sp3_flow_executions (lead_id, status);

-- Lookup por fluxo (ver quantas execuções um fluxo tem)
CREATE INDEX IF NOT EXISTS idx_flow_exec_flow
  ON sp3_flow_executions (flow_id, status);

-- 6. Flag para transição gradual do sistema antigo para o novo
ALTER TABLE sp3_followup_settings
ADD COLUMN IF NOT EXISTS use_visual_flows BOOLEAN DEFAULT false;

-- 7. Trigger para auto-start de fluxos quando stage muda
CREATE OR REPLACE FUNCTION trigger_flow_on_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO sp3_flow_executions (company_id, flow_id, lead_id, current_node_id, next_run_at)
    SELECT
      f.company_id,
      f.id,
      NEW.id,
      (SELECT n->>'id' FROM jsonb_array_elements(f.flow_data->'nodes') AS n WHERE n->>'type' = 'trigger' LIMIT 1),
      NOW()
    FROM sp3_flows f
    WHERE f.company_id = NEW.company_id
      AND f.is_active = true
      AND f.trigger_type = 'stage_change'
      AND f.trigger_config->>'to_stage' = NEW.stage
      AND (f.trigger_config->>'from_stage' IS NULL OR f.trigger_config->>'from_stage' = OLD.stage)
      -- Evitar duplicatas: não iniciar se já tem execução ativa desse fluxo pra esse lead
      AND NOT EXISTS (
        SELECT 1 FROM sp3_flow_executions e
        WHERE e.flow_id = f.id AND e.lead_id = NEW.id AND e.status IN ('running', 'paused')
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_flow_stage_change ON sp3chat;
CREATE TRIGGER trg_flow_stage_change
  AFTER UPDATE OF stage ON sp3chat
  FOR EACH ROW
  EXECUTE FUNCTION trigger_flow_on_stage_change();

-- 8. Trigger para auto-start em novo lead
CREATE OR REPLACE FUNCTION trigger_flow_on_new_lead()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sp3_flow_executions (company_id, flow_id, lead_id, current_node_id, next_run_at)
  SELECT
    f.company_id,
    f.id,
    NEW.id,
    (SELECT n->>'id' FROM jsonb_array_elements(f.flow_data->'nodes') AS n WHERE n->>'type' = 'trigger' LIMIT 1),
    NOW()
  FROM sp3_flows f
  WHERE f.company_id = NEW.company_id
    AND f.is_active = true
    AND f.trigger_type = 'new_lead';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_flow_new_lead ON sp3chat;
CREATE TRIGGER trg_flow_new_lead
  AFTER INSERT ON sp3chat
  FOR EACH ROW
  EXECUTE FUNCTION trigger_flow_on_new_lead();
