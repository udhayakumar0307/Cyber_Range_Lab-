export default function Pump({ status }) {
  const running = status === "RUNNING" || status === "STARTING";
  const stopping = status === "STOPPING";

  return (
    <div className="w-36 h-36 rounded-2xl bg-[#10253A] border border-[#284A69] flex flex-col items-center justify-center">
      <div
        className={`w-14 h-14 rounded-full border-4 flex items-center justify-center ${
          running
            ? "border-[#10B981]"
            : stopping
            ? "border-[#FBBF24]"
            : "border-[#EF4444]"
        }`}
      >
        <div
          className={`w-7 h-7 rounded-full border-t-4 border-[#38BDF8] ${
            running ? "animate-spin" : ""
          }`}
        />
      </div>

      <p className="text-[#38BDF8] font-bold mt-3">P101</p>
      <p className="text-sm text-[#94A3B8]">Pump</p>
      <p className="text-sm font-semibold">{status}</p>
    </div>
  );
}
