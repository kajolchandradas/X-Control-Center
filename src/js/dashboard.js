import { API } from './api.js';
import { Auth } from './auth.js';
import { Storage } from './storage.js';
import { Filters } from './filters.js';
import { FollowingManager } from './following.js';
import { renderNavbar } from '../components/navbar.js';
import { renderSidebar } from '../components/sidebar.js';
import { renderStatsCards } from '../components/stats.js';
import { renderUserCard } from '../components/user-card.js';
import { Modal } from '../components/modal.js';

export const Dashboard = {
  state: {
    account: null,
    following: [],
    followers: [],
    notFollowingBack: [],
    mutuals: [],
    fans: [],
    counts: {
      following: 0,
      followers: 0,
      notFollowingBack: 0,
      mutuals: 0,
      fans: 0
    },
    status: 'disconnected', // 'connected', 'archive', 'credits_unavailable', 'error', 'disconnected'
    dataSource: null,       // 'LIVE X API', 'X DATA ARCHIVE', null
    errorMessage: null,
    errorType: null,
    lastUpdated: null,
    activeTab: 'overview',
    loading: false
  },

  async init() {
    this.state.activeTab = Storage.getActiveTab() || 'overview';

    // Subscribe to Auth changes
    Auth.subscribe(async (authState) => {
      if (authState.loading) return;

      if (authState.authenticated && authState.user) {
        this.state.account = authState.user;
        await this.loadLiveData();
      } else {
        // Check if we have an X Data Archive stored locally
        const cachedArchive = Storage.getArchiveCache();
        if (cachedArchive) {
          this.applyArchiveData(cachedArchive.following, cachedArchive.followers, cachedArchive.account);
        } else {
          this.state.status = 'disconnected';
          this.state.dataSource = null;
          this.render();
        }
      }
    });
  },

  async loadLiveData() {
    this.state.loading = true;
    this.state.errorMessage = null;
    this.render();

    try {
      const res = await API.getAnalysis();

      this.state.account = res.account || this.state.account;
      this.state.following = res.following || [];
      this.state.followers = res.followers || [];
      this.state.notFollowingBack = res.notFollowingBack || [];
      this.state.mutuals = res.mutuals || [];
      this.state.fans = res.fans || [];
      this.state.counts = res.counts || {
        following: this.state.following.length,
        followers: this.state.followers.length,
        notFollowingBack: this.state.notFollowingBack.length,
        mutuals: this.state.mutuals.length,
        fans: this.state.fans.length
      };

      this.state.status = 'connected';
      this.state.dataSource = 'LIVE X API';
      this.state.lastUpdated = res.timestamp || new Date().toISOString();
      this.state.errorMessage = null;
    } catch (err) {
      console.warn('Live X analysis failed:', err);
      this.state.errorType = err.errorType || 'API_ERROR';
      this.state.errorMessage = err.message || 'X API request failed.';

      if (err.errorType === 'CREDITS_UNAVAILABLE') {
        this.state.status = 'credits_unavailable';
      } else {
        this.state.status = 'error';
      }

      // Check if user has an archive available to fall back on
      const cachedArchive = Storage.getArchiveCache();
      if (cachedArchive) {
        Modal.toast('Live API unavailable. Showing cached X Data Archive.', 'info', 5000);
        this.applyArchiveData(cachedArchive.following, cachedArchive.followers, cachedArchive.account, false);
      }
    } finally {
      this.state.loading = false;
      this.render();
    }
  },

  applyArchiveData(followingList = [], followersList = [], account = null, updateStatus = true) {
    // Normalise accounts
    const cleanFollowing = followingList.map(u => ({
      id: u.id || u.accountId || u.username,
      username: u.username || u.userLink?.split('user_id=')[1] || u.id || 'user',
      name: u.name || u.username || 'User',
      description: u.description || '',
      profile_image_url: u.profile_image_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
      verified: Boolean(u.verified),
      followers_count: u.followers_count ?? null,
      following_count: u.following_count ?? null,
      tweet_count: u.tweet_count ?? null,
      created_at: u.created_at || null
    }));

    const cleanFollowers = followersList.map(u => ({
      id: u.id || u.accountId || u.username,
      username: u.username || u.userLink?.split('user_id=')[1] || u.id || 'user',
      name: u.name || u.username || 'User',
      description: u.description || '',
      profile_image_url: u.profile_image_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
      verified: Boolean(u.verified),
      followers_count: u.followers_count ?? null,
      following_count: u.following_count ?? null,
      tweet_count: u.tweet_count ?? null,
      created_at: u.created_at || null
    }));

    const followerUsernames = new Set(cleanFollowers.map(u => (u.username || '').toLowerCase()));
    const followingUsernames = new Set(cleanFollowing.map(u => (u.username || '').toLowerCase()));

    const notFollowingBack = cleanFollowing.filter(u => !followerUsernames.has((u.username || '').toLowerCase()));
    const mutuals = cleanFollowing.filter(u => followerUsernames.has((u.username || '').toLowerCase()));
    const fans = cleanFollowers.filter(u => !followingUsernames.has((u.username || '').toLowerCase()));

    this.state.following = cleanFollowing;
    this.state.followers = cleanFollowers;
    this.state.notFollowingBack = notFollowingBack;
    this.state.mutuals = mutuals;
    this.state.fans = fans;

    this.state.counts = {
      following: cleanFollowing.length,
      followers: cleanFollowers.length,
      notFollowingBack: notFollowingBack.length,
      mutuals: mutuals.length,
      fans: fans.length
    };

    if (account) {
      this.state.account = account;
    } else if (!this.state.account) {
      this.state.account = {
        name: 'Archive Account',
        username: 'archive_user',
        description: 'Account loaded from official X Data Archive file.',
        followers_count: cleanFollowers.length,
        following_count: cleanFollowing.length,
        tweet_count: null
      };
    }

    if (updateStatus) {
      this.state.status = 'archive';
      this.state.dataSource = 'X DATA ARCHIVE';
      this.state.lastUpdated = new Date().toISOString();
    }

    // Save to storage cache
    Storage.saveArchiveCache({
      following: cleanFollowing,
      followers: cleanFollowers,
      account: this.state.account,
      timestamp: new Date().toISOString()
    });

    this.render();
  },

  setActiveTab(tab) {
    this.state.activeTab = tab;
    Storage.setActiveTab(tab);
    Filters.setCriteria({ category: tab === 'mutual' ? 'mutual' : (tab === 'followers' ? 'fans' : (tab === 'following' ? 'all' : 'not-following-back')) });
    this.render();
  },

  getCurrentList() {
    switch (this.state.activeTab) {
      case 'not-following-back':
        return this.state.notFollowingBack;
      case 'mutual':
        return this.state.mutuals;
      case 'following':
        return this.state.following;
      case 'followers':
        return this.state.followers;
      default:
        return this.state.notFollowingBack;
    }
  },

  render() {
    const root = document.getElementById('app');
    if (!root) return;

    root.innerHTML = `
      <div class="ambient-glow"></div>
      <div class="ambient-glow-2"></div>
      
      <div class="dashboard-layout">
        ${renderSidebar({
          activeTab: this.state.activeTab,
          counts: this.state.counts
        })}

        <div class="main-wrapper">
          ${renderNavbar({
            user: this.state.account,
            status: this.state.status,
            dataSource: this.state.dataSource
          })}

          <main class="dashboard-content">
            ${this.renderStatusBanners()}
            ${this.renderProfileSection()}
            ${this.renderMainView()}
          </main>
        </div>
      </div>
      <div id="toast-container" class="toast-container"></div>
    `;

    this.attachEvents();
  },

  renderStatusBanners() {
    if (this.state.status === 'credits_unavailable') {
      return `
        <div class="alert-card alert-warning animate-fade-in">
          <div style="font-size: 24px;">💳</div>
          <div class="alert-content">
            <h4>X API Credits Unavailable</h4>
            <p>${escapeHtml(this.state.errorMessage || 'X API credits are unavailable for this request.')}</p>
            <p style="margin-top: 4px; font-weight: 600;">No fake or placeholder accounts will be displayed.</p>
            <div class="alert-actions">
              <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                Open X Developer Portal ↗
              </a>
              <button class="btn btn-primary btn-sm" id="btn-switch-archive">
                Import X Data Archive
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.state.status === 'error') {
      return `
        <div class="alert-card alert-danger animate-fade-in">
          <div style="font-size: 24px;">⚠️</div>
          <div class="alert-content">
            <h4>X API Request Failed</h4>
            <p>${escapeHtml(this.state.errorMessage || 'Could not fetch live data from the official X API.')}</p>
            <div class="alert-actions">
              <button class="btn btn-secondary btn-sm" id="btn-retry-live">
                Retry Live Request
              </button>
              <button class="btn btn-primary btn-sm" id="btn-switch-archive">
                Use X Data Archive
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.state.status === 'disconnected') {
      return `
        <div class="alert-card alert-info animate-fade-in">
          <div style="font-size: 24px;">🔗</div>
          <div class="alert-content">
            <h4>Connect Your X Account</h4>
            <p>Connect your official X account via secure OAuth 2.0 PKCE to inspect following/followers in real-time, or import your personal X Data Archive.</p>
            <div class="alert-actions">
              <button class="btn btn-primary btn-sm" id="btn-login-hero">
                Connect X Account
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-switch-archive">
                Import X Data Archive
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  },

  renderProfileSection() {
    if (!this.state.account) return '';

    const a = this.state.account;
    const defaultAvatar = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';

    return `
      <section class="profile-banner animate-fade-in">
        <div class="profile-user-info">
          <img class="profile-avatar" src="${a.profile_image_url || defaultAvatar}" alt="${escapeHtml(a.username || 'user')}" onerror="this.src='${defaultAvatar}'">
          <div class="profile-names">
            <div class="profile-display-name">
              <span>${escapeHtml(a.name || a.username || 'Authenticated User')}</span>
              ${a.verified ? '<span class="badge-verified" title="Verified">✓</span>' : ''}
            </div>
            <div class="profile-handle">@${escapeHtml(a.username || 'user')}</div>
            ${a.description ? `<p class="profile-bio">${escapeHtml(a.description)}</p>` : ''}
          </div>
        </div>

        <div class="profile-actions">
          <button class="btn btn-secondary btn-sm" id="btn-refresh-data">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Refresh
          </button>
          <a class="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href="https://x.com/${encodeURIComponent(a.username || '')}">
            View on 𝕏 ↗
          </a>
        </div>
      </section>
    `;
  },

  renderMainView() {
    if (this.state.activeTab === 'archive-import') {
      return this.renderArchiveImportView();
    }

    if (this.state.activeTab === 'settings') {
      return this.renderSettingsView();
    }

    // Default: List view with overview statistics
    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        ${renderStatsCards({
          account: this.state.account || {},
          counts: this.state.counts,
          lastUpdated: this.state.lastUpdated,
          dataSource: this.state.dataSource
        })}

        ${this.renderFiltersPanel()}
        ${this.renderUserList()}
      </div>
    `;
  },

  renderFiltersPanel() {
    return `
      <section class="filter-panel animate-fade-in">
        <div class="filter-row-top">
          <div class="search-input-wrap">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input type="text" id="filter-search" class="input" placeholder="Search display name, @username or bio..." value="${escapeHtml(Filters.criteria.searchQuery)}">
          </div>

          <div class="filter-chips-wrap">
            <button class="filter-chip ${this.state.activeTab === 'not-following-back' ? 'active' : ''}" data-category="not-following-back">
              Not Following Back (${this.state.counts.notFollowingBack})
            </button>
            <button class="filter-chip ${this.state.activeTab === 'mutual' ? 'active' : ''}" data-category="mutual">
              Mutuals (${this.state.counts.mutuals})
            </button>
            <button class="filter-chip ${this.state.activeTab === 'following' ? 'active' : ''}" data-category="following">
              All Following (${this.state.counts.following})
            </button>
            <button class="filter-chip ${this.state.activeTab === 'followers' ? 'active' : ''}" data-category="followers">
              All Followers (${this.state.counts.followers})
            </button>
          </div>
        </div>

        <div class="filter-row-bottom">
          <div class="filter-group">
            <span class="filter-label">Verified:</span>
            <select id="filter-verified" class="select">
              <option value="all" ${Filters.criteria.verified === 'all' ? 'selected' : ''}>All</option>
              <option value="verified" ${Filters.criteria.verified === 'verified' ? 'selected' : ''}>Verified Only</option>
              <option value="unverified" ${Filters.criteria.verified === 'unverified' ? 'selected' : ''}>Unverified</option>
            </select>
          </div>

          <div class="filter-group">
            <span class="filter-label">Activity:</span>
            <select id="filter-activity" class="select">
              <option value="all" ${Filters.criteria.activity === 'all' ? 'selected' : ''}>All Activity</option>
              <option value="inactive" ${Filters.criteria.activity === 'inactive' ? 'selected' : ''}>Inactive (< 50 posts)</option>
              <option value="active" ${Filters.criteria.activity === 'active' ? 'selected' : ''}>Active (50 - 2K posts)</option>
              <option value="high" ${Filters.criteria.activity === 'high' ? 'selected' : ''}>Highly Active (2K+ posts)</option>
            </select>
          </div>

          <div class="filter-group">
            <span class="filter-label">Min Followers:</span>
            <select id="filter-followers-range" class="select">
              <option value="0" ${Filters.criteria.minFollowers === 0 ? 'selected' : ''}>0+</option>
              <option value="100" ${Filters.criteria.minFollowers === 100 ? 'selected' : ''}>100+</option>
              <option value="1000" ${Filters.criteria.minFollowers === 1000 ? 'selected' : ''}>1K+</option>
              <option value="10000" ${Filters.criteria.minFollowers === 10000 ? 'selected' : ''}>10K+</option>
              <option value="100000" ${Filters.criteria.minFollowers === 100000 ? 'selected' : ''}>100K+</option>
            </select>
          </div>

          <div class="filter-group">
            <span class="filter-label">Sort:</span>
            <select id="filter-sort" class="select">
              <option value="followers" ${Filters.criteria.sortBy === 'followers' ? 'selected' : ''}>Followers (High to Low)</option>
              <option value="following" ${Filters.criteria.sortBy === 'following' ? 'selected' : ''}>Following (High to Low)</option>
              <option value="posts" ${Filters.criteria.sortBy === 'posts' ? 'selected' : ''}>Posts (High to Low)</option>
              <option value="newest" ${Filters.criteria.sortBy === 'newest' ? 'selected' : ''}>Joined (Newest)</option>
              <option value="oldest" ${Filters.criteria.sortBy === 'oldest' ? 'selected' : ''}>Joined (Oldest)</option>
              <option value="alpha" ${Filters.criteria.sortBy === 'alpha' ? 'selected' : ''}>Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>
      </section>
    `;
  },

  renderUserList() {
    if (this.state.loading) {
      return `
        <div class="empty-state glass-panel">
          <div class="empty-state-icon animate-spin">⟳</div>
          <h3>Fetching Official X Data...</h3>
          <p>Contacting official X API endpoints. Live rate limits and pagination are being respected.</p>
        </div>
      `;
    }

    const currentList = this.getCurrentList();
    const filtered = Filters.apply(currentList);

    if (currentList.length === 0) {
      if (this.state.status === 'credits_unavailable' || this.state.status === 'error') {
        return `
          <div class="empty-state glass-panel animate-fade-in">
            <div class="empty-state-icon">💳</div>
            <h3>No Accounts Displayed</h3>
            <p>Official X API access or credits are unavailable. Under our strict real-data guarantee, no fake, demo, or placeholder accounts will ever be generated.</p>
            <div style="margin-top: 12px; display: flex; gap: 10px;">
              <button class="btn btn-primary btn-sm" id="btn-empty-import">
                Import X Data Archive Instead
              </button>
            </div>
          </div>
        `;
      }

      if (this.state.status === 'disconnected') {
        return `
          <div class="empty-state glass-panel animate-fade-in">
            <div class="empty-state-icon">𝕏</div>
            <h3>Connect Your Account</h3>
            <p>Sign in with your X account to calculate following vs followers and inspect unfollow targets.</p>
            <button class="btn btn-primary" id="btn-empty-login" style="margin-top: 12px;">
              Connect With X
            </button>
          </div>
        `;
      }

      return `
        <div class="empty-state glass-panel animate-fade-in">
          <div class="empty-state-icon">✓</div>
          <h3>All Caught Up</h3>
          <p>No accounts found in this category.</p>
        </div>
      `;
    }

    if (filtered.length === 0) {
      return `
        <div class="empty-state glass-panel animate-fade-in">
          <div class="empty-state-icon">🔍</div>
          <h3>No Matching Accounts</h3>
          <p>No accounts matched your current filter criteria. Try resetting filters or clearing the search query.</p>
        </div>
      `;
    }

    return `
      <div class="users-container animate-fade-in">
        <div style="font-size: 13px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; padding: 0 4px;">
          <span>Showing <b>${filtered.length}</b> of <b>${currentList.length}</b> accounts</span>
          <span class="badge ${this.state.dataSource?.includes('LIVE') ? 'badge-source-live' : 'badge-source-archive'}">
            Source: ${this.state.dataSource}
          </span>
        </div>
        ${filtered.map(user => renderUserCard(user)).join('')}
      </div>
    `;
  },

  renderArchiveImportView() {
    return `
      <div class="glass-panel animate-fade-in" style="padding: 28px;">
        <div class="section-title-wrap">
          <h2>Advanced: Import X Data Archive</h2>
          <p>Upload your official X Data Archive to calculate Following vs Followers without any API costs, rate limits, or developer credentials.</p>
        </div>

        <div style="margin: 24px 0;" class="archive-dropzone" id="archive-dropzone">
          <input type="file" id="archive-file-input" multiple accept=".js,.json" style="display: none;">
          <div style="font-size: 38px;">📁</div>
          <h3 style="font-size: 16px; font-weight: 700;">Drop your following.js & follower.js files here</h3>
          <p style="font-size: 13px; color: var(--text-muted);">or click to browse from your downloaded X archive (data/following.js, data/follower.js)</p>
          <button class="btn btn-secondary btn-sm" id="btn-select-archive-files">Browse Files</button>
        </div>

        <div class="archive-instructions-card">
          <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">How to download your official X Data Archive:</h4>
          <ol>
            <li>Open X, go to <b>More → Settings and Privacy → Your Account</b>.</li>
            <li>Click <b>Download an archive of your data</b> and verify your identity.</li>
            <li>Once X emails you that your archive is ready, download and unzip it.</li>
            <li>In the unzipped folder, open the <b>data</b> folder.</li>
            <li>Select or drop both <b>following.js</b> and <b>follower.js</b> (or <b>following.json</b> and <b>follower.json</b>) into the dropzone above.</li>
            <li>The app will calculate <b>Following - Followers</b> locally in your browser. All calculations happen on your machine.</li>
          </ol>
        </div>

        ${Storage.getArchiveCache() ? `
          <div style="margin-top: 24px; display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
            <div style="font-size: 13px; color: var(--text-secondary);">
              You have a cached archive loaded from <b>${new Date(Storage.getArchiveCache().timestamp || Date.now()).toLocaleDateString()}</b>.
            </div>
            <button class="btn btn-danger btn-sm" id="btn-clear-archive-cache">Clear Cached Archive</button>
          </div>
        ` : ''}
      </div>
    `;
  },

  renderSettingsView() {
    const currentBase = Storage.getApiBaseUrl();
    return `
      <div class="glass-panel animate-fade-in" style="padding: 28px; max-width: 680px;">
        <h2>Settings & Deployment Configuration</h2>
        <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
          Configure your deployment targets and API backend endpoints.
        </p>

        <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 18px;">
          <div>
            <label style="font-size: 13px; font-weight: 600; display: block; margin-bottom: 6px;">
              Backend API Base URL (PUBLIC_API_BASE_URL)
            </label>
            <input type="text" id="setting-api-url" class="input" style="width: 100%;" placeholder="e.g. https://your-vercel-app.vercel.app (leave empty for same-origin)" value="${escapeHtml(currentBase)}">
            <span style="font-size: 12px; color: var(--text-muted); display: block; margin-top: 4px;">
              Required when hosting the frontend statically on GitHub Pages with a separate Vercel/Netlify backend.
            </span>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary btn-sm" id="btn-save-settings">Save Settings</button>
            <button class="btn btn-secondary btn-sm" id="btn-reset-settings">Reset to Default</button>
          </div>

          <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle);">
            <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">Data Guarantee</h4>
            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
              This app never generates synthetic accounts. All data is fetched directly from the authenticated X account or parsed locally from your official X Data Archive.
            </p>
          </div>
        </div>
      </div>
    `;
  },

  attachEvents() {
    // Navigation / Tabs
    document.querySelectorAll('[data-tab]').forEach(el => {
      el.onclick = () => this.setActiveTab(el.dataset.tab);
    });

    document.querySelectorAll('[data-category]').forEach(el => {
      el.onclick = () => {
        this.setActiveTab(el.dataset.category);
      };
    });

    // Login buttons
    document.getElementById('btn-login-nav')?.addEventListener('click', () => Auth.login());
    document.getElementById('btn-login-hero')?.addEventListener('click', () => Auth.login());
    document.getElementById('btn-empty-login')?.addEventListener('click', () => Auth.login());

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => Auth.logout());

    // Refresh
    document.getElementById('btn-refresh-global')?.addEventListener('click', () => this.loadLiveData());
    document.getElementById('btn-refresh-data')?.addEventListener('click', () => this.loadLiveData());
    document.getElementById('btn-retry-live')?.addEventListener('click', () => this.loadLiveData());

    // Switch to Archive Tab
    document.querySelectorAll('#btn-switch-archive, #btn-empty-import').forEach(b => {
      b.onclick = () => this.setActiveTab('archive-import');
    });

    // Search filter with debounce
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      let timer;
      searchInput.oninput = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          Filters.setCriteria({ searchQuery: searchInput.value });
          this.render();
        }, 200);
      };
    }

    // Dropdown filters
    const verifiedSelect = document.getElementById('filter-verified');
    if (verifiedSelect) {
      verifiedSelect.onchange = () => {
        Filters.setCriteria({ verified: verifiedSelect.value });
        this.render();
      };
    }

    const activitySelect = document.getElementById('filter-activity');
    if (activitySelect) {
      activitySelect.onchange = () => {
        Filters.setCriteria({ activity: activitySelect.value });
        this.render();
      };
    }

    const followersRangeSelect = document.getElementById('filter-followers-range');
    if (followersRangeSelect) {
      followersRangeSelect.onchange = () => {
        Filters.setCriteria({ minFollowers: Number(followersRangeSelect.value) });
        this.render();
      };
    }

    const sortSelect = document.getElementById('filter-sort');
    if (sortSelect) {
      sortSelect.onchange = () => {
        Filters.setCriteria({ sortBy: sortSelect.value });
        this.render();
      };
    }

    // User card actions
    document.querySelectorAll('.action-unfollow').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const username = b.dataset.username;
        FollowingManager.unfollowUser(id, username, (unfollowedId) => {
          // Remove from local lists
          this.state.following = this.state.following.filter(u => u.id !== unfollowedId);
          this.state.notFollowingBack = this.state.notFollowingBack.filter(u => u.id !== unfollowedId);
          this.state.mutuals = this.state.mutuals.filter(u => u.id !== unfollowedId);
          this.state.counts.following = this.state.following.length;
          this.state.counts.notFollowingBack = this.state.notFollowingBack.length;
          this.state.counts.mutuals = this.state.mutuals.length;
          this.render();
        });
      };
    });

    document.querySelectorAll('.action-view').forEach(b => {
      b.onclick = async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const currentList = this.getCurrentList();
        const user = currentList.find(u => String(u.id) === String(id) || u.username === id);
        if (user) {
          try {
            // Fetch recent posts if live
            let posts = [];
            if (this.state.status === 'connected') {
              try {
                const res = await API.getPosts(user.id);
                posts = res.posts || [];
              } catch {}
            }
            Modal.showProfile(user, posts);
          } catch {
            Modal.showProfile(user);
          }
        }
      };
    });

    // Archive Upload handling
    const dropzone = document.getElementById('archive-dropzone');
    const fileInput = document.getElementById('archive-file-input');
    const browseBtn = document.getElementById('btn-select-archive-files');

    if (browseBtn && fileInput) {
      browseBtn.onclick = () => fileInput.click();
    }

    if (fileInput) {
      fileInput.onchange = (e) => this.handleArchiveFiles(e.target.files);
    }

    if (dropzone) {
      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      };
      dropzone.ondragleave = () => dropzone.classList.remove('dragover');
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files?.length) {
          this.handleArchiveFiles(e.dataTransfer.files);
        }
      };
    }

    document.getElementById('btn-clear-archive-cache')?.addEventListener('click', () => {
      Storage.clearArchiveCache();
      Modal.toast('Archive cache cleared.', 'info');
      this.state.following = [];
      this.state.followers = [];
      this.state.notFollowingBack = [];
      this.state.mutuals = [];
      this.state.status = 'disconnected';
      this.state.dataSource = null;
      this.render();
    });

    // Settings actions
    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
      const urlInput = document.getElementById('setting-api-url');
      if (urlInput) {
        Storage.setApiBaseUrl(urlInput.value);
        Modal.toast('Backend URL updated successfully.', 'success');
      }
    });

    document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
      Storage.setApiBaseUrl('');
      const urlInput = document.getElementById('setting-api-url');
      if (urlInput) urlInput.value = '';
      Modal.toast('Backend URL reset to origin.', 'info');
    });
  },

  async handleArchiveFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    Modal.toast('Reading X Data Archive files...', 'info', 3000);

    let followingData = [];
    let followerData = [];

    for (const file of fileList) {
      const content = await file.text();
      const fileName = file.name.toLowerCase();

      try {
        let parsed = null;
        // Check for official X archive JavaScript wrapping e.g. window.YTD.following.part0 = [ ... ]
        if (content.includes('window.YTD.')) {
          const jsonText = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
          parsed = JSON.parse(jsonText);
        } else {
          // Plain JSON
          parsed = JSON.parse(content);
        }

        if (fileName.includes('following')) {
          // Format in following.js: [ { following: { accountId: "...", userLink: "..." } } ]
          followingData = Array.isArray(parsed) ? parsed.map(item => {
            const entry = item.following || item;
            return {
              id: entry.accountId || entry.id,
              username: entry.username || (entry.userLink ? entry.userLink.split('user_id=')[1] : null) || entry.accountId,
              userLink: entry.userLink || null
            };
          }) : [];
        } else if (fileName.includes('follower')) {
          // Format in follower.js: [ { follower: { accountId: "...", userLink: "..." } } ]
          followerData = Array.isArray(parsed) ? parsed.map(item => {
            const entry = item.follower || item;
            return {
              id: entry.accountId || entry.id,
              username: entry.username || (entry.userLink ? entry.userLink.split('user_id=')[1] : null) || entry.accountId,
              userLink: entry.userLink || null
            };
          }) : [];
        }
      } catch (err) {
        console.error('Error parsing file:', file.name, err);
        Modal.toast(`Error parsing ${file.name}. Please ensure it is a valid X archive file.`, 'error', 4000);
      }
    }

    if (followingData.length > 0 || followerData.length > 0) {
      this.applyArchiveData(followingData, followerData);
      Modal.toast(`Loaded ${followingData.length} following & ${followerData.length} followers from archive!`, 'success', 5000);
      this.setActiveTab('not-following-back');
    } else {
      Modal.toast('Could not find following or follower lists in selected files. Please select following.js or follower.js from your data folder.', 'error', 5000);
    }
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
