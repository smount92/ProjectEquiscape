import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPhotoBySlug } from "@/app/actions/photos";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PhotoShareView from "@/components/PhotoShareView";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    return { title: "Photo Not Found — Model Horse Hub" };
  }

  const title = `${photo.horseName} — Model Horse Hub`;
  const description = photo.catalogRef
    ? `${photo.horseName} (${photo.catalogRef}) — shared by ${photo.ownerAlias} on Model Horse Hub`
    : `${photo.horseName} — shared by ${photo.ownerAlias} on Model Horse Hub`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: photo.imageUrl, width: 800, height: 600, alt: photo.horseName }],
      type: "article",
      siteName: "Model Horse Hub",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [photo.imageUrl],
    },
  };
}

export default async function PhotoPage({ params }: Props) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    notFound();
  }

  return (
    <ExplorerLayout title={photo.horseName} description="Shared photo">
      <PhotoShareView photo={photo} />
    </ExplorerLayout>
  );
}
