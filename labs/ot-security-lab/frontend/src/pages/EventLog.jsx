import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { usePlant } from "../context/PlantContext";

export default function EventLog() {
  const { plant } = usePlant();

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8">
          <h1 className="text-3xl font-bold mb-6">Event Log</h1>

          <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
            <div className="space-y-3">
              {(plant.events || []).map((event) => (
                <div key={`${event.time}-${event.message}`} className="grid grid-cols-[90px_120px_100px_1fr] gap-4 border-b border-[#22354E] pb-3 text-sm">
                  <span className="text-[#94A3B8]">{event.time}</span>
                  <span className="text-[#38BDF8]">{event.source}</span>
                  <span>{event.severity}</span>
                  <span>{event.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
