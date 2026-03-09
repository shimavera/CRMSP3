-- =============================================================================
-- Migration 0031: Tabela de Lacunas de Conhecimento da IA
--
-- Quando a IA detecta que não sabe responder algo (pergunta fora do roteiro/
-- prompt), ela registra a lacuna nesta tabela. O dono da empresa visualiza
-- as lacunas pendentes na tela de Configuração da IA e pode resolver ou
-- descartar cada uma.
-- =============================================================================

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS sp3_ia_gaps (
  id             BIGSERIAL PRIMARY KEY,
  company_id     UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  pergunta       TEXT NOT NULL,
  contexto_lead  TEXT,
  telefone_lead  TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);

-- 2. RLS
ALTER TABLE sp3_ia_gaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Isolate sp3_ia_gaps" ON sp3_ia_gaps;
CREATE POLICY "Isolate sp3_ia_gaps" ON sp3_ia_gaps
  FOR ALL USING (company_id = get_my_company_id());

-- Service role (n8n insere via REST API com service key)
DROP POLICY IF EXISTS "Service insert sp3_ia_gaps" ON sp3_ia_gaps;
CREATE POLICY "Service insert sp3_ia_gaps" ON sp3_ia_gaps
  FOR INSERT WITH CHECK (true);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_ia_gaps_company_status
  ON sp3_ia_gaps (company_id, status);

CREATE INDEX IF NOT EXISTS idx_ia_gaps_pending
  ON sp3_ia_gaps (company_id, created_at DESC)
  WHERE status = 'pending';
