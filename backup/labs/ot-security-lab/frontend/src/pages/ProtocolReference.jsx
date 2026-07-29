import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

const functionCodes = [
  {
    fc: "03",
    name: "Read Holding Registers",
    description: "Read process values from PLC",
  },
  {
    fc: "06",
    name: "Write Single Register",
    description: "Write a single PLC register",
  },
  {
    fc: "16",
    name: "Write Multiple Registers",
    description: "Write multiple PLC registers",
  },
];

const registers = [
  ["40001", "LT101", "Tank Level", "Read"],
  ["40002", "FT101", "Flow Rate", "Read"],
  ["40003", "TT101", "Temperature", "Read"],
  ["40004", "AT101", "Chemical Level", "Read"],
  ["40010", "XV101", "Valve Position", "Read / Write"],
  ["40020", "P101", "Pump Command", "Read / Write"],
  ["40030", "H101", "Heater Command", "Read / Write"],
  ["40040", "DP101", "Chemical Target", "Read / Write"],
];

const attacks = [
  {
    attack: "Close Valve",
    register: "40010",
    effect: "Valve closes, flow decreases",
  },
  {
    attack: "Stop Pump",
    register: "40020",
    effect: "Pump stops, flow becomes zero",
  },
  {
    attack: "Heater Runaway",
    register: "40030",
    effect: "Temperature increases",
  },
  {
    attack: "Chemical Overdose",
    register: "40040",
    effect: "Chemical concentration rises",
  },
];

const filters = [
  "modbus",
  "tcp.port == 502",
  "ip.addr == 192.168.1.10",
  "modbus.func_code == 6",
  "modbus.reference_num == 40010",
];

export default function ProtocolReference() {
  return (
    <div className="min-h-screen bg-[#071321] text-white flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="space-y-8 mt-8">

          <div>
            <h1 className="text-3xl font-bold">Protocol Reference</h1>
            <p className="text-slate-400 mt-2">
              Focused Modbus TCP and DNP3 reference for packet analysis and incident response.
            </p>
          </div>

          <Card title="Modbus TCP Function Codes">
            <Table
              headers={[
                "Function Code",
                "Operation",
                "Purpose",
              ]}
              rows={functionCodes.map(fc => [
                fc.fc,
                fc.name,
                fc.description,
              ])}
            />
          </Card>

          <Card title="DNP3 Operations Used in the Lab">
            <Table
              headers={["Operation", "Port", "Purpose"]}
              rows={[
                ["Class 0 Read Request", "TCP 20000", "SCADA requests the RTU static database"],
                ["Class 0 Read Response", "TCP 20000", "RTU returns remote process telemetry"],
              ]}
            />
          </Card>

          <Card title="PLC Register Map">
            <Table
              headers={[
                "Register",
                "Tag",
                "Description",
                "Access",
              ]}
              rows={registers}
            />
          </Card>

          <Card title="Attack → Register Mapping">
            <Table
              headers={[
                "Attack",
                "PLC Register",
                "Expected Physical Effect",
              ]}
              rows={attacks.map(a => [
                a.attack,
                a.register,
                a.effect,
              ])}
            />
          </Card>

          <Card title="Useful Wireshark Filters">
            <div className="space-y-3">
              {filters.map(filter => (
                <div
                  key={filter}
                  className="rounded-lg bg-[#071321] border border-[#284A69] px-4 py-3 font-mono"
                >
                  {filter}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Investigation Workflow">
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>Observe abnormal behaviour on the HMI.</li>
              <li>Review alarms and historian trends.</li>
              <li>Inspect network traffic.</li>
              <li>Open PCAP Analysis.</li>
              <li>Identify Modbus function code.</li>
              <li>Identify affected PLC register.</li>
              <li>Determine physical consequence.</li>
              <li>Execute recovery action from Operations Center.</li>
              <li>Verify the plant returns to normal.</li>
            </ol>
          </Card>

        </div>
      </main>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">{title}</h2>
      {children}
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b border-[#284A69] text-slate-400">
          {headers.map(h => (
            <th key={h} className="text-left py-3">
              {h}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            className="border-b border-[#22354E]"
          >
            {row.map((col, j) => (
              <td
                key={j}
                className="py-3"
              >
                {col}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
