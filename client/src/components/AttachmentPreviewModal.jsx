import { useEffect, useRef, useState } from "react";
import { X, Download, FileQuestion, Minus, Plus, Printer, ChevronDown, Lock, LockOpen, Play, PartyPopper } from "lucide-react";
import { fetchCampaignAttachment, saveFile } from "../lib/downloadCampaignAttachment";
import PdfScroller from "./PdfScroller";
import { Confetti } from "./ui";

// Which file types the browser can show inline, keyed by extension (the
// stored MIME type comes from the uploader's browser, so it's not trusted).
// .docx is converted to HTML with mammoth; anything else (.doc/.ppt/.pptx/.zip)
// gets a "download to open" note.
const PREVIEW_TYPES = {
  pdf: { kind: "pdf", mime: "application/pdf" },
  png: { kind: "image", mime: "image/png" },
  jpg: { kind: "image", mime: "image/jpeg" },
  jpeg: { kind: "image", mime: "image/jpeg" },
  txt: { kind: "text", mime: "text/plain" },
  docx: { kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

// Small coloured badge next to the filename, like a file-type icon.
const FILE_BADGES = {
  doc: { label: "W", color: "#2B579A" },
  docx: { label: "W", color: "#2B579A" },
  pdf: { label: "PDF", color: "#D93025" },
  png: { label: "IMG", color: "#188038" },
  jpg: { label: "IMG", color: "#188038" },
  jpeg: { label: "IMG", color: "#188038" },
  txt: { label: "TXT", color: "#5F6368" },
  ppt: { label: "P", color: "#D24726" },
  pptx: { label: "P", color: "#D24726" },
};

const ZOOM_LEVELS = [50, 75, 90, 100, 125, 150, 200];

// Dark viewer background with the document laid out as a white letter-size
// sheet in the middle, like a document viewer.
const paperPage = (body, extraCss = "") => `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: transparent; }
  body { padding: 16px 0 48px; }
  .page { box-sizing: border-box; width: 816px; min-height: 1056px; margin: 0 auto; padding: 72px 96px; background: white; color: #222;
          font-family: Calibri, Arial, sans-serif; font-size: 15px; line-height: 1.55; box-shadow: 0 2px 12px rgba(0,0,0,0.5); }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; margin: 12px 0; }
  td, th { border: 1px solid #ccc; padding: 6px 10px; vertical-align: top; }
  ${extraCss}
  @media print { body { padding: 0; } .page { width: auto; min-height: 0; padding: 0; box-shadow: none; } }
</style></head><body><div class="page">${body}</div></body></html>`;

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const getExtension = (filename = "") => (filename.split(".").pop() || "").toLowerCase();

// Viewer for a campaign's attached file, used by every role (students on
// their room page, teachers/admins in the campaign book): a full-screen
// document viewer with zoom, print and an explicit Download button.
// Students pass onProgress(fraction 0..1): the viewer then reports how far down the file they have
// scrolled (PDFs are drawn with pdf.js so the scroll position can be seen), shows it in a bar, and
// counts a file it can't show as read once it's downloaded. When `unlocked` turns true (the server saved
// the read) a confetti pop-up congratulates them; onPlay, if given, adds a "Play now" button to it.
function AttachmentPreviewModal({ campaign, onClose, onProgress, unlocked = false, onPlay }) {
  const filename = campaign.attachmentFilename;
  const extension = getExtension(filename);
  const previewType = PREVIEW_TYPES[extension] || null;
  const badge = FILE_BADGES[extension] || { label: extension.slice(0, 3).toUpperCase() || "?", color: "#5F6368" };

  const [url, setUrl] = useState(null);
  const [pageHtml, setPageHtml] = useState(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(100);
  const frameRef = useRef(null);
  const closeRef = useRef(null);
  const tracking = typeof onProgress === "function";
  // The viewer only tracks a campaign that was locked when it opened, so `unlocked` turning true
  // here always means the student just finished the file.
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const celebrate = tracking && unlocked && !celebrationDismissed;
  const [progress, setProgress] = useState(0);

  const report = (fraction) => {
    if (!tracking) return;
    setProgress((p) => Math.max(p, fraction));
    onProgress(fraction);
  };
  // How far down a scroll box the bottom of the view is; a file that fits without scrolling is all read.
  const measure = (el) => {
    if (!el) return;
    report(el.scrollHeight <= el.clientHeight + 4 ? 1 : Math.min(1, (el.scrollTop + el.clientHeight) / el.scrollHeight));
  };
  // Only once the sheet has loaded - before that the frame holds an empty page that would look fully read.
  const sheetLoaded = useRef(false);
  const measureSheet = () => sheetLoaded.current && measure(frameRef.current?.contentDocument?.scrollingElement);

  // Focus starts on Close so keyboard users can leave right away.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Documents rendered into a sheet (docx/txt) and images get our own zoom
  // and print controls; PDFs use the browser's built-in PDF toolbar instead.
  const isSheet = previewType?.kind === "docx" || previewType?.kind === "text";
  const hasToolbar = isSheet || previewType?.kind === "image";

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    fetchCampaignAttachment(campaign.id)
      .then(async (blob) => {
        if (cancelled) return;
        // Re-type the blob so e.g. PDFs render in the iframe even if the
        // server sent a generic Content-Type.
        const typed = previewType ? new Blob([blob], { type: previewType.mime }) : blob;
        objectUrl = URL.createObjectURL(typed);
        if (previewType?.kind === "text")
          setPageHtml(paperPage(`<pre>${escapeHtml(await blob.text())}</pre>`, "pre { margin: 0; font-family: Consolas, monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; }"));
        if (previewType?.kind === "docx") {
          // Loaded on demand — only someone opening a .docx pays for it.
          const { default: mammoth } = await import("mammoth/mammoth.browser");
          const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
          setPageHtml(paperPage(value));
        }
        if (!cancelled) setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [campaign.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Zoom the sheet inside the iframe without re-rendering it, so the reader
  // keeps their scroll position.
  const applyZoom = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.documentElement) doc.documentElement.style.zoom = `${zoom}%`;
  };
  useEffect(() => {
    applyZoom();
    if (tracking) measureSheet();
    // measureSheet only reads the frame; re-measure when the zoom changes the document's height
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, pageHtml]);

  // The docx/txt sheet scrolls inside its iframe, so listen there.
  const handleSheetLoad = () => {
    applyZoom();
    if (!tracking) return;
    sheetLoaded.current = true;
    frameRef.current?.contentWindow?.addEventListener("scroll", measureSheet, { passive: true });
    measureSheet();
  };

  const stepZoom = (dir) => {
    const i = ZOOM_LEVELS.indexOf(zoom);
    const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + dir))];
    setZoom(next);
  };

  const handlePrint = () => {
    if (isSheet) {
      frameRef.current?.contentWindow?.print();
      return;
    }
    // Images: print from a throwaway window holding just the picture.
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<title>${escapeHtml(filename)}</title><img src="${url}" style="max-width:100%" onload="window.print()">`);
    win.document.close();
  };

  const renderBody = () => {
    if (error)
      return <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#F28B82", alignSelf: "center" }}>{error}</p>;
    if (!url)
      return <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#BDC1C6", alignSelf: "center" }}>Opening the file...</p>;

    if (previewType?.kind === "pdf" && tracking)
      return <PdfScroller url={url} title={filename} onScroll={measure} />;
    if (previewType?.kind === "pdf")
      return <iframe src={url} title={filename} style={{ width: "min(1100px, 100%)", height: "100%", border: "none", backgroundColor: "white" }} />;
    if (previewType?.kind === "image")
      return (
        <div onScroll={(e) => measure(e.currentTarget)} style={{ width: "100%", height: "100%", overflow: "auto", display: "flex" }}>
          <img src={url} alt={filename} onLoad={(e) => measure(e.currentTarget.parentElement)} style={{ margin: "auto", maxWidth: zoom === 100 ? "100%" : "none", width: zoom === 100 ? "auto" : `${zoom}%`, boxShadow: "0 2px 12px rgba(0,0,0,0.5)" }} />
        </div>
      );
    // sandbox without allow-scripts — nothing in the document can run; the
    // same-origin flag only lets this page set zoom and call print().
    if (isSheet)
      return <iframe ref={frameRef} srcDoc={pageHtml} onLoad={handleSheetLoad} sandbox="allow-same-origin allow-modals" title={filename} style={{ width: "100%", height: "100%", border: "none" }} />;

    return (
      <div style={{ alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", textAlign: "center", padding: "32px 40px", backgroundColor: "#2D2E30", borderRadius: "16px" }}>
        <FileQuestion size={40} color="#C2A7FF" aria-hidden="true" />
        <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#E8EAED", margin: 0 }}>
          No preview available for this file type.<br />Download it to open it on your device.
        </p>
        <button onClick={() => { saveFile(url, filename); report(1); }} style={downloadButtonStyle(true)}>
          <Download size={16} /> Download
        </button>
      </div>
    );
  };

  const toolbarButton = { display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", background: "none", border: "none", borderRadius: "50%", color: "#E8EAED", cursor: "pointer" };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Attachment: ${filename}`} style={{ position: "fixed", inset: 0, zIndex: 1100, backgroundColor: "rgba(20, 20, 22, 0.96)", display: "flex", flexDirection: "column" }}>
      {/* Top bar: close, file badge + name, download */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "10px 20px 10px 12px", flexShrink: 0 }}>
        <button ref={closeRef} onClick={onClose} title="Close (Esc)" aria-label="Close attachment viewer" style={{ ...toolbarButton, width: "40px", height: "40px" }}>
          <X size={22} aria-hidden="true" />
        </button>
        <div style={{ flexShrink: 0, minWidth: "26px", height: "28px", padding: "0 5px", boxSizing: "border-box", borderRadius: "5px", backgroundColor: badge.color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif", fontWeight: "700", fontSize: badge.label.length > 1 ? "9px" : "15px" }}>
          {badge.label}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p title={filename} style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "17px", color: "#E8EAED", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filename}
          </p>
          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "12px", color: "#9AA0A6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {campaign.title}
          </p>
        </div>
        <button onClick={() => saveFile(url, filename)} disabled={!url} style={downloadButtonStyle(!!url)}>
          <Download size={16} /> Download
        </button>
      </div>

      {/* Student: how much of the file has been scrolled through - reaching the end unlocks Play */}
      {tracking && (
        <div className="read-meter" data-done={progress >= 0.98 || undefined} role="status">
          {progress >= 0.98 ? <LockOpen size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
          <span className="read-meter__label">
            {progress >= 0.98 ? "Play unlocked! Close the lesson to play." : "Scroll to the end of the lesson to unlock Play"}
          </span>
          <span className="read-meter__bar" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
          <span className="read-meter__percent" aria-hidden="true">{Math.round(progress * 100)}%</span>
        </div>
      )}

      {/* Zoom / print bar */}
      {hasToolbar && url && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "0 12px", padding: "6px 16px", backgroundColor: "#3C4043", borderRadius: "999px", flexShrink: 0, alignSelf: "stretch" }}>
          <button onClick={handlePrint} title="Print" aria-label="Print" style={toolbarButton}><Printer size={18} /></button>
          <div style={{ width: "1px", height: "20px", backgroundColor: "#5F6368", margin: "0 6px" }} />
          <button onClick={() => stepZoom(-1)} disabled={zoom === ZOOM_LEVELS[0]} title="Zoom out" aria-label="Zoom out" style={{ ...toolbarButton, opacity: zoom === ZOOM_LEVELS[0] ? 0.4 : 1 }}><Minus size={18} /></button>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              title="Zoom"
              aria-label="Zoom level"
              style={{ appearance: "none", background: "none", border: "none", color: "#E8EAED", fontFamily: "var(--font-body)", fontSize: "14px", padding: "4px 22px 4px 6px", cursor: "pointer", outline: "none" }}
            >
              {ZOOM_LEVELS.map((z) => <option key={z} value={z} style={{ color: "#202124" }}>{z}%</option>)}
            </select>
            <ChevronDown size={14} color="#E8EAED" style={{ position: "absolute", right: "4px", pointerEvents: "none" }} />
          </div>
          <button onClick={() => stepZoom(1)} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} title="Zoom in" aria-label="Zoom in" style={{ ...toolbarButton, opacity: zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ? 0.4 : 1 }}><Plus size={18} /></button>
        </div>
      )}

      {/* Document area; clicking the empty dark space around the document closes the viewer */}
      <div
        onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{ flex: 1, minHeight: 0, padding: "12px 24px 0", display: "flex", justifyContent: "center" }}
      >
        {renderBody()}
      </div>

      {celebrate && (
        <div className="read-celebration">
          <Confetti pieces={60} />
          <div className="read-celebration__card" role="alertdialog" aria-modal="true" aria-labelledby="read-celebration-title" aria-describedby="read-celebration-text">
            <span className="read-celebration__icon" aria-hidden="true">
              <PartyPopper size={36} />
            </span>
            <h2 id="read-celebration-title" className="read-celebration__title">Great job!</h2>
            <p id="read-celebration-text" className="read-celebration__text">
              You read the whole lesson. <strong>Play is unlocked!</strong>
            </p>
            <div className="read-celebration__actions">
              <button type="button" className="btn btn--secondary" onClick={() => setCelebrationDismissed(true)}>
                Keep reading
              </button>
              {onPlay ? (
                <button type="button" className="btn btn--accent" onClick={onPlay} autoFocus>
                  <Play size={18} aria-hidden="true" /> Play now
                </button>
              ) : (
                <button type="button" className="btn btn--accent" onClick={onClose} autoFocus>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const downloadButtonStyle = (enabled) => ({
  display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, padding: "9px 20px",
  background: "#8EAAFF", color: "#141927",
  border: "none", borderRadius: "999px", fontFamily: "var(--font-body)", fontWeight: "600", fontSize: "14px",
  cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.6,
});

export default AttachmentPreviewModal;
