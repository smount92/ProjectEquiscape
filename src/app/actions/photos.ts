"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { getPublicImageUrl } from "@/lib/utils/storage";

export interface PhotoDetail {
  imageId: string;
  shortSlug: string;
  imageUrl: string;
  angleProfile: string;
  horseId: string;
  horseName: string;
  ownerAlias: string;
  ownerAvatarUrl: string | null;
  catalogRef: string | null;
  finishType: string | null;
}

/**
 * Look up a photo by its short_slug for the /photo/[slug] route.
 * Returns null if not found or horse is soft-deleted/private.
 *
 * Admin client (justified downgrade, AnonProfile pattern): the share
 * page is anon-viewable, but user_horses/users RLS is authenticated-
 * only. Everything returned is public-scoped share content — private
 * and deleted horses are excluded below, and the slug itself is the
 * unguessable capability.
 */
export async function getPhotoBySlug(slug: string): Promise<PhotoDetail | null> {
  const supabase = getAdminClient();

  const { data: image } = await supabase
    .from("horse_images")
    .select(`
      id, short_slug, image_url, angle_profile, horse_id,
      user_horses!inner(
        custom_name, finish_type, deleted_at, owner_id, visibility,
        catalog_items:catalog_id(title, maker),
        users:owner_id(alias_name, avatar_url)
      )
    `)
    .eq("short_slug", slug)
    .maybeSingle();

  if (!image) return null;

  const horse = image.user_horses as unknown as {
    custom_name: string;
    finish_type: string | null;
    deleted_at: string | null;
    owner_id: string;
    visibility: string;
    catalog_items: { title: string; maker: string } | null;
    users: { alias_name: string; avatar_url: string | null } | null;
  };

  // Don't expose deleted or private horses
  if (horse.deleted_at) return null;
  if (horse.visibility === "private") return null;

  return {
    imageId: image.id,
    shortSlug: image.short_slug!,
    imageUrl: getPublicImageUrl(image.image_url),
    angleProfile: image.angle_profile,
    horseId: image.horse_id,
    horseName: horse.custom_name,
    ownerAlias: horse.users?.alias_name || "Collector",
    ownerAvatarUrl: horse.users?.avatar_url || null,
    catalogRef: horse.catalog_items
      ? `${horse.catalog_items.maker} — ${horse.catalog_items.title}`
      : null,
    finishType: horse.finish_type,
  };
}
