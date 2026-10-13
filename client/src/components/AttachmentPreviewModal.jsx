import { useEffect, useState } from "react";
import { X, Download, Paperclip, FileQuestion } from "lucide-react";
import { colors, fonts } from "../theme";
import { fetchCampaignAttachment, saveFile } from "../lib/downloadCampaignAttachment";

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

// Wraps mammoth's HTML in a minimal page so it reads like a document.
const docxPage = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 32px 40px; font-family: Calibri, Arial, sans-serif; font-size: 15px; line-height: 1.55; color: #222; background: white; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; margin: 12px 0; }
  td, th { border: 1px solid #ccc; padding: 6px 10px; vertical-align: top; }
</style></head><body>${body}</body></html>`;

const getPreviewType = (filename = "") =>
  PREVIEW_TYPES[(filename.split(".").pop() || "").toLowerCase()] || null;

// Student view of a campaign's attached file: shows it in-page where the
// browser can render it, with an explicit Download button either way.
function AttachmentPreviewModal({ campaign, onClose }) {
  const filename = campaign.attachmentFilename;
  const previewType = getPreviewType(filename);

  const [url, setUrl] = useState(null);
  const [text, setText] = useState(null);
  const [docHtml, setDocHtml] = useState(null);
  const [error, setError] = useState("");

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
        if (previewType?.kind === "text") setText(await blob.text());
        if (previewType?.kind === "docx") {
          // Loaded on demand — only students opening a .docx pay for it.
          const { default: mammoth } = await import("mammoth/mammoth.browser");
          const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
          setDocHtml(docxPage(value));
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

  const renderBody = () => {
    if (error) return <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.danger }}>{error}</p>;
    if (!url) return <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.inkMuted }}>Opening the scroll...</p>;

    if (previewType?.kind === "pdf")
      return <iframe src={url} title={filename} style={{ width: "100%", height: "100%", border: "none", borderRadius: "12px", backgroundColor: "white" }} />;
    if (previewType?.kind === "image")
      return <img src={url} alt={filename} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "12px" }} />;
    // sandbox="" — no scripts or navigation from whatever the document contains.
    if (previewType?.kind === "docx")
      return <iframe srcDoc={docHtml} sandbox="" title={filename} style={{ width: "100%", height: "100%", border: "none", borderRadius: "12px", backgroundColor: "white" }} />;
    if (previewType?.kind === "text")
      return (
        <pre style={{ width: "100%", height: "100%", margin: 0, padding: "20px", boxSizing: "border-box", overflow: "auto", backgroundColor: colors.parchmentPanel, border: `1px solid ${colors.parchmentLine}`, borderRadius: "12px", fontFamily: "monospace", fontSize: "13px", color: colors.ink, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {text}
        </pre>
      );

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
        <FileQuestion size={40} color={colors.magicViolet} />
        <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.inkMuted, margin: 0 }}>
          This file type can't be previewed here.<br />Download it to open it on your device.
        </p>
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(10, 6, 3, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(960px, 100%)", height: "min(85vh, 900px)", display: "flex", flexDirection: "column", backgroundColor: colors.parchmentDark, border: `1px solid ${colors.magicViolet}55`, borderRadius: "24px", boxShadow: "0 20px 50px rgba(0,0,0,0.4)", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", borderBottom: `1px solid ${colors.parchmentLine}` }}>
          <Paperclip size={16} color={colors.magicViolet} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: "600", fontSize: "15px", color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={filename}>
              {filename}
            </p>
            <p style={{ margin: 0, fontFamily: fonts.body, fontSize: "12px", color: colors.inkMuted }}>{campaign.title}</p>
          </div>
          <button
            onClick={() => saveFile(url, filename)}
            disabled={!url}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: `linear-gradient(160deg, ${colors.magicVioletBright}, ${colors.magicViolet})`, color: "white", border: "none", borderRadius: "14px", fontFamily: fonts.body, fontWeight: "600", fontSize: "13px", cursor: url ? "pointer" : "default", opacity: url ? 1 : 0.6 }}
          >
            <Download size={14} /> Download
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{ display: "flex", padding: "6px", background: "none", border: "none", color: colors.inkMuted, cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, minHeight: 0, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {renderBody()}
        </div>
      </div>
    </div>
  );
}

export default AttachmentPreviewModal;
