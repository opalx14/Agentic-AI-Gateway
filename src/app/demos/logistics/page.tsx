import { buildOperatorWorkspaceData } from "@/app/demo-data";
import { OperatorWorkspace } from "@/app/operator-workspace";

export default async function LogisticsDemoPage() {
  const data = await buildOperatorWorkspaceData();
  return <OperatorWorkspace data={data} fixedDomain="logistics" />;
}
