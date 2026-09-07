import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as dsrApi from '../../services/dsrApi';
import LoadingSpinner from '../../components/dsr/LoadingSpinner';
import ErrorMessage from '../../components/dsr/ErrorMessage';
import StatusBadge from '../../components/dsr/StatusBadge';
import RequestTypeBadge from '../../components/dsr/RequestTypeBadge';
import './dsr.css';

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(now.getDate() + 3);
  return due < threeDaysFromNow;
};

export default function DsrRequestList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const filters = {
    status: searchParams.get('status') || 'all',
    type: searchParams.get('type') || 'all',
    page: searchParams.get('page') || 1,
  };

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const apiFilters = {
        status: filters.status === 'all' ? '' : filters.status,
        type: filters.type === 'all' ? '' : filters.type,
        page: filters.page,
        limit: 20,
      };
      const data = await dsrApi.listDsrRequests(apiFilters);
      setRequests(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.type, filters.page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFilterChange = (e) => {
    setSearchParams({ ...filters, [e.target.name]: e.target.value, page: 1 });
  };

  return (
    <section className="module-section">
      <div className="section-heading module-heading-row">
        <div>
          <h2>DSR Request List</h2>
          <p>Filter and view all data subject requests.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Filter dropdowns can go here */}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <div className="panel table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request Number</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Principal Name</th>
                  <th>Created</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.length > 0 ? requests.map(req => (
                  <tr key={req.id} style={{ backgroundColor: isOverdue(req.due_date) ? 'var(--danger-bg)' : 'transparent' }}>
                    <td>{req.request_number}</td>
                    <td><RequestTypeBadge type={req.request_type} /></td>
                    <td><StatusBadge status={req.status} /></td>
                    <td>{req.principal_name || 'N/A'}</td>
                    <td>{formatDate(req.created_at)}</td>
                    <td>{formatDate(req.due_date)}</td>
                    <td>
                      <button className="secondary-action" style={{padding: '8px 12px', minHeight: 0}} onClick={() => navigate(`/dsr/requests/${req.id}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="empty-state">No requests found for the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination controls can go here */}
        </div>
      )}
    </section>
  );
}