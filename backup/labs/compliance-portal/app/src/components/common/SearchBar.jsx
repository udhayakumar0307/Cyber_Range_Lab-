import React from "react";
import { Search } from "lucide-react";

export default function SearchBar({ value, onChange, placeholder = "Search...", statusFilter, onStatusChange, statusOptions = [], dateFilter, onDateChange }) {
  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="search-input"
        />
      </div>
      
      <div className="filter-options-wrapper">
        {statusOptions.length > 0 && onStatusChange && (
          <select 
            value={statusFilter || "all"} 
            onChange={(e) => onStatusChange(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        
        {onDateChange && (
          <input
            type="date"
            value={dateFilter || ""}
            onChange={(e) => onDateChange(e.target.value)}
            className="filter-date-input"
          />
        )}
      </div>
    </div>
  );
}
