import { redirect } from "next/navigation";

export default async function RollAliasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/album/${id}`);
}
