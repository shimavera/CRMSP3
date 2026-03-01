import re

with open('src/App.tsx', 'r') as f:
    app_content = f.read()

# Make sidebar closeable on desktop
app_content = app_content.replace(
    "const [sidebarOpen, setSidebarOpen] = useState(false);",
    "const [sidebarOpen, setSidebarOpen] = useState(false);\n  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);"
)

app_content = app_content.replace(
    "<aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>",
    "<aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''} ${!desktopSidebarOpen && !isMobile ? ' desktop-sidebar-closed' : ''}`}>"
)

app_content = app_content.replace(
    '<div className="dashboard-container">',
    '<div className={`dashboard-container ${!desktopSidebarOpen && !isMobile ? \'desktop-sidebar-closed\' : \'\'}`}>'
)

# Add desktop toggle button
toggle_button = """              <button
                className="desktop-menu-toggle"
                onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '6px', borderRadius: '8px', alignItems: 'center', display: 'none' }}
              >
                <Menu size={26} />
              </button>"""

app_content = app_content.replace(
    """              <button
                className="mobile-only\"""",
    toggle_button + """\n              <button
                className="mobile-only\""""
)

with open('src/App.tsx', 'w') as f:
    f.write(app_content)
