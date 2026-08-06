export default function Heater({ temperature }) {
  const alarm = temperature > 75;

  return (
    <div
      className={`w-36 h-36 rounded-2xl border flex flex-col items-center justify-center ${
        alarm
          ? "bg-[#3A1F1F] border-[#EF4444]"
          : "bg-[#10253A] border-[#284A69]"
      }`}
    >
      <div
        className={`w-16 h-12 rounded-lg ${
          alarm ? "bg-[#EF4444]/70" : "bg-[#F59E0B]/70"
        }`}
      />

      <p className="text-[#38BDF8] font-bold mt-3">H101</p>
      <p className="text-sm text-[#94A3B8]">Heater</p>
      <p className="text-sm font-semibold">{temperature.toFixed(1)}°C</p>
    </div>
  );
}
