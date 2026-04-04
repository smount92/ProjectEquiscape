/**
 * @deprecated Use `import { UserAvatar } from "@/components/social"` instead.
 * This wrapper maps the legacy prop interface (avatarUrl, aliasName, size as number)
 * to the new one (src, alias, size as variant string).
 */
import UserAvatarNew from "@/components/social/UserAvatar";

interface LegacyUserAvatarProps {
    avatarUrl: string | null;
    aliasName: string;
    size?: number;
}

export default function UserAvatar({ avatarUrl, aliasName, size = 32 }: LegacyUserAvatarProps) {
    const sizeMap: Record<number, "xs" | "sm" | "md" | "lg"> = {
        24: "xs",
        32: "sm",
        40: "md",
        56: "lg",
    };
    const sizeVariant = sizeMap[size] || "sm";
    return <UserAvatarNew src={avatarUrl} alias={aliasName} size={sizeVariant} />;
}
