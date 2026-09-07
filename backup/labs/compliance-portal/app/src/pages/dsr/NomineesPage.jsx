import React, { useState, useCallback } from 'react';
import * as dsrApi from '../../services/dsrApi';
import LoadingSpinner from '../../components/dsr/LoadingSpinner';
import ErrorMessage from '../../components/dsr/ErrorMessage';
import './dsr.css';

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function NomineesPage() {
  const [principalId, setPrincipalId] = useState('');
  const [nominees, setNominees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [newNominee, setNewNominee] = useState({
    principal_id: '',
    nominee_name: '',
    nominee_email: '',
    nominee_phone: '',
    relationship: 'other'
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchNominees = useCallback(async (id) => {
    if (!id) {
      setError('Please provide a Principal ID.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await dsrApi.getNomineesByPrincipal(id);
      setNominees(data);
      setNewNominee(prev => ({ ...prev, principal_id: id })); // Pre-fill form
    } catch (err) {
      setError(err.message);
      setNominees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeactivate = async (nomineeId) => {
    if (window.confirm('Are you sure you want to deactivate this nominee?')) {
      try {
        await dsrApi.deactivateNominee(nomineeId); // This function expects the ID
        fetchNominees(principalId); // Refresh list
      } catch (err) {
        setError(`Failed to deactivate: ${err.message}`);
      }
    }
  };

  const handleAddNominee = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      await dsrApi.createNominee(newNominee);
      setNewNominee({ principal_id: principalId, nominee_name: '', nominee_email: '', nominee_phone: '', relationship: 'other' }); // Reset form
      fetchNominees(principalId); // Refresh list
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <section className="module-section">
      <div className="module-hero-copy">
        <h2>Manage Nominees</h2>
        <p>Find, add, and manage nominees for a given data principal.</p>
      </div>

      <article className="panel" style={{ padding: '20px', marginBottom: '18px' }}>
        <form onSubmit={(e) => { e.preventDefault(); fetchNominees(principalId); }} className="dsr-form-group">
          <label htmlFor="principalId">Load Nominees for Principal ID</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" id="principalId" value={principalId} onChange={(e) => setPrincipalId(e.target.value)} placeholder="Enter Principal UUID..." />
            <button type="submit" className="export-button" disabled={loading}>
              {loading ? 'Loading...' : 'Load Nominees'}
            </button>
          </div>
        </form>
      </article>

      {error && <ErrorMessage message={error} />}

      {nominees.length > 0 && (
        <div className="panel table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Phone</th><th>Relationship</th><th>Status</th><th>Nominated At</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {nominees.map(n => (
                  <tr key={n.id}>
                    <td>{n.nominee_name}</td>
                    <td>{n.nominee_email}</td>
                    <td>{n.nominee_phone}</td>
                    <td>{n.relationship}</td>
                    <td><span className={`dsr-badge ${n.is_active ? 'success' : 'default'}`}>{n.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>{formatDate(n.nominated_at)}</td>
                    <td>
                      {n.is_active && (
                        <button className="secondary-action" style={{padding: '8px 12px', minHeight: 0}} onClick={() => handleDeactivate(n.id)}>
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {principalId && (
        <article className="panel" style={{ padding: '20px', marginTop: '18px' }}>
          <div className="section-heading"><h3>Add New Nominee for Principal: {principalId}</h3></div>
          <form onSubmit={handleAddNominee} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            <div className="dsr-form-group">
              <label htmlFor="nominee_name">Nominee Name</label>
              <input type="text" value={newNominee.nominee_name} onChange={e => setNewNominee({...newNominee, nominee_name: e.target.value})} required />
            </div>
            <div className="dsr-form-group">
              <label htmlFor="nominee_email">Nominee Email</label>
              <input type="email" value={newNominee.nominee_email} onChange={e => setNewNominee({...newNominee, nominee_email: e.target.value})} required />
            </div>
            <div className="dsr-form-group">
              <label htmlFor="nominee_phone">Nominee Phone</label>
              <input type="tel" value={newNominee.nominee_phone} onChange={e => setNewNominee({...newNominee, nominee_phone: e.target.value})} />
            </div>
            <div className="dsr-form-group">
              <label htmlFor="relationship">Relationship</label>
              <select value={newNominee.relationship} onChange={e => setNewNominee({...newNominee, relationship: e.target.value})} required>
                <option value="spouse">Spouse</option>
                <option value="parent">Parent</option>
                <option value="child">Child</option>
                <option value="sibling">Sibling</option>
                <option value="legal_guardian">Legal Guardian</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button type="submit" className="export-button" disabled={addLoading} style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
              {addLoading ? 'Adding...' : 'Add Nominee'}
            </button>
          </form>
          {addError && <ErrorMessage message={addError} />}
        </article>
      )}
    </section>
  );
}