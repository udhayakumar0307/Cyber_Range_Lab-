export default function Pipe({ active }) {
  return (
    <div className="relative flex-1 h-5 rounded-full bg-[#17324D] overflow-hidden border border-[#284A69]">
      <div
        className={`absolute inset-y-0 left-0 transition-all duration-500 ${
          active ? "bg-[#38BDF8]" : "bg-[#475569]"
        }`}
        style={{ width: active ? "100%" : "25%" }}
      />

      {active && (
        <div className="absolute inset-0 flex items-center justify-around text-[#071321] text-xs font-bold animate-pulse">
          <span>▶</span>
          <span>▶</span>
          <span>▶</span>
        </div>
      )}
    </div>
  );
}
