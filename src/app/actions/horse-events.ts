"use server";

import { createActivityEvent } from "@/app/actions/activity";

/**
 * Fire-and-forget activity event when a horse is made public.
 * Called from client-side add/edit forms after successful insert/update.
 */
export async function notifyHorsePublic(data: {
    userId: string;
    horseId: string;
    horseName: string;
    finishType: string;
}): Promise<void> {
    createActivityEvent({
        actorId: data.userId,
        eventType: "new_horse",
        horseId: data.horseId,
        metadata: { horseName: data.horseName, finishType: data.finishType },
    });
}
