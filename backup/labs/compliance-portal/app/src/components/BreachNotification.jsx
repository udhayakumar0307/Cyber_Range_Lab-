import { FileText, Mail, Upload } from "lucide-react";
import React, { useMemo, useState } from "react";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const DEFAULT_PRINCIPAL_SUBJECT = "Important notice about a data breach";
const DEFAULT_PRINCIPAL_BODY = `Dear Data Principal,

We are writing to inform you about a data breach that may have affected your personal data.

What happened:

What information may have been involved:

What we are doing:

What you can do:

For any questions or assistance, please contact our privacy team.

Regards,
Privacy Office`;
const DEFAULT_BOARD_SUBJECT = "Data breach notification";
const DEFAULT_BOARD_BODY = `To the Data Protection Board,

We are submitting this notification regarding a personal data breach.

Reporting organization:

Date and time of breach detection:

Nature of the breach:

Categories of personal data affected:

Approximate number of affected data principals:

Likely consequences:

Measures taken or proposed to address the breach:

Contact person for follow-up:

Regards,
Privacy Office`;

function extractEmails(text) {
  return Array.from(new Set(text.match(EMAIL_PATTERN) ?? []));
}

function getInvalidEntries(text, emails) {
  const emailSet = new Set(emails.map((email) => email.toLowerCase()));

  return text
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.includes("@") && !emailSet.has(entry.toLowerCase()));
}

function buildMailtoUrl({ to = [], bcc = [], subject, body }) {
  const params = new URLSearchParams({ subject, body });

  if (bcc.length) {
    params.set("bcc", bcc.join(","));
  }

  // URLSearchParams uses '+' for spaces, which email clients may not parse correctly.
  return `mailto:${to.join(",")}?${params.toString().replace(/\+/g, "%20")}`;
}

export default function BreachNotification() {
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [principalSubject, setPrincipalSubject] = useState(DEFAULT_PRINCIPAL_SUBJECT);
  const [principalBody, setPrincipalBody] = useState(DEFAULT_PRINCIPAL_BODY);
  const [boardRecipientsText, setBoardRecipientsText] = useState("");
  const [boardSubject, setBoardSubject] = useState(DEFAULT_BOARD_SUBJECT);
  const [boardBody, setBoardBody] = useState(DEFAULT_BOARD_BODY);
  const [fileError, setFileError] = useState("");
  const [boardError, setBoardError] = useState("");

  const recipients = useMemo(() => extractEmails(fileText), [fileText]);
  const invalidEntries = useMemo(() => getInvalidEntries(fileText, recipients), [fileText, recipients]);
  const boardRecipients = useMemo(() => extractEmails(boardRecipientsText), [boardRecipientsText]);
  const invalidBoardEntries = useMemo(
    () => getInvalidEntries(boardRecipientsText, boardRecipients),
    [boardRecipients, boardRecipientsText]
  );
  const principalMailtoUrl = useMemo(
    () =>
      buildMailtoUrl({
        bcc: recipients,
        subject: principalSubject.trim(),
        body: principalBody.trim()
      }),
    [principalBody, principalSubject, recipients]
  );
  const boardMailtoUrl = useMemo(
    () =>
      buildMailtoUrl({
        to: boardRecipients,
        subject: boardSubject.trim(),
        body: boardBody.trim()
      }),
    [boardBody, boardRecipients, boardSubject]
  );

  function handleFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setFileError("");

    file
      .text()
      .then((text) => {
        setFileText(text);
      })
      .catch(() => {
        setFileText("");
        setFileError("Unable to read the uploaded file.");
      });
  }

  function handleOpenMailDraft() {
    if (!recipients.length) {
      setFileError("Upload a file with at least one valid email address.");
      return;
    }

    window.location.href = principalMailtoUrl;
  }

  function handleCopyRecipients() {
    if (!recipients.length) {
      setFileError("Upload a file with at least one valid email address.");
      return;
    }

    navigator.clipboard?.writeText(recipients.join(", "));
  }

  function handleOpenBoardMailDraft() {
    if (!boardRecipients.length) {
      setBoardError("Enter at least one valid Data Protection Board email address.");
      return;
    }

    if (invalidBoardEntries.length) {
      setBoardError("Remove invalid board email entries before creating the draft.");
      return;
    }

    setBoardError("");
    window.location.href = boardMailtoUrl;
  }

  return (
    <section className="module-section" aria-label="Breach notification">
      <article className="panel module-hero-panel">
        <div className="module-hero-copy">
          <p className="eyebrow">Incident Response</p>
          <h2>Breach Notification</h2>
          <p>
            Upload affected data principal email IDs, then prepare separate notification drafts for
            data principals and the Data Protection Board.
          </p>
        </div>
        <div className="module-score-block">
          <Mail size={26} aria-hidden="true" />
          <strong>{recipients.length}</strong>
          <span>Recipients</span>
        </div>
      </article>

      <section className="breach-layout">
        <article className="panel breach-panel">
          <div className="section-heading">
            <h2>Upload Email IDs</h2>
            <p>Use a CSV, TXT, or pasted export containing affected data principal email IDs.</p>
          </div>

          <label className="file-drop-zone">
            <Upload size={24} aria-hidden="true" />
            <span>{fileName || "Choose a recipient file"}</span>
            <input type="file" accept=".csv,.txt,.tsv,.json,text/*" onChange={handleFileUpload} />
          </label>

          {fileError && <div className="notice error">{fileError}</div>}

          <div className="breach-summary-grid">
            <div>
              <span>Valid emails</span>
              <strong>{recipients.length}</strong>
            </div>
            <div>
              <span>Invalid entries</span>
              <strong>{invalidEntries.length}</strong>
            </div>
          </div>

          <textarea
            className="recipient-preview"
            readOnly
            value={recipients.join("\n")}
            placeholder="Validated email IDs will appear here after upload."
            aria-label="Validated recipient email IDs"
          />
        </article>

        <article className="panel breach-panel">
          <div className="section-heading">
            <h2>Email Body</h2>
            <p>Explain the breach to affected data principals.</p>
          </div>

          <label className="breach-field">
            <span>Subject</span>
            <input
              type="text"
              value={principalSubject}
              onChange={(event) => setPrincipalSubject(event.target.value)}
            />
          </label>

          <label className="breach-field">
            <span>Message</span>
            <textarea
              value={principalBody}
              onChange={(event) => setPrincipalBody(event.target.value)}
            />
          </label>

          <div className="breach-actions">
            <button type="button" className="export-button" onClick={handleOpenMailDraft}>
              <Mail size={18} aria-hidden="true" />
              Open Mail Draft
            </button>
            <button type="button" className="secondary-action" onClick={handleCopyRecipients}>
              <FileText size={18} aria-hidden="true" />
              Copy Recipients
            </button>
          </div>
        </article>

        <article className="panel breach-panel breach-panel-wide">
          <div className="section-heading">
            <h2>Data Protection Board Notification</h2>
            <p>Enter the board email address and prepare the statutory breach report separately.</p>
          </div>

          <div className="breach-board-grid">
            <label className="breach-field">
              <span>Board email address</span>
              <input
                type="text"
                value={boardRecipientsText}
                onChange={(event) => {
                  setBoardRecipientsText(event.target.value);
                  setBoardError("");
                }}
                placeholder="board@example.gov.in"
              />
            </label>

            <label className="breach-field">
              <span>Subject</span>
              <input
                type="text"
                value={boardSubject}
                onChange={(event) => setBoardSubject(event.target.value)}
              />
            </label>
          </div>

          {boardError && <div className="notice error">{boardError}</div>}

          <label className="breach-field">
            <span>Board notification body</span>
            <textarea value={boardBody} onChange={(event) => setBoardBody(event.target.value)} />
          </label>

          <div className="breach-actions">
            <button type="button" className="export-button" onClick={handleOpenBoardMailDraft}>
              <Mail size={18} aria-hidden="true" />
              Open Board Mail Draft
            </button>
            <span className="breach-inline-status">
              {boardRecipients.length} valid board email
              {boardRecipients.length === 1 ? "" : "s"}
            </span>
          </div>
        </article>
      </section>
    </section>
  );
}
