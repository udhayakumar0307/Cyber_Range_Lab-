export default function Valve({ position }) {
  const closed = position < 10;

  return (
    <div className="w-36 h-36 rounded-2xl bg-[#10253A] border border-[#284A69] flex flex-col items-center justify-center">
      <div className="relative w-20 h-10">
        <div className="absolute left-0 top-3 w-8 h-4 bg-[#38BDF8] rotate-45" />
        <div className="absolute right-0 top-3 w-8 h-4 bg-[#38BDF8] -rotate-45" />
        <div
          className={`absolute left-8 top-0 w-4 h-10 rounded ${
            closed ? "bg-[#EF4444]" : "bg-[#10B981]"
          }`}
        />
      </div>

      <p className="text-[#38BDF8] font-bold mt-3">XV101</p>
      <p className="text-sm text-[#94A3B8]">Valve</p>
      <p className="text-sm font-semibold">{position.toFixed(0)}%</p>
    </div>
  );
}
