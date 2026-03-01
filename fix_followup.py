# -*- coding: utf-8 -*-
import json

with open('wf_followup.json') as f:
    wf = json.load(f)

for i, n in enumerate(wf['nodes']):
    if n['name'] == 'Lead Valido?':
        conds = n['parameters']['conditions']['conditions']
        for c in conds:
            if c.get('id') == 'cond-tel':
                old_op = c['operator'].copy()
                # Fix: add singleValue: true for unary operator isNotEmpty
                c['operator']['singleValue'] = True
                # Remove rightValue since it's a unary operator
                if 'rightValue' in c:
                    del c['rightValue']
                print(f'OLD operator: {json.dumps(old_op)}')
                print(f'NEW operator: {json.dumps(c["operator"])}')
                print(f'rightValue removed: {"rightValue" not in c}')

        wf['nodes'][i] = n
        break

# Save
with open('wf_followup_fixed.json', 'w') as f:
    json.dump(wf, f, ensure_ascii=False)

print('\nSaved to wf_followup_fixed.json')
