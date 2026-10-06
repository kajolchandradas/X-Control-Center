export const Modal = {
  // Toast notifications
  toast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-fade-in`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠';

    toast.innerHTML = `
      <span style="font-weight: bold; font-size: 14px;">${icon}</span>
      <div style="flex: 1; word-break: break-word;">${escapeHtml(message)}</div>
      <button style="color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 0 4px;" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Confirmation modal
  confirm({ title, message, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal-box animate-fade-in">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button class="btn btn-icon btn-outline close-btn">✕</button>
        </div>
        <div class="modal-body">
          <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.5;">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary cancel-btn">Cancel</button>
          <button class="btn ${confirmClass} confirm-btn">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('.close-btn').onclick = close;
    overlay.querySelector('.cancel-btn').onclick = close;
    overlay.querySelector('.confirm-btn').onclick = async () => {
      close();
      if (typeof onConfirm === 'function') await onConfirm();
    };
  },

  // Profile Detail & Posts Modal
  showProfile(user, posts = []) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    
    const formattedDate = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unavailable';
    const numFmt = n => n != null ? Number(n).toLocaleString() : '—';

    overlay.innerHTML = `
      <div class="modal-box animate-fade-in" style="max-width: 620px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h3>Account Profile</h3>
          <button class="btn btn-icon btn-outline close-btn">✕</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 18px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img class="user-avatar" style="width: 64px; height: 64px;" src="${user.profile_image_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'}" alt="${escapeHtml(user.username)}">
            <div>
              <div style="font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                ${escapeHtml(user.name)}
                ${user.verified ? '<span class="badge-verified">✓</span>' : ''}
              </div>
              <div style="color: var(--text-muted); font-size: 14px;">@${escapeHtml(user.username)}</div>
            </div>
          </div>

          ${user.description ? `<p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">${escapeHtml(user.description)}</p>` : ''}

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Followers</div>
              <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">${numFmt(user.followers_count)}</div>
            </div>
            <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Following</div>
              <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">${numFmt(user.following_count)}</div>
            </div>
            <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Posts</div>
              <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">${numFmt(user.tweet_count)}</div>
            </div>
          </div>

          <div style="font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Joined: ${formattedDate}</span>
            ${user.location ? `<span>📍 ${escapeHtml(user.location)}</span>` : ''}
          </div>

          ${posts && posts.length > 0 ? `
            <div style="margin-top: 10px;">
              <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Recent Posts (${posts.length})</h4>
              <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
                ${posts.map(p => `
                  <div style="background: var(--bg-surface); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); font-size: 13px;">
                    <div style="color: var(--text-secondary); line-height: 1.4;">${escapeHtml(p.text)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <a href="https://x.com/${encodeURIComponent(user.username)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
            Open on X ↗
          </a>
          <button class="btn btn-primary close-btn">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelectorAll('.close-btn').forEach(b => b.onclick = close);
  }
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
