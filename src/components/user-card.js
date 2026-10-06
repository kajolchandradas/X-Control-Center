export function renderUserCard(user, options = {}) {
  const { isFollowing = true, isFollower = false, onUnfollow, onFollow, onViewProfile } = options;

  const numFmt = n => n != null ? Number(n).toLocaleString() : '—';
  const ageFmt = d => {
    if (!d) return '—';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  const defaultAvatar = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
  const avatarUrl = user.profile_image_url || defaultAvatar;

  return `
    <div class="user-row-card" data-user-id="${user.id || user.username}">
      <div class="user-main-col">
        <img class="user-avatar" src="${avatarUrl}" alt="${escapeHtml(user.username || 'user')}" onerror="this.src='${defaultAvatar}'">
        <div class="user-details">
          <div class="user-name-line">
            <span>${escapeHtml(user.name || user.username || 'Unknown')}</span>
            ${user.verified ? '<span class="badge-verified" title="Verified">✓</span>' : ''}
          </div>
          <div class="user-handle-line">@${escapeHtml(user.username || 'unknown')}</div>
          ${user.description ? `<div class="user-bio-preview">${escapeHtml(user.description)}</div>` : ''}
        </div>
      </div>

      <div class="user-stats-cols">
        <div class="user-stat-metric">
          <span class="user-stat-metric-val">${numFmt(user.followers_count)}</span>
          <span class="user-stat-metric-lbl">Followers</span>
        </div>
        <div class="user-stat-metric">
          <span class="user-stat-metric-val">${numFmt(user.following_count)}</span>
          <span class="user-stat-metric-lbl">Following</span>
        </div>
        <div class="user-stat-metric">
          <span class="user-stat-metric-val">${numFmt(user.tweet_count)}</span>
          <span class="user-stat-metric-lbl">Posts</span>
        </div>
        <div class="user-stat-metric">
          <span class="user-stat-metric-val">${ageFmt(user.created_at)}</span>
          <span class="user-stat-metric-lbl">Joined</span>
        </div>
      </div>

      <div class="user-actions-col">
        <button class="btn btn-secondary btn-sm action-view" data-id="${user.id || user.username}" title="View profile details">
          Profile
        </button>
        <a href="https://x.com/${encodeURIComponent(user.username)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" title="Open on X">
          𝕏 ↗
        </a>
        <button class="btn btn-danger btn-sm action-unfollow" data-id="${user.id || user.username}" data-username="${escapeHtml(user.username)}" title="Unfollow account">
          Unfollow
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
