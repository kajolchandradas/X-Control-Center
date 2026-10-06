export function renderNavbar({ user, status, dataSource, onRefresh, onLogout, onSettings }) {
  const numFmt = n => n != null ? Number(n).toLocaleString() : '—';
  
  let statusText = 'Disconnected';
  let statusClass = 'status-disconnected';

  if (status === 'connected') {
    statusText = 'Connected (Live API)';
    statusClass = 'status-connected';
  } else if (status === 'archive') {
    statusText = 'Archive Mode';
    statusClass = 'status-archive';
  } else if (status === 'credits_unavailable') {
    statusText = 'API Credits Unavailable';
    statusClass = 'status-warning';
  } else if (status === 'error') {
    statusText = 'API Error';
    statusClass = 'status-error';
  }

  return `
    <header class="navbar">
      <div class="navbar-left">
        <div class="status-pill ${statusClass}">
          <span class="status-indicator-dot"></span>
          <span>${statusText}</span>
        </div>
        ${dataSource ? `
          <span class="badge ${dataSource.includes('LIVE') ? 'badge-source-live' : 'badge-source-archive'}">
            DATA SOURCE: ${dataSource}
          </span>
        ` : ''}
      </div>

      <div class="navbar-right">
        <button class="btn btn-secondary btn-sm" id="btn-refresh-global" title="Refresh data from source">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          Refresh
        </button>

        ${user ? `
          <div style="display: flex; align-items: center; gap: 10px;">
            <img class="user-avatar" style="width: 34px; height: 34px;" src="${user.profile_image_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'}" alt="${user.username || 'User'}">
            <span style="font-size: 13px; font-weight: 600; display: none; @media(min-width: 600px){ display: inline; }">@${user.username || 'user'}</span>
            <button class="btn btn-outline btn-sm" id="btn-logout" title="Disconnect account">
              Logout
            </button>
          </div>
        ` : `
          <button class="btn btn-primary btn-sm" id="btn-login-nav">
            Connect X
          </button>
        `}
      </div>
    </header>
  `;
}
