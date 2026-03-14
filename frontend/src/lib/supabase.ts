import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
    calendar?: boolean;
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
  closed?: boolean;
  closed_reason?: string;
  stage_updated_at?: string;
  followup_stage?: number;
  followup_locked?: boolean;
  last_outbound_at?: string;
  last_interaction_at?: string;
  instance_name?: string;
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

export type CalendarSettings = {
  company_id: string;
  ai_can_schedule: boolean;
  google_access_token?: string;
  google_refresh_token?: string;
  google_token_expiry?: string;
  google_calendar_id?: string;
  default_meeting_duration: number;
  business_hours: Record<string, { active: boolean; start: string; end: string }>;
  created_at?: string;
  updated_at?: string;
};

export type CalendarEvent = {
  id: number;
  company_id: string;
  lead_id?: number;
  google_event_id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'cancelled' | 'completed' | 'no_show';
  confirmation_status?: 'pending' | 'confirmed' | 'unconfirmed';
  attendees?: any;
  created_at?: string;
  updated_at?: string;
};

// ===== Flow Builder Visual =====

export type FlowNodeType = 'trigger' | 'send_message' | 'wait_delay' | 'condition' | 'action' | 'end';

export type FlowMessageItem = {
  message_type: 'text' | 'audio' | 'image' | 'video';
  text_content?: string;
  media_url?: string;
  media_name?: string;
  media_mime?: string;
  caption?: string;
  delay_between_ms?: number;
};

export type TriggerNodeData = {
  label: string;
  triggerType: 'manual' | 'stage_change' | 'new_lead' | 'no_response_timeout' | 'external_lead' | 'meeting_scheduled';
  config: Record<string, string>;
};

export type SendMessageNodeData = {
  label: string;
  messages: FlowMessageItem[];
};

export type WaitDelayNodeData = {
  label: string;
  delay_value: number;
  delay_unit: 'minutes' | 'hours' | 'days' | 'minutes_before_meeting' | 'hours_before_meeting' | 'days_before_meeting';
  business_hours?: boolean;
};

export type ConditionNodeData = {
  label: string;
  condition_type: 'lead_responded' | 'field_check' | 'stage_check' | 'custom_field_check' | 'message_contains';
  config: {
    field?: string;
    operator?: 'equals' | 'not_equals' | 'contains' | 'exists';
    value?: string;
    stage?: string;
    keyword?: string;
  };
};

export type ActionNodeData = {
  label: string;
  action_type: 'move_stage' | 'update_field' | 'lock_followup' | 'unlock_followup' | 'close_conversation' | 'update_calendar_confirmation';
  config: {
    stage?: string;
    field?: string;
    value?: string;
    reason?: string;
    confirmation_status?: 'confirmed' | 'unconfirmed';
  };
};

export type EndNodeData = {
  label: string;
  outcome: 'success' | 'neutral' | 'failed';
};

export type FlowNodeData = TriggerNodeData | SendMessageNodeData | WaitDelayNodeData | ConditionNodeData | ActionNodeData | EndNodeData;

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: FlowNodeData;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  animated?: boolean;
};

export type FlowData = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type FlowDefinition = {
  id: number;
  company_id?: string;
  name: string;
  description?: string;
  trigger_type: 'manual' | 'stage_change' | 'new_lead' | 'no_response_timeout' | 'external_lead' | 'meeting_scheduled';
  trigger_config: Record<string, string>;
  flow_data: FlowData;
  is_active: boolean;
  is_template: boolean;
  template_source_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type FlowExecution = {
  id: number;
  company_id?: string;
  flow_id: number;
  lead_id: number;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  current_node_id: string;
  next_run_at?: string;
  started_at?: string;
  completed_at?: string;
  pause_reason?: string;
  execution_log: Array<{ node_id: string; action: string; timestamp: string; result?: string }>;
  created_at?: string;
  updated_at?: string;
};

export type IAGap = {
  id: number;
  company_id?: string;
  pergunta: string;
  contexto_lead?: string;
  telefone_lead?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at?: string;
  resolved_at?: string;
};

// ===== Subscription / Billing =====

export type SubscriptionStatus = {
  allowed: boolean;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'blocked' | 'legacy';
  plan_type: 'trial' | 'monthly' | 'annual' | 'legacy';
  reason?: string;
  warning?: string;
  trial_end?: string;
  trial_leads_used?: number;
  trial_lead_limit?: number;
  days_remaining?: number;
  current_period_end?: string;
};
