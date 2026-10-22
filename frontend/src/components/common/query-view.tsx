import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState, StateView } from "./state-view";

export function QueryView<T>({
  query, children, isEmpty, empty, compact,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  isEmpty?: ((d: T) => boolean) | undefined;
  empty?: ReactNode;
  compact?: boolean | undefined;
}) {
  if (query.isPending) return <StateView kind="loading" />;
  if (query.isError) return <ErrorState error={query.error} compact={compact} onRetry={() => query.refetch()} />;
  if (isEmpty?.(query.data)) return <>{empty ?? <StateView kind="empty" compact={compact} />}</>;
  return <>{children(query.data)}</>;
}
