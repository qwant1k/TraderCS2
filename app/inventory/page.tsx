import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import CreateListing from "@/components/CreateListing";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await currentUser();
  if (!user) redirect("/api/auth/steam");

  return (
    <div>
      <h1>Выставить лот</h1>
      {!user.tradeUrl ? (
        <div className="msg err">
          Сначала добавьте трейд-ссылку в <Link href="/settings?setup=1">настройках</Link>. Без неё обмен не откроется.
        </div>
      ) : (
        <CreateListing />
      )}
    </div>
  );
}
