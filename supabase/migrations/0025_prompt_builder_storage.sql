-- =============================================================================
-- Migration 0025: Bucket de Storage para Prompt Builder (screenshots)
-- =============================================================================

-- Bucket público para imagens enviadas no chat do Prompt Builder
-- OpenAI precisa acessar as URLs publicamente para análise de screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('prompt-builder-images', 'prompt-builder-images', true)
ON CONFLICT (id) DO NOTHING;

-- Upload por usuários autenticados
DO $$ BEGIN
  CREATE POLICY "prompt_builder_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prompt-builder-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Leitura pública (OpenAI precisa acessar a URL da imagem)
DO $$ BEGIN
  CREATE POLICY "prompt_builder_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'prompt-builder-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
