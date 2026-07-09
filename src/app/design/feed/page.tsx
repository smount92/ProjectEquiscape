/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPosts, type Post } from "@/app/actions/posts";

/**
 * Design prototype: the "leather stable feed" treatment rendered with REAL
 * site data (global feed via getPosts). Sibling of /design; same gate —
 * open in dev, admin-only in production. Textures are pure CSS (gradients +
 * SVG noise), scoped under .proto-feed to stay out of the app cascade.
 */

export const dynamic = "force-dynamic";

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const CSS = `
.proto-feed { --leather-deep:#3E2414; --leather:#5C3A20; --leather-hi:#7A4E2C; --brass-dark:#7A5C22; --brass:#B08D3E; --brass-hi:#E8C878; --thread:#D9B978; }
.proto-feed .panel {
  position: relative; border-radius: 14px; padding: 22px 20px 24px 48px;
  background: ${NOISE}, radial-gradient(ellipse 120% 90% at 50% 0%, var(--leather-hi) 0%, var(--leather) 45%, var(--leather-deep) 100%);
  background-blend-mode: overlay, normal;
  box-shadow: inset 0 2px 3px rgba(255,220,170,.25), inset 0 -14px 28px rgba(0,0,0,.45), inset 14px 0 28px rgba(0,0,0,.25), inset -14px 0 28px rgba(0,0,0,.25), 0 6px 18px rgba(46,30,18,.35);
}
.proto-feed .panel::after {
  content:""; position:absolute; inset:10px; pointer-events:none; border:2px dashed var(--thread);
  border-radius:8px; opacity:.7; filter:drop-shadow(0 1px 0 rgba(0,0,0,.6));
}
.proto-feed h1 {
  margin:2px 0 20px; text-align:center; font-family:"Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  font-size:1.05rem; letter-spacing:.22em; text-transform:uppercase; color:#EFDDBB;
  text-shadow:0 -1px 1px rgba(0,0,0,.9), 0 1px 1px rgba(255,225,170,.25);
}
.proto-feed .spine { position:absolute; left:28px; top:64px; bottom:30px; width:2px; background:linear-gradient(var(--brass-dark), rgba(122,92,34,.25)); }
.proto-feed .entry { position:relative; margin-bottom:16px; }
.proto-feed .dot {
  position:absolute; left:-27px; top:16px; width:10px; height:10px; border-radius:50%;
  background:radial-gradient(circle at 35% 30%, var(--brass-hi), var(--brass-dark));
  box-shadow:0 0 0 3px rgba(0,0,0,.35);
}
.proto-feed time { display:block; font-family:"Palatino Linotype",Palatino,Georgia,serif; font-size:.7rem; letter-spacing:.12em; color:#C9AE84; margin-bottom:5px; }
.proto-feed .frame { background:#FEFCF8; border-radius:6px; border:6px solid transparent; background-clip:padding-box; position:relative; box-shadow:0 4px 10px rgba(0,0,0,.45); }
.proto-feed .frame::before {
  content:""; position:absolute; inset:-6px; z-index:-1; border-radius:8px;
  background:${NOISE}, linear-gradient(150deg, var(--leather-hi), var(--leather-deep));
  background-blend-mode: overlay, normal;
}
.proto-feed .photo { width:100%; max-height:230px; object-fit:cover; display:block; border-radius:2px 2px 0 0; }
.proto-feed .byline { display:flex; align-items:center; gap:8px; padding:9px 11px 0; }
.proto-feed .avatar { width:26px; height:26px; border-radius:50%; object-fit:cover; box-shadow:0 0 0 2px var(--brass); }
.proto-feed .avatar-fallback {
  width:26px; height:26px; border-radius:50%; display:grid; place-items:center;
  background:linear-gradient(160deg,#2C5545,#1E3D31); color:#E8C878;
  font-family:Georgia,serif; font-size:.7rem; box-shadow:0 0 0 2px var(--brass);
}
.proto-feed .who { font-family:"Palatino Linotype",Palatino,Georgia,serif; font-size:.8rem; font-weight:700; letter-spacing:.04em; color:#2D2318; }
.proto-feed .frame p { margin:0; padding:6px 11px 8px; font-family:Georgia,serif; font-size:.85rem; color:#594A3C; line-height:1.4; overflow-wrap:anywhere; }
.proto-feed .meta {
  display:flex; gap:14px; padding:0 11px 9px;
  font-family:"Palatino Linotype",Palatino,Georgia,serif; font-size:.72rem; letter-spacing:.06em; color:#8B5A2B;
}
.proto-feed .empty { color:#EFDDBB; text-align:center; font-family:Georgia,serif; font-style:italic; padding:20px 0; }
`;

export default async function LeatherFeedPrototype() {
  if (process.env.NODE_ENV === "production") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (
      !user ||
      user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()
    ) {
      notFound();
    }
  }

  let posts: Post[] = [];
  let loadError: string | null = null;
  try {
    posts = await getPosts({ globalFeed: true }, { limit: 10 });
  } catch {
    loadError = "Log in first — the feed loads through the same auth as /feed.";
  }

  return (
    <div className="proto-feed mx-auto max-w-md px-4 py-8">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <p className="mb-4 text-center text-xs tracking-wide text-muted-foreground">
        Design prototype — real posts from the live feed, leather treatment.
        Compare with <a className="underline" href="/feed">/feed</a>.
      </p>
      <div className="panel">
        <h1>Stable Activity Feed</h1>
        <div className="spine" aria-hidden="true" />
        {loadError && <div className="empty">{loadError}</div>}
        {!loadError && posts.length === 0 && (
          <div className="empty">No posts yet — the feed is empty.</div>
        )}
        {posts.map((post) => (
          <div className="entry" key={post.id}>
            <span className="dot" aria-hidden="true" />
            <time>{timeAgo(post.createdAt)}</time>
            <div className="frame">
              {post.media[0] && (
                <img
                  className="photo"
                  src={post.media[0].imageUrl}
                  alt={post.media[0].caption ?? "Post photo"}
                />
              )}
              <div className="byline">
                {post.authorAvatarUrl ? (
                  <img
                    className="avatar"
                    src={post.authorAvatarUrl}
                    alt=""
                  />
                ) : (
                  <span className="avatar-fallback" aria-hidden="true">
                    {post.authorAlias.replace(/^@/, "").charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="who">@{post.authorAlias.replace(/^@/, "")}</span>
              </div>
              {post.content && <p>{post.content}</p>}
              <div className="meta">
                <span>♥ {post.likesCount}</span>
                <span>✉ {post.repliesCount} replies</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
