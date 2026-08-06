import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import HistorianChart from "../components/charts/HistorianChart";
import { usePlant } from "../context/PlantContext";

export default function Historian() {
  const { plant } = usePlant();

  const samples = [...(plant.historian || [])].reverse();

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Historian</h1>
            <p className="text-[#94A3B8] mt-2">
              Review process trends over time and correlate abnormal behavior.
            </p>
          </div>

          <section className="grid grid-cols-4 gap-6">
            <Card tag="LT101" title="Tank Level" value={`${plant.tankLevel.toFixed(1)} %`} status="Normal" />
            <Card tag="FT101" title="Flow Rate" value={`${plant.flowRate.toFixed(1)} L/min`} status="Stable" />
            <Card tag="TT101" title="Temperature" value={`${plant.temperature.toFixed(1)} °C`} status="Within Range" />
            <Card tag="AT101" title="Chemical Level" value={`${plant.chemicalLevel.toFixed(1)} ppm`} status="Normal" />
          </section>

          <section className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6 min-h-[520px]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-semibold">Live Process Trends</h2>
              <span className="text-sm text-[#94A3B8]">
                Last {plant.historian.length} samples
              </span>
            </div>

            <div className="w-full h-[420px]">
              <HistorianChart data={plant.historian} />
            </div>
          </section>

          <section className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
            <h2 className="text-xl font-semibold mb-5">Recent Samples</h2>

            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 bg-[#10253A] border-b border-[#284A69] text-[#94A3B8]">
                  <tr>
                    <th className="w-1/5 text-left py-3">Time</th>
                    <th className="w-1/5 text-left py-3">Tank Level (%)</th>
                    <th className="w-1/5 text-left py-3">Flow (L/min)</th>
                    <th className="w-1/5 text-left py-3">Temperature (°C)</th>
                    <th className="w-1/5 text-left py-3">Chemical (ppm)</th>
                  </tr>
                </thead>

                <tbody>
                  {samples.map((sample, index) => (
                    <tr key={index} className="border-b border-[#22354E]">
                      <td className="py-3 text-[#94A3B8]">{sample.time}</td>
                      <td className="py-3">{Number(sample.tankLevel).toFixed(1)}</td>
                      <td className="py-3">{Number(sample.flowRate).toFixed(1)}</td>
                      <td className="py-3">{Number(sample.temperature).toFixed(1)}</td>
                      <td className="py-3">{Number(sample.chemicalLevel).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Card({ tag, title, value, status }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-5">
      <p className="text-xs text-[#38BDF8] font-semibold">{tag}</p>
      <p className="text-sm text-[#94A3B8] mt-1">{title}</p>
      <p className="text-xl font-semibold mt-3">{value}</p>
      <p className="text-sm text-[#10B981] mt-2">{status}</p>
    </div>
  );
}
