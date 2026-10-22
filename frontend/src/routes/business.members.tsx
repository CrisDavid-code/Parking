import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useOrgMutation } from "@/modules/fleet/api";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmButton } from "@/components/common/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useAuth } from "@/modules/auth/auth-context";
import type { OrgMember } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/members")({
  head: () => seo("Miembros"),
  component: () => <OrgGate>{(p) => <Page orgPath={p} />}</OrgGate>,
});

const roles = [
  { value: "ORG_ADMIN", label: "Administrador" },
  { value: "ORG_MEMBER", label: "Miembro" },
  { value: "DRIVER", label: "Conductor" },
];
const schema = z.object({
  email: z.string().email("Correo inválido"),
  role: z.enum(["ORG_ADMIN", "ORG_MEMBER", "DRIVER"], {
    errorMap: () => ({ message: "Selecciona un rol" }),
  }),
});

function Page({ orgPath }: { orgPath: string }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ORG_ADMIN", "PLATFORM_ADMIN");
  const invite = useOrgMutation((d: z.infer<typeof schema>) => api.post(`${orgPath}/members`, d));
  const change = useOrgMutation(({ id, role }: { id: string; role: string }) =>
    api.patch(`${orgPath}/members/${id}`, { role }),
  );
  const remove = useOrgMutation((id: string) => api.delete(`${orgPath}/members/${id}`));
  return (
    <>
      <PageHeader
        title="Miembros y roles"
        actions={
          isAdmin && (
            <FormDialog
              title="Invitar miembro"
              schema={schema}
              trigger={
                <Button>
                  <UserPlus className="size-4" /> Invitar
                </Button>
              }
              fields={[
                { name: "email", label: "Correo", type: "email" },
                { name: "role", label: "Rol", type: "select", options: roles },
              ]}
              onSubmit={(d) => invite.mutateAsync(d)}
              submitLabel="Invitar"
            />
          )
        }
      />
      <PaginatedTable<OrgMember>
        path={`${orgPath}/members`}
        queryKey={["org", orgPath, "members"]}
        columns={[
          { header: "Nombre", cell: (m) => m.fullName ?? "—" },
          { header: "Correo", cell: (m) => m.email },
          {
            header: "Rol",
            cell: (m) =>
              isAdmin ? (
                <select
                  aria-label={`Rol de ${m.email}`}
                  className="native-select w-40"
                  defaultValue={m.role}
                  onChange={(e) => change.mutate({ id: m.id, role: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge variant="secondary">{m.role}</Badge>
              ),
          },
        ]}
        actions={
          isAdmin
            ? (m) => (
                <ConfirmButton
                  title="Quitar miembro"
                  description={m.email}
                  successMessage="Miembro eliminado"
                  trigger={
                    <Button size="sm" variant="ghost">
                      Quitar
                    </Button>
                  }
                  onConfirm={() => remove.mutateAsync(m.id)}
                />
              )
            : undefined
        }
      />
    </>
  );
}
