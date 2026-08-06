import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import PlantCanvas from "../components/hmi/PlantCanvas";
import { usePlant } from "../context/PlantContext";

export default function HMI() {
  const { plant } = usePlant();

  return (
    <div className="min-h-screen bg-[#071321] text-[#F1F5F9] flex">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <Topbar />
        <PlantCanvas plant={plant} />
      </main>
    </div>
  );
}
