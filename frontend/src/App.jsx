import { useState, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const reset = () => {
    setFile(null);
    setEmail("");
    setStatus("idle");
    setMessage("");
    setSummary("");
  };

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx"].includes(ext)) {
      setStatus("error");
      setMessage("Only .csv and .xlsx files are accepted.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("File exceeds 10 MB limit.");
      return;
    }
    setFile(f);
    setStatus("idle");
    setMessage("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !email) return;

    setStatus("loading");
    setMessage("");
    setSummary("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("recipient_email", email);

    try {
      const res = await fetch(`${API_URL}/upload-and-summarize/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.detail || "Something went wrong.");
        return;
      }

      setStatus("success");
      setMessage(data.message);
      setSummary(data.summary);
    } catch {
      setStatus("error");
      setMessage("Network error — is the backend running?");
    }
  };

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>🐇</span>
        <div>
          <h1 style={styles.title}>Rabbit AI</h1>
          <p style={styles.subtitle}>Sales Insight Automator</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Drop zone */}
        <div
          style={{
            ...styles.dropzone,
            borderColor: dragOver ? "#a78bfa" : file ? "#4ade80" : "#555",
            background: dragOver ? "rgba(167,139,250,0.08)" : "transparent",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {file ? (
            <p style={{ color: "#4ade80", fontWeight: 600 }}>
              📄 {file.name}{" "}
              <span style={{ fontWeight: 400, color: "#aaa" }}>
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </p>
          ) : (
            <p style={{ color: "#aaa" }}>
              Drag & drop a <strong>.csv</strong> or <strong>.xlsx</strong> file here, or click to
              browse
            </p>
          )}
        </div>

        {/* Email */}
        <input
          type="email"
          required
          placeholder="Recipient email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={!file || !email || status === "loading"}
          style={{
            ...styles.button,
            opacity: !file || !email || status === "loading" ? 0.5 : 1,
            cursor: !file || !email || status === "loading" ? "not-allowed" : "pointer",
          }}
        >
          {status === "loading" ? (
            <span style={styles.spinner} />
          ) : (
            "Generate & Send Summary"
          )}
        </button>
      </form>

      {/* Feedback */}
      {status === "error" && <div style={styles.alert("error")}>{message}</div>}
      {status === "success" && (
        <>
          <div style={styles.alert("success")}>{message}</div>
          {summary && (
            <details style={styles.details}>
              <summary style={styles.detailsSummary}>View generated summary</summary>
              <pre style={styles.pre}>{summary}</pre>
            </details>
          )}
          <button onClick={reset} style={{ ...styles.button, marginTop: 12, background: "#444" }}>
            Upload Another File
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- inline styles ---------- */

const styles = {
  card: {
    background: "rgba(30, 27, 50, 0.95)",
    borderRadius: 16,
    padding: 32,
    boxShadow: "0 8px 32px rgba(0,0,0,.4)",
    border: "1px solid rgba(255,255,255,.06)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
  },
  logo: { fontSize: 40 },
  title: { fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 },
  subtitle: { fontSize: 13, color: "#a78bfa", margin: 0 },
  dropzone: {
    border: "2px dashed #555",
    borderRadius: 12,
    padding: "28px 16px",
    textAlign: "center",
    cursor: "pointer",
    marginBottom: 16,
    transition: "border-color .2s, background .2s",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #444",
    background: "#1a1730",
    color: "#e0e0e0",
    fontSize: 14,
    marginBottom: 16,
    outline: "none",
  },
  button: {
    width: "100%",
    padding: "13px 0",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  spinner: {
    display: "inline-block",
    width: 18,
    height: 18,
    border: "3px solid rgba(255,255,255,.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
  },
  alert: (type) => ({
    marginTop: 16,
    padding: "12px 14px",
    borderRadius: 10,
    fontSize: 13,
    background: type === "error" ? "rgba(239,68,68,.12)" : "rgba(34,197,94,.12)",
    color: type === "error" ? "#f87171" : "#4ade80",
    border: `1px solid ${type === "error" ? "rgba(239,68,68,.3)" : "rgba(34,197,94,.3)"}`,
  }),
  details: {
    marginTop: 12,
    borderRadius: 10,
    border: "1px solid #333",
    overflow: "hidden",
  },
  detailsSummary: {
    padding: "10px 14px",
    cursor: "pointer",
    background: "#1a1730",
    color: "#a78bfa",
    fontSize: 13,
    fontWeight: 600,
  },
  pre: {
    padding: 14,
    fontSize: 12,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    color: "#ccc",
    background: "#12101e",
    maxHeight: 300,
    overflowY: "auto",
    margin: 0,
  },
};
