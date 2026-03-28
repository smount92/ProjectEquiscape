// eslint-disable-next-line @next/next/no-img-element
interface UserAvatarProps {
 avatarUrl: string | null;
 aliasName: string;
 size?: number;
}

export default function UserAvatar({ avatarUrl, aliasName, size = 32 }: UserAvatarProps) {
 return (
 <div
 className="bg-[rgb(245 245 244)] text-stone-500 inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
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
