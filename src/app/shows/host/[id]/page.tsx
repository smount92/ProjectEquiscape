import { notFound, redirect } from "next/navigation";

import { getShowConsole } from "@/app/actions/shows-v2";
import { showsV2Enabled } from "@/lib/shows/flags";
import { createClient } from "@/lib/supabase/server";
import CommandCenterLayout from "@/components/layouts/CommandCenterLayout";
import ShowConsole from "@/components/shows/ShowConsole";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Show Console — Model Horse Hub",
    description: "Run your show: status, classlist, staff, and entries.",
};

export default async function ShowConsolePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    if (!showsV2Enabled()) notFound();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { id } = await params;
    const result = await getShowConsole({ showId: id });
    // Bad id, missing show, or non-staff viewer all land here — the
    // console simply doesn't exist for them.
    if (!result.success) notFound();

    const { console: data } = result;

    return (
        <CommandCenterLayout
            title={data.show.title}
            description={
                data.show.mode === "live"
                    ? "Live show console — build the classlist, staff the rings, run the day."
                    : "Online show console — build the classlist, staff the judging, watch entries."
            }
            mainContent={<ShowConsole data={data} />}
        />
    );
}
