-- =============================================
-- Migration 0016: Adicionar delay_unit para flexibilidade de tempo
--
-- Permite definir follow-up em minutos, horas ou dias.
-- A coluna delay_days passa a representar o valor numérico
-- e delay_unit indica a unidade (minutes, hours, days).
-- =============================================

-- 1. Adicionar coluna delay_unit
ALTER TABLE sp3_followup_steps
ADD COLUMN IF NOT EXISTS delay_unit TEXT NOT NULL DEFAULT 'days'
CHECK (delay_unit IN ('minutes', 'hours', 'days'));

-- 2. Dados existentes ficam como 'days' (default) — nenhuma conversão necessária

-- 3. Atualizar função de criação de etapas padrão
CREATE OR REPLACE FUNCTION create_default_followup_steps(p_company_id UUID)
RETURNS void AS $$
DECLARE
  v_step_id BIGINT;
BEGIN
  -- Etapa 1: após 5 minutos
  INSERT INTO sp3_followup_steps (company_id, step_number, delay_days, delay_unit)
  VALUES (p_company_id, 1, 5, 'minutes') RETURNING id INTO v_step_id;
  INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
  VALUES (v_step_id, p_company_id, 0, 'text',
    'Oi! Passando para ver se conseguiu ler minha última mensagem? 👀');

  -- Etapa 2: após 1 dia
  INSERT INTO sp3_followup_steps (company_id, step_number, delay_days, delay_unit)
  VALUES (p_company_id, 2, 1, 'days') RETURNING id INTO v_step_id;
  INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
  VALUES (v_step_id, p_company_id, 0, 'text',
    'Ainda por aí? Se preferir, podemos marcar um papo rápido para eu tirar suas dúvidas! 📲');

  -- Etapa 3: após 3 dias
  INSERT INTO sp3_followup_steps (company_id, step_number, delay_days, delay_unit)
  VALUES (p_company_id, 3, 3, 'days') RETURNING id INTO v_step_id;
  INSERT INTO sp3_followup_step_messages (step_id, company_id, sort_order, message_type, text_content)
  VALUES (v_step_id, p_company_id, 0, 'text',
    'Vi que as coisas devem estar corridas! Vou deixar nosso link de agenda aqui para quando você puder. 🤝');

  UPDATE sp3_followup_settings SET total_steps = 3 WHERE company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
