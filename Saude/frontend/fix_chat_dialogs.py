import re

with open('src/components/ChatView.tsx', 'r') as f:
    content = f.read()

# 1. Add dialog state and helper functions
dialog_state = """    const [dialog, setDialog] = useState<{
        type: 'alert' | 'confirm' | 'prompt';
        title: string;
        message: string;
        placeholder?: string;
        onConfirm: (val?: string) => void;
        onCancel: () => void;
    } | null>(null);

    const showAlert = (message: string) => new Promise<void>((resolve) => {
        setDialog({ type: 'alert', title: 'Aviso', message, onConfirm: () => { setDialog(null); resolve(); }, onCancel: () => { setDialog(null); resolve(); } });
    });

    const showConfirm = (message: string) => new Promise<boolean>((resolve) => {
        setDialog({ type: 'confirm', title: 'Confirmação', message, onConfirm: () => { setDialog(null); resolve(true); }, onCancel: () => { setDialog(null); resolve(false); } });
    });
"""

content = content.replace("    const [tempName, setTempName] = useState('');", "    const [tempName, setTempName] = useState('');\n" + dialog_state)

# 2. Add async keyword to functions that will use await showAlert
functions_to_async = [
    "handleSaveName", "toggleIA", "toggleFollowupLock", "saveObservacoes",
    "handleFileSelect", "sendMedia", "startRecording", "sendAudio"
]

for func in functions_to_async:
    content = content.replace(f"const {func} = (", f"const {func} = async (")

# Note: startRecording is already async sometimes, but let's be safe.
# Actually, I should check the exact signatures.

# 3. Replace alert calls
# alert('Erro ao renomear: ' + e.message); -> await showAlert('Erro ao renomear: ' + e.message);
content = content.replace("alert('Erro ao renomear: ' + e.message);", "await showAlert('Erro ao renomear: ' + e.message);")
content = content.replace("alert('Erro ao atualizar status da IA: ' + error.message);", "await showAlert('Erro ao atualizar status da IA: ' + error.message);")
content = content.replace("alert('Erro ao atualizar follow-up: ' + error.message);", "await showAlert('Erro ao atualizar follow-up: ' + error.message);")
content = content.replace("alert('Erro ao salvar observações: ' + error.message);", "await showAlert('Erro ao salvar observações: ' + error.message);")
content = content.replace("alert('Por favor, selecione apenas arquivos de imagem ou vídeo.');", "await showAlert('Por favor, selecione apenas arquivos de imagem ou vídeo.');")
content = content.replace("alert('Instância WhatsApp não configurada.');", "await showAlert('Instância WhatsApp não configurada.');")
content = content.replace("alert(`Erro ao enviar ${isVideo ? 'vídeo' : 'imagem'}: ` + err.message);", "await showAlert(`Erro ao enviar ${isVideo ? 'vídeo' : 'imagem'}: ` + err.message);")
content = content.replace("alert('Erro ao acessar microfone: ' + err);", "await showAlert('Erro ao acessar microfone: ' + err);")

# 4. Inject Dialog UI at the end
# Find the end of return ( ... )
# It ends with </div>\n    );\n};

modal_ui = """
            {dialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: '#111827', fontWeight: 'bold' }}>{dialog.title}</h3>
                        <p style={{ margin: '0 0 20px 0', color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.5' }}>{dialog.message}</p>
                        
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
                                onClick={() => dialog.onConfirm()}
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
};
"""

content = content.replace("        </div>\n    );\n};", modal_ui)

with open('src/components/ChatView.tsx', 'w') as f:
    f.write(content)

