# -*- coding: utf-8 -*-
import json

with open('wf_followup_fixed3.json') as f:
    wf = json.load(f)

# Fix: The Enviar Follow-up HTTP Request replaces $json with API response,
# so Atualizar Kanban and Gravar no Histórico can't access original lead data.
# Solution: Change Atualizar Kanban to use $('Lead Valido?').item.json
# which uses pairedItem to match the correct item from the upstream Code node.

for i, n in enumerate(wf['nodes']):
    if n['name'] == 'Atualizar Kanban':
        old_query = n['parameters']['query']
        new_query = """=UPDATE sp3chat SET followup_stage = {{ $('Lead Valido?').item.json.next_stage }}, last_outbound_at = NOW() WHERE telefone = '{{ $('Lead Valido?').item.json.telefone }}' AND company_id = '{{ $('Lead Valido?').item.json.company_id }}'"""
        n['parameters']['query'] = new_query
        wf['nodes'][i] = n
        print(f'Fixed Atualizar Kanban:')
        print(f'  OLD: {old_query}')
        print(f'  NEW: {new_query}')
        print()

    if n['name'] == 'Gravar no Histórico':
        old_query = n['parameters']['query']
        new_query = """=INSERT INTO n8n_chat_histories (session_id, message, company_id) VALUES ('{{ $('Lead Valido?').item.json.telefone }}', '{{ JSON.stringify({type: "ai", messages: [{text: $('Lead Valido?').item.json.mensagem}]}) }}', '{{ $('Lead Valido?').item.json.company_id }}')"""
        n['parameters']['query'] = new_query
        wf['nodes'][i] = n
        print(f'Fixed Gravar no Histórico:')
        print(f'  OLD: {old_query}')
        print(f'  NEW: {new_query}')

with open('wf_followup_final.json', 'w') as f:
    json.dump(wf, f, ensure_ascii=False)
print('\nSaved to wf_followup_final.json')
