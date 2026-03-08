import re

files_to_update = ['src/components/ChatView.tsx', 'src/components/KanbanView.tsx']
for file_path in files_to_update:
    with open(file_path, 'r') as f:
        content = f.read()

    new_config = """    const CUSTOM_FIELDS_CONFIG = [
        { key: 'data_avaliacao', label: 'Data da Avaliação', type: 'date' },
        { key: 'email', label: 'E-mail', type: 'text' },
        { key: 'proposta_valor', label: 'Valor da Proposta / Forecast', type: 'number' }
    ];"""

    # Replace the old config
    content = re.sub(r'const CUSTOM_FIELDS_CONFIG = \[[\s\S]*?\];', new_config, content)

    with open(file_path, 'w') as f:
        f.write(content)

