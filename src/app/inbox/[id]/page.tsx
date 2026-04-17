import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import ChatThread from"@/components/ChatThread";
import RatingForm from"@/components/RatingForm";
import TransactionActions from"@/components/TransactionActions";
import OfferCard from"@/components/OfferCard";
import BlockButton from"@/components/BlockButton";
import { isBlocked as checkIsBlocked } from"@/app/actions/blocks";
import { getTransactionByConversation } from"@/app/actions/transactions";
import { getConversationAttachments } from"@/app/actions/messaging";
import { getPublicImageUrls } from"@/lib/utils/storage";
import { resolveAvatarUrl } from"@/lib/utils/avatars.server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 return {
 title: `Conversation — Model Horse Hub`,
 description: `Private message thread ${id}.`,
 };
}


interface ConversationData {
 id: string;
 buyer_id: string;
 seller_id: string;
 horse_id: string | null;
}

interface MessageRow {
 id: string;
 sender_id: string;
 content: string;
 is_read: boolean;
 created_at: string;
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
 const { id: conversationId } = await params;
 const supabase = await createClient();

 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) redirect("/login");

 // Fetch conversation (RLS ensures user is buyer or seller)
 const { data: conversation } = await supabase
 .from("conversations")
 .select("id, buyer_id, seller_id, horse_id, transaction_status")
 .eq("id", conversationId)
 .single<ConversationData & { transaction_status: string }>();

 if (!conversation) notFound();

 // Get the other user's alias
 const otherId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;

 const { data: otherUser } = await supabase
 .from("users")
 .select("alias_name, avatar_url")
 .eq("id", otherId)
 .single<{ alias_name: string; avatar_url: string | null }>();

 const otherAlias = otherUser?.alias_name ??"Unknown";
 const otherAvatarUrl = await resolveAvatarUrl(otherUser?.avatar_url ?? null);

 // Fetch current user avatar
 const { data: currentUserData } = await supabase
 .from("users")
 .select("avatar_url")
 .eq("id", user.id)
 .single<{ avatar_url: string | null }>();
 const currentUserAvatar = await resolveAvatarUrl(currentUserData?.avatar_url ?? null);

 // Check block status for this conversation partner
 const isBlockedUser = await checkIsBlocked(otherId);

 // ── Trust Signals ──
 // Account age
 const { data: otherProfile } = await supabase
 .from("users")
 .select("created_at")
 .eq("id", otherId)
 .single<{ created_at: string }>();

 const memberSince = otherProfile?.created_at
 ? new Date(otherProfile.created_at).toLocaleDateString("en-US", { month:"long", year:"numeric" })
 : null;

 // Completed transfers count
 const { count: transferCount } = await supabase
 .from("horse_transfers")
 .select("id", { count:"exact", head: true })
 .eq("status","claimed")
 .or(`sender_id.eq.${otherId},claimed_by.eq.${otherId}`);

 // Average rating (from universal reviews table)
 const { data: reviewsData } = await supabase.from("reviews").select("stars").eq("target_id", otherId);
 const ratingsArr = (reviewsData ?? []) as { stars: number }[];
 const avgRating =
 ratingsArr.length > 0
 ? Math.round((ratingsArr.reduce((s, r) => s + r.stars, 0) / ratingsArr.length) * 10) / 10
 : null;

 // Get horse context if present
 let horseContext: {
 id: string;
 name: string;
 tradeStatus: string;
 price: number | null;
 thumbnailUrl: string | null;
 refLine: string | null;
 } | null = null;

 if (conversation.horse_id) {
 const { data: horse } = await supabase
 .from("user_horses")
 .select(
 `
 id, custom_name, trade_status, listing_price,
 catalog_items:catalog_id(title, maker),
 horse_images(image_url, angle_profile)
 `,
 )
 .eq("id", conversation.horse_id)
 .single<{
 id: string;
 custom_name: string;
 trade_status: string;
 listing_price: number | null;
 catalog_items: { title: string; maker: string } | null;
 horse_images: { image_url: string; angle_profile: string }[];
 }>();

 if (horse) {
 // Get thumbnail (Primary_Thumbnail or first image)
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const firstImg = horse.horse_images?.[0];
 const imgPath = thumb?.image_url || firstImg?.image_url;

 // Sign the URL
 let signedThumb: string | null = null;
 if (imgPath) {
 const urlMap = getPublicImageUrls([imgPath]);
 signedThumb = urlMap.get(imgPath) || null;
 }

 horseContext = {
 id: horse.id,
 name: horse.custom_name,
 tradeStatus: horse.trade_status,
 price: horse.listing_price,
 thumbnailUrl: signedThumb,
 refLine: horse.catalog_items ? `${horse.catalog_items.maker} — ${horse.catalog_items.title}` : null,
 };
 }
 }

 // Fetch all messages
 const { data: rawMessages } = await supabase
 .from("messages")
 .select("id, sender_id, content, is_read, created_at")
 .eq("conversation_id", conversationId)
 .order("created_at", { ascending: true });

 const messages = (rawMessages as MessageRow[]) ?? [];

 // Mark unread messages as read (server-side)
 const unreadIds = messages.filter((m) => m.sender_id !== user.id && !m.is_read).map((m) => m.id);

 if (unreadIds.length > 0) {
 await supabase.from("messages").update({ is_read: true }).in("id", unreadIds);
 }

 // Fetch photo attachments for this conversation
 const attachmentMap = await getConversationAttachments(conversationId);

 const isBuyer = conversation.buyer_id === user.id;

 const txn = await getTransactionByConversation(conversationId);
 const transactionId = txn?.transactionId ?? null;
 const hasCommerceTransaction = !!txn; // Any Safe-Trade transaction exists

 // Check if user has already reviewed via the new reviews table
 let existingRating: { id: string; stars: number; reviewText: string | null; createdAt: string } | null = null;
 if (transactionId) {
 const { data: rawReview } = await supabase
 .from("reviews")
 .select("id, stars, content, created_at")
 .eq("transaction_id", transactionId)
 .eq("reviewer_id", user.id)
 .maybeSingle();

 if (rawReview) {
 const rv = rawReview as { id: string; stars: number; content: string | null; created_at: string };
 existingRating = {
 id: rv.id,
 stars: rv.stars,
 reviewText: rv.content,
 createdAt: rv.created_at,
 };
 }
 }

 // Check for completed transfer between these two users (trust signal)
 const { count: mutualTransfers } = await supabase
 .from("horse_transfers")
 .select("id", { count:"exact", head: true })
 .eq("status","claimed")
 .or(
 `and(sender_id.eq.${user.id},claimed_by.eq.${otherId}),and(sender_id.eq.${otherId},claimed_by.eq.${user.id})`,
 );

 return (
 <div className="mx-auto flex h-[calc(100dvh-var(--header-height))] max-w-6xl flex-col overflow-hidden px-4 md:px-8">
 {/* Header */}
 <div className="bg-parchment border-edge animate-fade-in-up mb-4 flex shrink-0 flex-wrap items-center gap-4 rounded-lg border px-4 py-4 sm:px-6">
 <Link
 href="/inbox"
 className="bg-black/5 text-muted flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full no-underline transition-all"
 aria-label="Back to inbox"
 >
 <svg
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <polyline points="15 18 9 12 15 6" />
 </svg>
 </Link>
 <div className="flex min-w-0 flex-1 flex-col">
 <div className="flex items-center gap-2">
 <Link href={`/profile/${encodeURIComponent(otherAlias)}`}>@{otherAlias}</Link>
 <span className="bg-emerald-50 rounded-full px-[8px] py-[2px] text-xs font-medium text-[#2C5545]">
 {isBuyer ?"Seller" :"Buyer"}
 </span>
 </div>
 {horseContext ? (
 <span className="text-muted mt-0.5 text-xs">🐴 Re: {horseContext.name}</span>
 ) : (
 <span className="text-muted mt-0.5 text-xs opacity-70">💬 Direct Message</span>
 )}
 </div>

 {/* Trust Signals */}
 <div className="mt-0.5 flex flex-wrap gap-1">
 {memberSince && (
 <span
 className="border-edge text-muted inline-flex items-center gap-[3px] rounded-sm border bg-card px-2 py-0.5 text-xs whitespace-nowrap"
 title="Account age"
 >
 📅 Member since {memberSince}
 </span>
 )}
 <span
 className="border-edge text-muted inline-flex items-center gap-[3px] rounded-sm border bg-card px-2 py-0.5 text-xs whitespace-nowrap"
 title="Completed Hoofprint transfers"
 >
 📦 {transferCount || 0} transfer{transferCount !== 1 ?"s" :""}
 </span>
 {avgRating !== null && (
 <span
 className="border-edge text-muted inline-flex items-center gap-[3px] rounded-sm border bg-card px-2 py-0.5 text-xs whitespace-nowrap"
 title="Average user rating"
 >
 ⭐ {avgRating} ({ratingsArr.length})
 </span>
 )}
 </div>
 <div className="inline-flex items-center gap-1 text-xs text-muted">
 <svg
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
 <path d="M7 11V7a5 5 0 0 1 10 0v4" />
 </svg>
 Private &amp; Secure
 </div>
 <BlockButton targetId={otherId} targetAlias={otherAlias} initialBlocked={isBlockedUser} />
 </div>

 {/* Horse Context Card — visual banner for horse-linked conversations */}
 {horseContext && (
 <Link
 href={`/community/${horseContext.id}`}
 className="group animate-fade-in-up mb-4 flex items-center gap-4 rounded-xl border border-edge bg-card p-4 text-ink no-underline shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
 id="chat-horse-link"
 >
 {horseContext.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={horseContext.thumbnailUrl}
 alt={horseContext.name}
 className="h-14 w-14 shrink-0 rounded-md object-cover"
 />
 ) : (
 <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-parchment object-cover text-2xl">
 🐴
 </div>
 )}
 <div className="flex min-w-0 flex-1 flex-col gap-0.5">
 <span className="overflow-hidden text-sm font-bold text-ellipsis whitespace-nowrap">
 {horseContext.name}
 </span>
 {horseContext.refLine && (
 <span className="overflow-hidden text-xs text-muted text-ellipsis whitespace-nowrap">
 {horseContext.refLine}
 </span>
 )}
 {horseContext.tradeStatus !=="Not for Sale" && (
 <span
 className={`inline-flex w-fit items-center gap-[3px] rounded-full px-2 py-0.5 text-xs font-bold ${
 horseContext.tradeStatus ==="For Sale"
 ?"bg-emerald-50/80 text-emerald-600"
 :"bg-blue-50/80 text-blue-500"
 }`}
 >
 {horseContext.tradeStatus ==="For Sale" ?"💲" :"🤝"}{""}
 {horseContext.price
 ? `$${horseContext.price.toLocaleString("en-US")}`
 : horseContext.tradeStatus}
 </span>
 )}
 </div>
 <span className="shrink-0 text-[1.1rem] text-muted transition-transform group-hover:text-forest group-hover:translate-x-[3px]">
 →
 </span>
 </Link>
 )}

 {/* Offer Card — Commerce State Machine (show for ALL transaction states) */}
 {txn && <OfferCard transaction={txn} currentUserId={user.id} />}

 {/* Chat Thread (Client Component) */}
 <ChatThread
 conversationId={conversationId}
 currentUserId={user.id}
 currentUserAvatar={currentUserAvatar}
 otherAlias={otherAlias}
 otherAvatarUrl={otherAvatarUrl}
 initialMessages={messages.map((m) => ({
 id: m.id,
 senderId: m.sender_id,
 content: m.content,
 createdAt: m.created_at,
 isMe: m.sender_id === user.id,
 attachments: attachmentMap[m.id] || undefined,
 }))}
 />

 {/* Transaction Actions — only show legacy flow if NO Safe-Trade transaction exists */}
 {!hasCommerceTransaction && (
 <TransactionActions
 conversationId={conversationId}
 initialStatus={conversation.transaction_status ||"open"}
 hasRating={!!existingRating}
 />
 )}

 {/* Rating Form — only show if a transaction exists (conversation marked complete) */}
 {transactionId && (
 <RatingForm
 transactionId={transactionId}
 targetId={otherId}
 targetAlias={otherAlias}
 existingRating={existingRating}
 hasVerifiedTransfer={(mutualTransfers || 0) > 0}
 />
 )}
 </div>
 );
}
