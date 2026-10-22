import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthCard } from "@/modules/auth/auth-card";
import { useAuth } from "@/modules/auth/auth-context";
import { useInvitation, useShareMutations, PERMISSION_LABELS } from "@/modules/sharing/api";
import { QueryView } from "@/components/common/query-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { errorMessage } from "@/lib/api/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/invite/$token")({
  head: () => seo("Invitación"),
  component: Invite,
});

function Invite() {
  const { token } = Route.useParams();
  const { status } = useAuth();
  const inv = useInvitation(token);
  const { accept } = useShareMutations();
  const navigate = useNavigate();
  return (
    <AuthCard title="Invitación a compartir vehículo">
      <QueryView query={inv}>
        {(d) => (
          <div className="space-y-4">
            {d.vehicle ? (
              <p>
                <strong>{d.ownerName}</strong> te invita a acceder a{" "}
                <strong>{d.vehicle.alias}</strong> ({d.vehicle.make} {d.vehicle.model}).
              </p>
            ) : (
              <p>
                <strong>{d.ownerName}</strong> te invita a unirte a{" "}
                <strong>{d.organization?.name ?? "una organización"}</strong>.
              </p>
            )}
            {d.status !== "pending" && (
              <p role="alert" className="text-sm text-destructive">
                Esta invitación ya no está disponible ({d.status}).
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {d.permissions.map((p) => (
                <Badge key={p} variant="secondary">
                  {PERMISSION_LABELS[p]}
                </Badge>
              ))}
            </div>
            {status === "authenticated" ? (
              <Button
                className="w-full"
                disabled={accept.isPending || d.status !== "pending"}
                onClick={async () => {
                  try {
                    await accept.mutateAsync(token);
                    toast.success("Invitación aceptada");
                    if (d.vehicle) navigate({ to: "/app/sharing" });
                    else window.location.assign("/business"); // reload so the new organization role is picked up
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                Aceptar invitación
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link to="/login" search={{ redirect: `/invite/${token}` }}>
                  Inicia sesión para aceptar
                </Link>
              </Button>
            )}
          </div>
        )}
      </QueryView>
    </AuthCard>
  );
}
