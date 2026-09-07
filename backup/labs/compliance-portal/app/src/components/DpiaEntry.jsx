import React, { useState, useEffect } from "react";
import { Send, Key, Bot, User, Play, Download } from "lucide-react";
import { appConfig, getPiiRiskDetailsApiUrl, getRequiredValue } from "../config/appConfig.js";
import { requestJson } from "../services/apiClient.js";

export default function DpiaEntry({ onAuditComplete, activeApiKey }) {
  const [piiData, setPiiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem("groqApiKey") || "";
    } catch (e) {
      return "";
    }
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const configError =
    !appConfig.aiUrl || !appConfig.aiModel
      ? "Missing required configuration: VITE_AI_URL and/or VITE_AI_MODEL"
      : "";

  const loadPiiRiskDetails = async () => {
    setLoading(true);
    setError("");

    if (configError) {
      setError(configError);
      setPiiData(null);
      setLoading(false);
      return;
    }

    try {
      const headers = activeApiKey ? { "x-api-key": activeApiKey } : {};
      const data = await requestJson(getRequiredValue(getPiiRiskDetailsApiUrl(), "VITE_API_BASE_URL"), { headers });
      setPiiData(data);
    } catch (err) {
      setError(`Unable to load PII risk details: ${err.message}`);
      setPiiData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPiiRiskDetails();
  }, []);

  const handleApiKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    try {
      localStorage.setItem("groqApiKey", val);
    } catch (err) {
      // Ignore localStorage errors
    }
  };

  const startAssessment = async () => {
    if (!apiKey || !piiData || configError) return;
    setChatStarted(true);
    setIsTyping(true);

    const initMessage = { 
      role: "user", 
      content: "I have provided the company's PII risk details in the system instructions. Please review them and ask your first precise question to begin gathering missing information for the DPDP compliance report." 
    };
    
    const systemPrompt = {
      role: "system",
      content: `You are an AI assistant helping a company generate a DPDP compliance report to submit to the Data Protection Board. Here are the PII risk details stored by the company: ${JSON.stringify(piiData)}. Your task is to ask precise, targeted questions based on this data to gather any missing information from the user, one by one. Once you have all the necessary information, generate a comprehensive DPDP compliance report in Markdown format.`
    };

    try {
      const response = await fetch(getRequiredValue(appConfig.aiUrl, "VITE_AI_URL"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: getRequiredValue(appConfig.aiModel, "VITE_AI_MODEL"),
          messages: [systemPrompt, initMessage]
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error?.message || (typeof data.error === 'string' ? data.error : null) || data.message || JSON.stringify(data);
        throw new Error(`Groq API Error (${response.status}): ${errorMessage}`);
      }

      setMessages([initMessage, data.choices[0].message]);
    } catch (err) {
      setMessages([initMessage, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !apiKey) return;

    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const systemPrompt = {
        role: "system",
        content: `You are an AI assistant helping a company generate a DPDP compliance report to submit to the Data Protection Board. Here are the PII risk details stored by the company: ${JSON.stringify(piiData)}. Your task is to ask precise, targeted questions based on this data to gather any missing information from the user, one by one. Once you have all the necessary information, generate a comprehensive DPDP compliance report.`
      };

      const response = await fetch(getRequiredValue(appConfig.aiUrl, "VITE_AI_URL"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: getRequiredValue(appConfig.aiModel, "VITE_AI_MODEL"),
          messages: [systemPrompt, ...newMessages]
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error?.message || (typeof data.error === 'string' ? data.error : null) || data.message || JSON.stringify(data);
        throw new Error(`Groq API Error (${response.status}): ${errorMessage}`);
      }

      const aiMessage = data.choices[0].message;
      setMessages([...newMessages, aiMessage]);
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <section className="module-section dpia-entry-section">
      <div className="panel module-hero-panel">
        <div className="module-hero-copy">
          <p className="eyebrow">AI Assistant</p>
          <h2>DPIA AI Entry & Report Generation</h2>
          <p>
            Review the current PII risk details and answer the AI's questions to formulate a comprehensive DPDP compliance report.
          </p>
        </div>
      </div>

      <div className="panel" style={{ padding: '20px', marginTop: '20px' }}>
        {configError && (
          <div className="notice error" style={{ marginBottom: '20px' }}>
            {configError}
          </div>
        )}
        {error && (
          <div className="notice" style={{ marginBottom: '20px', backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' }}>
            <strong>Note:</strong> {error}
            <div style={{ marginTop: '12px' }}>
              <button type="button" onClick={loadPiiRiskDetails} style={{ padding: '8px 14px' }}>
                Retry
              </button>
            </div>
          </div>
        )}
        {loading && <div className="notice" style={{ marginBottom: '20px' }}>Loading PII Risk Details from API...</div>}

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Key size={20} />
          <input 
            type="password" 
            placeholder="Enter your Groq API Key" 
            value={apiKey} 
            onChange={handleApiKeyChange}
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', background: 'transparent', color: 'inherit' }}
          />
          {!chatStarted && (
            <button
              type="button"
              onClick={startAssessment}
              disabled={!apiKey || loading || Boolean(configError)}
              style={{
                padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px',
                borderRadius: '4px', background: (!apiKey || loading || configError) ? 'gray' : '#0f9f6e',
                color: '#ffffff', border: 'none', cursor: (!apiKey || loading || configError) ? 'not-allowed' : 'pointer', fontWeight: '500', fontSize: '14px'
              }}
            >
              <Play size={18} /> Start Assessment
            </button>
          )}
        </div>

        <div style={{ border: '1px solid #ccc', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '500px', background: 'transparent' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', opacity: 0.7, marginTop: '20px' }}>
                Hello! Please enter your Groq API key above and click "Start Assessment" to begin generating your DPDP compliance report.
              </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                gap: '12px',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? '#0f9f6e' : 'transparent',
                color: msg.role === 'user' ? '#ffffff' : 'inherit',
                padding: '12px 16px',
                borderRadius: '8px',
                maxWidth: '85%',
                border: msg.role === 'user' ? 'none' : '1px solid #ccc',
              }}>
                <div style={{ marginTop: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => {
                        const blob = new Blob([msg.content], { type: "text/markdown;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "DPDP_Compliance_Report.md";
                        a.click();
                        URL.revokeObjectURL(url);
                        
                        // Tell the dashboard the audit is finished today
                        if (onAuditComplete) {
                          onAuditComplete(new Date());
                        }
                      }}
                      title="Download as Markdown file"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                    >
                      <Download size={16} />
                    </button>
                  )}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '14px' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ alignSelf: 'flex-start', padding: '12px 16px', background: 'transparent', borderRadius: '8px', border: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                <Bot size={18} />
                AI is typing...
              </div>
            )}
          </div>
          
          <form onSubmit={handleSend} style={{ display: 'flex', padding: '15px', borderTop: '1px solid #ccc', gap: '10px', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={chatStarted ? "Type your message..." : "Click Start Assessment first"}
              disabled={!chatStarted || isTyping || Boolean(configError)}
              style={{ flex: 1, padding: '10px 15px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', background: 'transparent', color: 'inherit' }}
            />
            <button 
              type="submit" 
              disabled={!chatStarted || isTyping || !input.trim() || Boolean(configError)}
              style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', background: (!chatStarted || isTyping || !input.trim() || configError) ? 'gray' : '#2463eb', color: '#ffffff', border: 'none', cursor: (!chatStarted || isTyping || !input.trim() || configError) ? 'not-allowed' : 'pointer', fontWeight: '500', fontSize: '14px' }}
            >
              <Send size={18} /> Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}