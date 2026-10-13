// Fetches a campaign's attached resource file (GET /api/campaigns/:id/attachment)
// as a Blob. A plain <a href> / <iframe src> can't carry the Bearer auth header
// the API requires, so callers turn the blob into an object URL instead — the
// standard workaround for authenticated files.
export const fetchCampaignAttachment = async (campaignId) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}/attachment`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Couldn't load the attachment");
  }

  return res.blob();
};

// Triggers the browser's save dialog for an object URL (or any href).
export const saveFile = (href, filename) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename || "attachment";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// Fetch + save in one go — used by the teacher's CampaignBookViewer, which
// just needs "click it, get the file". Students preview first instead (see
// AttachmentPreviewModal).
export const downloadCampaignAttachment = async (campaignId, filename) => {
  const blob = await fetchCampaignAttachment(campaignId);
  const url = URL.createObjectURL(blob);
  saveFile(url, filename);
  URL.revokeObjectURL(url);
};
