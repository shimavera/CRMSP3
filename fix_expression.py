# -*- coding: utf-8 -*-
import json

with open('wf_debug.json') as f:
    wf = json.load(f)

for i, n in enumerate(wf['nodes']):
    if n['name'] == 'Agente IA':
        old_sm = n['parameters']['options']['systemMessage']

        # Fix 1: .first().all() -> .all() for videos
        new_sm = old_sm.replace(
            "$('Buscar Videos Prova Social').first() ? $('Buscar Videos Prova Social').first().all().map(",
            "$('Buscar Videos Prova Social').all().length > 0 ? $('Buscar Videos Prova Social').all().map("
        )

        # Fix 2: Add fallback || '' for prompt content
        new_sm = new_sm.replace(
            "$('Buscar Prompt IA').first().json.content",
            "($('Buscar Prompt IA').first().json.content || '')"
        )

        wf['nodes'][i]['parameters']['options']['systemMessage'] = new_sm

        changed = new_sm != old_sm
        print(f'Expression changed: {changed}')
        print(f'Old length: {len(old_sm)}')
        print(f'New length: {len(new_sm)}')

        if changed:
            # Show what changed
            if '.first().all()' in old_sm and '.first().all()' not in new_sm:
                print('Fixed: .first().all() -> .all()')
            if "|| ''" in new_sm:
                print("Fixed: Added || '' fallback for prompt content")

        print()
        print('=== NEW systemMessage ===')
        print(new_sm)
        break

with open('wf_fix_expression2.json', 'w') as f:
    json.dump(wf, f, ensure_ascii=False)
print('\nSaved to wf_fix_expression2.json')
