export const Filters = {
  criteria: {
    category: 'not-following-back', // 'all', 'not-following-back', 'mutual', 'fans'
    searchQuery: '',
    verified: 'all', // 'all', 'verified', 'unverified'
    activity: 'all', // 'all', 'inactive', 'active', 'high'
    minFollowers: 0,
    minFollowing: 0,
    minPosts: 0,
    accountAge: 'all', // 'all', 'new', '1yr', '3yr', '5yr'
    sortBy: 'followers', // 'followers', 'following', 'posts', 'newest', 'oldest', 'alpha'
    sortDirection: 'desc'
  },

  setCriteria(updates) {
    this.criteria = { ...this.criteria, ...updates };
  },

  reset() {
    this.criteria = {
      category: 'not-following-back',
      searchQuery: '',
      verified: 'all',
      activity: 'all',
      minFollowers: 0,
      minFollowing: 0,
      minPosts: 0,
      accountAge: 'all',
      sortBy: 'followers',
      sortDirection: 'desc'
    };
  },

  apply(users, context = {}) {
    if (!Array.isArray(users)) return [];

    let filtered = [...users];

    // 1. Search Query (username or display name)
    const q = (this.criteria.searchQuery || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.description || '').toLowerCase().includes(q)
      );
    }

    // 2. Verified Status
    if (this.criteria.verified === 'verified') {
      filtered = filtered.filter(u => Boolean(u.verified));
    } else if (this.criteria.verified === 'unverified') {
      filtered = filtered.filter(u => !u.verified);
    }

    // 3. Activity Level (based on tweet count and creation age)
    if (this.criteria.activity === 'inactive') {
      // Under 50 tweets or null
      filtered = filtered.filter(u => (u.tweet_count ?? 0) < 50);
    } else if (this.criteria.activity === 'active') {
      filtered = filtered.filter(u => (u.tweet_count ?? 0) >= 50 && (u.tweet_count ?? 0) < 2000);
    } else if (this.criteria.activity === 'high') {
      filtered = filtered.filter(u => (u.tweet_count ?? 0) >= 2000);
    }

    // 4. Min Followers Range
    if (this.criteria.minFollowers > 0) {
      filtered = filtered.filter(u => (u.followers_count ?? 0) >= this.criteria.minFollowers);
    }

    // 5. Min Following Range
    if (this.criteria.minFollowing > 0) {
      filtered = filtered.filter(u => (u.following_count ?? 0) >= this.criteria.minFollowing);
    }

    // 6. Min Posts Range
    if (this.criteria.minPosts > 0) {
      filtered = filtered.filter(u => (u.tweet_count ?? 0) >= this.criteria.minPosts);
    }

    // 7. Account Age
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (this.criteria.accountAge === 'new') {
      filtered = filtered.filter(u => u.created_at && (now - new Date(u.created_at).getTime()) < oneYearMs);
    } else if (this.criteria.accountAge === '1yr') {
      filtered = filtered.filter(u => u.created_at && (now - new Date(u.created_at).getTime()) >= oneYearMs);
    } else if (this.criteria.accountAge === '3yr') {
      filtered = filtered.filter(u => u.created_at && (now - new Date(u.created_at).getTime()) >= 3 * oneYearMs);
    } else if (this.criteria.accountAge === '5yr') {
      filtered = filtered.filter(u => u.created_at && (now - new Date(u.created_at).getTime()) >= 5 * oneYearMs);
    }

    // 8. Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (this.criteria.sortBy) {
        case 'followers':
          comparison = (b.followers_count ?? 0) - (a.followers_count ?? 0);
          break;
        case 'following':
          comparison = (b.following_count ?? 0) - (a.following_count ?? 0);
          break;
        case 'posts':
          comparison = (b.tweet_count ?? 0) - (a.tweet_count ?? 0);
          break;
        case 'newest':
          comparison = new Date(b.created_at || 0) - new Date(a.created_at || 0);
          break;
        case 'oldest':
          comparison = new Date(a.created_at || 0) - new Date(b.created_at || 0);
          break;
        case 'alpha':
          comparison = (a.name || a.username || '').localeCompare(b.name || b.username || '');
          break;
        default:
          comparison = 0;
      }
      return this.criteria.sortDirection === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }
};
