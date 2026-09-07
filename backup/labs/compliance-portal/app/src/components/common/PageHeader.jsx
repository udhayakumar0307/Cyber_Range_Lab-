import React from "react";
import { Link } from "react-router-dom";

export default function PageHeader({ title, subtitle, breadcrumbs = [], actionButton }) {
  return (
    <header className="page-header-container">
      <div className="breadcrumb-wrapper">
        <span className="breadcrumb-item">
          <Link to="/">Dashboard</Link>
        </span>
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={index}>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-item active">{item}</span>
          </React.Fragment>
        ))}
      </div>
      
      <div className="page-header-main">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actionButton && (
          <div className="page-header-actions">
            {actionButton}
          </div>
        )}
      </div>
    </header>
  );
}
