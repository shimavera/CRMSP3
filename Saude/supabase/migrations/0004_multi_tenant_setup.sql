-- 1. Criação da Tabela de Empresas (SaaS Tenants)
CREATE TABLE IF NOT EXISTS sp3_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  evo_instance_name TEXT,
  features JSONB DEFAULT '{}'::jsonb, -- Guardar se tem 'audio', 'videos', etc
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Inserir a primeira empresa (A sua própria empresa, que vai herdar os dados antigos)
-- Só vai inserir se estiver vazia (para não duplicar em re-execuções acidentais)
INSERT INTO sp3_companies (name, evo_instance_name)
SELECT 'SP3 Company - Master', 'sp3_master'
WHERE NOT EXISTS (SELECT 1 FROM sp3_companies LIMIT 1);

-- 3. Adicionar a coluna company_id na tabela de Usuários
ALTER TABLE sp3_users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES sp3_companies(id);

-- 4. Atualizar os usuários existentes para fazerem parte da primeira empresa
UPDATE sp3_users
SET company_id = (SELECT id FROM sp3_companies LIMIT 1)
WHERE company_id IS NULL;

-- 5. Função Auxiliar para pegar a company_id do usuário logado (usada nas políticas RLS para performance)
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM sp3_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 6. Adicionar company_id nas demais tabelas e atualizar dados antigos
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM sp3_companies LIMIT 1;
  
  -- Para sp3chat (Leads e Chat)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp3chat' AND column_name = 'company_id') THEN
    ALTER TABLE sp3chat ADD COLUMN company_id UUID REFERENCES sp3_companies(id);
    UPDATE sp3chat SET company_id = v_company_id WHERE company_id IS NULL;
  END IF;

  -- Para Históricos (n8n_chat_histories)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'n8n_chat_histories' AND column_name = 'company_id') THEN
    ALTER TABLE n8n_chat_histories ADD COLUMN company_id UUID REFERENCES sp3_companies(id);
    UPDATE n8n_chat_histories SET company_id = v_company_id WHERE company_id IS NULL;
  END IF;

  -- Para Configuração de Follow-Up (sp3_followup_settings)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp3_followup_settings' AND column_name = 'company_id') THEN
    ALTER TABLE sp3_followup_settings ADD COLUMN company_id UUID REFERENCES sp3_companies(id);
    UPDATE sp3_followup_settings SET company_id = v_company_id WHERE company_id IS NULL;
  END IF;
  
  -- Para Prompts (sp3_prompts)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp3_prompts' AND column_name = 'company_id') THEN
    ALTER TABLE sp3_prompts ADD COLUMN company_id UUID REFERENCES sp3_companies(id);
    UPDATE sp3_prompts SET company_id = v_company_id WHERE company_id IS NULL;
  END IF;

  -- Para Vídeos de Prova Social (sp3_social_proof_videos)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp3_social_proof_videos' AND column_name = 'company_id') THEN
    ALTER TABLE sp3_social_proof_videos ADD COLUMN company_id UUID REFERENCES sp3_companies(id);
    UPDATE sp3_social_proof_videos SET company_id = v_company_id WHERE company_id IS NULL;
  END IF;

  -- Para Mensagens Rápidas (sp3_quick_messages)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp3_quick_messages' AND column_name = 'company_id') THEN
    ALTER TABLE sp3_quick_messages ADD COLUMN company_id UUID REFERENCES sp3_companies(id);
    UPDATE sp3_quick_messages SET company_id = v_company_id WHERE company_id IS NULL;
  END IF;

END $$;

-- 7. REGRAS DE SEGURANÇA MÁXIMA (RLS) baseada em company_id

-- 7.1 Ativar RLS nas tabelas (se ainda não estiver ativo)
ALTER TABLE sp3_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_chat_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3_followup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3_social_proof_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3_quick_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp3_companies ENABLE ROW LEVEL SECURITY;

-- 7.2 Remover políticas antigas muito permissivas (ajuste os nomes se necessário)
-- DROP POLICY IF EXISTS "Enable all actions for public users" ON sp3chat;
-- DROP POLICY IF EXISTS "Todos podem alterar" ON sp3chat;

-- 7.3 Criar as Novas Políticas baseadas no Tenant Isolado

-- Políticas para Empresas (Somente super/master logados na própria empresa veem)
DROP POLICY IF EXISTS "Isolate sp3_companies" ON sp3_companies;
CREATE POLICY "Isolate sp3_companies" ON sp3_companies FOR ALL USING (
  id = get_my_company_id()
);

-- Políticas para Usuarios
DROP POLICY IF EXISTS "Isolate sp3_users" ON sp3_users;
CREATE POLICY "Isolate sp3_users" ON sp3_users FOR ALL USING (
  company_id = get_my_company_id() OR id = auth.uid()
);

-- Políticas para Leads (sp3chat)
DROP POLICY IF EXISTS "Isolate sp3chat" ON sp3chat;
CREATE POLICY "Isolate sp3chat" ON sp3chat FOR ALL USING (
  company_id = get_my_company_id()
);

-- Políticas para Históricos do n8n
DROP POLICY IF EXISTS "Isolate n8n_chat_histories" ON n8n_chat_histories;
CREATE POLICY "Isolate n8n_chat_histories" ON n8n_chat_histories FOR ALL USING (
  company_id = get_my_company_id()
);

-- Políticas para Followups
DROP POLICY IF EXISTS "Isolate sp3_followup_settings" ON sp3_followup_settings;
CREATE POLICY "Isolate sp3_followup_settings" ON sp3_followup_settings FOR ALL USING (
  company_id = get_my_company_id()
);

-- Políticas para Prompts
DROP POLICY IF EXISTS "Isolate sp3_prompts" ON sp3_prompts;
CREATE POLICY "Isolate sp3_prompts" ON sp3_prompts FOR ALL USING (
  company_id = get_my_company_id()
);

-- Políticas para Vídeos
DROP POLICY IF EXISTS "Isolate sp3_social_proof_videos" ON sp3_social_proof_videos;
CREATE POLICY "Isolate sp3_social_proof_videos" ON sp3_social_proof_videos FOR ALL USING (
  company_id = get_my_company_id()
);

-- Políticas para Mensagens Rápidas
DROP POLICY IF EXISTS "Isolate sp3_quick_messages" ON sp3_quick_messages;
CREATE POLICY "Isolate sp3_quick_messages" ON sp3_quick_messages FOR ALL USING (
  company_id = get_my_company_id()
);

-- Nota: Como o Supabase e o n8n precisam bypassar o RLS às vezes para inserir de fora (ex webhook da Evolution),
-- o token 'service_role' (n8n / Supabase Backend) já ignora RLS nativamente. 
-- O app em React logado ficará confinado a estas regras do 'auth.uid()'.

-- Para Instancias Evolution (sp3_instances)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sp3_instances') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sp3_instances' AND column_name = 'company_id') THEN
      ALTER TABLE sp3_instances ADD COLUMN company_id UUID REFERENCES sp3_companies(id);
      UPDATE sp3_instances SET company_id = (SELECT id FROM sp3_companies LIMIT 1) WHERE company_id IS NULL;
    END IF;
    ALTER TABLE sp3_instances ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolate sp3_instances" ON sp3_instances;
    CREATE POLICY "Isolate sp3_instances" ON sp3_instances FOR ALL USING (company_id = get_my_company_id());
  END IF;
END $$;
