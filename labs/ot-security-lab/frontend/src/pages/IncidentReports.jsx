import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { usePlant } from "../context/PlantContext";
import { exerciseStateConfig } from "../utils/exerciseState";

export default function IncidentReports() {
  const { plant } = usePlant();
  const state =
    exerciseStateConfig[plant.exerciseState] || exerciseStateConfig.NORMAL;

  const lastCommand = plant.plc?.lastCommand;
  const recentEvents = plant.events || [];
  const alarms = plant.alarms || [];
  const packets = plant.pcapPackets || [];

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Incident Reports</h1>
            <p className="text-[#94A3B8] mt-2">
              Read-only summary of the current lab investigation.
            </p>
          </div>

          <section className="grid grid-cols-4 gap-6">
            <ReportCard title="Exercise State" value={state.label} color={state.color} />
            <ReportCard title="Plant Status" value={plant.plantStatus} color="#10B981" />
            <ReportCard title="Active Alarms" value={plant.activeAlarms} color={plant.activeAlarms > 0 ? "#EF4444" : "#10B981"} />
            <ReportCard title="PCAP Packets" value={packets.length} color="#38BDF8" />
          </section>

          <section className="grid grid-cols-2 gap-6">
            <Panel title="Last PLC Command">
              {lastCommand ? (
                <div className="space-y-3 text-sm">
                  <Field label="Source" value={lastCommand.source} />
                  <Field label="Register" value={lastCommand.register} />
                  <Field label="Value" value={lastCommand.value} />
                  <Field label="Time" value={lastCommand.timestamp} />
                </div>
              ) : (
                <p className="text-[#94A3B8]">No PLC command recorded.</p>
              )}
            </Panel>

            <Panel title="Process Snapshot">
              <div className="space-y-3 text-sm">
                <Field label="Tank Level" value={`${plant.tankLevel.toFixed(1)} %`} />
                <Field label="Flow Rate" value={`${plant.flowRate.toFixed(1)} L/min`} />
                <Field label="Temperature" value={`${plant.temperature.toFixed(1)} °C`} />
                <Field label="Chemical" value={`${plant.chemicalLevel.toFixed(1)} ppm`} />
              </div>
            </Panel>
          </section>

          <section className="grid grid-cols-2 gap-6">
            <Panel title="Active Alarms">
              {alarms.length === 0 ? (
                <p className="text-[#10B981]">No active alarms.</p>
              ) : (
                <div className="space-y-3">
                  {alarms.map((alarm) => (
                    <div key={alarm.id} className="rounded-xl bg-[#071321] border border-[#284A69] p-4">
                      <div className="flex justify-between">
                        <span className="font-semibold text-[#EF4444]">{alarm.id}</span>
                        <span>{alarm.severity}</span>
                      </div>
                      <p className="text-sm mt-2">{alarm.message}</p>
                      <p className="text-xs text-[#94A3B8] mt-1">{alarm.equipment}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent Events">
              <div className="space-y-3">
                {recentEvents.slice(0, 8).map((event, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[80px_120px_1fr] gap-3 text-sm border-b border-[#22354E] pb-2"
                  >
                    <span className="text-[#94A3B8]">{event.time}</span>
                    <span className="text-[#38BDF8]">{event.source}</span>
                    <span>{event.message}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        </div>
      </main>
    </div>
  );
}

function ReportCard({ title, value, color }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-5">
      <p className="text-sm text-[#94A3B8]">{title}</p>
      <p className="text-xl font-semibold mt-2" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between border-b border-[#22354E] pb-2 gap-4">
      <span className="text-[#94A3B8]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
