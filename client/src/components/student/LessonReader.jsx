import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, FileText, Minus, PartyPopper, Play, Plus, Square, Volume2 } from "lucide-react";
import AttachmentPreviewModal from "../AttachmentPreviewModal";
import { Alert, Button, Confetti, IconButton, Modal, Segmented, Spinner } from "../ui";
import { api, errorMessage } from "../../lib/api";
import { fetchCampaignAttachment } from "../../lib/downloadCampaignAttachment";
import { canSpeak, detectLessonLanguage, fetchServerSpeech, useReaderVoices } from "../../lib/readerVoices";

// The kid-friendly lesson reader. Students open a campaign's attached file here
// and must reach the end and press "I finished reading!" before Play unlocks
// (the server records it - POST /campaigns/:id/reading/done - and the game
// refuses to load the campaign until then).
//
// Documents (.pdf/.docx/.doc/.txt) arrive as plain text from
// GET /campaigns/:id/reading and are shown as a picture-book: a few short
// sentences per page, one sentence per line, big friendly type, a progress bar
// of stars and a "Read to me" button that reads the page aloud in an American or a British (male)
// voice, picked from a 🗣️ menu (see lib/readerVoices.js), highlighting each sentence as it goes.
// Pictures are shown large; any other file opens in the normal file viewer.
//
// onFinished(campaign) runs once the read is saved; onPlay(campaign) when the
// student then presses "Let's play!".

const WORDS_PER_PAGE = 45;
const TEXT_SIZES = ["md", "lg", "xl"];

const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

const BULLET = /^\s*(?:[-*•▪◦●○■□➢➤✓✔]|\d{1,2}[.)]|[a-zA-Z][.)])\s+/;

// pdf-parse page markers ("-- 1 of 3 --"), lone page numbers and similar noise.
const isNoiseLine = (line) => /^-{1,3}\s*\d+\s*(of\s*\d+)?\s*-{1,3}$/i.test(line) || /^(page\s*)?\d{1,3}$/i.test(line);

// A short line with no closing punctuation reads as a title ("The Water Cycle").
const looksLikeHeading = (line) => wordCount(line) <= 8 && !/[.!?,;:]$/.test(line) && !BULLET.test(line) && /[A-Za-z]/.test(line);

// Words ending in "." that don't end a sentence ("Dr. Smith", "e.g. rain", "J. Rizal").
const ABBREVIATION = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt|vs|etc|e\.g|i\.e|No|Fig|[A-Z])\.$/i;

const splitSentences = (text) => {
  const sentences = [];
  let start = 0;
  const boundary = /[.!?]["”')\]]?\s+(?=["“'([]?[A-Z0-9])/g;
  for (let m = boundary.exec(text); m; m = boundary.exec(text)) {
    const end = m.index + m[0].trimEnd().length;
    if (ABBREVIATION.test(text.slice(start, end))) continue;
    sentences.push(text.slice(start, end).trim());
    start = m.index + m[0].length;
  }
  sentences.push(text.slice(start).trim());
  return sentences.filter(Boolean);
};

// Turns the lesson's raw text into blocks: { type: "heading" | "bullet" | "sentence", text }.
// Hard-wrapped PDF lines are joined back into paragraphs before splitting into sentences.
const toBlocks = (raw) => {
  const lines = String(raw || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim());

  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length === 0) return;
    for (const s of splitSentences(paragraph.join(" "))) blocks.push({ type: "sentence", text: s });
    paragraph = [];
  };

  for (const line of lines) {
    if (!line || isNoiseLine(line)) {
      flush();
      continue;
    }
    // A numbered or lettered title ("1. Introduction", "B) The Sun") is a heading, not a list item.
    const numbered = line.match(/^\s*(?:\d{1,2}|[A-Z])[.)]\s+(.*)$/);
    if (numbered && looksLikeHeading(numbered[1])) {
      flush();
      blocks.push({ type: "heading", text: numbered[1] });
      continue;
    }
    if (BULLET.test(line)) {
      flush();
      blocks.push({ type: "bullet", text: line.replace(BULLET, "") });
      continue;
    }
    if (paragraph.length === 0 && looksLikeHeading(line)) {
      blocks.push({ type: "heading", text: line });
      continue;
    }
    // A bullet's wrapped second line (it carries on mid-sentence, in lowercase) continues the bullet.
    const last = blocks[blocks.length - 1];
    if (paragraph.length === 0 && last?.type === "bullet" && !/[.!?]$/.test(last.text) && /^[a-z(,]/.test(line)) {
      last.text = `${last.text} ${line}`;
      continue;
    }
    paragraph.push(line);
  }
  flush();

  // A long bullet keeps only its first sentence on the starred line; the rest follow as sentences.
  return blocks.flatMap((b) => {
    if (b.type !== "bullet") return [b];
    const [first, ...rest] = splitSentences(b.text);
    return [{ type: "bullet", text: first || b.text }, ...rest.map((text) => ({ type: "sentence", text }))];
  });
};

// Groups blocks into small pages. A heading always starts a new page (and is never left alone at
// the bottom of one), and a page holds about WORDS_PER_PAGE words.
const toPages = (blocks) => {
  const pages = [];
  let current = [];
  let words = 0;
  const push = () => {
    if (current.some((b) => b.type !== "heading")) pages.push(current);
    else if (current.length && pages.length === 0) pages.push(current);
    current = [];
    words = 0;
  };

  for (const block of blocks) {
    const w = wordCount(block.text);
    if (block.type === "heading") {
      if (current.some((b) => b.type !== "heading")) push();
      current.push(block);
      continue;
    }
    if (words > 0 && words + w > WORDS_PER_PAGE) {
      push();
    }
    current.push(block);
    words += w;
  }
  if (current.length) {
    // Trailing headings with nothing after them join the last page.
    if (!current.some((b) => b.type !== "heading") && pages.length) pages[pages.length - 1].push(...current);
    else pages.push(current);
  }
  return pages;
};

function LessonReader({ campaign, onClose, onFinished, onPlay }) {
  const [reading, setReading] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [textSize, setTextSize] = useState(1);
  const [imageUrl, setImageUrl] = useState(null);
  const [openedFile, setOpenedFile] = useState(false);
  const [showFile, setShowFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [finished, setFinished] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(-1);
  const speakRun = useRef(0);
  const pageRef = useRef(null);
  // A lesson written in Filipino also offers (and starts with) a Filipino voice.
  const lessonLanguage = useMemo(() => (reading?.kind === "text" ? detectLessonLanguage(reading.text) : "en"), [reading]);
  const { options: voiceOptions, selected: voice, chooseVoice } = useReaderVoices(lessonLanguage);
  const [voiceError, setVoiceError] = useState("");
  // The voice in a ref, so a page that is already being read picks up a new choice.
  const voiceRef = useRef(voice);
  // The server voice's <audio> that is playing now, if any.
  const audioRef = useRef(null);
  useEffect(() => {
    voiceRef.current = voice;
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    api(`/campaigns/${campaign.id}/reading`)
      .then(async ({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(errorMessage(data, "Couldn't open the lesson"));
        setReading(data);
        if (data.kind === "image") {
          const blob = await fetchCampaignAttachment(campaign.id);
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        }
      })
      .catch((err) => !cancelled && setLoadError(err.message === "Failed to fetch" ? "Couldn't reach the server. Check your connection and try again." : err.message));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [campaign.id]);

  const pages = useMemo(() => (reading?.kind === "text" ? toPages(toBlocks(reading.text)) : []), [reading]);
  const page = pages[pageIndex] || [];
  const isLastPage = reading?.kind !== "text" || pageIndex >= pages.length - 1;
  const canFinish = reading && (reading.kind === "text" ? isLastPage : reading.kind === "image" ? !!imageUrl : openedFile);

  // ---------- Read aloud ----------
  const stopSpeaking = () => {
    speakRun.current += 1;
    if (canSpeak()) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingIndex(-1);
  };

  useEffect(() => stopSpeaking, []);

  // A device voice (the browser's speechSynthesis) says one line. `deviceVoice` null = the device default.
  const speakWithDevice = (text, deviceVoice, { onStart, onEnd, onError }) => {
    if (!canSpeak()) return onError(new Error("This browser can't read aloud"));
    const u = new SpeechSynthesisUtterance(text);
    if (deviceVoice) {
      u.voice = deviceVoice;
      u.lang = deviceVoice.lang;
    }
    u.rate = 0.9;
    u.pitch = 1.05;
    u.onstart = onStart;
    u.onend = onEnd;
    u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? null : onError(e));
    window.speechSynthesis.speak(u);
  };

  // A voice made on our server ("us" or "uk") says one line.
  const speakWithServer = async (text, serverVoice, run, { onStart, onEnd, onError }) => {
    try {
      const url = await fetchServerSpeech(text, serverVoice);
      if (run !== speakRun.current) return;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplaying = onStart;
      audio.onended = onEnd;
      audio.onerror = () => onError(new Error("Couldn't play the reading voice"));
      await audio.play();
    } catch (err) {
      if (run === speakRun.current) onError(err);
    }
  };

  // Says one line in the chosen voice. If the server voice fails, the line is read by the
  // device's own voice instead, so reading never just stops.
  const speakLine = (text, run, handlers) => {
    const v = voiceRef.current;
    if (v?.kind === "server") {
      speakWithServer(text, v.serverVoice, run, {
        ...handlers,
        onError: () => {
          if (run !== speakRun.current) return;
          setVoiceError("That voice isn't working right now, so your device's voice is reading instead.");
          speakWithDevice(text, null, handlers);
        },
      });
    } else {
      speakWithDevice(text, v?.voice || null, handlers);
    }
  };

  // Reads the page one block at a time so the line being read can be highlighted.
  const speakPage = () => {
    if (!voiceRef.current || page.length === 0) return;
    stopSpeaking();
    setVoiceError("");
    const run = speakRun.current;
    const speakFrom = (i) => {
      if (run !== speakRun.current) return;
      if (i >= page.length) {
        setSpeakingIndex(-1);
        return;
      }
      // Highlighted straight away (the server voice can take a moment to arrive), which also
      // turns the button into Stop.
      setSpeakingIndex(i);
      speakLine(page[i].text, run, {
        onStart: () => {
          if (run !== speakRun.current) return;
          // Get the next line's server audio ready while this one plays.
          if (voiceRef.current?.kind === "server" && page[i + 1]) fetchServerSpeech(page[i + 1].text, voiceRef.current.serverVoice).catch(() => {});
        },
        onEnd: () => speakFrom(i + 1),
        onError: () => run === speakRun.current && setSpeakingIndex(-1),
      });
    };
    speakFrom(0);
  };

  // Picking a voice: if the page is being read, start it again in the new voice;
  // otherwise the new voice says hello so the student can hear what it sounds like.
  const handleVoiceChange = (id) => {
    const next = voiceOptions.find((o) => o.id === id);
    if (!next) return;
    chooseVoice(id);
    voiceRef.current = next;
    if (speakingIndex >= 0) {
      speakPage();
      return;
    }
    stopSpeaking();
    setVoiceError("");
    const noop = () => {};
    const hello = id === "fil" ? "Kumusta! Sabay tayong magbasa." : "Hi! I can read with you.";
    speakLine(hello, speakRun.current, { onStart: noop, onEnd: noop, onError: noop });
  };

  const goTo = (next) => {
    stopSpeaking();
    setPageIndex(Math.max(0, Math.min(pages.length - 1, next)));
    pageRef.current?.scrollTo?.({ top: 0 });
  };

  // Arrow keys turn the pages.
  useEffect(() => {
    if (reading?.kind !== "text" || finished || showFile) return;
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight" && pageIndex < pages.length - 1) goTo(pageIndex + 1);
      if (e.key === "ArrowLeft" && pageIndex > 0) goTo(pageIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // goTo only depends on the values listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, finished, showFile, pageIndex, pages.length]);

  const handleFinish = async () => {
    stopSpeaking();
    setSaving(true);
    setSaveError("");
    try {
      const { ok, data } = await api(`/campaigns/${campaign.id}/reading/done`, { method: "POST" });
      if (!ok) throw new Error(errorMessage(data, "Couldn't save that you finished reading"));
      setFinished(true);
      onFinished?.(campaign);
    } catch (err) {
      setSaveError(err.message === "Failed to fetch" ? "Couldn't reach the server. Try again." : err.message);
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    stopSpeaking();
    onClose();
  };

  // ---------- Body ----------
  const renderBody = () => {
    if (loadError) return <Alert tone="danger" title="We couldn't open the lesson">{loadError}</Alert>;
    if (!reading)
      return (
        <p className="kid-reader__loading">
          <Spinner size={20} /> Getting your lesson ready...
        </p>
      );

    if (finished)
      return (
        <div className="kid-reader__done" role="status">
          <Confetti pieces={36} />
          <PartyPopper size={56} aria-hidden="true" />
          <p className="kid-reader__done-title">Great job, you finished reading!</p>
          <p className="kid-reader__done-text">You're ready for the adventure. Remember what you learned. It will help you solve the puzzles!</p>
        </div>
      );

    if (reading.kind === "image")
      return (
        <div className="kid-reader__picture">
          <p className="kid-reader__tip">👀 Look closely at the picture. What do you see?</p>
          {imageUrl ? <img src={imageUrl} alt={`The lesson picture: ${reading.filename}`} /> : <Spinner size={24} />}
        </div>
      );

    if (reading.kind === "file")
      return (
        <div className="kid-reader__file">
          <FileText size={48} aria-hidden="true" />
          <p className="kid-reader__done-title">Your lesson is in a file</p>
          <p className="kid-reader__done-text">
            Open it, read it carefully, then come back here and press <strong>I finished reading!</strong>
          </p>
          <Button
            variant="accent"
            size="lg"
            icon={BookOpen}
            onClick={() => {
              setShowFile(true);
              setOpenedFile(true);
            }}
          >
            Open the lesson
          </Button>
        </div>
      );

    const total = pages.length;
    return (
      <div className={`kid-reader__page kid-reader__page--${TEXT_SIZES[textSize]}`} ref={pageRef} aria-live="polite">
        <div key={pageIndex} className="kid-reader__sheet">
          {page.map((block, i) => {
            const speaking = speakingIndex === i ? "true" : undefined;
            if (block.type === "heading")
              return (
                <h3 key={i} className="kid-reader__heading" data-speaking={speaking}>
                  {block.text}
                </h3>
              );
            return (
              <p key={i} className={`kid-reader__line kid-reader__line--${block.type}`} data-speaking={speaking}>
                {block.type === "bullet" && (
                  <span className="kid-reader__star" aria-hidden="true">
                    ★
                  </span>
                )}
                {block.text}
              </p>
            );
          })}
        </div>
        {pageIndex === total - 1 && <p className="kid-reader__tip">🎉 This is the last page! Press the green button when you're done.</p>}
      </div>
    );
  };

  const total = pages.length;
  const progress = reading?.kind === "text" && total > 0 ? (pageIndex + 1) / total : null;

  const footer = finished ? (
    <div className="kid-reader__footer">
      <Button variant="secondary" onClick={close}>
        Close
      </Button>
      <Button
        variant="accent"
        size="lg"
        icon={Play}
        onClick={() => {
          close();
          onPlay?.(campaign);
        }}
        data-autofocus
      >
        Let's play!
      </Button>
    </div>
  ) : (
    <div className="kid-reader__footer">
      {reading?.kind === "text" ? (
        <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={() => goTo(pageIndex - 1)} disabled={pageIndex === 0}>
          Back
        </Button>
      ) : (
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
      )}
      {saveError && <span className="field__error" role="alert">{saveError}</span>}
      {!isLastPage ? (
        <Button variant="accent" size="lg" iconRight={ArrowRight} onClick={() => goTo(pageIndex + 1)} data-autofocus>
          Next page
        </Button>
      ) : (
        <Button variant="accent" size="lg" icon={CheckCircle2} onClick={handleFinish} loading={saving} disabled={!canFinish || saving} className="kid-reader__finish">
          I finished reading!
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Modal
        title={`📖 Let's read: ${campaign.title}`}
        description={reading?.readAt && !finished ? "You've read this before. Reading it again is a great way to remember!" : "Read the lesson first, then you can play."}
        size="lg"
        // Escape while the original file is open on top only closes the file.
        onClose={showFile ? () => setShowFile(false) : close}
        busy={saving}
        className="kid-reader"
        bodyClassName="kid-reader__body"
        footer={reading && !loadError ? footer : undefined}
      >
        {reading?.kind === "text" && !finished && (
          <div className="kid-reader__toolbar">
            <div className="kid-reader__progress" aria-label={`Page ${pageIndex + 1} of ${total}`}>
              <span className="kid-reader__page-count">
                Page {pageIndex + 1} of {total}
              </span>
              <span className="kid-reader__bar" aria-hidden="true">
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
              <span className="kid-reader__stars" aria-hidden="true">
                {pages.map((_, i) => (
                  <span key={i} data-done={i <= pageIndex || undefined}>
                    ★
                  </span>
                ))}
              </span>
            </div>
            <div className="row" style={{ "--gap": "6px" }}>
              {voiceOptions.length > 0 && (
                <Button size="sm" variant="soft" icon={speakingIndex >= 0 ? Square : Volume2} onClick={speakingIndex >= 0 ? stopSpeaking : speakPage}>
                  {speakingIndex >= 0 ? "Stop" : "Read to me"}
                </Button>
              )}
              {voiceOptions.length > 1 && (
                <Segmented
                  label="Reading voice"
                  value={voice?.id}
                  onChange={handleVoiceChange}
                  options={voiceOptions.map((o) => ({
                    value: o.id,
                    label: (
                      <span className="kid-reader__voice-option">
                        <span className="kid-reader__voice-tag" aria-hidden="true">
                          {o.tag}
                        </span>
                        {o.label}
                      </span>
                    ),
                  }))}
                />
              )}
              <IconButton size="sm" icon={Minus} label="Smaller text" onClick={() => setTextSize((s) => Math.max(0, s - 1))} disabled={textSize === 0} />
              <IconButton size="sm" icon={Plus} label="Bigger text" onClick={() => setTextSize((s) => Math.min(TEXT_SIZES.length - 1, s + 1))} disabled={textSize === TEXT_SIZES.length - 1} />
            </div>
          </div>
        )}

        {voiceError && !finished && (
          <p className="kid-reader__voice-note text-xs text-muted" role="status">
            {voiceError}
          </p>
        )}

        {renderBody()}

        {reading?.kind === "text" && !finished && (
          <p className="kid-reader__original">
            <button type="button" className="link-button" onClick={() => setShowFile(true)}>
              See the original file ({reading.filename})
            </button>
          </p>
        )}
      </Modal>

      {showFile && <AttachmentPreviewModal campaign={campaign} onClose={() => setShowFile(false)} />}
    </>
  );
}

export default LessonReader;
