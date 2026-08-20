/**
 * /shows/[id]/class/[classId] — THE CLASS ROOM (v4 dark launch).
 *
 * The hobby's atomic unit is the class, not the show: this page is
 * one class as a room — the lineup side by side (leg tags, photos,
 * documentation), then the ribbon rail + per-entry critiques once
 * THIS class's results are published (rolling reveal, or show
 * completion). Anon-visible like every v2 public show surface; the
 * blind rule is enforced server-side in getClassRoom.
 * Requires migration 148.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getClassRoom } from "@/app/actions/shows-v4";
import ClassRoomPage from "@/components/shows/ClassRoomPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string; classId: string }>;
}): Promise<Metadata> {
    const { classId } = await params;
    const result = await getClassRoom({ classId });
    if (!result.success) return { title: "Show" };
    const { room } = result;
    const numberBit = room.room.classNumber ? `Class ${room.room.classNumber} — ` : "";
    return {
        title: `${numberBit}${room.room.className} · ${room.show.title}`,
        description: `${room.entries.length} ${room.entries.length === 1 ? "entry" : "entries"} in ${room.room.className} (${room.room.sectionName}, ${room.room.divisionName}) at ${room.show.title}.`,
    };
}

export default async function ClassRoomRoute({
    params,
}: {
    params: Promise<{ id: string; classId: string }>;
}) {
    const { id, classId } = await params;

    const result = await getClassRoom({ classId });
    if (!result.success) notFound();
    // A class URL under the wrong show id is a stale/forged link.
    if (result.room.show.id !== id) notFound();

    return <ClassRoomPage room={result.room} />;
}
