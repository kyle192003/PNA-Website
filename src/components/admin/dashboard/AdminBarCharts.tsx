import type { DashboardChartPoint } from "@/lib/dashboard-chart";

function getMaxValue(data: DashboardChartPoint[]): number {
  return Math.max(...data.map((point) => point.value), 1);
}

export function AdminVerticalBarChart({
  data,
  height = 180,
}: {
  data: DashboardChartPoint[];
  height?: number;
}) {
  const max = getMaxValue(data);
  const plotHeight = Math.max(height - 28, 48);

  return (
    <div className="admin-vbar-chart" style={{ height }}>
      {data.map((point, index) => {
        const barHeight =
          point.value === 0 ? 4 : Math.max(Math.round((point.value / max) * plotHeight), 8);

        return (
          <div key={`${point.label}-${index}`} className="admin-vbar-chart-item">
            <div className="admin-vbar-chart-bar-wrap">
              <div
                className="admin-vbar-chart-bar"
                style={{ height: barHeight }}
                title={`${point.label}: ${point.value}`}
              >
                <span className="admin-vbar-chart-value">{point.value}</span>
              </div>
            </div>
            <span className="admin-vbar-chart-label">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminHorizontalBarChart({
  data,
  formatValue,
}: {
  data: DashboardChartPoint[];
  formatValue?: (value: number) => string;
}) {
  const max = getMaxValue(data);

  return (
    <div className="admin-hbar-chart">
      {data.map((point, index) => (
        <div key={`${point.label}-${index}`} className="admin-hbar-chart-row">
          <span className="admin-hbar-chart-label">{point.label}</span>
          <div className="admin-hbar-chart-track">
            <div
              className={`admin-hbar-chart-fill admin-hbar-chart-fill--tone-${index % 4}`}
              style={{ width: `${Math.max((point.value / max) * 100, point.value > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="admin-hbar-chart-value">
            {formatValue ? formatValue(point.value) : point.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminMiniBarChart({ data }: { data: DashboardChartPoint[] }) {
  const max = getMaxValue(data);
  const plotHeight = 56;

  return (
    <div className="admin-mini-bar-chart" style={{ height: plotHeight }}>
      {data.map((point, index) => {
        const barHeight =
          point.value === 0 ? 4 : Math.max(Math.round((point.value / max) * plotHeight), 8);

        return (
          <div
            key={`${point.label}-${index}`}
            className="admin-mini-bar-chart-bar"
            style={{ height: barHeight }}
            title={`${point.label}: ${point.value}`}
          />
        );
      })}
    </div>
  );
}
