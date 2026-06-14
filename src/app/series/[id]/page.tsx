import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SeriesAliasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/album/${id}`);
}
