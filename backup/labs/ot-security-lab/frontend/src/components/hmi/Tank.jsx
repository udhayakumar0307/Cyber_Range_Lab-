export default function Tank({ level }) {
  const alarm = level > 90 || level < 15;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative w-40 h-72 rounded-2xl border-4 overflow-hidden bg-[#071321] ${
          alarm ? "border-[#EF4444]" : "border-[#38BDF8]"
        }`}
      >
        <div
          className="absolute bottom-0 left-0 right-0 bg-[#38BDF8]/70 transition-all duration-700"
          style={{ height: `${level}%` }}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-[#94A3B8]">LT101</p>
          <p className="text-3xl font-bold">{level.toFixed(1)}%</p>
          <p className="text-xs text-[#94A3B8]">Tank Level</p>
        </div>
      </div>
    </div>
  );
}
