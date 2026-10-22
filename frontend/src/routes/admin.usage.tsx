import { createFileRoute } from "@tanstack/react-router";
import { useAdminUsage } from "@/modules/admin/api";
import { TrendChart } from "@/modules/reports/charts";
import { PageHeader, Section } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/usage")({
  head: () => seo("Uso de la plataforma"),
  component: Usage,
});

function Usage() {
  const q = useAdminUsage();
  return (
    <>
      <PageHeader title="Uso" />
      <QueryView query={q} isEmpty={(d) => d.series.length === 0}>
        {(d) => (
          <Section title="Usuarios y sesiones">
            <TrendChart
              data={d.series}
              x="date"
              series={[
                { key: "users", label: "Usuarios", color: "var(--chart-1)" },
                { key: "sessions", label: "Sesiones", color: "var(--chart-2)" },
              ]}
            />
          </Section>
        )}
      </QueryView>
    </>
  );
}
