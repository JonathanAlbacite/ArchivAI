import { useEffect, useState } from "react";
import BookShell from "../book/BookShell";
import { colors, fonts } from "../../theme";
import { getSceneMeta } from "../../scenes";

function CampaignBookViewer({ campaignId, onClose }) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);

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
        <p style={{ fontFamily: fonts.flourish, fontSize: "18px", color: colors.brassBright }}>Opening the tome...</p>
      </div>
    );
  }

  const clues = campaign.clues || [];
  const pageCount = Math.max(clues.length, 1);
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
    </div>
  );

  const rightPage = clues.length === 0 ? (
    <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.inkMuted }}>No clues recorded in this tome yet.</p>
  ) : (
    <div>
      <p style={{ fontFamily: fonts.flourish, fontSize: "13px", color: colors.ember, letterSpacing: "1px", margin: "0 0 16px 0" }}>
        Clue {currentClue.orderNumber}
      </p>

      <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.ink, margin: "0 0 6px 0" }}>Question</p>
      <p style={{ fontFamily: fonts.body, fontSize: "15px", color: colors.ink, margin: "0 0 22px 0", lineHeight: 1.5 }}>{currentClue.question}</p>

      <p style={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: colors.ink, margin: "0 0 6px 0" }}>Answer</p>
      <p style={{ fontFamily: fonts.body, fontSize: "15px", color: colors.ember, fontWeight: "600", margin: 0 }}>{currentClue.answer}</p>
    </div>
  );

  return (
    <BookShell
      leftPage={leftPage}
      rightPage={rightPage}
      pageIndex={pageIndex}
      pageCount={pageCount}
      onPrev={() => setPageIndex(Math.max(0, pageIndex - 1))}
      onNext={() => setPageIndex(Math.min(pageCount - 1, pageIndex + 1))}
      onClose={onClose}
    />
  );
}

export default CampaignBookViewer;
