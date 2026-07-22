import type { DashboardChartPoint } from "@/lib/dashboard-chart";
import {
  AdminHorizontalBarChart,
  AdminVerticalBarChart,
} from "@/components/admin/dashboard/AdminBarCharts";

export type BillMetric = {
  label: string;
  value: string | number;
  hint?: string;
};

export type BillBreakdownItem = {
  label: string;
  value: string;
};

export function AdminBillInsights({
  title,
  subtitle,
  highlightLabel,
  highlightValue,
  highlightHint,
  metrics,
  chartTitle,
  chartData,
  chartMode = "vertical",
  formatChartValue,
  breakdownTitle,
  breakdown,
}: {
  title: string;
  subtitle?: string;
  highlightLabel: string;
  highlightValue: string;
  highlightHint?: string;
  metrics: BillMetric[];
  chartTitle: string;
  chartData: DashboardChartPoint[];
  chartMode?: "vertical" | "horizontal";
  formatChartValue?: (value: number) => string;
  breakdownTitle: string;
  breakdown: BillBreakdownItem[];
}) {
  return (
    <section className="admin-bill-insights">
      <div className="admin-bill-insights__header">
        <div>
          <h2 className="admin-bill-insights__title">{title}</h2>
          {subtitle ? <p className="admin-bill-insights__subtitle">{subtitle}</p> : null}
        </div>
        <div className="admin-bill-insights__paybox">
          <p className="admin-bill-insights__pay-label">{highlightLabel}</p>
          <p className="admin-bill-insights__pay-value">{highlightValue}</p>
          {highlightHint ? <p className="admin-bill-insights__pay-hint">{highlightHint}</p> : null}
        </div>
      </div>

      <div className="admin-bill-insights__grid">
        <div className="admin-bill-insights__panel">
          <h3 className="admin-bill-insights__panel-title">Key figures</h3>
          <div className="admin-bill-insights__metrics">
            {metrics.map((metric) => (
              <div key={metric.label} className="admin-bill-insights__metric">
                <span className="admin-bill-insights__metric-label">{metric.label}</span>
                <strong className="admin-bill-insights__metric-value">{metric.value}</strong>
                {metric.hint ? (
                  <span className="admin-bill-insights__metric-hint">{metric.hint}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="admin-bill-insights__panel">
          <h3 className="admin-bill-insights__panel-title">{breakdownTitle}</h3>
          <ul className="admin-bill-insights__breakdown">
            {breakdown.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-bill-insights__panel admin-bill-insights__panel--chart">
          <h3 className="admin-bill-insights__panel-title">{chartTitle}</h3>
          {chartData.length === 0 ? (
            <p className="admin-muted mb-0">No chart data yet.</p>
          ) : chartMode === "horizontal" ? (
            <AdminHorizontalBarChart data={chartData} formatValue={formatChartValue} />
          ) : (
            <AdminVerticalBarChart data={chartData} height={200} />
          )}
        </div>
      </div>
    </section>
  );
}
