import { useEffect, useState } from "react";
import { Paperclip, Eye } from "lucide-react";
import BookShell from "../book/BookShell";
import AttachmentPreviewModal from "../AttachmentPreviewModal";
import { colors, fonts } from "../../theme";
import { getSceneMeta } from "../../scenes";

function CampaignBookViewer({ campaignId, onClose }) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [previewingAttachment, setPreviewingAttachment] = useState(false);

  useEffect(() => {
    const fetchCampaign = async () => {
      const token = localStorage.getItem("token");

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}`, {
          headers: { "Authorization": `Bearer ${token}` },
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.message);
          onClose();
          return;
        }

        setCampaign(data);
      } catch (err) {
        console.error(err);
        alert("Something went wrong.");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  if (loading || !campaign) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(8,5,3,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
        <p style={{ fontFamily: fonts.flourish, fontSize: "18px", color: colors.brassBright }}>Loading campaign...</p>
      </div>
    );
  }

  const clues = campaign.clues || [];
  // Additional notes (standalone hints) sit on one last page after the clues.
  const standaloneNotes = campaign.standaloneNotes || [];
  const hasNotesPage = standaloneNotes.length > 0;
  const pageCount = Math.max(clues.length + (hasNotesPage ? 1 : 0), 1);
  const isNotesPage = hasNotesPage && pageIndex === clues.length;
  const currentClue = clues[pageIndex];
  const sceneMeta = getSceneMeta(campaign.scene);

  const leftPage = (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
        <h2 style={{ fontFamily: fonts.displayDecorative, fontSize: "24px", color: colors.ink, margin: 0 }}>{campaign.title}</h2>
        <span
          style={{
            fontFamily: fonts.body,
            fontSize: "11px",
            fontWeight: "600",
            padding: "2px 10px",
            borderRadius: "10px",
            color: campaign.isPublished ? colors.success : colors.draft,
            backgroundColor: campaign.isPublished ? colors.successBg : colors.draftBg,
            whiteSpace: "nowrap",
          }}
        >
          {campaign.isPublished ? "Published" : "Draft"}
        </span>
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: "0 0 16px 0" }}>
        <sceneMeta.Icon size={14} color={sceneMeta.color} />
        <span style={{ fontFamily: fonts.body, fontSize: "12px", color: sceneMeta.color, fontWeight: "600" }}>{sceneMeta.label}</span>
      </div>

      {campaign.description && (
        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.inkMuted, margin: 0 }}>{campaign.description}</p>
      )}

      {campaign.attachmentFilename && (
        <button
          onClick={() => setPreviewingAttachment(true)}
          title={`Preview ${campaign.attachmentFilename}`}
          style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", marginTop: "16px", padding: "7px 10px", background: "none", border: `1px solid ${colors.parchmentLine}`, borderRadius: "10px", color: colors.ember, fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
        >
          <Paperclip size={12} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {campaign.attachmentFilename}
          </span>
          <Eye size={12} style={{ flexShrink: 0 }} />
        </button>
      )}
    </div>
  );

  const CLUE_TYPE_LABELS = { NORMAL: "Normal", MULTICHOICE: "MultiChoice", COMBO: "Combo" };

  const rightPage = isNotesPage ? (
    <div>
      <p style={{ fontFamily: fonts.flourish, fontSize: "13px", color: colors.ember, letterSpacing: "1px", margin: "0 0 16px 0" }}>
        Additional Notes
      </p>
      {standaloneNotes.map((n, i) => (
        <div key={i} style={{ marginBottom: "14px" }}>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.ink, margin: "0 0 4px 0" }}>Note {i + 1}</p>
          <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.inkMuted, margin: 0, lineHeight: 1.5 }}>{n}</p>
        </div>
      ))}
    </div>
  ) : clues.length === 0 ? (
    <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.inkMuted }}>No entries added to this campaign yet.</p>
  ) : (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 16px 0" }}>
        <p style={{ fontFamily: fonts.flourish, fontSize: "13px", color: colors.ember, letterSpacing: "1px", margin: 0 }}>
          Entry {currentClue.orderNumber}
        </p>
        <span style={{ fontFamily: fonts.body, fontSize: "11px", fontWeight: "600", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {CLUE_TYPE_LABELS[currentClue.type] || currentClue.type}
        </span>
      </div>

      <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.ink, margin: "0 0 6px 0" }}>Question</p>
      <p style={{ fontFamily: fonts.body, fontSize: "15px", color: colors.ink, margin: "0 0 22px 0", lineHeight: 1.5 }}>{currentClue.question}</p>

      {currentClue.note && (
        <>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.ink, margin: "0 0 6px 0" }}>Note</p>
          <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.inkMuted, margin: "0 0 22px 0", lineHeight: 1.5 }}>{currentClue.note}</p>
        </>
      )}

      <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.ink, margin: "0 0 6px 0" }}>
        {currentClue.answers?.length > 1 ? "Answers" : "Answer"}
      </p>
      {(currentClue.answers || []).map((a, i) => (
        <p
          key={i}
          style={{
            fontFamily: fonts.body,
            fontSize: "15px",
            color: a.isCorrect ? colors.ember : colors.inkMuted,
            fontWeight: a.isCorrect ? "600" : "400",
            margin: "0 0 4px 0",
          }}
        >
          {a.isCorrect ? "✓ " : "✕ "}{a.text}
        </p>
      ))}
    </div>
  );

  return (
    <>
    <BookShell
      leftPage={leftPage}
      rightPage={rightPage}
      pageIndex={pageIndex}
      pageCount={pageCount}
      onPrev={() => setPageIndex(Math.max(0, pageIndex - 1))}
      onNext={() => setPageIndex(Math.min(pageCount - 1, pageIndex + 1))}
      onClose={onClose}
    />

    {previewingAttachment && (
      <AttachmentPreviewModal campaign={campaign} onClose={() => setPreviewingAttachment(false)} />
    )}
    </>
  );
}

export default CampaignBookViewer;
