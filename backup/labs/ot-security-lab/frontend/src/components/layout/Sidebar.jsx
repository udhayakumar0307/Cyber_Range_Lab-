import { NavLink } from "react-router-dom";

const menuGroups = [
  {
    title: "Operations",
    items: [
      { name: "Overview", path: "/overview" },
      { name: "HMI / Process", path: "/hmi" },
      { name: "Historian", path: "/historian" },
      { name: "Alarms", path: "/alarms" },
      { name: "Event Log", path: "/events" },
      { name: "Protocol Reference", path: "/protocols" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { name: "Network", path: "/network" },
      { name: "PCAP Analysis", path: "/pcap" },
      { name: "Incident Reports", path: "/reports" },
      { name: "Operations Center", path: "/operations" },
    ],
  },
  {
    title: "Administration",
    items: [{ name: "Instructor", path: "/instructor" }],
  },
];

export default function Sidebar() {
  return (
    <aside className="w-[230px] min-h-screen bg-[#0D1B2A] border-r border-[#284A69]/60 px-4 py-5 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#F1F5F9]">
          CyStar
        </h1>
        <p className="text-sm font-semibold text-[#38BDF8] tracking-wide">
          OT Plant
        </p>
      </div>

      <nav className="flex-1 space-y-6">
        {menuGroups.map((group) => (
          <div key={group.title}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#94A3B8] mb-2 px-3">
              {group.title}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `relative block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[#0A84FF]/20 text-[#F8FAFC] shadow-lg shadow-[#0A84FF]/10"
                        : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#10253A]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#38BDF8]" />
                      )}
                      <span className="pl-2">{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="pt-5 border-t border-[#284A69]/50 space-y-1">
        <button className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#10253A] transition">
          Settings
        </button>

        <button className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition">
          Logout
        </button>
      </div>
    </aside>
  );
}
