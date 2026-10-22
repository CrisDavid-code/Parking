import { useNavigate } from "@tanstack/react-router";
import { Navigation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/common/state-view";
import { errorMessage } from "@/lib/api/client";
import { useNavMutations } from "./api";

export function StartNavigationButton({ parkingSessionId, label = "Navegar", className }: { parkingSessionId: string; label?: string; className?: string }) {
  const { start } = useNavMutations();
  const navigate = useNavigate();
  return (
    <Button className={className} disabled={start.isPending} onClick={async () => {
      try {
        const s = await start.mutateAsync({ parkingSessionId, mode: "basic" });
        navigate({ to: "/app/navigation/$sessionId", params: { sessionId: s.id } });
      } catch (e) {
        toast.error(errorMessage(e));
      }
    }}>
      {start.isPending ? <InlineSpinner /> : <Navigation className="size-4" />} {label}
    </Button>
  );
}
