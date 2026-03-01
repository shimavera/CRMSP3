import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Add dialog state
dialog_state = """  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const showAlert = (message: string) => new Promise<void>((resolve) => {
    setDialog({ type: 'alert', title: 'Aviso', message, onConfirm: () => { setDialog(null); resolve(); }, onCancel: () => { setDialog(null); resolve(); } });
  });

  const showConfirm = (message: string) => new Promise<boolean>((resolve) => {
    setDialog({ type: 'confirm', title: 'Confirmação', message, onConfirm: () => { setDialog(null); resolve(true); }, onCancel: () => { setDialog(null); resolve(false); } });
  });
"""

content = content.replace("  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);", "  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);\n" + dialog_state)

# 2. Replace calls
content = content.replace("if (!window.confirm('Tem certeza que deseja excluir este Lead?')) return;", "if (!await showConfirm('Tem certeza que deseja excluir este Lead?')) return;")
content = content.replace("alert('Erro ao excluir: ' + error.message);", "await showAlert('Erro ao excluir: ' + error.message);")

# 3. Inject UI
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
}"""

content = content.replace("    </div>\n  );\n}", modal_ui)

with open('src/App.tsx', 'w') as f:
    f.write(content)

