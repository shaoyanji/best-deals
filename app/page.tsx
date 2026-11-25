import { getDealFeed } from "@/lib/feed";
import DealsApp from "./components/deals-app";

export const dynamic = "force-dynamic";
export default async function Page() {
  const feed = await getDealFeed();
  return <DealsApp initialFeed={feed} />;
}
