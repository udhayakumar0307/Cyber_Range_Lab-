"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Trophy, Flag, TrendingUp, Users, Award } from "lucide-react"
import { useAuth } from "@/lib/auth"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

interface LeaderboardEntry {
  name: string
  email: string
  completedChallenges: number
  totalPoints: number
  totalTimeSpent: number
}

interface CTFLeaderboardViewProps {
  entries: LeaderboardEntry[]
  isLiveMode?: boolean
}

const DEFAULT_TEAMS: LeaderboardEntry[] = [
  { name: "Carl", email: "carl@ctf.io", completedChallenges: 13, totalPoints: 3700, totalTimeSpent: 120 },
  { name: "Marie", email: "marie@ctf.io", completedChallenges: 11, totalPoints: 3400, totalTimeSpent: 140 },
  { name: "Stephen", email: "stephen@ctf.io", completedChallenges: 15, totalPoints: 3300, totalTimeSpent: 155 },
  { name: "Tiffany", email: "tiffany@ctf.io", completedChallenges: 13, totalPoints: 3150, totalTimeSpent: 160 },
  { name: "David", email: "david@ctf.io", completedChallenges: 12, totalPoints: 3100, totalTimeSpent: 170 },
  { name: "Diane", email: "diane@ctf.io", completedChallenges: 7, totalPoints: 3000, totalTimeSpent: 110 },
  { name: "Ralph", email: "ralph@ctf.io", completedChallenges: 15, totalPoints: 3000, totalTimeSpent: 185 },
  { name: "Eugene", email: "eugene@ctf.io", completedChallenges: 9, totalPoints: 2800, totalTimeSpent: 130 },
  { name: "Bobby", email: "bobby@ctf.io", completedChallenges: 10, totalPoints: 2700, totalTimeSpent: 150 },
  { name: "Megan", email: "megan@ctf.io", completedChallenges: 8, totalPoints: 2500, totalTimeSpent: 125 }
]

const TEAM_COLORS: { [key: string]: string } = {
  "Carl": "#8B5CF6",     // Purple
  "Marie": "#F59E0B",    // Orange
  "Stephen": "#84CC16",  // Lime/Yellow-Green
  "Tiffany": "#047857",  // Dark Green
  "David": "#10B981",    // Emerald
  "Diane": "#6366F1",    // Indigo
  "Ralph": "#EF4444",    // Red
  "Eugene": "#EC4899",   // Pink
  "Bobby": "#06B6D4",    // Cyan
  "Megan": "#22C55E"     // Bright Green
}

const getTeamColor = (name: string, index: number): string => {
  const cleanName = name.replace(/\s*\(You\)/i, "").trim()
  if (TEAM_COLORS[cleanName]) return TEAM_COLORS[cleanName]
  const colors = ["#8B5CF6", "#F59E0B", "#84CC16", "#047857", "#10B981", "#6366F1", "#EF4444", "#EC4899", "#06B6D4", "#22C55E"]
  return colors[index % colors.length]
}

const DEFAULT_GROUPS = [
  {
    id: "group-mock-1",
    name: "Alpha Squad",
    emails: ["carl@ctf.io", "marie@ctf.io", "stephen@ctf.io"]
  },
  {
    id: "group-mock-2",
    name: "Beta Division",
    emails: ["tiffany@ctf.io", "david@ctf.io", "diane@ctf.io"]
  },
  {
    id: "group-mock-3",
    name: "Cyber Knights",
    emails: ["ralph@ctf.io", "eugene@ctf.io", "bobby@ctf.io"]
  }
]

export default function CTFLeaderboardView({ entries, isLiveMode = false }: CTFLeaderboardViewProps) {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null)
  const [leaderboardType, setLeaderboardType] = useState<"individual" | "group">("individual")
  const [groups, setGroups] = useState<any[]>([])

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") {
      const storedGroups = localStorage.getItem("admin_ctf_groups")
      if (storedGroups) {
        try {
          const parsed = JSON.parse(storedGroups)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setGroups(parsed)
          } else {
            setGroups(DEFAULT_GROUPS)
          }
        } catch (e) {
          console.error(e)
          setGroups(DEFAULT_GROUPS)
        }
      } else {
        setGroups(DEFAULT_GROUPS)
      }
    }
  }, [])

  // Use either entries, or if empty / default, merge/use mock list for visual completeness
  const activeEntries = useMemo(() => {
    if (!entries || entries.length === 0) {
      return DEFAULT_TEAMS
    }
    // If entries exist but are less than 3, pad with some DEFAULT_TEAMS for robust UI presentation
    if (entries.length < 4) {
      const existingNames = new Set(entries.map(e => e.name.toLowerCase()))
      const padding = DEFAULT_TEAMS.filter(t => !existingNames.has(t.name.toLowerCase()))
      return [...entries, ...padding].slice(0, 10)
    }
    return entries
  }, [entries])

  // Sort individual standings
  const sortedStandings = useMemo(() => {
    return [...activeEntries].sort((a, b) => b.totalPoints - a.totalPoints || a.totalTimeSpent - b.totalTimeSpent)
  }, [activeEntries])

  // Compute group standings
  const groupStandings = useMemo(() => {
    if (groups.length === 0) return []
    return groups.map(group => {
      const memberEntries = activeEntries.filter(entry => 
        group.emails.some((email: string) => email.toLowerCase() === entry.email.toLowerCase())
      )
      const totalPoints = memberEntries.reduce((sum, entry) => sum + (entry.totalPoints || 0), 0)
      const totalTimeSpent = memberEntries.reduce((sum, entry) => sum + (entry.totalTimeSpent || 0), 0)
      const completedCount = memberEntries.reduce((sum, entry) => sum + (entry.completedChallenges || 0), 0)
      return {
        name: group.name,
        email: group.id,
        completedChallenges: completedCount,
        totalPoints,
        totalTimeSpent,
        memberCount: group.emails.length
      }
    }).sort((a, b) => b.totalPoints - a.totalPoints || a.totalTimeSpent - b.totalTimeSpent)
  }, [groups, activeEntries])

  // Get current active standings list based on toggle
  const currentStandings = useMemo(() => {
    if (leaderboardType === "group") {
      return groupStandings
    }
    return sortedStandings
  }, [leaderboardType, sortedStandings, groupStandings])

  // Key stats
  const topScore = currentStandings[0]?.totalPoints || 0
  const leadingTeam = currentStandings[0]?.name || "N/A"
  const totalSubmissions = currentStandings.reduce((sum, e) => sum + (e.completedChallenges || 0), 0)

  // Generate deterministic progression points for chart rendering
  const chartData = useMemo(() => {
    const hours = ["01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00", "08:00"]
    return hours.map((hour, hourIdx) => {
      const point: any = { name: hour }
      currentStandings.forEach((player) => {
        const maxScore = player.totalPoints
        if (hourIdx === 0) {
          point[player.name] = 0
        } else if (hourIdx === hours.length - 1) {
          point[player.name] = maxScore
        } else {
          // Semi-random deterministic progress
          const progressFactor = hourIdx / (hours.length - 1)
          const nameHash = player.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
          const noise = (nameHash % 3) * 0.08
          const factor = Math.min(1, Math.max(0, progressFactor * (0.75 + noise)))
          point[player.name] = Math.round(maxScore * factor)
        }
      })
      return point
    })
  }, [currentStandings])

  // Helper to extract series values for sparklines
  const getTeamProgressValues = (playerName: string) => {
    return chartData.map(d => d[playerName] || 0)
  }

  // Render polyline sparkline
  const renderSparkline = (points: number[], color: string) => {
    const width = 80
    const height = 16
    const max = Math.max(...points, 1)
    const min = Math.min(...points, 0)
    const range = max - min

    const coords = points.map((p, idx) => {
      const x = (idx / (points.length - 1)) * width
      const y = height - 1 - ((p - min) / (range || 1)) * (height - 2)
      return `${x},${y}`
    }).join(" ")

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          points={coords}
        />
      </svg>
    )
  }

  if (!mounted) return null

  return (
    <div className="space-y-6 text-slate-100 w-full">
      {/* Top Banner and KPI Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Flag className="w-6 h-6 text-indigo-400 fill-indigo-400/20" /> CTF Leaderboard
            </h2>
            <p className="text-slate-400 text-xs font-light">
              Capture The Flag · {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Top Standings
            </p>
          </div>

          <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-white/10 self-start sm:self-center">
            <button
              onClick={() => setLeaderboardType("individual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                leaderboardType === "individual"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Individual
            </button>
            <button
              onClick={() => setLeaderboardType("group")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                leaderboardType === "group"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Group
            </button>
          </div>
        </div>

        {/* KPI Indicators */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950/40 border border-white/10 rounded-xl p-3 flex flex-col min-w-[100px] md:min-w-[120px]">
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Top Score</span>
            <span className="text-sm font-extrabold text-white font-mono mt-0.5">{topScore} pts</span>
          </div>

          <div className="bg-slate-950/40 border border-white/10 rounded-xl p-3 flex flex-col min-w-[100px] md:min-w-[120px]">
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
              {leaderboardType === "individual" ? "Leading Operator" : "Leading Team"}
            </span>
            <span className="text-sm font-extrabold text-white truncate max-w-[100px] mt-0.5">{leadingTeam}</span>
          </div>

          <div className="bg-slate-950/40 border border-white/10 rounded-xl p-3 flex flex-col min-w-[100px] md:min-w-[120px]">
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total Solves</span>
            <span className="text-sm font-extrabold text-white font-mono mt-0.5">{totalSubmissions}</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Card: Score Progression */}
        <div className="lg:col-span-7 bg-slate-950/30 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Score Progression</h3>
            </div>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
              01:00 → 08:00 | Timeline
            </span>
          </div>

          {/* Recharts Multi-line Graph */}
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "rgba(13, 13, 18, 0.95)", 
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: "11px",
                    color: "#fff"
                  }} 
                />
                {currentStandings.map((player, idx) => {
                  const color = getTeamColor(player.name, idx)
                  const isHovered = hoveredTeam === player.name
                  const isAnyHovered = hoveredTeam !== null
                  return (
                    <Line
                      key={player.name}
                      type="monotone"
                      dataKey={player.name}
                      stroke={color}
                      strokeWidth={isHovered ? 3.5 : isAnyHovered ? 0.75 : 1.8}
                      dot={isHovered ? { r: 5 } : { r: 2.5 }}
                      activeDot={{ r: 6 }}
                      opacity={isHovered ? 1 : isAnyHovered ? 0.25 : 0.8}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Color Legend Grid */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-white/5">
            {currentStandings.map((player, idx) => {
              const color = getTeamColor(player.name, idx)
              const isHovered = hoveredTeam === player.name
              return (
                <button
                  key={player.name}
                  onMouseEnter={() => setHoveredTeam(player.name)}
                  onMouseLeave={() => setHoveredTeam(null)}
                  className={`flex items-center gap-1.5 text-[10px] font-medium transition-all ${
                    isHovered ? "text-white scale-105" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span>{player.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Card: Final Standings Table */}
        <div className="lg:col-span-5 bg-slate-950/30 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Final Standings</h3>
            </div>
            <span className="text-[9px] text-slate-500">Hover rows to trace path</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01]">
                  <th className="py-2.5 px-3 font-bold text-slate-400 text-center w-8">#</th>
                  <th className="py-2.5 px-3 font-bold text-slate-400">
                    {leaderboardType === "individual" ? "Operator" : "Team"}
                  </th>
                  <th className="py-2.5 px-3 font-bold text-slate-400 text-right">Score</th>
                  <th className="py-2.5 px-3 font-bold text-slate-400 text-center">Subs</th>
                  <th className="py-2.5 px-3 font-bold text-slate-400 text-center w-24">Trend</th>
                </tr>
              </thead>
              <tbody>
                {currentStandings.map((player, idx) => {
                  const color = getTeamColor(player.name, idx)
                  const isHovered = hoveredTeam === player.name
                  const isMe = !!(user?.email && player.email && player.email.toLowerCase() === user.email.toLowerCase())
                  return (
                    <tr
                      key={player.name}
                      onMouseEnter={() => setHoveredTeam(player.name)}
                      onMouseLeave={() => setHoveredTeam(null)}
                      className={`border-b border-white/[0.03] transition-all hover:bg-white/[0.02] cursor-pointer ${
                        isMe ? "bg-emerald-500/[0.04] border-l-2 border-l-emerald-500" : ""
                      } ${isHovered ? "bg-white/[0.04]" : ""}`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        {idx === 0 ? (
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px] shadow-lg shadow-amber-500/20 mx-auto">1</span>
                        ) : idx === 1 ? (
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-300 text-slate-950 font-extrabold text-[10px] shadow-lg shadow-slate-300/20 mx-auto">2</span>
                        ) : idx === 2 ? (
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-700 text-white font-extrabold text-[10px] shadow-lg shadow-amber-700/20 mx-auto">3</span>
                        ) : (
                          <span className="font-mono text-slate-500">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-bold text-slate-200">
                            {isMe ? `${player.name} (You)` : player.name}
                          </span>
                          {leaderboardType === "group" && (
                            <span className="text-[10px] text-slate-500 font-normal">
                              ({(player as any).memberCount} members)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        {player.totalPoints}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {player.completedChallenges}
                      </td>
                      <td className="py-2.5 px-3 text-center align-middle">
                        <div className="flex justify-center items-center h-full">
                          {renderSparkline(getTeamProgressValues(player.name), color)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
