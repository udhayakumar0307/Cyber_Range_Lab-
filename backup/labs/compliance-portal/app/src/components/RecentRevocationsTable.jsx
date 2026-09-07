import React from "react";

export default function RecentRevocationsTable({ revocations }) {
  return (
    <section className="panel table-panel">
      <div className="section-heading">
        <h2>Recent Revocations</h2>
        <p>Sorted by most recent timestamp</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User Name</th>
              <th>User ID</th>
              <th>Purpose</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {revocations.length ? (
              revocations.map((item) => (
                <tr key={`${item.user_id}-${item.timestamp}`}>
                  <td>{item.name}</td>
                  <td>{item.user_id}</td>
                  <td>
                    <span className="purpose-pill">{item.purpose}</span>
                  </td>
                  <td>{new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  }).format(new Date(item.timestamp))}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="empty-state">
                  No revoked consents match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
