import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useNotifications, useNotificationMutations } from "@/modules/notifications/api";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/notifications")({
  head: () => seo("Notificaciones"),
  component: Notifications,
});

function Notifications() {
  const q = useNotifications(50);
  const m = useNotificationMutations();
  const f = useFormat();
  return (
    <>
      <PageHeader
        title="Notificaciones"
        actions={
          <Button
            variant="outline"
            disabled={m.readAll.isPending}
            onClick={() =>
              m.readAll
                .mutateAsync()
                .then(() => toast.success("Todas marcadas como leídas"))
                .catch((e) => toast.error(errorMessage(e)))
            }
          >
            <CheckCheck className="size-4" /> Marcar todas como leídas
          </Button>
        }
      />
      <QueryView
        query={q}
        isEmpty={(d) => d.items.length === 0}
        empty={<StateView kind="empty" title="Sin notificaciones" />}
      >
        {(d) => (
          <ul className="surface-card divide-y divide-border">
            {d.items.map((n) => (
              <li key={n.id} className={`flex gap-3 p-4 ${n.readAt ? "" : "bg-primary/5"}`}>
                <Bell
                  className={`mt-0.5 size-5 shrink-0 ${n.readAt ? "text-muted-foreground" : "text-primary"}`}
                  aria-hidden
                />
                <div className="flex-1">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{f.date(n.createdAt)}</p>
                </div>
                {!n.readAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      m.read.mutateAsync(n.id).catch((e) => toast.error(errorMessage(e)))
                    }
                  >
                    Marcar leída
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </>
  );
}
