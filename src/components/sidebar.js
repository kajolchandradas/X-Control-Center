export function renderSidebar({ activeTab = 'overview', counts = {} }) {
  const numFmt = n => (n != null && n > 0) ? Number(n).toLocaleString() : '';

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊', count: null },
    { id: 'not-following-back', label: 'Not Following Back', icon: '👤❌', count: counts.notFollowingBack },
    { id: 'mutual', label: 'Mutual Followers', icon: '🔄', count: counts.mutuals },
    { id: 'following', label: 'Following', icon: '➡️', count: counts.following },
    { id: 'followers', label: 'Followers', icon: '⬅️', count: counts.followers },
    { id: 'archive-import', label: 'Archive Import', icon: '📁', count: null },
    { id: 'settings', label: 'Settings', icon: '⚙️', count: null }
  ];

  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="brand-icon">𝕏</div>
        <div>
          <div class="brand-title">X Control Center</div>
          <div class="brand-subtitle">Real-Data Dashboard</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section-label">Account Management</div>
        ${navItems.slice(0, 5).map(item => `
          <div class="nav-item ${activeTab === item.id ? 'active' : ''}" data-tab="${item.id}">
            <div class="nav-item-content">
              <span class="nav-icon">${item.icon}</span>
              <span>${item.label}</span>
            </div>
            ${item.count ? `<span class="nav-count">${numFmt(item.count)}</span>` : ''}
          </div>
        `).join('')}

        <div class="nav-section-label" style="margin-top: 14px;">Tools & Sources</div>
        ${navItems.slice(5).map(item => `
          <div class="nav-item ${activeTab === item.id ? 'active' : ''}" data-tab="${item.id}">
            <div class="nav-item-content">
              <span class="nav-icon">${item.icon}</span>
              <span>${item.label}</span>
            </div>
          </div>
        `).join('')}
      </nav>

      <div class="sidebar-footer">
        <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
          Zero fake data guarantee. Real official X API or verified user data archive.
        </div>
      </div>
    </aside>
  `;
}
