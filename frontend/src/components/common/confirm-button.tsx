import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { errorMessage } from "@/lib/api/client";

export function ConfirmButton({
  trigger,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirmar",
  successMessage = "Acción completada",
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  onConfirm: () => Promise<unknown>;
  confirmLabel?: string;
  successMessage?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                await onConfirm();
                toast.success(successMessage);
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
