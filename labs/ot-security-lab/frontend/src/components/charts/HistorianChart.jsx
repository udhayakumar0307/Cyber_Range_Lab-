export default function HistorianChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="h-[300px] flex items-center justify-center text-[#94A3B8]">
        No historian data
      </div>
    );
  }

  const width = 700;
  const height = 260;
  const padding = 35;

  const keys = [
    { key: "tankLevel", color: "#38BDF8", label: "Tank" },
    { key: "temperature", color: "#FBBF24", label: "Temp" },
    { key: "flowRate", color: "#10B981", label: "Flow" },
    { key: "chemicalLevel", color: "#0A84FF", label: "Chem" },
  ];

  const allValues = data.flatMap((d) => keys.map((k) => d[k.key]));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  const x = (i) =>
    padding + (i / (data.length - 1)) * (width - padding * 2);

  const y = (value) =>
    height - padding - ((value - min) / (max - min || 1)) * (height - padding * 2);

  const linePath = (key) =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`)
      .join(" ");

  return (
    <div className="h-[300px]">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {[0, 1, 2, 3, 4].map((n) => {
          const yy = padding + n * ((height - padding * 2) / 4);
          return (
            <line
              key={n}
              x1={padding}
              x2={width - padding}
              y1={yy}
              y2={yy}
              stroke="#22354E"
              strokeDasharray="4 4"
            />
          );
        })}

        {keys.map((series) => (
          <path
            key={series.key}
            d={linePath(series.key)}
            fill="none"
            stroke={series.color}
            strokeWidth="3"
          />
        ))}

      {data.map((d, i) => {
        if (i % 4 !== 0 && i !== data.length - 1) return null;

        return (
          <text
            key={d.time}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fill="#94A3B8"
          >
            {d.time}
          </text>
        );
      })}
      </svg>

      <div className="flex gap-5 text-xs text-[#94A3B8] justify-center mt-1">
        {keys.map((k) => (
          <div key={k.key} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: k.color }}
            />
            {k.label}
          </div>
        ))}
      </div>
    </div>
  );
}
