import { getDealFeed } from "@/lib/feed";
import { readBrowseState } from "@/lib/browse-state";
import DealsApp from "./components/deals-app";

export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [feed, values] = await Promise.all([getDealFeed(), searchParams]);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  return (
    <DealsApp
      initialFeed={feed}
      initialBrowse={readBrowseState(params.toString())}
    />
  );
}
