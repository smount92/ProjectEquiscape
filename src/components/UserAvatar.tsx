// eslint-disable-next-line @next/next/no-img-element
interface UserAvatarProps {
    avatarUrl: string | null;
    aliasName: string;
    size?: number;
}

export default function UserAvatar({ avatarUrl, aliasName, size = 32 }: UserAvatarProps) {
    return (
        <div
            className="rounded-full bg-[rgba(0, 0, 0, 0.06)] inline-flex items-center justify-center overflow-hidden shrink-0 font-bold text-muted"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={aliasName} />
            ) : (
                <span>{aliasName.charAt(0).toUpperCase()}</span>
            )}
        </div>
    );
}
