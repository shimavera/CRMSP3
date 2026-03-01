# -*- coding: utf-8 -*-
import json

with open('wf_followup.json') as f:
    wf = json.load(f)

# Replace the Filter node with an IF node
for i, n in enumerate(wf['nodes']):
    if n['name'] == 'Lead Valido?':
        # Replace with IF node v2 that checks _skip is not true
        wf['nodes'][i] = {
            "id": n['id'],
            "name": "Lead Valido?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": n['position'],
            "parameters": {
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": ""
                    },
                    "conditions": [
                        {
                            "id": "cond-skip",
                            "leftValue": "={{ $json._skip }}",
                            "rightValue": True,
                            "operator": {
                                "type": "boolean",
                                "operation": "notEqual"
                            }
                        }
                    ],
                    "combinator": "and"
                }
            }
        }
        print(f'Replaced Filter v2 with IF v2')
        print(f'Condition: $json._skip notEqual true')
        print(f'True branch (output 0) -> lead IS valid')
        print(f'False branch (output 1) -> _skip item')
        break

# Connections should be the same: Lead Valido? [output 0] -> Enviar Follow-up
# Verify
conns = wf.get('connections', {})
lv_conns = conns.get('Lead Valido?', {})
print(f'\nConnections from Lead Valido?: {json.dumps(lv_conns, indent=2)}')

with open('wf_followup_fixed2.json', 'w') as f:
    json.dump(wf, f, ensure_ascii=False)

print('\nSaved to wf_followup_fixed2.json')
