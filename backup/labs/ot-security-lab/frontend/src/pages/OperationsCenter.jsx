import { useEffect, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { usePlant } from "../context/PlantContext";
import { exerciseStateConfig } from "../utils/exerciseState";
import { getWorkflowStatus } from "../simulator/responseWorkflow";

const actions = [
  { label: "Confirm EWS Source", command: "IDENTIFY_EWS_SOURCE", phase: "Investigate" },
  { label: "Review Traffic Pattern", command: "REVIEW_TRAFFIC_PATTERN", phase: "Investigate" },
  { label: "Review Asset Inventory", command: "REVIEW_ASSET_INVENTORY", phase: "Investigate" },
  { label: "Compare HMI / PLC / Historian", command: "COMPARE_HMI_PLC", phase: "Investigate" },
  { label: "Check Network", command: "CHECK_NETWORK", phase: "Investigate" },
  { label: "Verify Registers", command: "VERIFY_REGISTER_VALUES", phase: "Investigate" },
  { label: "Verify Current State", command: "VERIFY_CURRENT_STATE", phase: "Investigate" },
  { label: "Validate Source Identity", command: "VERIFY_SOURCE_IDENTITY", phase: "Investigate" },

  { label: "Isolate Engineering WS", command: "ISOLATE_EWS", phase: "Contain" },
  { label: "Block Source", command: "BLOCK_SOURCE", phase: "Contain" },
  { label: "Isolate Network", command: "ISOLATE_NETWORK", phase: "Contain" },
  { label: "Isolate HMI Data Path", command: "ISOLATE_HMI_DATA_PATH", phase: "Contain" },

  { label: "Restart Pump", command: "START_PUMP", phase: "Recover" },
  { label: "Restore Valve", command: "OPEN_VALVE", phase: "Recover" },
  { label: "Restore Heater", command: "RESET_HEATER", phase: "Recover" },
  { label: "Normalize Chemical", command: "RESET_CHEMICAL", phase: "Recover" },
  { label: "Restore Process", command: "RESTORE_PROCESS", phase: "Recover" },
  { label: "Request Trusted PLC Poll", command: "START_TRUSTED_REFRESH", phase: "Recover" },
  { label: "Wait for Trusted Update", command: "WAIT_FOR_TRUSTED_UPDATE", phase: "Recover" },
  { label: "Restore HMI Data", command: "RESTORE_HMI_DATA", phase: "Recover" },
  { label: "Restart PLC", command: "RESTART_PLC", phase: "Recover" },

  { label: "Start Stability Window", command: "START_STABILITY_WINDOW", phase: "Verify" },
  { label: "Wait for Process Stability", command: "WAIT_FOR_PROCESS_STABILITY", phase: "Verify" },
  { label: "Start Clean Traffic Window", command: "START_CLEAN_TRAFFIC_WINDOW", phase: "Verify" },
  { label: "Wait for Clean Traffic", command: "WAIT_FOR_CLEAN_TRAFFIC", phase: "Verify" },
  { label: "Verify HMI Match", command: "VERIFY_HMI_MATCH", phase: "Verify" },
  { label: "Verify Recovery", command: "VERIFY_RECOVERY", phase: "Verify" },

  { label: "Restore Network", command: "RESTORE_NETWORK", phase: "Restore" },
  { label: "Restore Engineering WS", command: "RECONNECT_EWS", phase: "Restore" },
];

const phaseOrder = ["Contain", "Investigate", "Recover", "Verify", "Restore"];

export default function OperationsCenter() {
  const { plant, studentAction } = usePlant();
  const workflow = getWorkflowStatus(plant);

  const [messages, setMessages] = useState([
    "Response console ready.",
    "Analyze the plant condition before taking action.",
  ]);

  useEffect(() => {
    if (!plant.responseFeedback) return;
    setMessages((prev) => [
      `${plant.responseFeedback.time} — ${plant.responseFeedback.ok ? "SUCCESS" : "REJECTED"}: ${plant.responseFeedback.message}`,
      ...prev,
    ]);
  }, [plant.responseFeedback]);

  const state =
    exerciseStateConfig[plant.exerciseState] || exerciseStateConfig.NORMAL;

  function handleAction(action) {
    studentAction(action.command);
  }

  const expectedCommand = workflow?.expected?.action || null;

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8 space-y-6">
          <section className="flex items-center justify-between rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
            <div>
              <h1 className="text-3xl font-bold">Response Console</h1>
              <p className="text-[#94A3B8] mt-2">
                Explore corrective actions at any time. During an incident, the recommended next action is highlighted.
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-[#94A3B8]">Exercise State</p>
              <p className="text-xl font-semibold" style={{ color: state.color }}>
                {state.label}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-5 gap-6">
            <StatusCard title="Plant Status" value={plant.plantStatus} color="#10B981" />
            <StatusCard title="Active Alarms" value={plant.activeAlarms} color={plant.activeAlarms > 0 ? "#EF4444" : "#10B981"} />
            <StatusCard title="Pump" value={plant.pumpStatus} color="#38BDF8" />
            <StatusCard title="Valve Position" value={`${plant.valvePosition.toFixed(0)}%`} color="#38BDF8" />
            <StatusCard
              title="Engineering WS"
              value={(plant.networkDevices || []).find((device) => device.id === "EWS01")?.status || plant.ewsState || "ONLINE"}
              color={["OFFLINE", "ISOLATED"].includes((plant.networkDevices || []).find((device) => device.id === "EWS01")?.status || plant.ewsState) ? "#EF4444" : "#10B981"}
            />
          </section>

          <section className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm text-[#94A3B8]">Active Incident</p>
                <h2 className="text-xl font-semibold mt-1">
                  {workflow?.response?.title || "No active incident"}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#94A3B8]">Required Next Action</p>
                <p className="font-semibold text-[#38BDF8] mt-1">
                  {workflow?.expected?.label || "Launch an exercise from Instructor"}
                </p>
              </div>
            </div>

            {workflow && (
              <div className="grid grid-cols-5 gap-3 mt-5">
                {phaseOrder.map((phase) => {
                  const steps = workflow.response.workflow.filter((step) => step.phase.toUpperCase() === phase.toUpperCase());
                  const done = steps.length > 0 && steps.every((step) =>
                    (workflow.incident.responseHistory || []).some((entry) => entry.action === step.action)
                  );
                  const current = workflow.expected?.phase?.toUpperCase() === phase.toUpperCase();
                  return (
                    <div key={phase} className={`rounded-xl border p-3 text-center text-sm ${done ? "border-[#10B981] text-[#10B981]" : current ? "border-[#38BDF8] text-[#38BDF8]" : "border-[#284A69] text-[#64748B]"}`}>
                      {phase}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
              <h2 className="text-xl font-semibold mb-5">Corrective Actions</h2>

              <div className="grid grid-cols-2 gap-4">
                {actions.map((action) => {
                  const recommended = action.command === expectedCommand;
                  return (
                    <button
                      key={action.command}
                      onClick={() => handleAction(action)}
                      className={`rounded-xl transition py-3 px-4 font-semibold text-left border ${
                        recommended
                          ? "bg-[#0A84FF] hover:bg-[#0077E6] border-[#38BDF8]"
                          : "bg-[#132B42] hover:bg-[#19364F] border-[#284A69] text-[#E2E8F0]"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs opacity-75">
                        <span>{action.phase}</span>
                        {recommended && <span>RECOMMENDED</span>}
                      </span>
                      <span className="block mt-1">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
              <h2 className="text-xl font-semibold mb-5">System Feedback</h2>

              <div className="h-64 overflow-y-auto rounded-xl bg-[#071321] border border-[#284A69] p-4 text-sm font-mono space-y-2">
                {messages.map((message, index) => (
                  <div key={index} className="text-[#94A3B8]">
                    {">"} {message}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
            <h2 className="text-xl font-semibold mb-4">Current Process Condition</h2>
            <div className="grid grid-cols-4 gap-6 text-sm">
              <ProcessValue label="Tank Level" value={`${plant.tankLevel.toFixed(1)}%`} />
              <ProcessValue label="Flow Rate" value={`${plant.flowRate.toFixed(1)} L/min`} />
              <ProcessValue label="Temperature" value={`${plant.temperature.toFixed(1)} °C`} />
              <ProcessValue label="Chemical" value={`${plant.chemicalLevel.toFixed(1)} ppm`} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatusCard({ title, value, color }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-5">
      <p className="text-sm text-[#94A3B8]">{title}</p>
      <p className="text-xl font-semibold mt-2" style={{ color }}>{value}</p>
    </div>
  );
}

function ProcessValue({ label, value }) {
  return (
    <div className="rounded-xl bg-[#071321] border border-[#284A69] p-4">
      <p className="text-[#94A3B8]">{label}</p>
      <p className="text-lg font-semibold mt-2">{value}</p>
    </div>
  );
}
