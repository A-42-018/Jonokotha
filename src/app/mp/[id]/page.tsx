import RepProfile from "@/components/mp/RepProfile";

export default async function RepProfilePage({ params }: PageProps<"/mp/[id]">) {
  const { id } = await params;
  return <RepProfile id={id} />;
}
