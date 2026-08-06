export default function Topbar() {
  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <p className="text-sm text-[#94A3B8] mt-1">
          Water Treatment Plant Simulation
        </p>
      </div>

      <div className="text-right leading-tight">
        <div className="text-xs font-semibold text-[#F1F5F9]">
          {new Date().toLocaleTimeString()}
        </div>
        <div className="text-[11px] text-[#10B981]">ONLINE</div>
      </div>
    </header>
  );
}
