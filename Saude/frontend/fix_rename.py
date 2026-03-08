import re

with open('src/components/ChatView.tsx', 'r') as f:
    content = f.read()

# Add states
states = """    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

    const handleSaveName = async () => {
        if (!selectedLead) return;
        try {
            const { error } = await supabase
                .from('sp3chat')
                .update({ nome: tempName })
                .eq('id', selectedLead.id);
            if (error) throw error;
            setSelectedLead({ ...selectedLead, nome: tempName });
        } catch (e: any) {
            alert('Erro ao renomear: ' + e.message);
        } finally {
            setIsEditingName(false);
        }
    };
"""

content = content.replace("    const timerRef = useRef<any>(null);", "    const timerRef = useRef<any>(null);\n" + states)

# Update the rendering
h4_pattern = r'<h4 style=\{\{ fontWeight: \'700\', fontSize: \'0\.95rem\', color: \'#111b21\' \}\}>\{selectedLead\.nome \|\| selectedLead\.telefone\}</h4>'

h4_replacement = """{isEditingName ? (
                                        <input
                                            autoFocus
                                            value={tempName}
                                            onChange={e => setTempName(e.target.value)}
                                            onBlur={handleSaveName}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                            style={{ fontWeight: '700', fontSize: '0.95rem', color: '#111b21', border: '1px solid var(--accent)', borderRadius: '4px', padding: '2px 6px', outline: 'none' }}
                                        />
                                    ) : (
                                        <h4 
                                            onDoubleClick={() => { setTempName(selectedLead.nome || ''); setIsEditingName(true); }}
                                            style={{ fontWeight: '700', fontSize: '0.95rem', color: '#111b21', cursor: 'text' }}
                                            title="Clique duplo para editar nome"
                                        >
                                            {selectedLead.nome || selectedLead.telefone}
                                        </h4>
                                    )}"""

content = re.sub(h4_pattern, h4_replacement, content)

with open('src/components/ChatView.tsx', 'w') as f:
    f.write(content)

