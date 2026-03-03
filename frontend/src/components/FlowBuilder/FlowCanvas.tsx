import { useCallback, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TriggerNode from './nodes/TriggerNode';
import SendMessageNode from './nodes/SendMessageNode';
import WaitDelayNode from './nodes/WaitDelayNode';
import ConditionNode from './nodes/ConditionNode';
import ActionNode from './nodes/ActionNode';
import EndNode from './nodes/EndNode';
import type { FlowNodeType } from './utils/flowTypes';
import { getDefaultNodeData } from './utils/flowTypes';
import { NODE_COLORS } from './nodes/nodeStyles';

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  send_message: SendMessageNode,
  wait_delay: WaitDelayNode,
  condition: ConditionNode,
  action: ActionNode,
  end: EndNode,
};

interface FlowCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  isDark: boolean;
}

export default function FlowCanvas({
  initialNodes,
  initialEdges,
  onNodesChange: onNodesChangeProp,
  onEdgesChange: onEdgesChangeProp,
  onNodeSelect,
  isDark,
}: FlowCanvasProps) {
  const reactFlowRef = useRef<{ screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number } } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Connect edges
  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const edgeColor = sourceNode ? NODE_COLORS[sourceNode.type as FlowNodeType] || '#64748b' : '#64748b';

    let label: string | undefined;
    if (sourceNode?.type === 'condition') {
      label = params.sourceHandle === 'true' ? 'Sim' : 'Não';
    }

    setEdges(eds => {
      const newEdges = addEdge({
        ...params,
        label,
        animated: true,
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      }, eds);
      onEdgesChangeProp(newEdges);
      return newEdges;
    });
  }, [nodes, setEdges, onEdgesChangeProp]);

  // Validate connection
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const source = 'source' in connection ? connection.source : null;
    const target = 'target' in connection ? connection.target : null;
    if (!source || !target || source === target) return false;

    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);
    if (!sourceNode || !targetNode) return false;

    if (sourceNode.type === 'end') return false;
    if (targetNode.type === 'trigger') return false;

    const existingEdge = edges.find(e => e.source === source && e.target === target);
    if (existingEdge) return false;

    const sourceHandle = 'sourceHandle' in connection ? connection.sourceHandle : undefined;

    if (sourceNode.type === 'condition') {
      const handleEdge = edges.find(e => e.source === source && e.sourceHandle === sourceHandle);
      if (handleEdge) return false;
    } else {
      const existingOut = edges.find(e => e.source === source);
      if (existingOut) return false;
    }

    return true;
  }, [nodes, edges]);

  // Node click
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeSelect(node.id);
  }, [onNodeSelect]);

  // Pane click (deselect)
  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // Drag-to-create from palette
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow') as FlowNodeType;
    if (!type || !reactFlowRef.current) return;

    const position = reactFlowRef.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position,
      data: getDefaultNodeData(type),
    };

    setNodes(nds => {
      const updated = [...nds, newNode];
      onNodesChangeProp(updated);
      return updated;
    });
  }, [setNodes, onNodesChangeProp]);

  // Track all node/edge changes for parent sync
  const handleNodesChangeInternal = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    setTimeout(() => {
      setNodes(current => {
        onNodesChangeProp(current);
        return current;
      });
    }, 0);
  }, [onNodesChange, setNodes, onNodesChangeProp]);

  const handleEdgesChangeInternal = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    onEdgesChange(changes);
    setTimeout(() => {
      setEdges(current => {
        onEdgesChangeProp(current);
        return current;
      });
    }, 0);
  }, [onEdgesChange, setEdges, onEdgesChangeProp]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChangeInternal}
        onEdgesChange={handleEdgesChangeInternal}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={(instance: any) => { reactFlowRef.current = instance; }}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          animated: true,
          style: { strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
        style={{
          backgroundColor: isDark ? '#0f0f1a' : '#f8fafc',
        }}
      >
        <Background gap={15} size={1} color={isDark ? '#1a1a2e' : '#e2e8f0'} />
        <Controls
          style={{
            borderRadius: '10px',
            overflow: 'hidden',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
          }}
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => NODE_COLORS[node.type as FlowNodeType] || '#64748b'}
          style={{
            borderRadius: '10px',
            overflow: 'hidden',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
            backgroundColor: isDark ? '#1a1a2e' : '#f1f5f9',
          }}
        />
      </ReactFlow>
    </div>
  );
}
