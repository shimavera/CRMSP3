-- Migration 0018: Sistema de Automação Instagram (Estilo ManyChat)
-- Comentário com palavra-chave → sequência de DMs automáticas

-- ============================================================
-- 1. Adicionar credenciais Meta App na tabela de empresas
-- ============================================================
ALTER TABLE sp3_companies ADD COLUMN IF NOT EXISTS ig_app_id TEXT;
ALTER TABLE sp3_companies ADD COLUMN IF NOT EXISTS ig_app_secret TEXT;

-- ============================================================
-- 2. Tabela: Contas Instagram conectadas
-- ============================================================
CREATE TABLE IF NOT EXISTS sp3_instagram_accounts (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  ig_user_id TEXT NOT NULL,
  ig_username TEXT,
  page_id TEXT,
  page_name TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, ig_user_id)
);

ALTER TABLE sp3_instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolate sp3_instagram_accounts" ON sp3_instagram_accounts
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());

-- ============================================================
-- 3. Tabela: Automações (1 post + 1 keyword = 1 automação)
-- ============================================================
CREATE TABLE IF NOT EXISTS sp3_instagram_automations (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  instagram_account_id BIGINT NOT NULL REFERENCES sp3_instagram_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  post_id TEXT NOT NULL,
  post_url TEXT,
  post_thumbnail_url TEXT,
  post_caption TEXT,
  keyword TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  reply_comment BOOLEAN DEFAULT true,
  reply_comment_text TEXT DEFAULT 'Te mandei no Direct! 🔥',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, post_id, keyword)
);

ALTER TABLE sp3_instagram_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolate sp3_instagram_automations" ON sp3_instagram_automations
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());

CREATE INDEX idx_ig_automations_lookup ON sp3_instagram_automations(company_id, post_id, active);

-- ============================================================
-- 4. Tabela: Mensagens da sequência de DM
-- ============================================================
CREATE TABLE IF NOT EXISTS sp3_instagram_automation_messages (
  id BIGSERIAL PRIMARY KEY,
  automation_id BIGINT NOT NULL REFERENCES sp3_instagram_automations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'link_button')),
  text_content TEXT,
  media_url TEXT,
  button_title TEXT,
  button_url TEXT,
  delay_seconds SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(automation_id, sort_order)
);

ALTER TABLE sp3_instagram_automation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolate sp3_instagram_automation_messages" ON sp3_instagram_automation_messages
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());

CREATE INDEX idx_ig_automation_messages_order ON sp3_instagram_automation_messages(automation_id, sort_order);

-- ============================================================
-- 5. Tabela: Log de DMs enviadas (prevenir duplicatas)
-- ============================================================
CREATE TABLE IF NOT EXISTS sp3_instagram_dm_log (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES sp3_companies(id) ON DELETE CASCADE,
  automation_id BIGINT NOT NULL REFERENCES sp3_instagram_automations(id) ON DELETE CASCADE,
  ig_user_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(automation_id, ig_user_id, comment_id)
);

ALTER TABLE sp3_instagram_dm_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolate sp3_instagram_dm_log" ON sp3_instagram_dm_log
  FOR ALL USING (company_id = get_my_company_id() OR is_master_admin());

-- ============================================================
-- 6. RPCs para credenciais do Meta App
-- ============================================================
CREATE OR REPLACE FUNCTION save_ig_app_credentials(
  p_company_id UUID,
  p_app_id TEXT,
  p_app_secret TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE sp3_companies
  SET ig_app_id = p_app_id,
      ig_app_secret = p_app_secret
  WHERE id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_ig_app_credentials(p_company_id UUID)
RETURNS TABLE(app_id TEXT, app_secret TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT ig_app_id, ig_app_secret
  FROM sp3_companies
  WHERE id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. Bucket de Storage para mídia do Instagram
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('instagram-media', 'instagram-media', true)
ON CONFLICT (id) DO NOTHING;
