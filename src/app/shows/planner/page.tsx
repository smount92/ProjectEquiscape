import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getShowStrings } from"@/app/actions/competition";
import ShowStringManager from"@/components/ShowStringManager";
import CommandCenterLayout from"@/components/layouts/CommandCenterLayout";
import { Button } from "@/components/ui/button";


export const metadata = {
 title:"Live Show Packer",
 description:"Plan your show entries, track class assignments, and convert results into records.",
};

export default async function ShowPlannerPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const showStrings = await getShowStrings();

 // Get user's horses for the entry form
 const { data: horses } = await supabase
 .from("user_horses")
 .select("id, custom_name")
 .eq("owner_id", user.id)
 .order("custom_name");

 const horseList = (horses || []).map((h: { id: string; custom_name: string }) => ({
 id: h.id,
 name: h.custom_name,
 }));

 return (
 <CommandCenterLayout
  title="🧳 Live Show Packer"
  description="Pack your string of horses for real-world live shows. Detect ring time conflicts and convert results into ribbons when you get home."
  headerActions={
  <Button asChild variant="outline" size="wide"><Link
   href="/shows"
  >
   ← Back to Shows
  </Link></Button>
  }
  mainContent={<ShowStringManager showStrings={showStrings} horses={horseList} />}
 />
 );
}
