import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as dsrApi from '../../services/dsrApi';
import LoadingSpinner from '../../components/dsr/LoadingSpinner';
import ErrorMessage from '../../components/dsr/ErrorMessage';
import StatusBadge from '../../components/dsr/StatusBadge';
import RequestTypeBadge from '../../components/dsr/RequestTypeBadge';
import ActivityLogItem from '../../components/dsr/ActivityLogItem';
import './dsr.css';

const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const DsrDetailHeader = ({ request }) => (
  <div className="dsr-detail-header">
    <div><span>Request Number</span><p>{request.request_number}</p></div>
    <div><span>Status</span><p><StatusBadge status={request.status} /></p></div>
    <div><span>Request Type</span><p><RequestTypeBadge type={request.request_type} /></p></div>
    <div><span>Principal</span><p><Link to={`/dsr/principals?search=${request.principal_id}`}>{request.principal_name || request.principal_id}</Link></p></div>
    <div><span>Created Date</span><p>{formatDate(request.created_at)}</p></div>
    <div><span>Due Date</span><p>{formatDate(request.due_date)}</p></div>
  </div>
);

const AccessPanel = ({ request, onUpdate }) => {
  const [responseData, setResponseData] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const parsedJSON = JSON.parse(responseData);
      await dsrApi.respondToAccessRequest(request.id, {
        response_data: parsedJSON,
        performed_by: performedBy,
      });
      onUpdate();
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Invalid JSON format.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  if (request.details?.responded_at) {
    return (
      <div className="notice" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
        <p>Response already submitted on {formatDate(request.details.responded_at)}.</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--soft-bg)', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
          {JSON.stringify(request.details.response_data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h4>Right to Access — Respond with Data</h4>
      <div className="dsr-form-group">
        <label htmlFor="response_data">Response Data (JSON)</label>
        <textarea id="response_data" value={responseData} onChange={(e) => setResponseData(e.target.value)} required placeholder='{ "email": "user@example.com", "orders": [] }' />
      </div>
      <div className="dsr-form-group">
        <label htmlFor="performed_by_access">Performed By</label>
        <input type="text" id="performed_by_access" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} required placeholder="admin@company.com" />
      </div>
      <button type="submit" className="export-button" disabled={loading}>{loading ? 'Submitting...' : 'Submit Response'}</button>
      {error && <ErrorMessage message={error} />}
    </form>
  );
};

const CorrectionErasurePanel = ({ request, onUpdate }) => {
  const [actionType, setActionType] = useState(request.request_type);
  const [fieldsToCorrect, setFieldsToCorrect] = useState('{}');
  const [erasureScope, setErasureScope] = useState('partial');
  const [erasureReason, setErasureReason] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let payload = { action_type: actionType, performed_by: performedBy };
      if (actionType === 'correction') {
        payload.fields_to_correct = JSON.parse(fieldsToCorrect);
      } else {
        payload.erasure_scope = erasureScope;
        payload.erasure_reason = erasureReason;
      }
      await dsrApi.applyCorrectionErasure(request.id, payload);
      onUpdate();
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Invalid JSON format for fields to correct.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  if (request.details?.correction_applied || request.details?.erasure_confirmed) {
    const action = request.details.correction_applied ? 'Correction' : 'Erasure';
    return (
      <div className="notice" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
        <p>{action} applied on {formatDate(request.details.actioned_at)}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h4>Right to Correction / Erasure</h4>
      <div className="dsr-form-group">
        <label>Action Type</label>
        <div>
          <label style={{ marginRight: '15px' }}><input type="radio" name="actionType" value="correction" checked={actionType === 'correction'} onChange={e => setActionType(e.target.value)} /> Correction</label>
          <label><input type="radio" name="actionType" value="erasure" checked={actionType === 'erasure'} onChange={e => setActionType(e.target.value)} /> Erasure</label>
        </div>
      </div>
      {actionType === 'correction' && (
        <div className="dsr-form-group">
          <label htmlFor="fields_to_correct">Fields to Correct (JSON)</label>
          <textarea id="fields_to_correct" value={fieldsToCorrect} onChange={e => setFieldsToCorrect(e.target.value)} placeholder='{ "phone": { "old": "123", "new": "456" } }' />
        </div>
      )}
      {actionType === 'erasure' && (
        <>
          <div className="dsr-form-group">
            <label htmlFor="erasure_scope">Erasure Scope</label>
            <select id="erasure_scope" value={erasureScope} onChange={e => setErasureScope(e.target.value)}>
              <option value="partial">Partial</option>
              <option value="full">Full</option>
            </select>
          </div>
          <div className="dsr-form-group">
            <label htmlFor="erasure_reason">Erasure Reason</label>
            <textarea id="erasure_reason" value={erasureReason} onChange={e => setErasureReason(e.target.value)} required />
          </div>
        </>
      )}
      <div className="dsr-form-group">
        <label htmlFor="performed_by_ce">Performed By</label>
        <input type="text" id="performed_by_ce" value={performedBy} onChange={e => setPerformedBy(e.target.value)} required placeholder="admin@company.com" />
      </div>
      <button type="submit" className="export-button" disabled={loading}>{loading ? 'Submitting...' : 'Apply Action'}</button>
      {error && <ErrorMessage message={error} />}
    </form>
  );
};

const GrievancePanel = ({ request, onUpdate }) => {
  const [officerResponse, setOfficerResponse] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEscalate = async () => {
    setLoading(true);
    setError('');
    try {
      await dsrApi.escalateGrievance(request.id, {
        grievance_reason: request.details?.grievance_reason || request.description,
        performed_by: performedBy,
      });
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOfficerResponse = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await dsrApi.recordOfficerResponse(request.id, {
        officer_response: officerResponse,
        performed_by: performedBy,
      });
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h4>Grievance Redressal</h4>
      <div className="dsr-form-group">
        <label>Grievance Reason</label>
        <p style={{ color: 'var(--text-muted)' }}>{request.details?.grievance_reason || 'Not specified.'}</p>
      </div>

      {request.details?.officer_response ? (
        <div className="notice" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
          <p>Officer responded on {formatDate(request.details.officer_responded_at)}.</p>
          <p style={{ marginTop: '10px' }}><strong>Response:</strong> {request.details.officer_response}</p>
        </div>
      ) : !request.details?.escalated_to_officer ? (
        <div>
          <div className="dsr-form-group">
            <label htmlFor="performed_by_escalate">Performed By</label>
            <input type="text" id="performed_by_escalate" value={performedBy} onChange={e => setPerformedBy(e.target.value)} required placeholder="admin@company.com" />
          </div>
          <button onClick={handleEscalate} className="export-button" disabled={loading}>{loading ? 'Escalating...' : 'Escalate to Officer'}</button>
        </div>
      ) : (
        <form onSubmit={handleOfficerResponse}>
          <p>Assigned Officer: <strong>{request.details.officer_name}</strong> ({request.details.officer_email})</p>
          <div className="dsr-form-group">
            <label htmlFor="officer_response">Officer Response</label>
            <textarea id="officer_response" value={officerResponse} onChange={e => setOfficerResponse(e.target.value)} required />
          </div>
          <div className="dsr-form-group">
            <label htmlFor="performed_by_response">Performed By (Officer)</label>
            <input type="text" id="performed_by_response" value={performedBy} onChange={e => setPerformedBy(e.target.value)} required placeholder="officer@company.com" />
          </div>
          <button type="submit" className="export-button" disabled={loading}>{loading ? 'Submitting...' : 'Record Officer Response'}</button>
        </form>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  );
};

const NominationPanel = ({ request }) => {
  return (
    <div>
      <h4>Nomination Record</h4>
      <p>This is a nomination registration record. No further action is needed on this request.</p>
      {request.details && <pre>{JSON.stringify(request.details, null, 2)}</pre>}
    </div>
  );
};

const renderConditionalPanel = (request, onUpdate) => {
  switch (request.request_type) {
    case 'access':
      return <AccessPanel request={request} onUpdate={onUpdate} />;
    case 'correction':
    case 'erasure':
      return <CorrectionErasurePanel request={request} onUpdate={onUpdate} />;
    case 'grievance':
      return <GrievancePanel request={request} onUpdate={onUpdate} />;
    case 'nomination':
      return <NominationPanel request={request} />;
    default:
      return <p>This request type does not have a specific action panel.</p>;
  }
};

export default function DsrRequestDetail() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');

  const fetchRequest = useCallback(async () => {
    try {
      setError('');
      const data = await dsrApi.getDsrRequest(id);
      setRequest(data);
      setNewStatus(data.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchRequest();
  }, [fetchRequest]);

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    setUpdateMessage('Updating...');
    try {
      await dsrApi.updateDsrStatus(request.id, {
        status: newStatus,
        performed_by: 'Admin User' // This should come from auth context in a real app
      });
      setUpdateMessage('Status updated successfully!');
      fetchRequest(); // Re-fetch to get the latest data
      setTimeout(() => setUpdateMessage(''), 3000);
    } catch (err) {
      setUpdateMessage(`Error: ${err.message}`);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!request) return <div className="notice">Request not found.</div>;

  return (
    <section className="module-section">
      <div className="module-hero-copy" style={{ marginBottom: '24px' }}>
        <h2>Request Details</h2>
      </div>

      <article className="panel" style={{ padding: '20px' }}>
        <DsrDetailHeader request={request} />
        <p style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--table-border)', paddingTop: '16px' }}>
          <strong>Description:</strong> {request.description || 'No description provided.'}
        </p>
      </article>

      <div className="breach-layout" style={{ marginTop: '18px' }}>
        <article className="panel breach-panel">
          <div className="section-heading">
            <h2>Manage Request</h2>
          </div>
          <form onSubmit={handleStatusUpdate} className="dsr-form-group">
            <label htmlFor="status-update">Change Status</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                id="status-update"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="in_review">In Review</option>
                <option value="awaiting_info">Awaiting Info</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
                <option value="escalated">Escalated</option>
              </select>
              <button type="submit" className="export-button" style={{ minHeight: '42px' }}>Update</button>
            </div>
            {updateMessage && <p className="api-key-status" style={{ marginTop: '8px' }}>{updateMessage}</p>}
          </form>

          <div style={{ borderTop: '1px solid var(--table-border)', paddingTop: '16px', marginTop: '16px' }}>
            <div className="section-heading">
              <h3>Request Actions</h3>
            </div>
            {renderConditionalPanel(request, fetchRequest)}
          </div>
        </article>

        <article className="panel breach-panel">
          <div className="section-heading">
            <h2>Activity Log</h2>
            <p>A complete audit trail for this request.</p>
          </div>
          <div className="activity-log-container">
            {request.activity_log && request.activity_log.length > 0 ? (
              request.activity_log.map((item) => (
                <ActivityLogItem key={item.id} item={item} />
              ))
            ) : (
              <p>No activity recorded yet.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}