export function renderStatsCards({ account = {}, counts = {}, lastUpdated = null, dataSource = 'LIVE X API' }) {
  const numFmt = n => n != null ? Number(n).toLocaleString() : 'Unavailable';

  const followerCount = account.followers_count ?? counts.followers ?? null;
  const followingCount = account.following_count ?? counts.following ?? null;
  const tweetCount = account.tweet_count ?? null;
  const notFollowingBack = counts.notFollowingBack ?? (followingCount != null && followerCount != null ? Math.max(0, followingCount - followerCount) : null);
  const mutuals = counts.mutuals ?? null;

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label-wrap">
          <span class="stat-label">Followers</span>
          <span style="font-size: 16px;">👥</span>
        </div>
        <div class="stat-value">${numFmt(followerCount)}</div>
        <div class="stat-subtext">Accounts following you</div>
      </div>

      <div class="stat-card">
        <div class="stat-label-wrap">
          <span class="stat-label">Following</span>
          <span style="font-size: 16px;">➡️</span>
        </div>
        <div class="stat-value">${numFmt(followingCount)}</div>
        <div class="stat-subtext">Accounts you follow</div>
      </div>

      <div class="stat-card highlight">
        <div class="stat-label-wrap">
          <span class="stat-label" style="color: #60a5fa;">Not Following Back</span>
          <span style="font-size: 16px;">❌</span>
        </div>
        <div class="stat-value" style="color: #60a5fa;">${numFmt(notFollowingBack)}</div>
        <div class="stat-subtext">Following - Followers</div>
      </div>

      <div class="stat-card">
        <div class="stat-label-wrap">
          <span class="stat-label">Mutual Followers</span>
          <span style="font-size: 16px;">🔄</span>
        </div>
        <div class="stat-value">${numFmt(mutuals)}</div>
        <div class="stat-subtext">Mutual connections</div>
      </div>

      <div class="stat-card">
        <div class="stat-label-wrap">
          <span class="stat-label">Total Posts</span>
          <span style="font-size: 16px;">💬</span>
        </div>
        <div class="stat-value">${numFmt(tweetCount)}</div>
        <div class="stat-subtext">Lifetime tweets/posts</div>
      </div>

      <div class="stat-card">
        <div class="stat-label-wrap">
          <span class="stat-label">Total Likes</span>
          <span style="font-size: 16px;">❤️</span>
        </div>
        <div class="stat-value" style="font-size: 20px; font-weight: 600; color: var(--text-muted); margin-top: 18px;">
          API Restricted
        </div>
        <div class="stat-subtext" style="font-size: 11px;">
          Not provided in standard X metrics
        </div>
      </div>
    </div>
  `;
}
