export default function MetricCard({ title, value, unit, statusText, status = "normal" }) {
  const statusColors = {
    normal: "text-[#10B981]",
    info: "text-[#38BDF8]",
    warning: "text-[#FBBF24]",
    alarm: "text-[#EF4444]",
  };

  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-5 h-32 shadow-xl shadow-black/20">
      <p className="text-sm text-[#94A3B8]">{title}</p>

      <div className="flex items-end gap-2 mt-3">
        <h2 className="text-3xl font-semibold text-[#F8FAFC]">{value}</h2>
        {unit && <span className="text-sm text-[#94A3B8] mb-1">{unit}</span>}
      </div>

      <p className={`text-sm mt-2 ${statusColors[status]}`}>
        {statusText}
      </p>
    </div>
  );
}
