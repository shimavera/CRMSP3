import { useState, useEffect, useCallback, useRef } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import { Save, AlertCircle, CheckCircle, Loader2, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { FlowDefinition, FlowNodeType, UserProfile } from '../../lib/supabase';
import FlowCanvas from './FlowCanvas';
import FlowSidebar from './FlowSidebar';
import NodeConfigPanel from './NodeConfigPanel';
import { getDefaultNodeData } from './utils/flowTypes';
import { validateFlow, type ValidationResult } from './utils/flowValidation';

interface FlowBuilderViewProps {
  authUser: UserProfile;
  isDarkMode: boolean;
}

export default function FlowBuilderView({ authUser, isDarkMode }: FlowBuilderViewProps) {
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Current working nodes/edges
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  const companyId = authUser.company_id;
  const selectedFlow = flows.find(f => f.id === selectedFlowId);

  // Load flows
  useEffect(() => {
    if (!companyId) return;
    loadFlows();
  }, [companyId]);

  const loadFlows = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('sp3_flows')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFlows(data as FlowDefinition[]);
    }
    setIsLoading(false);
  };

  // When selecting a flow, load its data
  useEffect(() => {
    if (selectedFlow) {
      const fd = selectedFlow.flow_data || { nodes: [], edges: [] };
      nodesRef.current = fd.nodes as Node[];
      edgesRef.current = fd.edges as Edge[];
      setFlowName(selectedFlow.name);
      setSelectedNodeId(null);
      setIsDirty(false);
      setValidation(null);
    }
  }, [selectedFlowId]);

  // Handlers
  const handleNodesChange = useCallback((nodes: Node[]) => {
    nodesRef.current = nodes;
    setIsDirty(true);
  }, []);

  const handleEdgesChange = useCallback((edges: Edge[]) => {
    edgesRef.current = edges;
    setIsDirty(true);
  }, []);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleUpdateNodeData = useCallback((nodeId: string, newData: Record<string, unknown>) => {
    nodesRef.current = nodesRef.current.map(n =>
      n.id === nodeId ? { ...n, data: newData as Node['data'] } : n
    );
    setIsDirty(true);
    // Force re-render of canvas
    setSelectedNodeId(prev => prev);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    nodesRef.current = nodesRef.current.filter(n => n.id !== nodeId);
    edgesRef.current = edgesRef.current.filter(e => e.source !== nodeId && e.target !== nodeId);
    setSelectedNodeId(null);
    setIsDirty(true);
  }, []);

  // CRUD operations
  const handleCreateFlow = async () => {
    if (!companyId) return;

    const triggerId = crypto.randomUUID();
    const defaultFlow = {
      nodes: [{
        id: triggerId,
        type: 'trigger' as const,
        position: { x: 300, y: 50 },
        data: getDefaultNodeData('trigger'),
      }],
      edges: [],
    };

    const { data, error } = await supabase
      .from('sp3_flows')
      .insert({
        company_id: companyId,
        name: 'Novo Fluxo',
        flow_data: defaultFlow,
        trigger_type: 'manual',
      })
      .select()
      .single();

    if (!error && data) {
      const newFlow = data as FlowDefinition;
      setFlows(prev => [newFlow, ...prev]);
      setSelectedFlowId(newFlow.id);
      showToast('success', 'Fluxo criado com sucesso');
    } else {
      showToast('error', 'Erro ao criar fluxo');
    }
  };

  const handleSaveFlow = async () => {
    if (!selectedFlowId || !companyId) return;

    // Validate first
    const flowData = {
      nodes: nodesRef.current.map(n => ({
        id: n.id,
        type: n.type as FlowNodeType,
        position: n.position,
        data: n.data as Record<string, unknown>,
      })),
      edges: edgesRef.current.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        label: typeof e.label === 'string' ? e.label : undefined,
        animated: e.animated,
      })),
    };

    const result = validateFlow(flowData as any);
    setValidation(result);

    if (!result.isValid) {
      showToast('error', `${result.errors.length} erro(s) encontrado(s)`);
      return;
    }

    // Determine trigger type from trigger node
    const triggerNode = flowData.nodes.find(n => n.type === 'trigger');
    const triggerType = (triggerNode?.data as Record<string, unknown>)?.triggerType as string || 'manual';
    const triggerConfig = (triggerNode?.data as Record<string, unknown>)?.config || {};

    setIsSaving(true);
    const { error } = await supabase
      .from('sp3_flows')
      .update({
        name: flowName,
        flow_data: flowData,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedFlowId);

    setIsSaving(false);

    if (!error) {
      setFlows(prev => prev.map(f =>
        f.id === selectedFlowId
          ? { ...f, name: flowName, flow_data: flowData as any, trigger_type: triggerType as FlowDefinition['trigger_type'], trigger_config: triggerConfig as Record<string, string> }
          : f
      ) as FlowDefinition[]);
      setIsDirty(false);
      showToast('success', result.warnings.length > 0
        ? `Salvo com ${result.warnings.length} aviso(s)`
        : 'Fluxo salvo com sucesso'
      );
    } else {
      showToast('error', 'Erro ao salvar fluxo');
    }
  };

  const handleDeleteFlow = (id: number) => {
    setConfirmDelete(id);
  };

  const confirmDeleteFlow = async () => {
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('sp3_flows')
      .delete()
      .eq('id', confirmDelete);

    if (!error) {
      setFlows(prev => prev.filter(f => f.id !== confirmDelete));
      if (selectedFlowId === confirmDelete) {
        setSelectedFlowId(null);
        setSelectedNodeId(null);
      }
      showToast('success', 'Fluxo excluído');
    }
    setConfirmDelete(null);
  };

  const handleDuplicateFlow = async (id: number) => {
    const flow = flows.find(f => f.id === id);
    if (!flow || !companyId) return;

    const { data, error } = await supabase
      .from('sp3_flows')
      .insert({
        company_id: companyId,
        name: `${flow.name} (cópia)`,
        flow_data: flow.flow_data,
        trigger_type: flow.trigger_type,
        trigger_config: flow.trigger_config,
        is_active: false,
      })
      .select()
      .single();

    if (!error && data) {
      setFlows(prev => [data as FlowDefinition, ...prev]);
      showToast('success', 'Fluxo duplicado');
    }
  };

  const handleToggleActive = async (id: number, active: boolean) => {
    const { error } = await supabase
      .from('sp3_flows')
      .update({ is_active: active })
      .eq('id', id);

    if (!error) {
      setFlows(prev => prev.map(f => f.id === id ? { ...f, is_active: active } : f));
      showToast('success', active ? 'Fluxo ativado' : 'Fluxo desativado');
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Selected node data for config panel
  const selectedNode = selectedNodeId ? nodesRef.current.find(n => n.id === selectedNodeId) : null;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      backgroundColor: isDarkMode ? '#0f0f1a' : '#f8fafc',
    }}>
      {/* Left Sidebar */}
      <FlowSidebar
        flows={flows}
        selectedFlowId={selectedFlowId}
        onSelectFlow={setSelectedFlowId}
        onCreateFlow={handleCreateFlow}
        onDeleteFlow={handleDeleteFlow}
        onDuplicateFlow={handleDuplicateFlow}
        onToggleActive={handleToggleActive}
        isLoading={isLoading}
        isDark={isDarkMode}
      />

      {/* Center: Canvas or Empty State */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedFlow ? (
          <>
            {/* Top Toolbar */}
            <div style={{
              padding: '10px 16px',
              borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: isDarkMode ? '#12121e' : '#ffffff',
            }}>
              {/* Flow name */}
              {editingName ? (
                <input
                  autoFocus
                  value={flowName}
                  onChange={e => setFlowName(e.target.value)}
                  onBlur={() => { setEditingName(false); setIsDirty(true); }}
                  onKeyDown={e => { if (e.key === 'Enter') { setEditingName(false); setIsDirty(true); } }}
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: isDarkMode ? '#e0e0e0' : '#1a1a2e',
                    backgroundColor: 'transparent',
                    border: `1px solid var(--accent)`,
                    borderRadius: '6px',
                    padding: '4px 8px',
                    outline: 'none',
                    minWidth: '200px',
                  }}
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: isDarkMode ? '#e0e0e0' : '#1a1a2e',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {flowName || 'Sem nome'}
                  <Edit2 size={12} style={{ color: isDarkMode ? '#666' : '#94a3b8' }} />
                </button>
              )}

              {/* Status badges */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: selectedFlow.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                color: selectedFlow.is_active ? '#10b981' : '#64748b',
                fontSize: '0.65rem',
                fontWeight: 600,
              }}>
                {selectedFlow.is_active ? 'Ativo' : 'Inativo'}
              </div>

              {isDirty && (
                <div style={{
                  fontSize: '0.65rem',
                  color: '#f59e0b',
                  fontWeight: 500,
                }}>
                  Alterações não salvas
                </div>
              )}

              <div style={{ flex: 1 }} />

              {/* Validation errors */}
              {validation && !validation.isValid && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#ef4444',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                }}
                  title={validation.errors.join('\n')}
                >
                  <AlertCircle size={14} />
                  {validation.errors.length} erro(s)
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handleSaveFlow}
                disabled={isSaving || !isDirty}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isDirty ? 'var(--accent)' : (isDarkMode ? '#2a2a3e' : '#e2e8f0'),
                  color: isDirty ? '#fff' : (isDarkMode ? '#555' : '#94a3b8'),
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: isDirty ? 'pointer' : 'default',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                Salvar
              </button>
            </div>

            {/* Canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
              <ReactFlowProvider>
                <FlowCanvas
                  key={selectedFlowId}
                  initialNodes={(selectedFlow.flow_data?.nodes || []) as Node[]}
                  initialEdges={(selectedFlow.flow_data?.edges || []) as Edge[]}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onNodeSelect={handleNodeSelect}
                  isDark={isDarkMode}
                />
              </ReactFlowProvider>
            </div>
          </>
        ) : (
          /* Empty State */
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            color: isDarkMode ? '#555' : '#94a3b8',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              backgroundColor: isDarkMode ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                <circle cx="12" cy="5" r="3" />
                <line x1="12" y1="8" x2="12" y2="14" />
                <circle cx="6" cy="19" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="12" y1="14" x2="6" y2="16" />
                <line x1="12" y1="14" x2="18" y2="16" />
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: isDarkMode ? '#e0e0e0' : '#1a1a2e',
                marginBottom: '6px',
              }}>
                Flow Builder
              </div>
              <div style={{ fontSize: '0.8rem', maxWidth: '300px' }}>
                Selecione um fluxo na sidebar ou crie um novo para começar a construir sua automação visual.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Config Panel */}
      {selectedNode && (
        <NodeConfigPanel
          nodeId={selectedNode.id}
          nodeType={selectedNode.type as FlowNodeType}
          nodeData={selectedNode.data as Record<string, unknown>}
          onUpdateData={handleUpdateNodeData}
          onClose={() => setSelectedNodeId(null)}
          onDeleteNode={handleDeleteNode}
          isDark={isDarkMode}
          companyId={companyId}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '10px',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff',
          fontSize: '0.78rem',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}
      {/* Modal Confirmar Exclusão */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#fee2e2', padding: '10px', borderRadius: '50%', color: '#ef4444' }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>Excluir Fluxo</h3>
              </div>
            </div>

            <p style={{ margin: '0 0 24px 0', fontSize: '0.95rem', color: isDarkMode ? '#cbd5e1' : '#475569', lineHeight: 1.5 }}>
              Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita e todas as automações que dependem dele vão parar de funcionar.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '10px 16px', borderRadius: '10px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                  color: isDarkMode ? '#cbd5e1' : '#475569',
                  fontWeight: 600, fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteFlow}
                style={{
                  padding: '10px 16px', borderRadius: '10px',
                  backgroundColor: '#ef4444', border: 'none',
                  color: 'white', fontWeight: 600, fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
