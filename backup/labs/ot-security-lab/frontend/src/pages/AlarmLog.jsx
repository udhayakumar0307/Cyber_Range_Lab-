import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { usePlant } from "../context/PlantContext";

export default function AlarmLog() {
  const { plant } = usePlant();

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8">
          <h1 className="text-3xl font-bold mb-6">Alarm Log</h1>

          <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
            {(plant.alarms || []).length === 0 ? (
              <p className="text-[#10B981]">No active alarms.</p>
            ) : (
              <div className="space-y-4">
                {plant.alarms.map((alarm) => (
                  <div key={alarm.id} className="rounded-xl bg-[#071321] border border-[#284A69] p-4">
                    <div className="flex justify-between">
                      <h2 className="font-semibold text-[#EF4444]">{alarm.id}</h2>
                      <span>{alarm.severity}</span>
                    </div>
                    <p className="mt-2">{alarm.message}</p>
                    <p className="text-sm text-[#94A3B8] mt-1">{alarm.equipment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
