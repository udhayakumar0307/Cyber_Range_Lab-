import { useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { usePlant } from "../context/PlantContext";

const registerLabels = {
  40001: "Tank Level",
  40002: "Flow Rate",
  40003: "Temperature",
  40004: "Chemical Level",
  40010: "Valve Position",
  40020: "Pump Command",
  40030: "Heater Command",
  40040: "Chemical Target",
};

export default function Network() {
  const { plant } = usePlant();
  const [selectedDevice, setSelectedDevice] = useState(null);

  const devices = plant.networkDevices || [];
  const selected =
    selectedDevice || devices.find((device) => device.id === "PLC01");

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Network Topology</h1>
            <p className="text-[#94A3B8] mt-2">
              Inspect OT assets, communication paths, and PLC register state.
            </p>
          </div>

          <section className="grid grid-cols-3 gap-6">
            <div className="col-span-2 rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
              <h2 className="text-xl font-semibold mb-6">OT Asset Map</h2>

              <div className="grid grid-cols-3 gap-5">
                {devices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => setSelectedDevice(device)}
                    className={`text-left rounded-2xl border p-5 transition ${
                      selected?.id === device.id
                        ? "bg-[#17324D] border-[#38BDF8]"
                        : "bg-[#071321] border-[#284A69] hover:bg-[#10253A]"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">{device.name}</h3>
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

                    <p className="text-sm text-[#94A3B8] mt-2">
                      {device.type}
                    </p>

                    <p className="text-sm text-[#38BDF8] mt-1">
                      {device.protocol}
                    </p>

                    <p className="text-xs text-[#94A3B8] mt-4">
                      Asset ID: {device.id}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <DeviceDetails device={selected} plant={plant} />
          </section>

          <section className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
            <h2 className="text-xl font-semibold mb-5">Recent Network Activity</h2>

            {(plant.pcapPackets || []).length === 0 ? (
              <p className="text-[#94A3B8]">
                No network activity generated yet.
              </p>
            ) : (
              <div className="space-y-3">
                {(plant.pcapPackets || []).slice(-5).reverse().map((packet, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[90px_100px_100px_140px_1fr] gap-4 border-b border-[#22354E] pb-2 text-sm"
                  >
                    <span className="text-[#94A3B8]">{packet.timestamp}</span>
                    <span>{packet.source}</span>
                    <span>{packet.destination}</span>
                    <span className="text-[#38BDF8]">{packet.protocol}</span>
                    <span>{packet.operation}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function DeviceDetails({ device, plant }) {
  if (!device) {
    return (
      <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
        <h2 className="text-xl font-semibold">Device Details</h2>
        <p className="text-[#94A3B8] mt-4">Select a device.</p>
      </div>
    );
  }

  const isPLC = device.id === "PLC01";
  const lastCommand = plant.plc?.lastCommand;

  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">Device Details</h2>

      <div className="space-y-3 text-sm">
        <Field label="Name" value={device.name} />
        <Field label="Asset ID" value={device.id} />
        <Field label="Type" value={device.type} />
        <Field label="Status" value={device.status} />
        <Field label="Protocol" value={device.protocol} />
      </div>

      {isPLC && (
        <>
          <div className="mt-6 rounded-xl bg-[#071321] border border-[#284A69] p-4">
            <h3 className="font-semibold mb-3">Last PLC Command</h3>

            {lastCommand ? (
              <div className="space-y-2 text-sm">
                <Field label="Source" value={lastCommand.source} />
                <Field label="Register" value={lastCommand.register} />
                <Field label="Value" value={lastCommand.value} />
                <Field label="Time" value={lastCommand.timestamp} />
              </div>
            ) : (
              <p className="text-[#94A3B8] text-sm">
                No PLC command recorded.
              </p>
            )}
          </div>

          <div className="mt-6 rounded-xl bg-[#071321] border border-[#284A69] p-4">
            <h3 className="font-semibold mb-3">Holding Registers</h3>

            <div className="space-y-2 text-sm">
              {Object.entries(plant.plc?.registers || {}).map(
                ([register, value]) => (
                  <Field
                    key={register}
                    label={`${register} — ${
                      registerLabels[register] || "Unknown"
                    }`}
                    value={value}
                  />
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#22354E] pb-2">
      <span className="text-[#94A3B8]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
