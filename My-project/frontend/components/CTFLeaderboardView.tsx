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

  const currentIndividualEntries = useMemo(() => {
    return entries && entries.length > 0 ? entries : DEFAULT_TEAMS
  }, [entries])

  const groupLeaderboardEntries = useMemo(() => {
    return groups.map((g) => {
      const groupMembers = currentIndividualEntries.filter((p) =>
        g.emails.some((e: string) => e.toLowerCase() === p.email.toLowerCase())
      )
      const totalPoints = groupMembers.reduce((sum, m) => sum + m.totalPoints, 0)
      const completedChallenges = groupMembers.reduce((sum, m) => sum + m.completedChallenges, 0)
      const totalTimeSpent = groupMembers.reduce((sum, m) => sum + m.totalTimeSpent, 0)

      return {
        name: g.name,
        email: `group-${g.id}`,
        totalPoints,
        completedChallenges,
        totalTimeSpent,
        memberCount: g.emails.length,
      }
    }).sort((a, b) => b.totalPoints - a.totalPoints)
  }, [groups, currentIndividualEntries])

  const currentStandings = useMemo(() => {
    if (leaderboardType === "group") {
      return groupLeaderboardEntries.length > 0 ? groupLeaderboardEntries : [
        { name: "Alpha Squad", email: "group-1", totalPoints: 10400, completedChallenges: 39, totalTimeSpent: 415, memberCount: 3 },
        { name: "Beta Division", email: "group-2", totalPoints: 9250, completedChallenges: 32, totalTimeSpent: 440, memberCount: 3 },
        { name: "Cyber Knights", email: "group-3", totalPoints: 8500, completedChallenges: 34, totalTimeSpent: 465, memberCount: 3 }
      ]
    }

    let standings = [...currentIndividualEntries]
    if (user?.email) {
      const userIndex = standings.findIndex(
        (e) => e.email.toLowerCase() === user.email.toLowerCase()
      )
      if (userIndex !== -1) {
        standings[userIndex] = {
          ...standings[userIndex],
          name: `${standings[userIndex].name} (You)`,
        }
      }
    }
    return standings.sort((a, b) => b.totalPoints - a.totalPoints)
  }, [leaderboardType, groupLeaderboardEntries, currentIndividualEntries, user])

  const chartData = useMemo(() => {
    const timePoints = [
      { name: "01:00", factor: 0.0 },
      { name: "02:00", factor: 0.15 },
      { name: "03:00", factor: 0.28 },
      { name: "04:00", factor: 0.42 },
      { name: "05:00", factor: 0.58 },
      { name: "06:00", factor: 0.73 },
      { name: "07:00", factor: 0.88 },
      { name: "08:00", factor: 1.0 },
    ]

    return timePoints.map((tp) => {
      const dataPoint: { [key: string]: any } = { name: tp.name }
      currentStandings.forEach((player) => {
        dataPoint[player.name] = Math.round(player.totalPoints * tp.factor)
      })
      return dataPoint
    })
  }, [currentStandings])

  const topScore = useMemo(() => {
    if (currentStandings.length === 0) return 0
    return Math.max(...currentStandings.map((p) => p.totalPoints))
  }, [currentStandings])

  const leadingTeam = useMemo(() => {
    if (currentStandings.length === 0) return "N/A"
    return currentStandings[0].name
  }, [currentStandings])

  const totalSubmissions = useMemo(() => {
    return currentStandings.reduce((sum, p) => sum + p.completedChallenges, 0)
  }, [currentStandings])

  const getTeamProgressValues = (name: string): number[] => {
    return chartData.map((d) => (d[name] as number) || 0)
  }

  const renderSparkline = (values: number[], color: string) => {
    if (!values || values.length === 0) return null
    const min = 0
    const max = Math.max(...values, 1)
    const points = values
      .map((val, idx) => {
        const x = (idx / (values.length - 1)) * 80
        const y = 20 - (val / max) * 16
        return `${x},${y}`
      })
      .join(" ")

    return (
      <svg className="w-20 h-6 overflow-visible inline-block">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    )
  }

  if (!mounted) return null

  return (
    <div className="space-y-6">
      {/* Top Banner Header & Toggle Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Capture The Flag Standings</h2>
              <span className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-0.5 rounded bg-muted border border-border">
                {isLiveMode ? "Live Sync" : "Sandbox"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Top Individual Solvers & Group Scoring</p>
          </div>

          {/* Toggle Switcher */}
          <div className="flex bg-muted p-1 rounded-xl border border-border text-xs ml-2">
            <button
              onClick={() => setLeaderboardType("individual")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                leaderboardType === "individual"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Individual
            </button>
            <button
              onClick={() => setLeaderboardType("group")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                leaderboardType === "group"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Group
            </button>
          </div>
        </div>

        {/* KPI Indicators */}
        <div className="flex items-center gap-3">
          <div className="bg-card border border-border rounded-xl p-3 flex flex-col min-w-[100px] md:min-w-[120px]">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Top Score</span>
            <span className="text-sm font-extrabold text-foreground font-mono mt-0.5">{topScore} pts</span>
          </div>

          <div className="bg-card border border-border rounded-xl p-3 flex flex-col min-w-[100px] md:min-w-[120px]">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
              {leaderboardType === "individual" ? "Leading Operator" : "Leading Team"}
            </span>
            <span className="text-sm font-extrabold text-foreground truncate max-w-[100px] mt-0.5">{leadingTeam}</span>
          </div>

          <div className="bg-card border border-border rounded-xl p-3 flex flex-col min-w-[100px] md:min-w-[120px]">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Total Solves</span>
            <span className="text-sm font-extrabold text-foreground font-mono mt-0.5">{totalSubmissions}</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Card: Score Progression */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Score Progression</h3>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              01:00 → 08:00 | Timeline
            </span>
          </div>

          {/* Recharts Multi-line Graph */}
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="var(--muted-foreground)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="var(--muted-foreground)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "var(--card)", 
                    borderColor: "var(--border)",
                    borderRadius: "12px",
                    fontSize: "11px",
                    color: "var(--foreground)"
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
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-border">
            {currentStandings.map((player, idx) => {
              const color = getTeamColor(player.name, idx)
              const isHovered = hoveredTeam === player.name
              return (
                <button
                  key={player.name}
                  onMouseEnter={() => setHoveredTeam(player.name)}
                  onMouseLeave={() => setHoveredTeam(null)}
                  className={`flex items-center gap-1.5 text-[10px] font-medium transition-all ${
                    isHovered ? "text-foreground font-bold scale-105" : "text-muted-foreground hover:text-foreground"
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
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Final Standings</h3>
            </div>
            <span className="text-[9px] text-muted-foreground">Hover rows to trace path</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="py-2.5 px-3 font-bold text-muted-foreground text-center w-8">#</th>
                  <th className="py-2.5 px-3 font-bold text-muted-foreground">
                    {leaderboardType === "individual" ? "Operator" : "Team"}
                  </th>
                  <th className="py-2.5 px-3 font-bold text-muted-foreground text-right">Score</th>
                  <th className="py-2.5 px-3 font-bold text-muted-foreground text-center">Subs</th>
                  <th className="py-2.5 px-3 font-bold text-muted-foreground text-center w-24">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentStandings.map((player, idx) => {
                  const color = getTeamColor(player.name, idx)
                  const isHovered = hoveredTeam === player.name
                  const isMe = !!(user?.email && player.email && player.email.toLowerCase() === user.email.toLowerCase())
                  return (
                    <tr
                      key={player.name}
                      onMouseEnter={() => setHoveredTeam(player.name)}
                      onMouseLeave={() => setHoveredTeam(null)}
                      className={`transition-all hover:bg-muted/40 cursor-pointer ${
                        isMe ? "bg-primary/10 border-l-2 border-l-primary" : ""
                      } ${isHovered ? "bg-muted/60" : ""}`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        {idx === 0 ? (
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-500 text-white font-extrabold text-[10px] shadow-xs mx-auto">1</span>
                        ) : idx === 1 ? (
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-400 text-white font-extrabold text-[10px] shadow-xs mx-auto">2</span>
                        ) : idx === 2 ? (
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-700 text-white font-extrabold text-[10px] shadow-xs mx-auto">3</span>
                        ) : (
                          <span className="font-mono text-muted-foreground">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-bold text-foreground">
                            {isMe ? `${player.name} (You)` : player.name}
                          </span>
                          {leaderboardType === "group" && (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              ({(player as any).memberCount} members)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {player.totalPoints}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
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
