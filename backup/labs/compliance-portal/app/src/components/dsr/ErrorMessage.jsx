import React from 'react';

export default function ErrorMessage({ message }) {
  if (!message) return null;
  return <div className="notice error" style={{ margin: '20px 0' }}>{message}</div>;
}