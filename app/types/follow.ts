// types/follow.ts
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  photoURL?: string | null;
  description?: string;
  followersCount?: number;
  followingCount?: number;
}

export interface FollowData {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: any;
  user?: UserProfile;
}

export interface FollowerData extends FollowData {
  isFollowing?: boolean;
}