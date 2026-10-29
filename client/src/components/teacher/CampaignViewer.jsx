import { useEffect, useState } from "react";
import { CheckCircle2, Eye, Paperclip, XCircle } from "lucide-react";
import AttachmentPreviewModal from "../AttachmentPreviewModal";
import { SceneBadge } from "../SceneIcon";
import { Alert, Badge, Card, LoadingState, Modal, StatusChip } from "../ui";
import { CLUE_TYPES } from "./campaignEditor/editorModel";
import { api, errorMessage } from "../../lib/api";

// Read-only view of one campaign for its teacher: details, every entry with
// its answers (correct ones marked in text, not only color), and the
// additional notes. Loads GET /api/campaigns/:id, which includes answers for the owner.
function CampaignViewer({ campaignId, onClose }) {
  const [campaign, setCampaign] = useState(null);
  const [error, setError] = useState("");
  const [previewingAttachment, setPreviewingAttachment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/campaigns/${campaignId}`)
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) setError(errorMessage(data, "Couldn't load this campaign."));
        else setCampaign(data);
      })
      .catch(() => !cancelled && setError("Couldn't reach the server. Check your connection."));
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const clues = campaign?.clues || [];
  const notes = campaign?.standaloneNotes || [];

  return (
    <>
      <Modal title={campaign?.title || "Campaign"} size="lg" onClose={onClose} closeOnBackdrop>
        {error && <Alert tone="danger">{error}</Alert>}
        {!campaign && !error && <LoadingState label="Loading campaign..." />}
        {campaign && (
          <div className="stack stack-lg">
            <div className="stack stack-sm">
              <div className="row" style={{ "--gap": "6px" }}>
                <StatusChip status={campaign.isPublished ? "published" : "draft"} />
                <SceneBadge scene={campaign.scene} />
                <Badge tone="outline">{clues.length} {clues.length === 1 ? "entry" : "entries"}</Badge>
              </div>
              {campaign.description && <p className="text-sm text-muted">{campaign.description}</p>}
              {campaign.attachmentFilename && (
                <button type="button" className="attachment-chip" onClick={() => setPreviewingAttachment(true)}>
                  <Paperclip size={14} aria-hidden="true" />
                  <span className="truncate">{campaign.attachmentFilename}</span>
                  <Eye size={14} aria-hidden="true" />
                  <span className="sr-only">Open attachment</span>
                </button>
              )}
            </div>

            {clues.length === 0 ? (
              <p className="text-sm text-muted">No entries added to this campaign yet.</p>
            ) : (
              <ol className="stack" role="list">
                {clues.map((clue) => (
                  <li key={clue.id}>
                    <Card muted className="stack stack-sm">
                      <div className="row row-between">
                        <p className="eyebrow">Entry {clue.orderNumber}</p>
                        <Badge tone="info">{CLUE_TYPES[clue.type]?.label || clue.type}</Badge>
                      </div>
                      <p className="font-semibold">{clue.question}</p>
                      {clue.note && (
                        <p className="text-sm text-muted">
                          <span className="font-semibold">Hint: </span>
                          {clue.note}
                        </p>
                      )}
                      <ul className="answer-list" role="list">
                        {(clue.answers || []).map((a, i) => (
                          <li key={i} data-correct={a.isCorrect}>
                            {a.isCorrect ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
                            <span className="sr-only">{a.isCorrect ? "Correct:" : "Decoy:"}</span>
                            {a.text}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </li>
                ))}
              </ol>
            )}

            {notes.length > 0 && (
              <section aria-labelledby="viewer-notes">
                <h3 id="viewer-notes" style={{ marginBottom: 8 }}>
                  Additional notes
                </h3>
                <ol className="stack stack-sm text-sm" style={{ paddingLeft: 20 }}>
                  {notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </Modal>

      {previewingAttachment && campaign && <AttachmentPreviewModal campaign={campaign} onClose={() => setPreviewingAttachment(false)} />}
    </>
  );
}

export default CampaignViewer;
