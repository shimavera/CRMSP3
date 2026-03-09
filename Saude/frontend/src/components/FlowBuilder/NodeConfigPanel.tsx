import { useRef, useState } from 'react';
import {
  X, Plus, Trash2, Upload, Variable, Loader2,
  Play, MessageSquare, Clock, GitBranch, Zap, Flag,
} from 'lucide-react';
import type {
  TriggerNodeData,
  SendMessageNodeData,
  WaitDelayNodeData,
  ConditionNodeData,
  ActionNodeData,
  EndNodeData,
  FlowMessageItem,
  FlowNodeType,
} from './utils/flowTypes';
import { FLOW_VARIABLES, PIPELINE_STAGES } from './utils/flowTypes';
import { NODE_COLORS } from './nodes/nodeStyles';
import { supabase } from '../../lib/supabase';

interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: FlowNodeType;
  nodeData: Record<string, unknown>;
  onUpdateData: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  onDeleteNode: (nodeId: string) => void;
  isDark: boolean;
  companyId?: string;
}

const TYPE_ICONS: Record<FlowNodeType, typeof Play> = {
  trigger: Play,
  send_message: MessageSquare,
  wait_delay: Clock,
  condition: GitBranch,
  action: Zap,
  end: Flag,
};

const TYPE_LABELS: Record<FlowNodeType, string> = {
  trigger: 'Gatilho',
  send_message: 'Enviar Mensagem',
  wait_delay: 'Aguardar',
  condition: 'Condição',
  action: 'Ação',
  end: 'Fim',
};

export default function NodeConfigPanel({
  nodeId,
  nodeType,
  nodeData,
  onUpdateData,
  onClose,
  onDeleteNode,
  isDark,
  companyId,
}: NodeConfigPanelProps) {
  const Icon = TYPE_ICONS[nodeType];
  const color = NODE_COLORS[nodeType];

  const update = (partial: Record<string, unknown>) => {
    onUpdateData(nodeId, { ...nodeData, ...partial });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
    backgroundColor: isDark ? '#1a1a2e' : '#f8fafc',
    color: isDark ? '#e0e0e0' : '#1a1a2e',
    fontSize: '0.75rem',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem',
    fontWeight: 600,
    color: isDark ? '#aaa' : '#64748b',
    marginBottom: '4px',
    display: 'block',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '14px',
  };

  return (
    <div style={{
      width: '300px',
      minWidth: '300px',
      height: '100%',
      borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      backgroundColor: isDark ? '#12121e' : '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '30px',
          height: '30px',
          borderRadius: '8px',
          backgroundColor: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} style={{ color }} />
        </div>
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 700,
          color: isDark ? '#e0e0e0' : '#1a1a2e',
          flex: 1,
        }}>
          {TYPE_LABELS[nodeType]}
        </span>
        <button onClick={onClose} style={{
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          color: isDark ? '#888' : '#94a3b8',
          padding: '4px',
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Config Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        {/* Label (all nodes) */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Nome do Nó</label>
          <input
            style={inputStyle}
            value={(nodeData.label as string) || ''}
            onChange={e => update({ label: e.target.value })}
            placeholder="Nome do nó"
          />
        </div>

        {/* Type-specific config */}
        {nodeType === 'trigger' && <TriggerConfig data={nodeData as unknown as TriggerNodeData} update={update} inputStyle={inputStyle} selectStyle={selectStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} isDark={isDark} />}
        {nodeType === 'send_message' && <SendMessageConfig data={nodeData as unknown as SendMessageNodeData} update={update} inputStyle={inputStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} isDark={isDark} companyId={companyId} />}
        {nodeType === 'wait_delay' && <WaitDelayConfig data={nodeData as unknown as WaitDelayNodeData} update={update} inputStyle={inputStyle} selectStyle={selectStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} />}
        {nodeType === 'condition' && <ConditionConfig data={nodeData as unknown as ConditionNodeData} update={update} inputStyle={inputStyle} selectStyle={selectStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} />}
        {nodeType === 'action' && <ActionConfig data={nodeData as unknown as ActionNodeData} update={update} inputStyle={inputStyle} selectStyle={selectStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} />}
        {nodeType === 'end' && <EndConfig data={nodeData as unknown as EndNodeData} update={update} inputStyle={inputStyle} selectStyle={selectStyle} labelStyle={labelStyle} sectionStyle={sectionStyle} />}
      </div>

      {/* Footer: Delete */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      }}>
        <button
          onClick={() => onDeleteNode(nodeId)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.3)',
            backgroundColor: 'transparent',
            color: '#ef4444',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Trash2 size={14} /> Excluir Nó
        </button>
      </div>
    </div>
  );
}

// ---- Sub-configs ----

interface ConfigProps {
  inputStyle: React.CSSProperties;
  selectStyle?: React.CSSProperties;
  labelStyle: React.CSSProperties;
  sectionStyle: React.CSSProperties;
  isDark?: boolean;
  companyId?: string;
}

function TriggerConfig({ data, update, selectStyle, labelStyle, sectionStyle, inputStyle }: { data: TriggerNodeData; update: (p: Record<string, unknown>) => void } & ConfigProps & { selectStyle: React.CSSProperties }) {
  return (
    <>
      <div style={sectionStyle}>
        <label style={labelStyle}>Tipo de Gatilho</label>
        <select
          style={selectStyle}
          value={data.triggerType || 'manual'}
          onChange={e => update({ triggerType: e.target.value, config: {} })}
        >
          <option value="manual">Manual</option>
          <option value="stage_change">Mudança de Stage</option>
          <option value="new_lead">Novo Lead</option>
          <option value="no_response_timeout">Lead Não Respondeu</option>
          <option value="external_lead">Lead do Site (Formulário)</option>
          <option value="meeting_scheduled">Reunião Agendada</option>
        </select>
      </div>
      {data.triggerType === 'external_lead' && (
        <div style={{ ...sectionStyle, padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 600, marginBottom: '4px' }}>Como funciona</div>
          <div style={{ fontSize: '0.6rem', color: '#64748b', lineHeight: '1.5' }}>
            Quando um lead preenche o formulário no site e cai na tabela leads_sp3, o sistema automaticamente:
            <br />1. Cria o lead no CRM (Kanban)
            <br />2. Inicia este fluxo
            <br />3. Envia a primeira mensagem via WhatsApp
          </div>
        </div>
      )}
      {data.triggerType === 'stage_change' && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>De Stage (opcional)</label>
            <select
              style={selectStyle}
              value={data.config?.from_stage || ''}
              onChange={e => update({ config: { ...data.config, from_stage: e.target.value } })}
            >
              <option value="">Qualquer</option>
              {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={sectionStyle}>
            <label style={labelStyle}>Para Stage</label>
            <select
              style={selectStyle}
              value={data.config?.to_stage || ''}
              onChange={e => update({ config: { ...data.config, to_stage: e.target.value } })}
            >
              <option value="">Selecione...</option>
              {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </>
      )}
      {data.triggerType === 'no_response_timeout' && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>Tempo sem resposta</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...inputStyle, width: '80px' }}
                type="number"
                min={1}
                value={data.config?.timeout_value || 30}
                onChange={e => update({ config: { ...data.config, timeout_value: parseInt(e.target.value) || 1 } })}
              />
              <select
                style={{ ...selectStyle, flex: 1 }}
                value={data.config?.timeout_unit || 'minutes'}
                onChange={e => update({ config: { ...data.config, timeout_unit: e.target.value } })}
              >
                <option value="minutes">Minuto(s)</option>
                <option value="hours">Hora(s)</option>
                <option value="days">Dia(s)</option>
              </select>
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>
              O fluxo inicia quando o lead não responde após este tempo desde a última mensagem enviada.
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SendMessageConfig({ data, update, inputStyle, labelStyle, sectionStyle, isDark, companyId }: { data: SendMessageNodeData; update: (p: Record<string, unknown>) => void } & ConfigProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const msgs = data.messages || [];

  const updateMessage = (idx: number, partial: Partial<FlowMessageItem>) => {
    const newMsgs = [...msgs];
    newMsgs[idx] = { ...newMsgs[idx], ...partial };
    update({ messages: newMsgs });
  };

  const addMessage = (type: FlowMessageItem['message_type']) => {
    update({ messages: [...msgs, { message_type: type, text_content: '' }] });
  };

  const removeMessage = (idx: number) => {
    update({ messages: msgs.filter((_, i) => i !== idx) });
  };

  const handleMediaUpload = async (file: File, idx: number) => {
    if (!companyId) return;
    // Validar tamanho (16MB WhatsApp limit)
    if (file.size > 16 * 1024 * 1024) {
      setUploadError('Arquivo muito grande (máx. 16MB)');
      setTimeout(() => setUploadError(null), 3000);
      return;
    }
    setUploadingIdx(idx);
    setUploadError(null);
    try {
      const ext = file.name.split('.').pop();
      const path = `${companyId}/flow-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('followup-media').upload(path, file, { contentType: file.type });
      if (error) {
        setUploadError(error.message || 'Erro no upload');
        setTimeout(() => setUploadError(null), 3000);
        return;
      }
      const { data: urlData } = supabase.storage.from('followup-media').getPublicUrl(path);
      updateMessage(idx, {
        media_url: urlData.publicUrl,
        media_name: file.name,
        media_mime: file.type,
      });
    } catch {
      setUploadError('Erro inesperado no upload');
      setTimeout(() => setUploadError(null), 3000);
    } finally {
      setUploadingIdx(null);
    }
  };

  const insertVariable = (idx: number, token: string) => {
    const msg = msgs[idx];
    const currentText = msg.text_content || '';
    updateMessage(idx, { text_content: currentText + ' ' + token });
  };

  return (
    <>
      {msgs.map((msg, idx) => (
        <div key={idx} style={{
          ...sectionStyle,
          padding: '10px',
          borderRadius: '10px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: isDark ? '#aaa' : '#64748b' }}>
              Mensagem {idx + 1} — {msg.message_type === 'text' ? 'Texto' : msg.message_type === 'audio' ? 'Áudio' : msg.message_type === 'image' ? 'Imagem' : 'Vídeo'}
            </span>
            <button onClick={() => removeMessage(idx)} style={{
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '2px',
            }}>
              <Trash2 size={12} />
            </button>
          </div>

          {msg.message_type === 'text' && (
            <>
              <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                value={msg.text_content || ''}
                onChange={e => updateMessage(idx, { text_content: e.target.value })}
                placeholder="Digite a mensagem..."
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {FLOW_VARIABLES.map(v => (
                  <button
                    key={v.token}
                    onClick={() => insertVariable(idx, v.token)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: '4px',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      backgroundColor: 'transparent',
                      color: 'var(--accent)',
                      fontSize: '0.58rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <Variable size={9} /> {v.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {(msg.message_type === 'audio' || msg.message_type === 'image' || msg.message_type === 'video') && (
            <>
              {msg.media_url ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? '#1a1a2e' : '#f1f5f9',
                  fontSize: '0.68rem',
                  color: isDark ? '#aaa' : '#64748b',
                }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.media_name || 'Arquivo enviado'}
                  </span>
                  <button
                    onClick={() => updateMessage(idx, { media_url: undefined, media_name: undefined, media_mime: undefined })}
                    style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '2px' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <button
                  disabled={uploadingIdx === idx}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    if (msg.message_type === 'audio') input.accept = 'audio/*';
                    else if (msg.message_type === 'image') input.accept = 'image/*';
                    else input.accept = 'video/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleMediaUpload(file, idx);
                    };
                    input.click();
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                    backgroundColor: 'transparent',
                    color: isDark ? '#888' : '#94a3b8',
                    fontSize: '0.7rem',
                    cursor: uploadingIdx === idx ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    opacity: uploadingIdx === idx ? 0.6 : 1,
                  }}
                >
                  {uploadingIdx === idx
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                    : <><Upload size={14} /> Enviar {msg.message_type === 'audio' ? 'Áudio' : msg.message_type === 'image' ? 'Imagem' : 'Vídeo'}</>
                  }
                </button>
              )}
              {uploadError && (
                <div style={{ fontSize: '0.62rem', color: '#ef4444', marginTop: '4px', fontWeight: 500 }}>
                  {uploadError}
                </div>
              )}
              {(msg.message_type === 'image' || msg.message_type === 'video') && (
                <div style={{ marginTop: '6px' }}>
                  <label style={labelStyle}>Legenda (opcional)</label>
                  <input
                    style={inputStyle}
                    value={msg.caption || ''}
                    onChange={e => updateMessage(idx, { caption: e.target.value })}
                    placeholder="Legenda da mídia"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {/* Add message buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {(['text', 'audio', 'image', 'video'] as const).map(type => (
          <button
            key={type}
            onClick={() => addMessage(type)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              backgroundColor: 'transparent',
              color: isDark ? '#aaa' : '#64748b',
              fontSize: '0.65rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Plus size={11} /> {type === 'text' ? 'Texto' : type === 'audio' ? 'Áudio' : type === 'image' ? 'Imagem' : 'Vídeo'}
          </button>
        ))}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} />
    </>
  );
}

function WaitDelayConfig({ data, update, inputStyle, selectStyle, labelStyle, sectionStyle }: { data: WaitDelayNodeData; update: (p: Record<string, unknown>) => void } & ConfigProps & { selectStyle: React.CSSProperties }) {
  return (
    <>
      <div style={sectionStyle}>
        <label style={labelStyle}>Tempo de Espera</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            style={{ ...inputStyle, width: '80px' }}
            type="number"
            min={1}
            value={data.delay_value || 1}
            onChange={e => update({ delay_value: parseInt(e.target.value) || 1 })}
          />
          <select
            style={{ ...selectStyle, flex: 1 }}
            value={data.delay_unit || 'days'}
            onChange={e => update({ delay_unit: e.target.value })}
          >
            <optgroup label="A partir de agora">
              <option value="minutes">Minuto(s)</option>
              <option value="hours">Hora(s)</option>
              <option value="days">Dia(s)</option>
            </optgroup>
            <optgroup label="Até a data da Reunião">
              <option value="minutes_before_meeting">Minuto(s) antes</option>
              <option value="hours_before_meeting">Hora(s) antes</option>
              <option value="days_before_meeting">Dia(s) antes</option>
            </optgroup>
          </select>
        </div>
      </div>
      <div style={sectionStyle}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={data.business_hours || false}
            onChange={e => update({ business_hours: e.target.checked })}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <span style={{ fontSize: '0.75rem', color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#475569' }}>
            Respeitar horário comercial (configurado em Ajustes &gt; Follow-up)
          </span>
        </label>
      </div>
    </>
  );
}

function ConditionConfig({ data, update, inputStyle, selectStyle, labelStyle, sectionStyle }: { data: ConditionNodeData; update: (p: Record<string, unknown>) => void } & ConfigProps & { selectStyle: React.CSSProperties }) {
  return (
    <>
      <div style={sectionStyle}>
        <label style={labelStyle}>Tipo de Condição</label>
        <select
          style={selectStyle}
          value={data.condition_type || 'lead_responded'}
          onChange={e => update({ condition_type: e.target.value, config: {} })}
        >
          <option value="lead_responded">Lead Respondeu?</option>
          <option value="stage_check">Verificar Stage</option>
          <option value="field_check">Verificar Campo</option>
          <option value="custom_field_check">Campo Personalizado</option>
        </select>
      </div>

      {data.condition_type === 'stage_check' && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Stage Esperado</label>
          <select
            style={selectStyle}
            value={data.config?.stage || ''}
            onChange={e => update({ config: { ...data.config, stage: e.target.value } })}
          >
            <option value="">Selecione...</option>
            {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {(data.condition_type === 'field_check' || data.condition_type === 'custom_field_check') && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>Campo</label>
            <input
              style={inputStyle}
              value={data.config?.field || ''}
              onChange={e => update({ config: { ...data.config, field: e.target.value } })}
              placeholder={data.condition_type === 'custom_field_check' ? 'ex: cpf, email' : 'ex: nome, telefone'}
            />
          </div>
          <div style={sectionStyle}>
            <label style={labelStyle}>Operador</label>
            <select
              style={selectStyle}
              value={data.config?.operator || 'exists'}
              onChange={e => update({ config: { ...data.config, operator: e.target.value } })}
            >
              <option value="exists">Existe</option>
              <option value="equals">Igual a</option>
              <option value="not_equals">Diferente de</option>
              <option value="contains">Contém</option>
            </select>
          </div>
          {data.config?.operator && data.config.operator !== 'exists' && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Valor</label>
              <input
                style={inputStyle}
                value={data.config?.value || ''}
                onChange={e => update({ config: { ...data.config, value: e.target.value } })}
                placeholder="Valor esperado"
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

function ActionConfig({ data, update, inputStyle, selectStyle, labelStyle, sectionStyle }: { data: ActionNodeData; update: (p: Record<string, unknown>) => void } & ConfigProps & { selectStyle: React.CSSProperties }) {
  return (
    <>
      <div style={sectionStyle}>
        <label style={labelStyle}>Tipo de Ação</label>
        <select
          style={selectStyle}
          value={data.action_type || 'move_stage'}
          onChange={e => update({ action_type: e.target.value, config: {} })}
        >
          <option value="move_stage">Mover Stage</option>
          <option value="update_field">Atualizar Campo</option>
          <option value="lock_followup">Pausar Follow-up</option>
          <option value="unlock_followup">Retomar Follow-up</option>
          <option value="close_conversation">Fechar Conversa</option>
        </select>
      </div>

      {data.action_type === 'move_stage' && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Mover para Stage</label>
          <select
            style={selectStyle}
            value={data.config?.stage || ''}
            onChange={e => update({ config: { ...data.config, stage: e.target.value } })}
          >
            <option value="">Selecione...</option>
            {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {data.action_type === 'update_field' && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>Campo</label>
            <input
              style={inputStyle}
              value={data.config?.field || ''}
              onChange={e => update({ config: { ...data.config, field: e.target.value } })}
              placeholder="ex: observacoes"
            />
          </div>
          <div style={sectionStyle}>
            <label style={labelStyle}>Valor</label>
            <input
              style={inputStyle}
              value={data.config?.value || ''}
              onChange={e => update({ config: { ...data.config, value: e.target.value } })}
              placeholder="Novo valor"
            />
          </div>
        </>
      )}

      {data.action_type === 'close_conversation' && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Motivo</label>
          <input
            style={inputStyle}
            value={data.config?.reason || ''}
            onChange={e => update({ config: { ...data.config, reason: e.target.value } })}
            placeholder="ex: Sem resposta após follow-up"
          />
        </div>
      )}
    </>
  );
}

function EndConfig({ data, update, selectStyle, labelStyle, sectionStyle }: { data: EndNodeData; update: (p: Record<string, unknown>) => void } & ConfigProps & { selectStyle: React.CSSProperties }) {
  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>Resultado</label>
      <select
        style={selectStyle}
        value={data.outcome || 'neutral'}
        onChange={e => update({ outcome: e.target.value })}
      >
        <option value="success">Sucesso (Converteu)</option>
        <option value="neutral">Neutro (Encerrado)</option>
        <option value="failed">Falhou (Perdido)</option>
      </select>
    </div>
  );
}
