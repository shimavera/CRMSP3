import { createClient } from '@supabase/supabase-js';

// No Frontend, DEVEMOS usar a 'anon' key (Public), nunca a 'service_role' (Secret).
// A chave que você mandou começa com 'sb_secret', o que indica que é a chave restrita.
// Por favor, substitua abaixo pela sua 'anon' / 'public' key do painel do Supabase.

const supabaseUrl = 'https://ioqjhbhjzuukmssxhvma.supabase.co';
const supabaseAnonKey = 'sb_publishable_BXmr9LLM_NDS94Y05ic8og_kFYcRsVU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Lead = {
  id: number;
  nome?: string;
  telefone: string;
  created_at?: string;
  status?: string;
  contato?: string;
  modelo_ia?: string;
  ia_active?: boolean;
  // Campos do Kanban / Pipeline
  stage?: string;
  meeting_datetime?: string;
  meeting_link?: string;
  meeting_status?: string;   // scheduled | no_show | completed
  proposal_status?: string;  // sent | accepted | rejected
  closed_reason?: string;
  stage_updated_at?: string;
};
