export type UsagePoint = {
  usage_date: string;
  storage_used_gb: number | string;
};

type UsageChartProps = {
  usage: UsagePoint[];
  title?: string;
};

function toNumber(value: number | string): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

export function UsageChart({ usage, title = 'Cloud Usage Overview' }: UsageChartProps) {
  const points = [...usage].sort(
    (a, b) => new Date(a.usage_date).getTime() - new Date(b.usage_date).getTime()
  );

  if (!points.length) {
    return (
      <section className="dashboard-card">
        <h2 className="title card-heading">{title}</h2>
        <p className="subtitle">No usage data available.</p>
      </section>
    );
  }

  const values = points.map((item) => toNumber(item.storage_used_gb));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  const width = 780;
  const height = 260;
  const padX = 32;
  const padY = 24;

  const polylinePoints = points
    .map((point, index) => {
      const x = padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
      const y = padY + ((max - toNumber(point.storage_used_gb)) / range) * (height - padY * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${padX},${height - padY} ${polylinePoints} ${width - padX},${height - padY}`;

  return (
    <section className="dashboard-card">
      <h2 className="title card-heading">{title}</h2>
      <div className="usage-chart-shell">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Storage usage trend">
          <defs>
            <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(45, 140, 210, 0.35)" />
              <stop offset="100%" stopColor="rgba(45, 140, 210, 0.02)" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padY + ratio * (height - padY * 2);
            return <line key={ratio} x1={padX} y1={y} x2={width - padX} y2={y} className="usage-grid-line" />;
          })}

          <polygon points={areaPoints} fill="url(#usageFill)" />
          <polyline points={polylinePoints} className="usage-line" />

          {points.map((point, index) => {
            const x = padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
            const y = padY + ((max - toNumber(point.storage_used_gb)) / range) * (height - padY * 2);

            return <circle key={`${point.usage_date}-${index}`} cx={x} cy={y} r={4} className="usage-dot" />;
          })}
        </svg>
      </div>

      <div className="usage-axis-labels">
        <span>{formatDate(points[0].usage_date)}</span>
        <span>{formatDate(points[points.length - 1].usage_date)}</span>
      </div>
    </section>
  );
}
