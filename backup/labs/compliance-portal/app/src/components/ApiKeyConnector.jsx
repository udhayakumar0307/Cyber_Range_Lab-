import React from "react";
import { KeyRound, RefreshCw } from "lucide-react";

export default function ApiKeyConnector({
  apiKey,
  connected,
  loading,
  onApiKeyChange,
  onConnect
}) {
  return (
    <section className="api-key-panel" aria-label="Consent API connection">
      <div className="api-key-label">
        <KeyRound size={18} aria-hidden="true" />
        <span>Consent API key</span>
      </div>
      <form className="api-key-form" onSubmit={onConnect}>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder="Paste API key"
          autoComplete="off"
          aria-label="Consent database API key"
        />
        <button type="submit" disabled={loading}>
          <RefreshCw size={17} aria-hidden="true" />
          {loading ? "Syncing" : "Sync"}
        </button>
      </form>
      <p className={connected ? "api-key-status connected" : "api-key-status"}>
        {connected ? "Using connected consent service" : "Connect a consent service"}
      </p>
    </section>
  );
}
