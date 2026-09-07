import React from "react";
import { AlertCircle } from "lucide-react";

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", type = "warning" }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <AlertCircle size={20} className={`modal-icon-${type}`} />
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`btn-primary btn-${type}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
