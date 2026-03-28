"use client";

import { useState } from"react";
import { toggleFollow } from"@/app/actions/follows";

interface FollowButtonProps {
 targetUserId: string;
 initialIsFollowing: boolean;
 initialFollowerCount: number;
 isOwnProfile: boolean;
}

export default function FollowButton({
 targetUserId,
 initialIsFollowing,
 initialFollowerCount,
 isOwnProfile,
}: FollowButtonProps) {
 const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
 const [followerCount, setFollowerCount] = useState(initialFollowerCount);
 const [loading, setLoading] = useState(false);

 if (isOwnProfile) return null;

 const handleToggle = async () => {
 setLoading(true);
 const result = await toggleFollow(targetUserId);
 if (result.success) {
 setIsFollowing(result.isFollowing ?? false);
 setFollowerCount(result.followerCount ?? followerCount);
 }
 setLoading(false);
 };

 return (
 <div className="mt-2 flex items-center gap-2">
 <button
 className={`btn btn-sm ${isFollowing ?"btn-ghost !border-emerald-300 !text-[#22C55E] hover:!border-red-300 hover:!text-[#ef4444]" :"btn-primary"}`}
 onClick={handleToggle}
 disabled={loading}
 id="follow-button"
 >
 {loading ?"…" : isFollowing ?"✓ Following" :"+ Follow"}
 </button>
 <span className="text-stone-500 text-sm">
 {followerCount} follower{followerCount !== 1 ?"s" :""}
 </span>
 </div>
 );
}
