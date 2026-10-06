import { API } from './api.js';

export const FollowersManager = {
  async fetchFollowers(maxResults = 100, paginationToken = null) {
    return API.getFollowers(maxResults, paginationToken);
  }
};
