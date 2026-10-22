import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StateView, ErrorState } from "@/components/common/state-view";
import type { Organization } from "@/types/api";
import { useCurrentOrg } from "./api";

export function OrgGate({ children }: { children: (orgPath: string, org: Organization) => ReactNode }) {
  const { query, org, orgPath } = useCurrentOrg();
  if (query.isPending) return <StateView kind="loading" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!org || !orgPath)
    return <StateView kind="empty" title="Sin organización" description="Crea una organización para usar las funciones de empresa."
      action={<Button asChild><Link to="/app/onboarding">Configurar empresa</Link></Button>} />;
  return <>{children(orgPath, org)}</>;
}
