import { redirect } from "next/navigation";

/** /community/barns/create → /community/groups/create */
export default function CreateBarnAlias() {
    redirect("/community/groups/create");
}
