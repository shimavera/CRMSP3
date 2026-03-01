with open('src/index.css', 'r') as f:
    css = f.read()

css = css.replace("grid-template-columns: 280px 1fr;", "grid-template-columns: 280px 1fr;\ntransition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);")

css += """
@media (min-width: 769px) {
  .dashboard-container.desktop-sidebar-closed {
    grid-template-columns: 0px 1fr;
  }
  .sidebar.desktop-sidebar-closed {
    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
    border: none;
    padding: 0;
    width: 0;
  }
  .desktop-menu-toggle {
    display: inline-flex !important;
  }
}
"""

with open('src/index.css', 'w') as f:
    f.write(css)
