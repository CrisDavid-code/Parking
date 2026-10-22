import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = Record<string, string | number>;
const axis = { stroke: "var(--muted-foreground)", fontSize: 12 };

export function TrendChart({ data, x, series }: { data: Row[]; x: string; series: { key: string; label: string; color: string }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Gráfico: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={x} {...axis} /><YAxis {...axis} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
          <Legend />
          {series.map((s) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function BarsChart({ data, x, series }: { data: Row[]; x: string; series: { key: string; label: string; color: string }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Gráfico de barras: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={x} {...axis} /><YAxis {...axis} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
          <Legend />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
