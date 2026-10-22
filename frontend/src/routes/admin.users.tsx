import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { Badge } from "@/components/ui/badge";
import { api, errorMessage } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import type { Role, User } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/users")({ head: () => seo("Usuarios"), component: Users });
const allRoles: Role[] = ["USER", "ORG_ADMIN", "ORG_MEMBER", "DRIVER", "PLATFORM_ADMIN"];

function Users() {
  const f = useFormat();
  const qc = useQueryClient();
  const toggle = async (u: User, r: Role) => {
    const roles = u.roles.includes(r) ? u.roles.filter((x) => x !== r) : [...u.roles, r];
    try { await api.patch(`/admin/users/${u.id}`, { roles }); toast.success("Roles actualizados"); qc.invalidateQueries({ queryKey: ["admin", "users"] }); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <>
      <PageHeader title="Usuarios" />
      <PaginatedTable<User> path="/admin/users" queryKey={["admin", "users"]}
        filters={[{ name: "role", label: "Rol", options: allRoles.map((r) => ({ value: r, label: r })) }, { name: "accountType", label: "Tipo", options: [{ value: "personal", label: "Personal" }, { value: "business", label: "Empresa" }] }]}
        columns={[
          { header: "Nombre", cell: (u) => <span className="font-medium">{u.fullName}</span> },
          { header: "Correo", cell: (u) => u.email },
          { header: "Tipo", cell: (u) => u.accountType },
          { header: "Roles", cell: (u) => (
            <div className="flex flex-wrap gap-1">
              {allRoles.map((r) => (
                <button key={r} type="button" onClick={() => toggle(u, r)} aria-pressed={u.roles.includes(r)} title="Alternar rol">
                  <Badge variant={u.roles.includes(r) ? "default" : "outline"}>{r}</Badge>
                </button>
              ))}
            </div>) },
          { header: "Alta", cell: (u) => f.date(u.createdAt, false) },
        ]} />
    </>
  );
}
