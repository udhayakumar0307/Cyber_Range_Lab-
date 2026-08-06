import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import StatusCard from "../components/cards/StatusCard";
import MetricCard from "../components/cards/MetricCard";
import HistorianChart from "../components/charts/HistorianChart";
import ProcessSummary from "../components/process/ProcessSummary";
import { usePlant } from "../context/PlantContext";

export default function Overview() {
  const { plant: plantState } = usePlant();

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8 space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-4">System Status</h2>

            <div className="grid grid-cols-4 gap-6">
              <StatusCard
                title="Plant Status"
                value={plantState.plantStatus}
                subtitle="Water Treatment Unit"
                status="normal"
              />

              <StatusCard
                title="Communications"
                value={plantState.communications}
                subtitle="PLC / HMI Link Active"
                status="info"
              />

              <StatusCard
                title="PLC Status"
                value={plantState.plcStatus}
                subtitle="OpenPLC-01"
                status="normal"
              />

              <StatusCard
                title="Active Alarms"
                value={plantState.activeAlarms}
                subtitle={
                  plantState.activeAlarms === 0
                    ? "No Active Alarms"
                    : "Requires Attention"
                }
                status={plantState.activeAlarms > 0 ? "alarm" : "normal"}
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4">Live Plant Metrics</h2>

            <div className="grid grid-cols-4 gap-6">
              <MetricCard
                title="Tank Level"
                value={plantState.tankLevel.toFixed(1)}
                unit="%"
                statusText="Normal"
                status="normal"
              />

              <MetricCard
                title="Flow Rate"
                value={plantState.flowRate.toFixed(1)}
                unit="L/min"
                statusText="Stable"
                status="info"
              />

              <MetricCard
                title="Temperature"
                value={plantState.temperature.toFixed(1)}
                unit="°C"
                statusText="Within Range"
                status="normal"
              />

              <MetricCard
                title="Chemical Level"
                value={plantState.chemicalLevel.toFixed(1)}
                unit="ppm"
                statusText="Normal"
                status="normal"
              />
            </div>
          </section>

          <section className="grid grid-cols-3 gap-6">
            <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
              <h2 className="text-lg font-semibold mb-6">Process Overview</h2>
              <ProcessSummary />
            </div>

            <div className="col-span-2 rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-semibold">Historian</h2>
                <span className="text-xs text-[#94A3B8]">
                  Last 20 Samples
                </span>
              </div>

              <HistorianChart data={plantState.historian} />
            </div>
          </section>

          <section className="grid grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
              <h2 className="text-lg font-semibold mb-5">Network Health</h2>

              <div className="space-y-4">
                {plantState.networkDevices.map((device, index) => (
                  <div key={device.id}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div>{device.name}</div>
                        <div className="text-xs text-[#94A3B8]">
                          {device.protocol}
                        </div>
                      </div>

                      <span
                        className={`w-3 h-3 rounded-full ${
                          device.status === "ONLINE"
                            ? "bg-[#10B981]"
                            : device.status === "DEGRADED"
                            ? "bg-[#FBBF24]"
                            : "bg-[#EF4444]"
                        }`}
                      />
                    </div>

                    {index !== plantState.networkDevices.length - 1}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
              <h2 className="text-lg font-semibold mb-5">Latest Events</h2>

              <div className="space-y-4">
                {plantState.events.map((event) => (
                  <div
                    key={`${event.time}-${event.message}`}
                    className="grid grid-cols-[70px_90px_1fr] gap-3 text-sm border-b border-[#22354E] pb-2"
                  >
                    <span className="text-[#94A3B8]">{event.time}</span>
                    <span className="text-[#38BDF8]">{event.source}</span>
                    <span>{event.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
