export default function StatusCard({ title, value, subtitle, status = "normal" }) {
  const colors = {
    normal: "bg-[#10B981]",
    warning: "bg-[#FBBF24]",
    alarm: "bg-[#EF4444]",
    info: "bg-[#38BDF8]",
  };

  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-5 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-[#94A3B8]">{title}</p>
        <span className={`w-3 h-3 rounded-full ${colors[status]}`} />
      </div>

      <h3 className="text-2xl font-semibold text-[#F8FAFC] mb-1">
        {value}
      </h3>

      <p className="text-sm text-[#94A3B8]">
        {subtitle}
      </p>
    </div>
  );
}
