// Sidebar.tsx
import React from 'react';
import { sidebarStyles } from '../styles/sidebarStyles';

interface SidebarProps {
  collapsed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  return (
    <aside className={`${sidebarStyles.root.base} ${collapsed ? sidebarStyles.root.collapsed.on : sidebarStyles.root.collapsed.off}`}>
      <div className={sidebarStyles.root.inner}>
        <button className={sidebarStyles.collapse.button}>
          <span className={sidebarStyles.collapse.label.base}>App</span>
        </button>

        <ul className={sidebarStyles.collapse.list}>
          <li className={sidebarStyles.item.base}>
            <span className={sidebarStyles.item.content.base}>Create</span>
          </li>
          <li className={sidebarStyles.item.base}>
            <span className={sidebarStyles.item.content.base}>Settings</span>
          </li>
          <li className={sidebarStyles.item.base}>
            <span className={sidebarStyles.item.content.base}>Help</span>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
