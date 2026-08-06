import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { usePlant } from "../context/PlantContext";
import { getInstructorScenarios } from "../simulator/attacks";

const scenarios = [
  {
    title: "Normal Operation",
    description: "Reset the plant to baseline safe operating conditions.",
    severity: "INFO",
    scenarioType: "RESET",
    category: "SYSTEM",
  },
  ...getInstructorScenarios(),
];

function severityColor(level) {
  switch (level) {
    case "INFO":
      return "bg-[#17324D] text-[#38BDF8]";
    case "LOW":
      return "bg-[#17324D] text-[#38BDF8]";
    case "MEDIUM":
      return "bg-[#4A3A1F] text-[#FBBF24]";
    case "HIGH":
      return "bg-[#5C3A00] text-[#FACC15]";
    case "CRITICAL":
      return "bg-[#4A1F1F] text-[#EF4444]";
    default:
      return "bg-[#17324D] text-[#38BDF8]";
  }
}

export default function Instructor() {
  const { runScenario } = usePlant();

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8">
          <h1 className="text-3xl font-bold">Instructor Console</h1>

          <p className="text-[#94A3B8] mt-2 mb-8">
            Launch cyber-security scenarios for the OT training environment.
          </p>

          <div className="grid grid-cols-3 gap-6">
            {scenarios.map((scenario) => (
              <div
                key={scenario.scenarioType}
                className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6 flex flex-col"
              >
                <div className="flex justify-between items-start mb-5 gap-4">
                  <div>
                    <h2 className="text-xl font-semibold leading-tight">
                      {scenario.title}
                    </h2>

                    <p className="text-xs text-[#38BDF8] mt-2">
                      {scenario.category}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${severityColor(
                      scenario.severity
                    )}`}
                  >
                    {scenario.severity}
                  </span>
                </div>

                <div className="flex-1">
                  <p className="text-[#94A3B8] text-sm leading-6 min-h-[96px]">
                    {scenario.description}
                  </p>
                </div>

                <button
                  onClick={() => runScenario(scenario.scenarioType)}
                  className="mt-6 w-full rounded-xl bg-[#0A84FF] hover:bg-[#0077E6] transition-all duration-200 py-3 font-semibold"
                >
                  Launch Scenario
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
