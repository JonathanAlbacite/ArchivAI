import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Pencil, Check, X, UploadCloud } from "lucide-react";
import Navbar from "../../components/Navbar";
import EmberField from "../../components/EmberField";
import dashboard_bg from "../../assets/dashboard_bg.png";
import { colors, fonts } from "../../theme";

const SLOT_NAMES = ["Head", "Body", "Arm", "Leg"];

// Admin: manages the catalog of character models shown on the website's Customize Character
// scene (see client/src/components/CharacterCustomizer3D.jsx and server/routes/characterSets.js).
// Adding a character here is a two-step upload: pick a .glb, then assign whichever mesh names the
// server found inside it to Head/Body/Arm/Leg - GLBs aren't guaranteed to follow any naming
// convention, so that mapping has to be done by hand rather than guessed. Renaming/reordering an
// existing set, or deleting one, doesn't need the file re-uploaded.
//
// NOT HANDLED HERE - a newly-added set previews correctly on the website, but won't appear in the
// real Unity gameplay build until someone also imports a matching FBX into the Unity project and
// adds it to CharacterPartRegistryAsset by hand (needs the Unity Editor, can't be done from a
// browser upload) - see character-customization project notes.
//
// Each slot's optionId - the string actually sent to Unity/CharacterLoadout for that slot's part
// (shown below next to its mesh name) - is auto-generated server-side to already match whatever
// Unity's own CharacterPartRegistryEditor.cs will auto-generate for that slot's Nth option
// (head001, head002, ...). That only holds if options are added in the same order on both sides,
// though, so each one also has a pencil icon to edit it directly - type in whatever Unity's
// registry is actually using for that option (see routes/characterSets.js's own
// PATCH /admin/character-sets/:id/slots/:slotId) if the two ever drift out of sync.
//
// THE FIRST SET IN THE LIST IS THE BASE LOOK, AUTOMATICALLY - the server gives its slots the "000"
// ids (head000, body000, ...) and numbers the rest 001, 002, ... in list order, so moving a set to
// the top (the arrows) makes it the base. "000" is never something Unity's own registry
// auto-generates, so Unity's SetPart() doesn't recognize it and just leaves that part showing
// whatever mesh the character prefab already starts with - the game's own default look, with zero
// Unity-side changes needed.
function AdminCharacterSets() {
  const navigate = useNavigate();

  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedUpload, setParsedUpload] = useState(null); // { glbFilename, nodeNames }
  const [newLabel, setNewLabel] = useState("");
  const [newSlotMapping, setNewSlotMapping] = useState({ Head: "", Body: "", Arm: "", Leg: "" });

  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");

  // Same editing pattern as editingId/editLabel above, but for one slot's optionId at a time -
  // keyed by "<setId>:<slotRowId>" since a set can have up to 4 editable IDs at once (one per
  // Head/Body/Arm/Leg), not just one label.
  const [editingOptionKey, setEditingOptionKey] = useState(null);
  const [editOptionIdValue, setEditOptionIdValue] = useState("");

  const token = localStorage.getItem("token");
  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchSets = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/character-sets`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to load character sets.");
        return;
      }
      setSets(Array.isArray(data) ? data.sort((a, b) => a.orderNumber - b.orderNumber) : []);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAddForm = () => {
    setShowAddForm(false);
    setParsedUpload(null);
    setNewLabel("");
    setNewSlotMapping({ Head: "", Body: "", Arm: "", Leg: "" });
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // lets the same file be re-selected after a cancel
    if (!file) return;

    setUploading(true);
    setParsedUpload(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // No Content-Type header here on purpose - the browser sets its own multipart boundary.
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/character-sets/parse-upload`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      setParsedUpload(data);
      setNewSlotMapping({ Head: "", Body: "", Arm: "", Leg: "" });
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) {
      alert("Give this character a name first.");
      return;
    }
    const slots = SLOT_NAMES.filter((slot) => newSlotMapping[slot]).map((slot) => ({
      slot,
      meshName: newSlotMapping[slot],
    }));
    if (slots.length === 0) {
      alert("Assign at least one mesh name to a slot.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/character-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ label: newLabel, glbFilename: parsedUpload.glbFilename, slots }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      resetAddForm();
      await fetchSets();
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id) => {
    if (!editLabel.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/character-sets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ label: editLabel }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      setEditingId(null);
      await fetchSets();
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // Overrides one slot's optionId directly - see PATCH /admin/character-sets/:id/slots/:slotId's
  // own header for why this exists (the auto-generated ID can drift out of sync with Unity's own
  // registry if options are ever added out of order on one side).
  const handleUpdateOptionId = async (setId, slotRowId) => {
    if (!editOptionIdValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/character-sets/${setId}/slots/${slotRowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ optionId: editOptionIdValue }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      setEditingOptionKey(null);
      await fetchSets();
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // Swaps orderNumber with whichever set is adjacent in the current (already orderNumber-sorted)
  // list - the picker and the admin list both read that same order, so this is also what controls
  // which character shows up first on the student's side.
  const handleMove = async (set, direction) => {
    const index = sets.findIndex((s) => s.id === set.id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= sets.length) return;
    const other = sets[swapIndex];

    setSaving(true);
    try {
      await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/admin/character-sets/${set.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ orderNumber: other.orderNumber }),
        }),
        fetch(`${import.meta.env.VITE_API_URL}/api/admin/character-sets/${other.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ orderNumber: set.orderNumber }),
        }),
      ]);
      await fetchSets();
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (set) => {
    if (!window.confirm(`Delete "${set.label}"? Any student who had it selected will fall back to another option.`))
      return;

    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/character-sets/${set.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      await fetchSets();
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    padding: "9px 12px",
    borderRadius: "8px",
    border: `1px solid ${colors.vaultBorder}`,
    backgroundColor: "rgba(255,255,255,0.03)",
    fontFamily: fonts.body,
    fontSize: "13px",
    color: "#EFE6D6",
    outline: "none",
  };

  const iconButtonStyle = (disabled) => ({
    background: "none",
    border: "none",
    cursor: disabled ? "default" : "pointer",
    color: disabled ? "#5D5145" : colors.brass,
    display: "flex",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />

      <div
        style={{
          position: "relative",
          display: "flex",
          minHeight: "100vh",
          backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(60,38,20,0.45), rgba(6,4,2,0.94)), url(${dashboard_bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <EmberField variant="ember" count={26} />

        <div
          style={{
            position: "relative",
            background: `linear-gradient(165deg, ${colors.wood} 0%, ${colors.obsidian} 100%)`,
            flex: 1,
            borderRadius: "24px",
            margin: "20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            border: `1px solid ${colors.vaultBorder}`,
          }}
        >
          <div style={{ padding: "40px", maxWidth: "820px" }}>
            <button
              onClick={() => navigate("/admin/dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                color: colors.brass,
                fontFamily: fonts.body,
                fontSize: "13px",
                cursor: "pointer",
                padding: 0,
                marginBottom: "18px",
              }}
            >
              <ArrowLeft size={15} /> Admin Dashboard
            </button>

            <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "30px", color: colors.brassBright, margin: "0 0 6px 0" }}>
              Character Sets
            </h1>
            <p style={{ color: "#C9BBA6", fontFamily: fonts.body, fontSize: "14px", margin: "0 0 28px 0" }}>
              The characters students can pick from on the Customize Character page. Order here is the order they're
              offered in - the first one is what a student sees before customizing anything.
            </p>

            {loading ? (
              <p style={{ fontFamily: fonts.flourish, fontSize: "16px", color: colors.brassBright }}>Loading...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {sets.map((set, i) => (
                  <div
                    key={set.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${colors.vaultBorder}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontFamily: fonts.flourish, fontSize: "13px", color: colors.ember, minWidth: "20px" }}>
                        #{i + 1}
                      </span>

                      {editingId === set.id ? (
                        <>
                          <input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            style={{ ...fieldStyle, flex: 1 }}
                            autoFocus
                          />
                          <button onClick={() => handleRename(set.id)} disabled={saving} style={iconButtonStyle(saving)} title="Save name">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditingId(null)} style={iconButtonStyle(false)} title="Cancel">
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontFamily: fonts.body, fontSize: "14px", color: "#EFE6D6", fontWeight: "600", flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                            {set.label}
                            {/* Label only - the base is simply whichever set is first (see this file's
                                header), so there's nothing to click or save here. */}
                            {i === 0 && (
                              <span
                                style={{
                                  fontFamily: fonts.body,
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  letterSpacing: "0.5px",
                                  color: colors.obsidian,
                                  background: colors.brassBright,
                                  borderRadius: "6px",
                                  padding: "2px 7px",
                                }}
                                title="First set - sends the 000 ids, so Unity keeps its own default mesh"
                              >
                                BASE
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => { setEditingId(set.id); setEditLabel(set.label); }}
                            style={iconButtonStyle(false)}
                            title="Rename"
                          >
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => handleMove(set, -1)} disabled={i === 0 || saving} style={iconButtonStyle(i === 0 || saving)} title="Move up">
                            <ArrowUp size={16} />
                          </button>
                          <button
                            onClick={() => handleMove(set, 1)}
                            disabled={i === sets.length - 1 || saving}
                            style={iconButtonStyle(i === sets.length - 1 || saving)}
                            title="Move down"
                          >
                            <ArrowDown size={16} />
                          </button>
                          <button onClick={() => handleDelete(set)} disabled={saving} style={{ ...iconButtonStyle(saving), color: saving ? "#5D5145" : colors.danger }} title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", margin: "8px 0 0 28px" }}>
                      {SLOT_NAMES.map((slot) => {
                        const match = set.slots.find((s) => s.slot === slot);
                        // Keyed by set + the slot ROW's own id (not the slot name), since a set
                        // only ever has one row per slot name but this key still has to be
                        // globally unique across every set's own slots on the page.
                        const editKey = match ? `${set.id}:${match.id}` : null;

                        return (
                          <div key={slot} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontFamily: fonts.body, fontSize: "12px", color: "#B9AC96" }}>
                              {slot}: {match ? match.meshName : "—"}
                            </span>

                            {match && (
                              editingOptionKey === editKey ? (
                                <>
                                  <input
                                    value={editOptionIdValue}
                                    onChange={(e) => setEditOptionIdValue(e.target.value)}
                                    style={{ ...fieldStyle, width: "92px", padding: "4px 8px", fontSize: "12px" }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleUpdateOptionId(set.id, match.id)}
                                    disabled={saving}
                                    style={iconButtonStyle(saving)}
                                    title="Save ID"
                                  >
                                    <Check size={13} />
                                  </button>
                                  <button onClick={() => setEditingOptionKey(null)} style={iconButtonStyle(false)} title="Cancel">
                                    <X size={13} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {/* The exact string Unity's registry has to use for this option too - see
                                      this file's own NOT HANDLED HERE note. */}
                                  <span style={{ fontFamily: fonts.body, fontSize: "12px", color: "#8A7B64" }}>
                                    (id: {match.optionId})
                                  </span>
                                  <button
                                    onClick={() => { setEditingOptionKey(editKey); setEditOptionIdValue(match.optionId); }}
                                    style={iconButtonStyle(false)}
                                    title="Edit ID - must match the ID Unity's CharacterPartRegistryAsset uses for this option"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {sets.length === 0 && (
                  <p style={{ fontFamily: fonts.body, fontSize: "13px", color: "#B9AC96", fontStyle: "italic" }}>
                    No character sets yet - add the first one below.
                  </p>
                )}
              </div>
            )}

            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  background: "none",
                  border: `1px dashed ${colors.brass}`,
                  borderRadius: "10px",
                  padding: "10px 16px",
                  color: colors.brassBright,
                  fontFamily: fonts.body,
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                + Add Character
              </button>
            ) : (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${colors.vaultBorder}`,
                }}
              >
                <p style={{ fontFamily: fonts.body, fontWeight: "600", fontSize: "14px", color: colors.brassBright, margin: "0 0 14px 0" }}>
                  Add Character
                </p>

                {!parsedUpload ? (
                  <div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        padding: "24px",
                        borderRadius: "10px",
                        border: `1px dashed ${colors.vaultBorder}`,
                        color: "#C9BBA6",
                        fontFamily: fonts.body,
                        fontSize: "13px",
                        cursor: uploading ? "default" : "pointer",
                      }}
                    >
                      <UploadCloud size={18} />
                      {uploading ? "Reading file..." : "Choose a .glb file"}
                      <input type="file" accept=".glb" onChange={handleFileSelected} disabled={uploading} style={{ display: "none" }} />
                    </label>
                    <button
                      onClick={resetAddForm}
                      style={{ marginTop: "12px", background: "none", border: "none", color: colors.brass, fontFamily: fonts.body, fontSize: "13px", cursor: "pointer", padding: 0 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontFamily: fonts.body, fontSize: "13px", color: "#C9BBA6", margin: "0 0 14px 0" }}>
                      Found {parsedUpload.nodeNames.length} named mesh{parsedUpload.nodeNames.length === 1 ? "" : "es"} in
                      the file. Assign whichever ones are this character's Head/Body/Arm/Leg below - leave a slot
                      blank if this model doesn't provide it.
                    </p>

                    <input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder='Display name (e.g. "Robot")'
                      style={{ ...fieldStyle, width: "100%", marginBottom: "14px", boxSizing: "border-box" }}
                    />

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                      {SLOT_NAMES.map((slot) => (
                        <div key={slot} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontFamily: fonts.body, fontSize: "13px", color: "#EFE6D6", width: "50px" }}>{slot}</span>
                          <select
                            value={newSlotMapping[slot]}
                            onChange={(e) => setNewSlotMapping((prev) => ({ ...prev, [slot]: e.target.value }))}
                            style={{ ...fieldStyle, flex: 1 }}
                          >
                            <option value="">— none —</option>
                            {parsedUpload.nodeNames.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: "12px" }}>
                      <button
                        onClick={resetAddForm}
                        style={{
                          flex: 1,
                          padding: "12px",
                          background: "transparent",
                          color: colors.brassBright,
                          border: `1px solid ${colors.vaultBorder}`,
                          borderRadius: "14px",
                          fontFamily: fonts.body,
                          fontWeight: "600",
                          fontSize: "14px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={saving}
                        style={{
                          flex: 1,
                          padding: "12px",
                          background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`,
                          color: "white",
                          border: "none",
                          borderRadius: "14px",
                          fontFamily: fonts.body,
                          fontWeight: "600",
                          fontSize: "14px",
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        {saving ? "Adding..." : "Add Character"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminCharacterSets;
