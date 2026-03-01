-- =============================================
-- 0008: Mensagem personalizada fora de horário
-- =============================================
-- Os campos start_time, end_time e active_days já existem em sp3_followup_settings.
-- Adicionamos apenas a mensagem personalizada de fora de horário.

ALTER TABLE sp3_followup_settings
ADD COLUMN IF NOT EXISTS out_of_hours_message TEXT
DEFAULT 'Oi! No momento estamos fora do nosso horário de atendimento. Deixe sua mensagem que retornaremos assim que possível!';

-- Preencher registros existentes que ficaram com NULL
UPDATE sp3_followup_settings
SET out_of_hours_message = 'Oi! No momento estamos fora do nosso horário de atendimento. Deixe sua mensagem que retornaremos assim que possível!'
WHERE out_of_hours_message IS NULL;
