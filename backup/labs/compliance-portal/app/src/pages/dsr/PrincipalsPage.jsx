import React, { useState } from 'react';
import * as dsrApi from '../../services/dsrApi';
import LoadingSpinner from '../../components/dsr/LoadingSpinner';
import ErrorMessage from '../../components/dsr/ErrorMessage';
import './dsr.css';

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function PrincipalsPage() {
  // State for registration form
  const [formData, setFormData] = useState({ full_name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // State for search
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const result = await dsrApi.registerPrincipal(formData);
      setSuccessMessage(`Principal registered successfully! ID: ${result.id}`);
      setFormData({ full_name: '', email: '', phone: '' }); // Reset form
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchId) {
      setSearchError('Please enter a Principal ID to search.');
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const result = await dsrApi.getPrincipal(searchId);
      setSearchResult(result);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <section className="module-section">
      <div className="module-hero-copy">
        <h2>Manage Data Principals</h2>
        <p>Register new data principals and look up existing ones by their ID.</p>
      </div>

      <div className="breach-layout">
        <article className="panel breach-panel">
          <div className="section-heading">
            <h3>Register New Principal</h3>
          </div>
          <form onSubmit={handleRegister}>
            <div className="dsr-form-group">
              <label htmlFor="full_name">Full Name</label>
              <input type="text" id="full_name" name="full_name" value={formData.full_name} onChange={handleInputChange} required />
            </div>
            <div className="dsr-form-group">
              <label htmlFor="email">Email Address</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required />
            </div>
            <div className="dsr-form-group">
              <label htmlFor="phone">Phone Number</label>
              <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange} />
            </div>
            <button type="submit" className="export-button" disabled={loading}>
              {loading ? 'Registering...' : 'Register Principal'}
            </button>
          </form>
          {error && <ErrorMessage message={error} />}
          {successMessage && <div className="notice" style={{ marginTop: '16px', borderColor: 'var(--success)', color: 'var(--success)' }}>{successMessage}</div>}
        </article>

        <article className="panel breach-panel">
          <div className="section-heading">
            <h3>Look Up Principal</h3>
          </div>
          <form onSubmit={handleSearch}>
            <div className="dsr-form-group">
              <label htmlFor="searchId">Principal ID</label>
              <input type="text" id="searchId" value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Enter UUID..." />
            </div>
            <button type="submit" className="secondary-action" disabled={searchLoading}>
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
          {searchLoading && <LoadingSpinner />}
          {searchError && <ErrorMessage message={searchError} />}
          {searchResult && (
            <div className="dsr-summary-card" style={{ marginTop: '20px', cursor: 'default' }}>
              <h4>Principal Found</h4>
              <p><strong>ID:</strong> {searchResult.id}</p>
              <p><strong>Name:</strong> {searchResult.full_name}</p>
              <p><strong>Email:</strong> {searchResult.email}</p>
              <p><strong>Phone:</strong> {searchResult.phone || 'N/A'}</p>
              <p><strong>Registered:</strong> {formatDate(searchResult.created_at)}</p>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}