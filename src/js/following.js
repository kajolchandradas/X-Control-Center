import { API } from './api.js';
import { Modal } from '../components/modal.js';

export const FollowingManager = {
  async unfollowUser(targetUserId, username, onSuccess) {
    Modal.confirm({
      title: 'Confirm Unfollow',
      message: `Are you sure you want to unfollow @${username || targetUserId}? You will stop seeing their posts in your following feed.`,
      confirmText: 'Unfollow Account',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          Modal.toast(`Unfollowing @${username}...`, 'info', 2000);
          const res = await API.unfollow(targetUserId);
          if (res.success) {
            Modal.toast(`Successfully unfollowed @${username}`, 'success');
            if (typeof onSuccess === 'function') onSuccess(targetUserId);
          } else {
            throw new Error(res.error || 'Unfollow failed');
          }
        } catch (err) {
          console.error('Unfollow failed:', err);
          Modal.toast(err.message || 'Failed to unfollow user on X', 'error', 5000);
        }
      }
    });
  },

  async followUser(targetUserId, username, onSuccess) {
    try {
      Modal.toast(`Following @${username}...`, 'info', 2000);
      const res = await API.follow(targetUserId);
      if (res.success) {
        Modal.toast(`Successfully followed @${username}`, 'success');
        if (typeof onSuccess === 'function') onSuccess(targetUserId);
      } else {
        throw new Error(res.error || 'Follow failed');
      }
    } catch (err) {
      console.error('Follow failed:', err);
      Modal.toast(err.message || 'Failed to follow user on X', 'error', 5000);
    }
  }
};
