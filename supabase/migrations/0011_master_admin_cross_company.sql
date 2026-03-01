-- Migration: Permitir Super Admin (role = 'master') visualizar dados de todos os tenants
-- Isso é necessário para que o administrador do SaaS possa monitorar e suportar os clientes

-- 1. Função auxiliar para verificar se o usuário logado é o Super Admin da SP3
-- IMPORTANTE: Todos os admins de tenant têm role='master', então precisamos
-- verificar também se o company pertence à "SP3 Company - Master"
CREATE OR REPLACE FUNCTION is_master_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM sp3_users u
    JOIN sp3_companies c ON u.company_id = c.id
    WHERE u.id = auth.uid()
      AND u.role = 'master'
      AND c.name = 'SP3 Company - Master'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Atualizar políticas RLS para permitir master admin ver tudo

-- sp3chat (Leads)
DROP POLICY IF EXISTS "Isolate sp3chat" ON sp3chat;
CREATE POLICY "Isolate sp3chat" ON sp3chat FOR ALL USING (
  company_id = get_my_company_id() OR is_master_admin()
);

-- n8n_chat_histories (Mensagens)
DROP POLICY IF EXISTS "Isolate n8n_chat_histories" ON n8n_chat_histories;
CREATE POLICY "Isolate n8n_chat_histories" ON n8n_chat_histories FOR ALL USING (
  company_id = get_my_company_id() OR is_master_admin()
);

-- sp3_instances (Instâncias WhatsApp) — master precisa ver para enviar mensagens
DROP POLICY IF EXISTS "Isolate sp3_instances" ON sp3_instances;
CREATE POLICY "Isolate sp3_instances" ON sp3_instances FOR ALL USING (
  company_id = get_my_company_id() OR is_master_admin()
);

-- sp3_followup_settings
DROP POLICY IF EXISTS "Isolate sp3_followup_settings" ON sp3_followup_settings;
CREATE POLICY "Isolate sp3_followup_settings" ON sp3_followup_settings FOR ALL USING (
  company_id = get_my_company_id() OR is_master_admin()
);

-- sp3_prompts
DROP POLICY IF EXISTS "Isolate sp3_prompts" ON sp3_prompts;
CREATE POLICY "Isolate sp3_prompts" ON sp3_prompts FOR ALL USING (
  company_id = get_my_company_id() OR is_master_admin()
);

-- sp3_social_proof_videos
DROP POLICY IF EXISTS "Isolate sp3_social_proof_videos" ON sp3_social_proof_videos;
CREATE POLICY "Isolate sp3_social_proof_videos" ON sp3_social_proof_videos FOR ALL USING (
  company_id = get_my_company_id() OR is_master_admin()
);

-- sp3_quick_messages
DROP POLICY IF EXISTS "Isolate sp3_quick_messages" ON sp3_quick_messages;
CREATE POLICY "Isolate sp3_quick_messages" ON sp3_quick_messages FOR ALL USING (
  company_id = get_my_company_id() OR is_master_admin()
);

-- sp3_companies — master pode ver todas as empresas
DROP POLICY IF EXISTS "Isolate sp3_companies" ON sp3_companies;
CREATE POLICY "Isolate sp3_companies" ON sp3_companies FOR ALL USING (
  id = get_my_company_id() OR is_master_admin()
);
