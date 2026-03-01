import re

with open('src/components/SettingsView.tsx', 'r') as f:
    content = f.read()

# Add state and functions for Modal
modal_state = """
    // --- DIALOG MODAL STATE ---
    const [dialog, setDialog] = useState<{
        type: 'alert' | 'confirm' | 'prompt';
        title: string;
        message: string;
        placeholder?: string;
        onConfirm: (val?: string) => void;
        onCancel: () => void;
    } | null>(null);

    const [promptInput, setPromptInput] = useState('');

    const showAlert = (message: string) => new Promise<void>((resolve) => {
        setDialog({ type: 'alert', title: 'Aviso', message, onConfirm: () => { setDialog(null); resolve(); }, onCancel: () => { setDialog(null); resolve(); } });
    });

    const showConfirm = (message: string) => new Promise<boolean>((resolve) => {
        setDialog({ type: 'confirm', title: 'Confirmação', message, onConfirm: () => { setDialog(null); resolve(true); }, onCancel: () => { setDialog(null); resolve(false); } });
    });

    const showPrompt = (message: string, placeholder?: string) => new Promise<string | null>((resolve) => {
        setPromptInput('');
        setDialog({ type: 'prompt', title: 'Confirmação Exigida', message, placeholder, onConfirm: (val) => { setDialog(null); resolve(val || null); }, onCancel: () => { setDialog(null); resolve(null); } });
    });
"""

# Find where to inject
# After 'const [togglingClientId, setTogglingClientId] = useState<string | null>(null);'
content = content.replace("const [togglingClientId, setTogglingClientId] = useState<string | null>(null);", "const [togglingClientId, setTogglingClientId] = useState<string | null>(null);\n" + modal_state)

# Replacements
content = content.replace("alert(`Erro ao salvar:", "await showAlert(`Erro ao salvar:")
content = content.replace("alert('Erro ao fazer upload: ' + err.message);", "await showAlert('Erro ao fazer upload: ' + err.message);")
content = content.replace("if (error) alert('Erro: ' + error.message);", "if (error) { await showAlert('Erro: ' + error.message); }")
content = content.replace("if (!window.confirm(`Excluir o vídeo", "if (!await showConfirm(`Excluir o vídeo")
content = content.replace("alert('Erro ao salvar mensagem rápida: ' + err.message);", "await showAlert('Erro ao salvar mensagem rápida: ' + err.message);")
content = content.replace("if (!window.confirm('Excluir esta mensagem", "if (!await showConfirm('Excluir esta mensagem")
content = content.replace("alert('Erro ao salvar no banco. Verifique se criou a tabela sp3_prompts via SQL no Supabase.');", "await showAlert('Erro ao salvar no banco. Verifique se criou a tabela sp3_prompts via SQL no Supabase.');")
content = content.replace("const handleRestoreVersion = (content: string) => {", "const handleRestoreVersion = async (content: string) => {")
content = content.replace("if (window.confirm('Deseja carregar esta versão", "if (await showConfirm('Deseja carregar esta versão")
content = content.replace("if (!window.confirm('Deseja realmente desconectar o WhatsApp?')) return;", "if (!await showConfirm('Deseja realmente desconectar o WhatsApp?')) return;")
content = content.replace("alert('Nao e possivel excluir a instancia ativa. Ative outra instancia primeiro.');", "await showAlert('Nao e possivel excluir a instancia ativa. Ative outra instancia primeiro.');")
content = content.replace("if (!window.confirm(`Excluir a instancia", "if (!await showConfirm(`Excluir a instancia")
content = content.replace("alert('Erro ao alterar status: ' + error.message);", "await showAlert('Erro ao alterar status: ' + error.message);")
content = content.replace("alert('Erro ao salvar: ' + error.message);", "await showAlert('Erro ao salvar: ' + error.message);")
content = content.replace("if (!window.confirm(confirmText)) return;", "if (!await showConfirm(confirmText)) return;")
content = content.replace("window.prompt(`Para confirmar, digite o nome da empresa: \\\"${empresa.name}\\\"`);", "await showPrompt(`Para confirmar, digite o nome da empresa: \\\"${empresa.name}\\\"`);")
content = content.replace("alert('Nome não confere. Exclusão cancelada.');", "await showAlert('Nome não confere. Exclusão cancelada.');")
content = content.replace("alert('Erro ao excluir: ' + error.message);", "await showAlert('Erro ao excluir: ' + error.message);")
content = content.replace("alert(`Empresa \\\"${empresa.name}\\\" excluída com sucesso! ${data?.deleted_users || 0} usuário(s) removido(s).`);", "await showAlert(`Empresa \\\"${empresa.name}\\\" excluída com sucesso! ${data?.deleted_users || 0} usuário(s) removido(s).`);")
content = content.replace("alert('Erro: ' + e.message);", "await showAlert('Erro: ' + e.message);")
content = content.replace("if (!window.confirm('Remover este", "if (!await showConfirm('Remover este")
content = content.replace("if (!window.confirm('CUIDADO:", "if (!await showConfirm('CUIDADO:")
content = content.replace("if (!window.confirm('TEM CERTEZA ABSOLUTA?", "if (!await showConfirm('TEM CERTEZA ABSOLUTA?")
content = content.replace("alert('Histórico de conversas apagado com sucesso!", "await showAlert('Histórico de conversas apagado com sucesso!")
content = content.replace("alert('Erro ao apagar histórico: ' + err.message);", "await showAlert('Erro ao apagar histórico: ' + err.message);")

# Inject Dialog UI at the bottom
modal_ui = """
            {dialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: '#111827', fontWeight: 'bold' }}>{dialog.title}</h3>
                        <p style={{ margin: '0 0 20px 0', color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.5' }}>{dialog.message}</p>
                        
                        {dialog.type === 'prompt' && (
                            <input 
                                type="text" 
                                autoFocus
                                value={promptInput}
                                onChange={(e) => setPromptInput(e.target.value)}
                                placeholder={dialog.placeholder || 'Digite...'}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', marginBottom: '20px', fontSize: '0.95rem', outline: 'none' }}
                                onKeyDown={(e) => { if (e.key === 'Enter') dialog.onConfirm(promptInput); }}
                            />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            {dialog.type !== 'alert' && (
                                <button 
                                    onClick={dialog.onCancel}
                                    style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#374151', cursor: 'pointer', fontWeight: '500' }}
                                >
                                    Cancelar
                                </button>
                            )}
                            <button 
                                onClick={() => dialog.onConfirm(promptInput)}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6254f1', color: 'white', cursor: 'pointer', fontWeight: '500' }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
"""

# Replace the last `</div>\n    );`
content = content.replace("        </div>\n    );\n}", modal_ui + "\n}")

with open('src/components/SettingsView.tsx', 'w') as f:
    f.write(content)

