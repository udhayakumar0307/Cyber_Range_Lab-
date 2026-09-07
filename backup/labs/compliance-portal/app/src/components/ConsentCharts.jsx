import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const COLORS = {
  Granted: "#0f9f6e",
  Revoked: "#d03801"
};

export default function ConsentCharts({ statusData, purposeData }) {
  return (
    <section className="chart-grid" aria-label="Consent visualizations">
      <article className="panel chart-panel">
        <div className="section-heading">
          <h2>Consent Status</h2>
          <p>Granted vs revoked</p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={96}
              paddingAngle={3}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {statusData.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </article>

      <article className="panel chart-panel">
        <div className="section-heading">
          <h2>Purpose Distribution</h2>
          <p>Consent counts by purpose</p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={purposeData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="purpose" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="granted" name="Granted" fill={COLORS.Granted} radius={[6, 6, 0, 0]} />
            <Bar dataKey="revoked" name="Revoked" fill={COLORS.Revoked} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}
