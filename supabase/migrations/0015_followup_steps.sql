-- =============================================
-- Migration 0015: Sistema de Follow-up Dinâmico (até 15 etapas, multimídia)
--
-- Substitui o sistema fixo de msg_1/2/3 + interval_1/2/3 por tabelas
-- dinâmicas que suportam até 15 etapas, cada uma com múltiplas mensagens
-- de tipos variados (texto, áudio PTT, vídeo, imagem).
-- =============================================

-- 1. Tabela de etapas do follow-up
CREATE TABLE IF NOT EXISTS sp3_followup_steps (
  id          BIGSERIAL PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  step_number SMALLINT NOT NULL CHECK (step_number BETWEEN 1 AND 15),
  delay_days  SMALLINT NOT NULL DEFAULT 1 CHECK (delay_days >= 0),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, step_number)
);

-- 2. Tabela de mensagens dentro de cada etapa (enviadas sequencialmente)
CREATE TABLE IF NOT EXISTS sp3_followup_step_messages (
  id           BIGSERIAL PRIMARY KEY,
  step_id      BIGINT NOT NULL REFERENCES sp3_followup_steps(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'image', 'video')),
  text_content TEXT,
  media_url    TEXT,
  media_name   TEXT,
  media_mime   TEXT,
  caption      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (step_id, sort_order)
);

-- 3. Coluna total_steps na tabela de settings para lookup rápido
ALTER TABLE sp3_followup_settings
ADD COLUMN IF NOT EXISTS total_steps SMALLINT DEFAULT 3;

-- 4. Habilitar RLS
ALTER TABLE sp3_followup_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3_followup_step_messages ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS (mesmo padrão do projeto)
DROP POLICY IF EXISTS "Isolate sp3_followup_steps" ON sp3_followup_steps;
CREATE POLICY "Isolate sp3_followup_steps" ON sp3_followup_steps
  FOR ALL USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Isolate sp3_followup_step_messages" ON sp3_followup_step_messages;
CREATE POLICY "Isolate sp3_followup_step_messages" ON sp3_followup_step_messages
  FOR ALL USING (company_id = get_my_company_id());

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_followup_steps_company_step
  ON sp3_followup_steps (company_id, step_number);

CREATE INDEX IF NOT EXISTS idx_followup_step_messages_step_order
  ON sp3_followup_step_messages (step_id, sort_order);

-- 7. Migrar dados existentes (msg_1/2/3 → registros nas novas tabelas)
DO $$
DECLARE
  rec RECORD;
  v_step_id BIGINT;
BEGIN
  FOR rec IN
    SELECT company_id, msg_1, msg_2, msg_3,
           COALESCE(interval_1, 10) as i1,
           COALESCE(interval_2, 30) as i2,
           COALESCE(interval_3, 60) as i3
    FROM sp3_followup_settings
    WHERE company_id IS NOT NULL
  LOOP
    -- Etapa 1
    INSERT INTO sp3_followup_steps (company_id, step_number, delay_days, active)
    VALUES (rec.company_id, 1, GREATEST(1, ROUND(rec.i1::numeric / 1440)::int), true)
    ON CONFLICT (company_id, step_number) DO NOTHING
    RETURNING id INTO v_step_id;

    IF v_step_id IS NOT NULL AND rec.msg_1 IS NOT NULL THEN
      INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
      VALUES (v_step_id, rec.company_id, 0, 'text', rec.msg_1)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Etapa 2
    INSERT INTO sp3_followup_steps (company_id, step_number, delay_days, active)
    VALUES (rec.company_id, 2, GREATEST(1, ROUND(rec.i2::numeric / 1440)::int), true)
    ON CONFLICT (company_id, step_number) DO NOTHING
    RETURNING id INTO v_step_id;

    IF v_step_id IS NOT NULL AND rec.msg_2 IS NOT NULL THEN
      INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
      VALUES (v_step_id, rec.company_id, 0, 'text', rec.msg_2)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Etapa 3
    INSERT INTO sp3_followup_steps (company_id, step_number, delay_days, active)
    VALUES (rec.company_id, 3, GREATEST(1, ROUND(rec.i3::numeric / 1440)::int), true)
    ON CONFLICT (company_id, step_number) DO NOTHING
    RETURNING id INTO v_step_id;

    IF v_step_id IS NOT NULL AND rec.msg_3 IS NOT NULL THEN
      INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
      VALUES (v_step_id, rec.company_id, 0, 'text', rec.msg_3)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Atualizar total_steps
    UPDATE sp3_followup_settings SET total_steps = 3 WHERE company_id = rec.company_id;
  END LOOP;
END $$;

-- 8. Função para criar etapas padrão em novos tenants
CREATE OR REPLACE FUNCTION create_default_followup_steps(p_company_id UUID)
RETURNS void AS $$
DECLARE
  v_step_id BIGINT;
BEGIN
  -- Etapa 1: após 1 dia
  INSERT INTO sp3_followup_steps (company_id, step_number, delay_days)
  VALUES (p_company_id, 1, 1) RETURNING id INTO v_step_id;
  INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
  VALUES (v_step_id, p_company_id, 0, 'text',
    'Oi! Passando para ver se conseguiu ler minha última mensagem? 👀');

  -- Etapa 2: após 2 dias
  INSERT INTO sp3_followup_steps (company_id, step_number, delay_days)
  VALUES (p_company_id, 2, 2) RETURNING id INTO v_step_id;
  INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
  VALUES (v_step_id, p_company_id, 0, 'text',
    'Ainda por aí? Se preferir, podemos marcar um papo rápido para eu tirar suas dúvidas! 📲');

  -- Etapa 3: após 4 dias
  INSERT INTO sp3_followup_steps (company_id, step_number, delay_days)
  VALUES (p_company_id, 3, 4) RETURNING id INTO v_step_id;
  INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
  VALUES (v_step_id, p_company_id, 0, 'text',
    'Vi que as coisas devem estar corridas! Vou deixar nosso link de agenda aqui para quando você puder. 🤝');

  UPDATE sp3_followup_settings SET total_steps = 3 WHERE company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Criar bucket para mídias de follow-up (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('followup-media', 'followup-media', true)
ON CONFLICT (id) DO NOTHING;
