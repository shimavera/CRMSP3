const fs = require('fs');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const companyId = 'e55d9ef0-4e0d-4d69-8555-141772957921';

// Nodes
const triggerId = uuidv4();
const wait2hId = uuidv4();
const msg2hId = uuidv4();
const wait6hId = uuidv4();
const msg6hId = uuidv4();
const wait4hBeforeId = uuidv4();
const msg4hBeforeId = uuidv4();
const wait2hBeforeId = uuidv4();
const msg2hBeforeId = uuidv4();
const wait30mBeforeId = uuidv4();
const msg30mBeforeId = uuidv4();
const wait5mBeforeId = uuidv4();
const msg5mBeforeId = uuidv4();

const nodes = [
    {
        id: triggerId,
        type: 'trigger',
        position: { x: 50, y: 50 },
        data: { label: 'Reunião Agendada', triggerType: 'meeting_scheduled' }
    },
    {
        id: wait2hId,
        type: 'wait_delay',
        position: { x: 50, y: 150 },
        data: { label: 'Aguardar 2 Horas', delay_value: 2, delay_unit: 'hours' }
    },
    {
        id: msg2hId,
        type: 'send_message',
        position: { x: 50, y: 250 },
        data: {
            label: 'Mensagem Confirmação',
            messages: [{ type: 'text', text_content: 'Olá {{lead_name}}, passando para confirmar que nossa reunião foi agendada para {{meeting_datetime}}! Se precisar de algo antes, é só chamar.' }]
        }
    },
    {
        id: wait6hId,
        type: 'wait_delay',
        position: { x: 50, y: 350 },
        data: { label: 'Aguardar 6 Horas', delay_value: 6, delay_unit: 'hours' }
    },
    {
        id: msg6hId,
        type: 'send_message',
        position: { x: 50, y: 450 },
        data: {
            label: 'Mensagem Material de Apoio',
            messages: [{ type: 'text', text_content: 'Gostaria de mandar um material rápido para você ir conhecendo mais como trabalhamos antes da nossa reunião no dia {{meeting_date}}.' }]
        }
    },
    {
        id: wait4hBeforeId,
        type: 'wait_delay',
        position: { x: 50, y: 550 },
        data: { label: 'Wait 4h Before', delay_value: 4, delay_unit: 'hours_before_meeting' }
    },
    {
        id: msg4hBeforeId,
        type: 'send_message',
        position: { x: 50, y: 650 },
        data: {
            label: 'Lembrete (4 Horas)',
            messages: [{ type: 'text', text_content: 'Passando pra lembrar do nosso papo mais tarde hoje, às {{meeting_time}}! Tudo certo por aí?' }]
        }
    },
    {
        id: wait2hBeforeId,
        type: 'wait_delay',
        position: { x: 50, y: 750 },
        data: { label: 'Wait 2h Before', delay_value: 2, delay_unit: 'hours_before_meeting' }
    },
    {
        id: msg2hBeforeId,
        type: 'send_message',
        position: { x: 50, y: 850 },
        data: {
            label: 'Lembrete (2 Horas)',
            messages: [{ type: 'text', text_content: 'Faltam 2 horas para o nosso bate-papo! Já estou com tudo separado aqui pra conversarmos.' }]
        }
    },
    {
        id: wait30mBeforeId,
        type: 'wait_delay',
        position: { x: 50, y: 950 },
        data: { label: 'Wait 30m Before', delay_value: 30, delay_unit: 'minutes_before_meeting' }
    },
    {
        id: msg30mBeforeId,
        type: 'send_message',
        position: { x: 50, y: 1050 },
        data: {
            label: 'Lembrete (30 Min)',
            messages: [{ type: 'text', text_content: 'Ei {{nome}}, nossa reunião começa em 30 minutinhos!' }]
        }
    },
    {
        id: wait5mBeforeId,
        type: 'wait_delay',
        position: { x: 50, y: 1150 },
        data: { label: 'Wait 5m Before', delay_value: 5, delay_unit: 'minutes_before_meeting' }
    },
    {
        id: msg5mBeforeId,
        type: 'send_message',
        position: { x: 50, y: 1250 },
        data: {
            label: 'Lembrete Link (5 Min)',
            messages: [{ type: 'text', text_content: 'Estamos abrindo a sala! Pode entrar acessando o nosso link: {{meeting_link}}' }]
        }
    }
];

const edges = [
    { id: uuidv4(), source: triggerId, target: wait2hId, sourceHandle: "bottom" },
    { id: uuidv4(), source: wait2hId, target: msg2hId, sourceHandle: "bottom" },
    { id: uuidv4(), source: msg2hId, target: wait6hId, sourceHandle: "bottom" },
    { id: uuidv4(), source: wait6hId, target: msg6hId, sourceHandle: "bottom" },
    { id: uuidv4(), source: msg6hId, target: wait4hBeforeId, sourceHandle: "bottom" },
    { id: uuidv4(), source: wait4hBeforeId, target: msg4hBeforeId, sourceHandle: "bottom" },
    { id: uuidv4(), source: msg4hBeforeId, target: wait2hBeforeId, sourceHandle: "bottom" },
    { id: uuidv4(), source: wait2hBeforeId, target: msg2hBeforeId, sourceHandle: "bottom" },
    { id: uuidv4(), source: msg2hBeforeId, target: wait30mBeforeId, sourceHandle: "bottom" },
    { id: uuidv4(), source: wait30mBeforeId, target: msg30mBeforeId, sourceHandle: "bottom" },
    { id: uuidv4(), source: msg30mBeforeId, target: wait5mBeforeId, sourceHandle: "bottom" },
    { id: uuidv4(), source: wait5mBeforeId, target: msg5mBeforeId, sourceHandle: "bottom" }
];

const flowData = { nodes, edges };

// We want to generate an insert query to execute in supabase since we don't have the secret key in the frontend code
const sql = `
INSERT INTO sp3_flows (
  company_id, name, is_active, trigger_type, trigger_config, is_template, flow_data
) VALUES (
  '${companyId}',
  'Lembrete de Reunião',
  true,
  'meeting_scheduled',
  '{}'::jsonb,
  false,
  '${JSON.stringify(flowData)}'::jsonb
);
`;

fs.writeFileSync('/tmp/insert_flow.sql', sql);
console.log('SQL generated at /tmp/insert_flow.sql');
