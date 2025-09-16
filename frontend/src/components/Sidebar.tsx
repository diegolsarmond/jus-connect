import React from "react";
import { NavLink } from "react-router-dom";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, onLogout }) => {
  return (
    <aside className="sidebar" aria-label="Menu principal">
      <header>
        <strong className="sidebar-label">Modelos</strong>
        <button type="button" onClick={onToggle} aria-pressed={collapsed} aria-label="Alternar menu">
          {collapsed ? "➡️" : "⬅️"}
        </button>
      </header>
      <nav>
        <NavLink to="/" end>
          <span role="img" aria-hidden>
            📚
          </span>
          <span className="sidebar-label">Biblioteca</span>
        </NavLink>
        <NavLink to="/templates/new">
          <span role="img" aria-hidden>
            ✍️
          </span>
          <span className="sidebar-label">Novo modelo</span>
        </NavLink>
      </nav>
      <footer>
        <button type="button" onClick={onLogout}>
          Sair
        </button>
      </footer>
    </aside>
  );
};

export default Sidebar;
