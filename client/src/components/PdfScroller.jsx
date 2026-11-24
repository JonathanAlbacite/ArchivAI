import { useEffect, useRef, useState } from "react";

// A PDF drawn with pdf.js as a scrolling column of pages. Used instead of the browser's own PDF
// viewer when the page needs to know how far the reader has scrolled (the built-in viewer hides
// its scroll position). onScroll(scrollBox) runs once every page has its full height and on each scroll.
function PdfScroller({ url, title, onScroll }) {
  const boxRef = useRef(null);
  const pagesRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    const holder = pagesRef.current;

    (async () => {
      try {
        // Loaded on demand - only someone opening a PDF lesson pays for it.
        const pdfjs = await import("pdfjs-dist");
        const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        loadingTask = pdfjs.getDocument({ url });
        const doc = await loadingTask.promise;
        // Closed while it was loading: the cleanup ran before the task existed, so free it here.
        if (cancelled) return loadingTask.destroy().catch(() => {});

        const width = Math.min(900, (boxRef.current?.clientWidth || 900) - 24);
        const dpr = Math.min(2, window.devicePixelRatio || 1);

        // Every page gets its full size first, so the scroll height is right before anything is
        // drawn (otherwise a half-loaded file would look "scrolled to the end").
        const pages = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const scale = width / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${width}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          canvas.setAttribute("aria-label", `${title}, page ${n} of ${doc.numPages}`);
          canvas.setAttribute("role", "img");
          canvas.className = "pdf-scroller__page";
          holder.appendChild(canvas);
          pages.push({ page, canvas, viewport });
        }
        setReady(true);

        for (const { page, canvas, viewport } of pages) {
          if (cancelled) return;
          await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Couldn't open this PDF.");
      }
    })();

    return () => {
      cancelled = true;
      holder.replaceChildren();
      // The loading task owns the document and its worker (pdf.js 6 has no destroy() on the document).
      // Never let cleanup throw - an error here would blank the whole page.
      Promise.resolve()
        .then(() => loadingTask?.destroy())
        .catch(() => {});
    };
  }, [url, title]);

  useEffect(() => {
    if (ready && boxRef.current) onScroll?.(boxRef.current);
    // onScroll is a fresh function each render; this only needs to run when the pages are laid out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div ref={boxRef} className="pdf-scroller" onScroll={(e) => ready && onScroll?.(e.currentTarget)}>
      {error && <p className="pdf-scroller__note pdf-scroller__note--error">{error}</p>}
      {!ready && !error && <p className="pdf-scroller__note">Opening the file...</p>}
      <div ref={pagesRef} className="pdf-scroller__pages" />
    </div>
  );
}

export default PdfScroller;
