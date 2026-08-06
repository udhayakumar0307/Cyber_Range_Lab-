export default function SensorTag({ tag, label, value, unit, status = "normal" }) {
  const statusColor =
    status === "alarm"
      ? "text-[#EF4444]"
      : status === "warning"
      ? "text-[#FBBF24]"
      : "text-[#38BDF8]";

  return (
    <div className="rounded-xl bg-[#10253A] border border-[#284A69] px-4 py-3 min-w-[130px]">
      <p className="text-xs text-[#94A3B8]">{tag}</p>
      <p className="text-sm text-[#F1F5F9]">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${statusColor}`}>
        {value} <span className="text-sm text-[#94A3B8]">{unit}</span>
      </p>
    </div>
  );
}
