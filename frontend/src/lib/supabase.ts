import { createClient } from '@supabase/supabase-js';

// No Frontend, DEVEMOS usar a 'anon' key (Public), nunca a 'service_role' (Secret).
// A chave que você mandou começa com 'sb_secret', o que indica que é a chave restrita.
// Por favor, substitua abaixo pela sua 'anon' / 'public' key do painel do Supabase.

const supabaseUrl = 'https://REDACTED_SUPABASE_URL';
const supabaseAnonKey = 'REDACTED_SUPABASE_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserProfile = {
  id: string;
  email: string;
  company_id?: string;
  company_name?: string;
  nome: string;
  role: 'master' | 'user';
  permissions: {
    dashboard: boolean;
    chats: boolean;
    kanban: boolean;
    leads: boolean;
    settings: boolean;
  };
  created_at?: string;
};

export type SocialProofVideo = {
  id: number;
  company_id?: string;
  titulo: string;
  descricao: string;
  contexto: string;
  url: string;
  mimetype: string;
  active: boolean;
  created_at?: string;
};

export type QuickMessage = {
  id: string;
  company_id?: string;
  title: string;
  content: string;
  created_at?: string;
};

export type Instance = {
  id: string;
  company_id?: string;
  instance_name: string;
  display_name: string;
  evo_api_url: string;
  evo_api_key: string;
  is_active: boolean;
  connection_status: 'connected' | 'disconnected' | 'connecting';
  phone_number?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type Lead = {
  id: number;
  company_id?: string;
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
  followup_stage?: number;
  followup_locked?: boolean;
  last_outbound_at?: string;
  last_interaction_at?: string;
  observacoes?: string;
  // Novos recursos
  tasks?: { id: string; title: string; due_date: string; completed: boolean }[];
  custom_fields?: Record<string, string>;
};

export type FollowupStep = {
  id: number;
  company_id?: string;
  step_number: number;
  delay_days: number;
  delay_unit: 'minutes' | 'hours' | 'days';
  active: boolean;
  messages: FollowupStepMessage[];
  created_at?: string;
  updated_at?: string;
};

export type FollowupStepMessage = {
  id?: number;
  step_id?: number;
  company_id?: string;
  sort_order: number;
  message_type: 'text' | 'audio' | 'image' | 'video';
  text_content?: string;
  media_url?: string;
  media_name?: string;
  media_mime?: string;
  caption?: string;
};

export type InstagramAccount = {
  id: number;
  company_id?: string;
  ig_user_id: string;
  ig_username: string;
  page_id: string;
  page_name: string;
  access_token?: string;
  token_expires_at?: string;
  is_active: boolean;
  created_at?: string;
};

export type InstagramAutomation = {
  id: number;
  company_id?: string;
  instagram_account_id: number;
  name: string;
  post_id: string;
  post_url: string;
  post_thumbnail_url?: string;
  post_caption?: string;
  keyword: string;
  active: boolean;
  reply_comment: boolean;
  reply_comment_text?: string;
  messages: InstagramAutomationMessage[];
  created_at?: string;
};

export type InstagramAutomationMessage = {
  id?: number;
  automation_id?: number;
  company_id?: string;
  sort_order: number;
  message_type: 'text' | 'image' | 'link_button';
  text_content?: string;
  media_url?: string;
  button_title?: string;
  button_url?: string;
  delay_seconds: number;
};

export type InstagramPost = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};
