-- ==========================================
-- SUPER CONFIG SP3: GATILHO DE ORDENAÇÃO DE CHAT
-- ==========================================
-- 1. Executar esse SQL diretamente no seu painel do Supabase -> SQL Editor
--
-- O que isso faz? Sempre que uma nova mensagem entrar no N8N_CHAT_HISTORIES,
-- o próprio banco vai atualizar a coluna last_interaction_at do SP3CHAT.
-- Isso arruma totalmente a lentidão/gargalo na interface do app.
-- ==========================================

-- A) Criamos a coluna no sp3chat caso ainda não exista:
ALTER TABLE public.sp3chat 
ADD COLUMN IF NOT EXISTS last_interaction_at timestamp with time zone;

-- B) Criamos a Função (Trigger Function):
CREATE OR REPLACE FUNCTION update_sp3chat_last_interaction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.sp3chat
    SET last_interaction_at = NEW.created_at
    WHERE telefone = NEW.session_id AND company_id = NEW.company_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- C) Vinculamos a função à tabela de histórico (n8n_chat_histories):
DROP TRIGGER IF EXISTS trigger_update_interaction ON public.n8n_chat_histories;

CREATE TRIGGER trigger_update_interaction
AFTER INSERT ON public.n8n_chat_histories
FOR EACH ROW
EXECUTE FUNCTION update_sp3chat_last_interaction();

-- PRONTO! Daqui pra frente o ChatView sempre vai mostrar a conversa mais recente no topo na velocidade da luz.
