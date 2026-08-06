const equipment = ["Tank", "Pump", "Valve", "Heater"];

export default function ProcessSummary() {
  return (
    <div className="space-y-4">
      {equipment.map((item, index) => (
        <div key={item}>
          <div className="rounded-lg bg-[#17324D] px-4 py-3 flex justify-between items-center">
            <span>{item}</span>
            <span className="w-3 h-3 rounded-full bg-[#10B981]" />
          </div>

          {index !== equipment.length - 1 && (
            <div className="text-center text-[#38BDF8] my-2">↓</div>
          )}
        </div>
      ))}
    </div>
  );
}
