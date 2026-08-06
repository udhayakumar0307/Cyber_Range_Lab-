import { useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { usePlant } from "../context/PlantContext";
import {
  analyzePackets,
  decodePacket,
  getRegisterInfo,
} from "../simulator/pcapAnalyzer";

import { buildTrafficStatistics } from "../simulator/network/trafficStatistics";
import { detectIOCs } from "../simulator/network/iocEngine";
import { buildConversations } from "../simulator/network/conversationTracker";
import { reconstructSessions } from "../simulator/network/sessionReconstructor";
import { buildCommunicationMatrix } from "../simulator/network/communicationMatrix";
import {
  uploadPcap,
  getCaptures,
  getCaptureById,
  generatePcap,
  getPcapDownloadUrl,
} from "../services/pcapApi";

export default function Pcap() {
  const { plant } = usePlant();

  const [mode, setMode] = useState("generated");
  const [selectedPacket, setSelectedPacket] = useState(null);

  const packets = plant.pcapPackets || [];

  const analysis = analyzePackets(packets);
  const decoded = decodePacket(selectedPacket);

  const trafficStats = buildTrafficStatistics(packets);
  const iocs = detectIOCs(packets);
  const conversations = buildConversations(packets);
  const sessions = reconstructSessions(packets);
  const communicationMatrix = buildCommunicationMatrix(packets);

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />

        <div className="mt-8">
          <h1 className="text-3xl font-bold">PCAP Analysis</h1>
          <p className="text-[#94A3B8] mt-2 mb-8">
            Analyze lab-generated OT captures or upload external PCAP files.
          </p>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setMode("generated")}
              className={`px-5 py-3 rounded-xl font-semibold ${
                mode === "generated"
                  ? "bg-[#0A84FF]"
                  : "bg-[#10253A] border border-[#284A69] text-[#94A3B8]"
              }`}
            >
              Lab Generated Capture
            </button>

            <button
              onClick={() => setMode("upload")}
              className={`px-5 py-3 rounded-xl font-semibold ${
                mode === "upload"
                  ? "bg-[#0A84FF]"
                  : "bg-[#10253A] border border-[#284A69] text-[#94A3B8]"
              }`}
            >
              Upload PCAP
            </button>
          </div>

          {mode === "generated" ? (
            <GeneratedCapture
              packets={packets}
              analysis={analysis}
              trafficStats={trafficStats}
              iocs={iocs}
              conversations={conversations}
              sessions={sessions}
              communicationMatrix={communicationMatrix}
              selectedPacket={selectedPacket}
              setSelectedPacket={setSelectedPacket}
              decoded={decoded}
            />
          ) : (
            <UploadCapture />
          )}
        </div>
      </main>
    </div>
  );
}

function GeneratedCapture({
  packets,
  analysis,
  trafficStats,
  iocs,
  conversations,
  sessions,
  communicationMatrix,
  selectedPacket,
  setSelectedPacket,
  decoded,
}) {
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  async function handleGenerateDownload() {
    setGenerating(true);

    try {
      const result = await generatePcap(
        packets,
        `ot_sim_capture_${Date.now()}.pcap`
      );

      setDownloadUrl(getPcapDownloadUrl(result.filename));
      window.open(getPcapDownloadUrl(result.filename), "_blank");
    } catch (err) {
      console.error(err);
      alert("Failed to generate PCAP.");
    }

    setGenerating(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
        <h2 className="text-xl font-semibold mb-5">Generated Capture</h2>

        <div className="flex gap-4">
          <button
            onClick={handleGenerateDownload}
            disabled={!packets.length || generating}
            className="px-5 py-3 rounded-xl bg-[#0A84FF] hover:bg-[#0077E6] disabled:opacity-50 font-semibold"
          >
            {generating ? "Generating..." : "Download Generated PCAP"}
          </button>

          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] font-semibold"
            >
              Open Last PCAP
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <InfoCard title="Total Packets" value={analysis.totalPackets} />
        <InfoCard title="Protocols" value={Object.keys(analysis.protocols).length} />
        <InfoCard title="Reads" value={analysis.readCount} />
        <InfoCard title="Writes" value={analysis.writeCount} />
        <InfoCard title="Suspicious" value={analysis.suspiciousCount} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <TrafficStatisticsPanel trafficStats={trafficStats} />
        <IOCPanel iocs={iocs} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
          <h2 className="text-xl font-semibold mb-5">Packet Records</h2>

          <PacketTable
            packets={packets}
            selectedPacket={selectedPacket}
            setSelectedPacket={setSelectedPacket}
          />
        </div>

        <PacketDecoder decoded={decoded} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <ConversationsPanel conversations={conversations} />
        <SessionsPanel sessions={sessions} />
        <CommunicationMatrixPanel communicationMatrix={communicationMatrix} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ProtocolSummary protocols={analysis.protocols} />
        <AffectedRegisters affectedRegisters={analysis.affectedRegisters} />
      </div>
    </div>
  );
}

function TrafficStatisticsPanel({ trafficStats }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">Traffic Statistics</h2>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <Stat label="Modbus Packets" value={trafficStats.modbusPackets} />
        <Stat label="Reads" value={trafficStats.reads} />
        <Stat label="Writes" value={trafficStats.writes} />
        <Stat label="Responses" value={trafficStats.responses} />
        <Stat label="Conversations" value={trafficStats.conversations} />
        <Stat label="Suspicious" value={trafficStats.suspicious} />
      </div>
    </div>
  );
}

function IOCPanel({ iocs }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">IOC Findings</h2>

      {iocs.length === 0 ? (
        <p className="text-[#10B981]">No suspicious indicators detected.</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {iocs.slice(0, 8).map((ioc) => (
            <div
              key={ioc.id}
              className="rounded-xl bg-[#071321] border border-[#284A69] p-4"
            >
              <div className="flex justify-between gap-4">
                <p className="font-semibold">{ioc.title}</p>
                <span
                  className={
                    ioc.severity === "CRITICAL" || ioc.severity === "HIGH"
                      ? "text-[#EF4444]"
                      : "text-[#FBBF24]"
                  }
                >
                  {ioc.severity}
                </span>
              </div>

              <p className="text-sm text-[#94A3B8] mt-2">
                {ioc.description}
              </p>

              {ioc.register && (
                <p className="text-xs text-[#38BDF8] mt-2">
                  Register: {ioc.register}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PacketTable({ packets, selectedPacket, setSelectedPacket }) {
  if (!packets.length) {
    return (
      <div className="text-[#94A3B8] py-8">
        No packets generated yet. Wait for normal traffic or launch a scenario.
      </div>
    );
  }

  const displayPackets = [...packets].reverse();

  function formatValue(value) {
    if (value === undefined || value === null) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  return (
    <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
      <table className="w-full min-w-[1050px] table-fixed text-sm">
        <thead className="sticky top-0 bg-[#10253A] border-b border-[#284A69] text-[#94A3B8]">
          <tr>
            <th className="w-32 px-3 py-3 text-left">Time</th>
            <th className="w-36 px-3 py-3 text-left">Source</th>
            <th className="w-36 px-3 py-3 text-left">Destination</th>
            <th className="w-32 px-3 py-3 text-left">Protocol</th>
            <th className="w-16 px-3 py-3 text-center">FC</th>
            <th className="w-32 px-3 py-3 text-left">Register</th>
            <th className="w-64 px-3 py-3 text-left">Value</th>
            <th className="w-24 px-3 py-3 text-center">Severity</th>
          </tr>
        </thead>

        <tbody>
          {displayPackets.map((packet, index) => {
            const selected = selectedPacket === packet;
            const valueText = formatValue(packet.value ?? packet.payload?.value);

            return (
              <tr
                key={`${packet.timestamp}-${packet.source}-${packet.destination}-${index}`}
                onClick={() => setSelectedPacket(packet)}
                className={`border-b border-[#22354E] cursor-pointer hover:bg-[#17324D] ${
                  selected ? "bg-[#17324D]" : ""
                }`}
              >
                <td className="px-3 py-3 whitespace-nowrap">{packet.timestamp}</td>
                <td className="px-3 py-3 whitespace-nowrap font-medium">{packet.source}</td>
                <td className="px-3 py-3 whitespace-nowrap font-medium">{packet.destination}</td>
                <td className="px-3 py-3 whitespace-nowrap text-[#38BDF8]">{packet.protocol}</td>
                <td className="px-3 py-3 text-center">{packet.functionCode ?? "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{packet.register ?? packet.payload?.register ?? "-"}</td>
                <td className="px-3 py-3 truncate" title={valueText}>{valueText}</td>
                <td
                  className={`px-3 py-3 text-center font-semibold ${
                    packet.severity === "HIGH" || packet.severity === "CRITICAL"
                      ? "text-[#EF4444]"
                      : packet.severity === "MEDIUM"
                      ? "text-[#FBBF24]"
                      : "text-[#10B981]"
                  }`}
                >
                  {packet.severity}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PacketDecoder({ decoded }) {
  if (!decoded) {
    return (
      <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
        <h2 className="text-xl font-semibold mb-5">Packet Decoder</h2>
        <p className="text-[#94A3B8]">
          Select a packet to decode Modbus fields and affected process tags.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">Packet Decoder</h2>

      <div className="space-y-4 text-sm">
        <Field label="Protocol" value={decoded.protocol} />
        <Field label="Function" value={decoded.operation} />
        <Field label="Function Code" value={decoded.decoded.functionCode} />

        <Field
          label="Register"
          value={`${decoded.decoded.register} (${decoded.decoded.name})`}
        />

        <Field label="Tag" value={decoded.decoded.tag} />
        <Field label="Asset" value={decoded.decoded.asset} />

        <Field
          label="Value"
          value={
            typeof decoded.decoded.value === "object"
              ? JSON.stringify(decoded.decoded.value)
              : `${decoded.decoded.value}${
                  decoded.decoded.unit ? ` ${decoded.decoded.unit}` : ""
                }`
          }
        />

        <div className="rounded-xl bg-[#071321] border border-[#284A69] p-4 mt-4">
          <p className="text-[#94A3B8] text-xs mb-2">Interpretation</p>
          <p>{decoded.decoded.meaning}</p>
        </div>

        <div className="rounded-xl bg-[#071321] border border-[#284A69] p-4">
          <p className="text-[#94A3B8] text-xs mb-2">Physical Consequence</p>
          <p>{decoded.decoded.consequence}</p>
        </div>
      </div>
    </div>
  );
}

function ConversationsPanel({ conversations }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">Conversations</h2>

      {conversations.length === 0 ? (
        <p className="text-[#94A3B8]">No conversations detected.</p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {conversations.slice(0, 8).map((conv) => (
            <div
              key={conv.id}
              className="rounded-xl bg-[#071321] border border-[#284A69] p-4 text-sm"
            >
              <div className="flex justify-between gap-4">
                <p className="font-semibold">
                  {conv.source} → {conv.destination}
                </p>
                <span
                  className={conv.suspicious ? "text-[#EF4444]" : "text-[#10B981]"}
                >
                  {conv.suspicious ? "Suspicious" : "Normal"}
                </span>
              </div>

              <p className="text-[#94A3B8] mt-2">{conv.protocol}</p>

              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <span>Packets: {conv.packetCount}</span>
                <span>Reads: {conv.reads}</span>
                <span>Writes: {conv.writes}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionsPanel({ sessions }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">Modbus Sessions</h2>

      {sessions.length === 0 ? (
        <p className="text-[#94A3B8]">No sessions reconstructed.</p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {sessions.slice(0, 8).map((session) => (
            <div
              key={session.sessionId}
              className="rounded-xl bg-[#071321] border border-[#284A69] p-4 text-sm"
            >
              <div className="flex justify-between gap-4">
                <p className="font-semibold">{session.functionName}</p>
                <span
                  className={
                    session.suspicious ? "text-[#EF4444]" : "text-[#10B981]"
                  }
                >
                  {session.completed ? "Completed" : "Open"}
                </span>
              </div>

              <p className="text-[#94A3B8] mt-2">
                {session.source} → {session.destination}
              </p>

              <p className="text-xs text-[#38BDF8] mt-2">
                {session.registerLabel}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunicationMatrixPanel({ communicationMatrix }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">Communication Matrix</h2>

      {communicationMatrix.length === 0 ? (
        <p className="text-[#94A3B8]">No communication pairs detected.</p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {communicationMatrix.slice(0, 8).map((row) => (
            <div
              key={`${row.source}-${row.destination}`}
              className="rounded-xl bg-[#071321] border border-[#284A69] p-4 text-sm"
            >
              <div className="flex justify-between gap-4">
                <p className="font-semibold">
                  {row.source} → {row.destination}
                </p>
                <span
                  className={row.suspicious > 0 ? "text-[#EF4444]" : "text-[#10B981]"}
                >
                  {row.packets} packets
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-[#94A3B8]">
                <span>Reads: {row.reads}</span>
                <span>Writes: {row.writes}</span>
                <span>Suspicious: {row.suspicious}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProtocolSummary({ protocols }) {
  const entries = Object.entries(protocols);

  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">Protocol Summary</h2>

      {entries.length === 0 ? (
        <p className="text-[#94A3B8]">No protocol data available.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([protocol, count]) => (
            <div
              key={protocol}
              className="flex justify-between border-b border-[#22354E] pb-2"
            >
              <span>{protocol}</span>
              <span className="text-[#38BDF8]">{count} packets</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AffectedRegisters({ affectedRegisters }) {
  const entries = Object.entries(affectedRegisters);

  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
      <h2 className="text-xl font-semibold mb-5">Affected Registers</h2>

      {entries.length === 0 ? (
        <p className="text-[#94A3B8]">No register activity detected.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([register, count]) => {
            const info = getRegisterInfo(register);

            return (
              <div
                key={register}
                className="flex justify-between border-b border-[#22354E] pb-2"
              >
                <span>
                  {register} {info ? `(${info.tag})` : ""}
                </span>
                <span className="text-[#38BDF8]">{count} times</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UploadCapture() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!selectedFile) return;

    setLoading(true);
    setError("");

    try {
      const response = await uploadPcap(selectedFile);
      setResult(response);
      await loadCaptures();
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  async function loadCaptures() {
    setCapturesLoading(true);
    setError("");

    try {
      const response = await getCaptures();
      setCaptures(response);
    } catch (err) {
      setError(err.message);
    }

    setCapturesLoading(false);
  }

  async function loadCapture(captureId) {
    setLoading(true);
    setError("");

    try {
      const response = await getCaptureById(captureId);
      setResult(response);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
        <h2 className="text-xl font-semibold mb-4">Upload External PCAP</h2>

        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".pcap,.pcapng"
            id="pcap-upload"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files[0])}
          />

          <label
            htmlFor="pcap-upload"
            className="px-5 py-3 rounded-xl bg-[#17324D] border border-[#284A69] hover:bg-[#1E3A5C] cursor-pointer font-semibold"
          >
            Choose PCAP File
          </label>

          <span className="text-[#94A3B8]">
            {selectedFile ? selectedFile.name : "No file selected"}
          </span>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || loading}
            className="ml-auto px-6 py-3 rounded-xl bg-[#0A84FF] hover:bg-[#0077E6] disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? "Analyzing..." : "Analyze Capture"}
          </button>
        </div>

        {error && <p className="text-[#EF4444] mt-4">{error}</p>}
      </div>

      <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-semibold">Previous Captures</h2>

          <button
            onClick={loadCaptures}
            disabled={capturesLoading}
            className="px-4 py-2 rounded-xl bg-[#17324D] border border-[#284A69] hover:bg-[#1E3A5C]"
          >
            {capturesLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {captures.length === 0 ? (
          <p className="text-[#94A3B8]">
            No captures loaded. Click Refresh or upload a PCAP.
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {captures.map((capture) => (
              <div
                key={capture.id}
                className="grid grid-cols-[1fr_120px_160px_120px] gap-4 items-center rounded-xl bg-[#071321] border border-[#284A69] p-4 text-sm"
              >
                <div>
                  <p className="font-semibold">{capture.filename}</p>
                  <p className="text-[#94A3B8] text-xs">
                    {capture.createdAt}
                  </p>
                </div>

                <p>{capture.packetCount} packets</p>

                <p className="text-[#94A3B8]">
                  {(capture.fileSize / 1024).toFixed(1)} KB
                </p>

                <button
                  onClick={() => loadCapture(capture.id)}
                  className="px-4 py-2 rounded-xl bg-[#0A84FF] hover:bg-[#0077E6] font-semibold"
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-6">
          <h2 className="text-xl font-semibold mb-5">Backend Analysis</h2>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <InfoCard title="Filename" value={result.filename} />
            <InfoCard title="Packets" value={result.packetCount} />
            <InfoCard
              title="Capture ID"
              value={result.captureId || result.id || "-"}
            />
          </div>

          <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#10253A] text-[#94A3B8]">
                <tr>
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Source</th>
                  <th className="text-left py-2">Destination</th>
                  <th className="text-left py-2">Protocol</th>
                  <th className="text-left py-2">Operation</th>
                  <th className="text-left py-2">Summary</th>
                </tr>
              </thead>

              <tbody>
                {(result.packets || []).map((packet) => (
                  <tr key={packet.index} className="border-b border-[#22354E]">
                    <td className="py-2">{packet.index}</td>
                    <td>{packet.source}</td>
                    <td>{packet.destination}</td>
                    <td className="text-[#38BDF8]">{packet.protocol}</td>
                    <td>{packet.operation || "-"}</td>
                    <td>{packet.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, value }) {
  return (
    <div className="rounded-2xl bg-[#10253A] border border-[#284A69] p-5">
      <p className="text-sm text-[#94A3B8]">{title}</p>
      <p className="text-xl font-semibold mt-2">{value}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-[#071321] border border-[#284A69] p-4">
      <p className="text-[#94A3B8]">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
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
