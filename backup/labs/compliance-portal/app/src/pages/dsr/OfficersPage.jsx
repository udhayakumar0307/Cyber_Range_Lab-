import React, { useState, useEffect, useCallback } from 'react';
import * as dsrApi from '../../services/dsrApi';
import LoadingSpinner from '../../components/dsr/LoadingSpinner';
import ErrorMessage from '../../components/dsr/ErrorMessage';
import './dsr.css';

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function OfficersPage() {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newOfficer, setNewOfficer] = useState({ name: '', email: '', phone: '', department: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchOfficers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await dsrApi.listOfficers();
      setOfficers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  const handleAddOfficer = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      await dsrApi.createOfficer(newOfficer);
      setNewOfficer({ name: '', email: '', phone: '', department: '' }); // Reset form
      fetchOfficers(); // Refresh list
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <section className="module-section">
      <div className="module-hero-copy">
        <h2>Manage Grievance Officers</h2>
        <p>Add new grievance officers and view the list of all active officers.</p>
      </div>

      <article className="panel" style={{ padding: '20px', marginBottom: '18px' }}>
        <div className="section-heading"><h3>Add New Officer</h3></div>
        <form onSubmit={handleAddOfficer}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            <div className="dsr-form-group"><label>Name</label><input type="text" value={newOfficer.name} onChange={e => setNewOfficer({...newOfficer, name: e.target.value})} required /></div>
            <div className="dsr-form-group"><label>Email</label><input type="email" value={newOfficer.email} onChange={e => setNewOfficer({...newOfficer, email: e.target.value})} required /></div>
            <div className="dsr-form-group"><label>Phone</label><input type="tel" value={newOfficer.phone} onChange={e => setNewOfficer({...newOfficer, phone: e.target.value})} /></div>
            <div className="dsr-form-group"><label>Department</label><input type="text" value={newOfficer.department} onChange={e => setNewOfficer({...newOfficer, department: e.target.value})} /></div>
          </div>
          <button type="submit" className="export-button" disabled={addLoading} style={{ marginTop: '16px' }}>
            {addLoading ? 'Adding...' : 'Add Officer'}
          </button>
        </form>
        {addError && <ErrorMessage message={addError} />}
      </article>

      {loading ? <LoadingSpinner /> : error ? <ErrorMessage message={error} /> : (
        <div className="panel table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Phone</th><th>Department</th><th>Status</th><th>Appointed At</th>
                </tr>
              </thead>
              <tbody>
                {officers.length > 0 ? officers.map(o => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{o.email}</td>
                    <td>{o.phone}</td>
                    <td>{o.department}</td>
                    <td><span className={`dsr-badge ${o.is_active ? 'success' : 'default'}`}>{o.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>{formatDate(o.appointed_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="empty-state">No officers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}