# -*- coding: utf-8 -*-
import json

with open('wf_followup.json') as f:
    wf = json.load(f)

# Replace the Lead Valido? node with a Code node that filters properly
for i, n in enumerate(wf['nodes']):
    if n['name'] == 'Lead Valido?':
        wf['nodes'][i] = {
            "id": n['id'],
            "name": "Lead Valido?",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": n['position'],
            "parameters": {
                "jsCode": "// Filter out _skip items and items without telefone\nconst valid = items.filter(item => {\n  if (item.json._skip) return false;\n  if (!item.json.telefone || String(item.json.telefone).trim().length === 0) return false;\n  if (!item.json.mensagem) return false;\n  return true;\n});\n\nif (valid.length === 0) {\n  // Return empty to stop the flow\n  return [];\n}\n\nreturn valid;"
            },
            "onError": "continueRegularOutput"
        }
        print(f'Replaced with Code node')
        break

# Connection stays the same: Lead Valido? [output 0] -> Enviar Follow-up
conns = wf.get('connections', {})
lv_conns = conns.get('Lead Valido?', {})
print(f'Connections: {json.dumps(lv_conns)}')

with open('wf_followup_fixed3.json', 'w') as f:
    json.dump(wf, f, ensure_ascii=False)
print('Saved!')
