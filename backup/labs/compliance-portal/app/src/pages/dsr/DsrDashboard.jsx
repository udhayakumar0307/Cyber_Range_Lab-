import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as dsrApi from '../../services/dsrApi';
import LoadingSpinner from '../../components/dsr/LoadingSpinner';
import ErrorMessage from '../../components/dsr/ErrorMessage';
import './dsr.css';

const DsrSummaryCard = ({ title, count, status, navigate }) => (
  <article className="dsr-summary-card" onClick={() => navigate(`/dsr/requests?status=${status}`)}>
    <span>{title}</span>
    <strong>{count}</strong>
  </article>
);

export default function DsrDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, in_review: 0, resolved: 0, escalated: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const requests = await dsrApi.listDsrRequests(); // Fetches all requests
        const newStats = requests.reduce((acc, req) => {
          acc.total = (acc.total || 0) + 1;
          acc[req.status] = (acc[req.status] || 0) + 1;
          return acc;
        }, {});
        setStats(prev => ({ ...prev, ...newStats }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <section className="module-section">
      <div className="module-hero-copy">
        <p className="eyebrow">Data Subject Rights</p>
        <h2>DSR Requests Dashboard</h2>
        <p>
          Monitor and manage all incoming Data Subject Rights requests from this central dashboard.
        </p>
      </div>
      <div className="dsr-dashboard-grid">
        <DsrSummaryCard title="Total Requests" count={stats.total || 0} status="all" navigate={navigate} />
        <DsrSummaryCard title="Pending" count={stats.pending || 0} status="pending" navigate={navigate} />
        <DsrSummaryCard title="In Review" count={stats.in_review || 0} status="in_review" navigate={navigate} />
        <DsrSummaryCard title="Resolved" count={stats.resolved || 0} status="resolved" navigate={navigate} />
        <DsrSummaryCard title="Escalated" count={stats.escalated || 0} status="escalated" navigate={navigate} />
      </div>
    </section>
  );
}