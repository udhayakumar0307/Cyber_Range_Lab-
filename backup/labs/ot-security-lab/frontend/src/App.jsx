import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./pages/Overview";
import HMI from "./pages/HMI";
import { PlantProvider } from "./context/PlantContext";
import Instructor from "./pages/Instructor";
import OperationsCenter from "./pages/OperationsCenter";
import Network from "./pages/Network";
import AlarmLog from "./pages/AlarmLog";
import EventLog from "./pages/EventLog";
import ProtocolReference from "./pages/ProtocolReference";
import Pcap from "./pages/Pcap";
import Historian from "./pages/Historian";
import IncidentReports from "./pages/IncidentReports";

export default function App() {
  return (
    <PlantProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/hmi" element={<HMI />} />
        <Route path="/instructor" element={<Instructor />} />
        <Route path="/operations" element={<OperationsCenter />} />
        <Route path="/network" element={<Network />} />
        <Route path="/alarms" element={<AlarmLog />} />
        <Route path="/events" element={<EventLog />} />
        <Route path="/protocols" element={<ProtocolReference />} />
        <Route path="/pcap" element={<Pcap />} />
        <Route path="/historian" element={<Historian />} />
        <Route path="/reports" element={<IncidentReports />} />
      </Routes>
    </PlantProvider>
  );
}
