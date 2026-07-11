"use client";

import { useState } from"react";
import { toggleFollow } from"@/app/actions/follows";
import { Button } from"@/components/ui/button";

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
 <Button
 variant={isFollowing ?"outline" :"default"}
 size="sm"
 className={isFollowing ?"border-success/50 text-success hover:border-destructive hover:text-destructive" :""}
 onClick={handleToggle}
 disabled={loading}
 id="follow-button"
 >
 {loading ?"…" : isFollowing ?"✓ Following" :"+ Follow"}
 </Button>
 <span className="text-muted-foreground text-sm">
 {followerCount} follower{followerCount !== 1 ?"s" :""}
 </span>
 </div>
 );
}
