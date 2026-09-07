import React from "react";
import { Download, Search } from "lucide-react";

const PURPOSES = ["All", "Marketing", "Research", "Analytics"];

export default function FilterBar({ purpose, searchTerm, onPurposeChange, onSearchChange, onExport }) {
  return (
    <section className="filter-bar" aria-label="Dashboard filters">
      <div className="search-field">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search name or user ID"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="segmented-control" aria-label="Filter by purpose">
        {PURPOSES.map((item) => (
          <button
            key={item}
            type="button"
            className={purpose === item ? "active" : ""}
            onClick={() => onPurposeChange(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <button type="button" className="export-button" onClick={onExport}>
        <Download size={18} aria-hidden="true" />
        Export CSV
      </button>
    </section>
  );
}
