import { useState, useEffect, useRef, useCallback } from 'react';
import { I } from './Icons';
import { T, font, fontMono } from '../theme';
import type { ClientSlide } from '../lib/types';
import { CanvasLayer, SlideBox, slideTextStyle, resolveTemplate, boxColor } from './SlideCanvas';

const pill = (active?: boolean): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: "50%",
  background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
  border: `1px solid ${active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)"}`,
  color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, WebkitTapHighlightColor: "transparent",
});

const sBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: "50%", border: "none",
  background: "transparent", color: "rgba(255,255,255,0.5)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
};

// Hide native number spinners
const spinnerCSS = `
  input[type=number].pt-input::-webkit-outer-spin-button,
  input[type=number].pt-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  input[type=number].pt-input{-moz-appearance:textfield}
  [data-placeholder="true"]:empty::before{content:"Text";opacity:0.3}
  [data-placeholder="true"]:focus::before{content:none}
`;

/** Single contentEditable block per field — natural text editing with line breaks */
function EditableBlock({ lines, field, color, fontSize, fontFamily, lineHeight, ghost, editable, onUpdate, onLive, onFieldFocus, onFieldBlur }: {
  lines: string[];
  field: 'original' | 'translation';
  color: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  // In a merged single-box template an empty secondary field must take no
  // vertical space, or it would shift the middle-aligned text off-center
  ghost?: boolean;
  editable?: boolean;
  onUpdate: (field: 'original' | 'translation', lines: string[]) => void;
  onLive: (field: 'original' | 'translation', lines: string[]) => void;
  onFieldFocus: (field: 'original' | 'translation') => void;
  onFieldBlur: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const localText = useRef(lines.join('\n'));

  useEffect(() => {
    if (ref.current) {
      const joined = lines.join('\n');
      if (localText.current !== joined) {
        ref.current.innerText = joined;
        localText.current = joined;
      }
    }
  }, [lines]);

  const isEmpty = lines.length === 0;

  return (
    <div
      ref={el => {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (el && el.innerText === '' && lines.length > 0) {
          el.innerText = lines.join('\n');
        }
      }}
      contentEditable={editable}
      suppressContentEditableWarning
      data-edit-region
      data-field={field}
      data-placeholder={isEmpty && !ghost ? 'true' : undefined}
      onFocus={() => {
        onFieldFocus(field);
        if (isEmpty && ref.current) {
          ref.current.innerText = '';
          localText.current = '';
        }
      }}
      onInput={() => {
        if (ref.current) {
          localText.current = ref.current.innerText || '';
          onLive(field, localText.current.replace(/\r\n/g, '\n').split('\n'));
        }
      }}
      onBlur={() => {
        const text = (localText.current || '').replace(/\r\n/g, '\n');
        const newLines = text.split('\n');
        // Trim trailing empty lines
        while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
          newLines.pop();
        }
        onUpdate(field, newLines);
        onFieldBlur();
      }}
      style={{
        ...slideTextStyle(color, fontSize, fontFamily, lineHeight),
        outline: "none",
        caretColor: editable ? "currentColor" : undefined,
        cursor: editable ? "text" : undefined,
        opacity: isEmpty && !editable ? 0 : undefined,
        minHeight: editable && isEmpty && !ghost ? '1.3em' : undefined,
      }}
    />
  );
}

function InsertZone({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: hovered ? 20 : 6, height: hovered ? 20 : 6,
        borderRadius: "50%", border: "none", padding: 0,
        background: hovered ? T.primary : "rgba(255,255,255,0.12)",
        color: "#fff", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .2s ease",
      }}
    >
      {hovered && <I.Plus s={12} />}
    </button>
  );
}

// Editable slide state — pts stay unset until the user touches the controls
type SlideSnap = { original: string[]; translation: string[]; label?: string; origPt?: number; transPt?: number };

interface FullscreenProps {
  slides: ClientSlide[];
  start: number;
  onClose: (editedSlides?: ClientSlide[]) => void;
  mobile: boolean;
  editable?: boolean;
  // Slide template for every slide, or per-slide when previewing mixed songs
  template?: string;
  perSlideTemplates?: (string | undefined)[];
  // Live autosave: fires when an edit is committed (blur, delete, insert, reorder, font)
  onChange?: (slides: ClientSlide[]) => void;
  // Synchronous flush on refresh / backgrounding — captures the focused, still-being-typed field
  onFlush?: (slides: ClientSlide[]) => void;
  saveStatus?: 'saving' | 'saved' | null;
}

export function Fullscreen({ slides: initialSlides, start, onClose, mobile, editable, template, perSlideTemplates, onChange, onFlush, saveStatus }: FullscreenProps) {
  const [i, setI] = useState(start);
  const [activeField, setActiveField] = useState<'original' | 'translation' | null>(null);
  // origPt/transPt stay unset until the user touches the size controls, so the
  // template's defaults keep applying (and template switches don't inherit
  // stale sizes)
  const [slides, setSlides] = useState<SlideSnap[]>(() => initialSlides.map(s => ({
    original: [...s.original],
    translation: [...s.translation],
    label: s.label,
    origPt: s.origPt,
    transPt: s.transPt,
  })));
  const [dirty, setDirty] = useState(false);
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragSlideIdx, setDragSlideIdx] = useState<number | null>(null);
  const [dropSlideIdx, setDropSlideIdx] = useState<number | null>(null);
  const touchRef = useRef({ startX: 0, startY: 0 });
  const [vw, setVw] = useState(window.innerWidth);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEditing = activeField !== null;

  // Refs for synchronous access in handleClose
  const slidesRef = useRef(slides);
  const dirtyRef = useRef(dirty);

  // Undo/redo history — snapshots of the full slide set taken before each edit
  const cloneSlides = (sl: SlideSnap[]): SlideSnap[] =>
    sl.map(s => ({ original: [...s.original], translation: [...s.translation], label: s.label, origPt: s.origPt, transPt: s.transPt }));
  const undoRef = useRef<SlideSnap[][]>([]);
  const redoRef = useRef<SlideSnap[][]>([]);
  const [, bumpHist] = useState(0);

  // Snapshot the current slides onto the undo stack before a mutation
  const pushHistory = () => {
    undoRef.current.push(cloneSlides(slidesRef.current));
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    bumpHist(v => v + 1);
  };

  const applySnapshot = (snap: SlideSnap[]) => {
    slidesRef.current = snap;
    setSlides(snap);
    setI(ci => Math.min(ci, snap.length - 1));
    setDirty(true); dirtyRef.current = true;
    bumpHist(v => v + 1);
  };

  const undo = () => {
    if (undoRef.current.length === 0) return;
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setActiveField(null);
    redoRef.current.push(cloneSlides(slidesRef.current));
    applySnapshot(undoRef.current.pop()!);
  };

  const redo = () => {
    if (redoRef.current.length === 0) return;
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setActiveField(null);
    undoRef.current.push(cloneSlides(slidesRef.current));
    applySnapshot(redoRef.current.pop()!);
  };

  useEffect(() => {
    const h = () => setVw(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    return () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); };
  }, []);

  const s = slides[i];

  // Resolve the slide template: per-slide when previewing across songs,
  // otherwise the single template for the song being edited
  const def = resolveTemplate(perSlideTemplates?.[i] ?? template);
  const origBox = def.boxes.find(b => b.fields.includes('original')) ?? def.boxes[0];
  const transBox = def.boxes.find(b => !b.fields.includes('original') && b.fields.includes('translation'));
  const merged = !transBox; // single-box template: translation follows the main size

  const origPt = s.origPt ?? origBox.style.fontSize;
  const transPt = s.transPt ?? transBox?.style.fontSize ?? origBox.style.fontSize;

  const slideW = mobile ? vw - 24 : Math.min(vw * 0.82, 960);

  // Text lays out on the shared 1920×1080 canvas (font px = pt, exactly like the
  // export, scale_behavior NONE — oversize text clips, never shrinks); the whole
  // canvas is then scaled to slideW for display

  // Flag boxes whose text overruns vertically (it will be cut off in ProPresenter)
  const boxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [overflow, setOverflow] = useState<boolean[]>([]);
  useEffect(() => {
    const check = () => setOverflow(def.boxes.map((_, bi) => {
      const el = boxRefs.current[bi];
      return !!el && el.scrollHeight > el.clientHeight + 1;
    }));
    check();
    // Re-check once the webfont is in — metrics change wrap and content height
    document.fonts?.ready.then(check);
  }, [i, slides, origPt, transPt, def]);

  const markDirty = () => { setDirty(true); dirtyRef.current = true; };

  // Keep latest callbacks in refs so the unload listener never goes stale
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;
  const mountedRef = useRef(false);

  // Propagate committed edits up so they autosave as a draft without closing the editor
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    onChangeRef.current?.(slides);
  }, [slides]);

  // On refresh / tab close / backgrounding, synchronously capture the field that's
  // still being typed (React state/effects won't flush before the page unloads)
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      let current = slidesRef.current;
      const el = document.activeElement as HTMLElement | null;
      if (el && el.hasAttribute('data-edit-region')) {
        const field = el.getAttribute('data-field') as 'original' | 'translation' | null;
        if (field) {
          const liveLines = (el.innerText || '').replace(/\r\n/g, '\n').split('\n');
          while (liveLines.length && liveLines[liveLines.length - 1].trim() === '') liveLines.pop();
          current = current.map((sl, si) => si === i ? { ...sl, [field]: liveLines } : sl);
        }
      }
      onFlushRef.current?.(current);
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [i]);

  // Live typing only marks the draft dirty (so flush/close save it). The actual text is
  // committed to state on blur; the unload flush reads the focused field straight from the DOM.
  const liveEdit = useCallback(() => { markDirty(); }, []);

  const updateField = useCallback((field: 'original' | 'translation', lines: string[]) => {
    // Skip if the text is unchanged (blur fires even when nothing was edited)
    const cur = slidesRef.current[i];
    if (cur && cur[field].length === lines.length && cur[field].every((l, k) => l === lines[k])) return;
    pushHistory();
    setSlides(prev => {
      const idx = i;
      const updated = prev.map((sl, si) => si !== idx ? sl : { ...sl, [field]: lines });
      slidesRef.current = updated;
      return updated;
    });
    markDirty();
  }, [i]);

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    pushHistory();
    setSlides(prev => {
      const updated = prev.filter((_, si) => si !== idx);
      slidesRef.current = updated;
      return updated;
    });
    setI(prev => idx < prev ? prev - 1 : Math.min(prev, slides.length - 2));
    markDirty();
  };

  const insertSlide = (afterIdx: number) => {
    pushHistory();
    setSlides(prev => {
      const empty: SlideSnap = { original: [], translation: [] };
      const updated = [...prev.slice(0, afterIdx + 1), empty, ...prev.slice(afterIdx + 1)];
      slidesRef.current = updated;
      return updated;
    });
    setI(afterIdx + 1);
    setActiveField('original');
    markDirty();
  };

  const reorderSlide = (from: number, to: number) => {
    if (from === to) return;
    pushHistory();
    setSlides(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      slidesRef.current = updated;
      return updated;
    });
    // Adjust current slide index to follow the viewed slide
    if (from === i) {
      setI(to);
    } else if (from < i && to >= i) {
      setI(i - 1);
    } else if (from > i && to <= i) {
      setI(i + 1);
    }
    markDirty();
  };

  const moveSlide = (dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= slides.length) return;
    reorderSlide(i, to);
  };

  const handleClose = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Small delay to let blur handlers save text before reading refs
    setTimeout(() => {
      setActiveField(null);
      onClose(dirtyRef.current ? slidesRef.current : undefined);
    }, 10);
  }, [onClose]);

  const handleDone = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setActiveField(null);
  };

  const goToSlide = useCallback((idx: number) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setActiveField(null);
    setConfirmDelete(false);
    setI(idx);
  }, []);

  const handleFieldFocus = useCallback((field: 'original' | 'translation') => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setActiveField(field);
  }, []);

  const handleFieldBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => {
      const active = document.activeElement;
      if (!active || (!active.closest('[data-edit-region]') && !active.closest('[data-edit-toolbar]'))) {
        setActiveField(null);
      }
    }, 100);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // While actively typing in a field, let the browser handle native text undo
      if (isEditing && e.key !== "Escape") return;
      if (e.key === "Escape") {
        if (isEditing) {
          e.preventDefault();
          handleDone();
        } else {
          handleClose();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      // Number keys 1-9 jump to that slide (only when not typing in a field)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const target = Number(e.key) - 1;
        if (target < slides.length) { e.preventDefault(); goToSlide(target); }
        return;
      }
      if (e.key === "ArrowRight") goToSlide(Math.min(slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") goToSlide(Math.max(0, i - 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [slides.length, handleClose, isEditing, goToSlide, i]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isEditing) return;
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  }, [isEditing]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isEditing) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goToSlide(Math.min(slides.length - 1, i + 1));
      else goToSlide(Math.max(0, i - 1));
    }
  }, [slides.length, isEditing, goToSlide, i]);

  const clampPt = (v: number) => Math.max(20, Math.min(300, Math.round(v)));

  const setOrigPt = (v: number) => {
    pushHistory();
    setSlides(prev => {
      const updated = prev.map((sl, si) => si !== i ? sl : { ...sl, origPt: v });
      slidesRef.current = updated;
      return updated;
    });
    markDirty();
  };

  const setTransPt = (v: number) => {
    pushHistory();
    setSlides(prev => {
      const updated = prev.map((sl, si) => si !== i ? sl : { ...sl, transPt: v });
      slidesRef.current = updated;
      return updated;
    });
    markDirty();
  };

  const sizeControl = (label: string, value: number, set: (v: number) => void) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 1, background: "rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "2px 4px",
    }}>
      <button onClick={() => set(clampPt(value - 5))} style={sBtn}><I.Minus s={10} /></button>
      <input
        type="number"
        className="pt-input"
        value={value}
        onChange={e => set(clampPt(Number(e.target.value) || value))}
        onKeyDown={e => e.stopPropagation()}
        style={{
          width: 38, background: "transparent", border: "none", outline: "none",
          color: "rgba(255,255,255,0.6)", fontFamily: fontMono,
          fontSize: 11, textAlign: "center", padding: 0,
        }}
      />
      <button onClick={() => set(clampPt(value + 5))} style={sBtn}><I.Plus s={10} /></button>
      {!mobile && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", paddingRight: 6 }}>{label}</span>}
    </div>
  );

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{
      position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.95)",
      backdropFilter: "blur(24px)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", animation: "fi .2s ease",
      padding: mobile ? 12 : 20,
    }}>
      <style>{spinnerCSS}</style>

      {/* Top bar */}
      <div style={{
        position: "absolute", top: mobile ? 12 : 20, left: mobile ? 12 : 20, right: mobile ? 12 : 20,
        display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: fontMono, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            {i + 1} / {slides.length}
          </div>
          {editable && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={undo}
                disabled={undoRef.current.length === 0}
                title="Undo (Cmd/Ctrl+Z)"
                style={{
                  ...pill(), width: 32, height: 32,
                  opacity: undoRef.current.length === 0 ? 0.3 : 1,
                  cursor: undoRef.current.length === 0 ? "default" : "pointer",
                }}
              ><I.Undo s={14} /></button>
              <button
                onClick={redo}
                disabled={redoRef.current.length === 0}
                title="Redo (Cmd/Ctrl+Shift+Z)"
                style={{
                  ...pill(), width: 32, height: 32,
                  opacity: redoRef.current.length === 0 ? 0.3 : 1,
                  cursor: redoRef.current.length === 0 ? "default" : "pointer",
                  transform: "scaleX(-1)",
                }}
              ><I.Undo s={14} /></button>
            </div>
          )}
          {editable && saveStatus && (
            <span style={{
              display: "flex", alignItems: "center", gap: 3, fontSize: 11,
              color: saveStatus === 'saved' ? "rgba(120,230,180,0.9)" : "rgba(255,255,255,0.4)",
            }}>
              {saveStatus === 'saved' ? <I.Check s={11} /> : null}
              {saveStatus === 'saved' ? 'Saved' : 'Saving…'}
            </span>
          )}
        </div>
        <button onClick={handleClose} style={pill()}><I.X s={15} /></button>
      </div>

      {/* Floating edit toolbar */}
      {isEditing && (
        <div data-edit-toolbar style={{
          position: "absolute", top: mobile ? 54 : 66, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 3,
          animation: "fi .15s ease",
        }}>
          {sizeControl(merged ? "Size" : "Main", origPt, setOrigPt)}
          {!merged && sizeControl("Trans", transPt, setTransPt)}
          <button onClick={handleDone} style={{
            height: 28, borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)",
            cursor: "pointer", padding: "0 14px", fontSize: 12, fontFamily: font,
          }}>Done</button>
        </div>
      )}

      {/* Slide */}
      <div
        key={i}
        onMouseEnter={() => { if (!mobile && editable) setShowDeleteBtn(true); }}
        onMouseLeave={() => setShowDeleteBtn(false)}
        style={{
          width: slideW,
          aspectRatio: "16/9", background: "#000", borderRadius: mobile ? 12 : 16,
          position: "relative", overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.06)",
          animation: "si .25s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {!mobile && showDeleteBtn && slides.length > 1 && (
          confirmDelete ? (
            <button onClick={() => { deleteSlide(i); setConfirmDelete(false); }} style={{
              position: "absolute", top: 8, left: 8, zIndex: 4,
              height: 28, borderRadius: 14, padding: "0 12px",
              background: "rgba(255,60,60,0.9)", border: "none",
              color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: font,
              display: "flex", alignItems: "center", gap: 4,
              animation: "fi .15s ease",
            }}>Delete?</button>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              position: "absolute", top: 8, left: 8, zIndex: 4,
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(255,60,60,0.8)", border: "none",
              color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "fi .15s ease",
            }}><I.X s={12} /></button>
          )
        )}

        <CanvasLayer width={slideW}>
          {def.boxes.map((box, bi) => {
            const boxEmpty = box.fields.every(f => (f === 'original' ? s.original : s.translation).length === 0);
            return (
              <SlideBox
                key={box.name}
                ref={el => { boxRefs.current[bi] = el; }}
                box={box}
                border={editable && boxEmpty ? '2px dashed rgba(255,255,255,0.15)' : undefined}
              >
                {overflow[bi] && <div title="Text exceeds its box and will be cut off in ProPresenter" style={{
                  position: "absolute", left: 0, right: 0, bottom: 0, height: 4,
                  background: "rgba(255,70,70,0.8)", zIndex: 1,
                }} />}
                {box.fields.map(field => (
                  <EditableBlock
                    key={`${i}-${field}`}
                    lines={field === 'original' ? s.original : s.translation}
                    field={field}
                    color={boxColor(box)}
                    fontSize={field === 'original' || merged ? origPt : transPt}
                    fontFamily={box.cssFontStack}
                    lineHeight={box.previewLineHeight}
                    ghost={box.fields.length > 1 && field !== 'original'}
                    editable={editable}
                    onUpdate={updateField}
                    onLive={liveEdit}
                    onFieldFocus={handleFieldFocus}
                    onFieldBlur={handleFieldBlur}
                  />
                ))}
              </SlideBox>
            );
          })}
        </CanvasLayer>
      </div>

      {/* Slide filmstrip — draggable numbered chips */}
      <div style={{ display: "flex", alignItems: "center", gap: mobile ? 8 : 12, marginTop: mobile ? 14 : 20 }}>
        {!mobile && (
          <button onClick={() => goToSlide(Math.max(0, i - 1))} disabled={i === 0} style={{
            width: 36, height: 36, borderRadius: "50%",
            background: i === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: i === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
            cursor: i === 0 ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><I.Left /></button>
        )}
        <div style={{
          display: "flex", gap: mobile ? 6 : 8, overflowX: "auto",
          maxWidth: mobile ? "78vw" : "min(60vw, 700px)",
          padding: "4px 2px", alignItems: "center",
          WebkitOverflowScrolling: "touch",
        }}>
          {slides.map((_, j) => (
            <div key={j} style={{ display: "flex", alignItems: "center", gap: mobile ? 6 : 8 }}>
              {j === 0 && !mobile && editable && dragSlideIdx === null && <InsertZone onClick={() => insertSlide(-1)} />}
              <button
                draggable={!!editable && slides.length > 1}
                onClick={() => { if (dragSlideIdx === null) goToSlide(j); }}
                onDragStart={editable ? (e) => {
                  setDragSlideIdx(j);
                  e.dataTransfer.effectAllowed = 'move';
                } : undefined}
                onDragOver={editable ? (e) => {
                  e.preventDefault();
                  if (dragSlideIdx !== null && dragSlideIdx !== j) setDropSlideIdx(j);
                } : undefined}
                onDrop={editable ? () => {
                  if (dragSlideIdx !== null && dropSlideIdx !== null) reorderSlide(dragSlideIdx, dropSlideIdx);
                  setDragSlideIdx(null); setDropSlideIdx(null);
                } : undefined}
                onDragEnd={editable ? () => {
                  setDragSlideIdx(null); setDropSlideIdx(null);
                } : undefined}
                style={{
                  minWidth: mobile ? 28 : 32, height: mobile ? 22 : 26,
                  borderRadius: 6, flexShrink: 0,
                  background: j === i ? T.primary : dropSlideIdx === j ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.1)",
                  border: dropSlideIdx === j ? `2px solid ${T.primary}` : j === i ? "none" : "1px solid rgba(255,255,255,0.12)",
                  color: j === i ? "#fff" : "rgba(255,255,255,0.5)",
                  cursor: editable && slides.length > 1 ? "grab" : "pointer",
                  transition: "all .15s ease", padding: "0 6px",
                  opacity: dragSlideIdx === j ? 0.3 : 1,
                  fontSize: mobile ? 10 : 11, fontWeight: 700, fontFamily: fontMono,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >{j + 1}</button>
              {!mobile && editable && dragSlideIdx === null && <InsertZone onClick={() => insertSlide(j)} />}
            </div>
          ))}
        </div>
        {!mobile && (
          <button onClick={() => goToSlide(Math.min(slides.length - 1, i + 1))} disabled={i === slides.length - 1} style={{
            width: 36, height: 36, borderRadius: "50%",
            background: i === slides.length - 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: i === slides.length - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
            cursor: i === slides.length - 1 ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><I.Right /></button>
        )}
      </div>

      {/* Mobile: Move/Add/Delete buttons */}
      {mobile && editable && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {slides.length > 1 && (
            <>
              <button disabled={i === 0} onClick={() => moveSlide(-1)} style={{
                height: 32, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)",
                background: i === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
                color: i === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
                cursor: i === 0 ? "default" : "pointer", padding: "0 12px", fontSize: 12, fontFamily: font,
                display: "flex", alignItems: "center", gap: 4,
              }}><I.Left s={11} /> Move</button>
              <button disabled={i === slides.length - 1} onClick={() => moveSlide(1)} style={{
                height: 32, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)",
                background: i === slides.length - 1 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
                color: i === slides.length - 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
                cursor: i === slides.length - 1 ? "default" : "pointer", padding: "0 12px", fontSize: 12, fontFamily: font,
                display: "flex", alignItems: "center", gap: 4,
              }}>Move <I.Right s={11} /></button>
            </>
          )}
          <button onClick={() => insertSlide(i)} style={{
            height: 32, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
            cursor: "pointer", padding: "0 12px", fontSize: 12, fontFamily: font,
            display: "flex", alignItems: "center", gap: 4,
          }}><I.Plus s={11} /> Add</button>
          {slides.length > 1 && (
            confirmDelete ? (
              <button onClick={() => { deleteSlide(i); setConfirmDelete(false); }} style={{
                height: 32, borderRadius: 16, border: "1px solid rgba(255,60,60,0.4)",
                background: "rgba(255,60,60,0.15)", color: "rgba(255,100,100,0.9)",
                cursor: "pointer", padding: "0 14px", fontSize: 12, fontWeight: 600, fontFamily: font,
                display: "flex", alignItems: "center", gap: 4,
                animation: "fi .15s ease",
              }}>Delete?</button>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{
                height: 32, borderRadius: 16, border: "1px solid rgba(255,60,60,0.25)",
                background: "rgba(255,60,60,0.08)", color: "rgba(255,100,100,0.8)",
                cursor: "pointer", padding: "0 12px", fontSize: 12, fontFamily: font,
                display: "flex", alignItems: "center", gap: 4,
              }}><I.X s={11} /> Delete</button>
            )
          )}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: font }}>
        {isEditing ? "Tap text to edit \u00b7 Esc to finish" : mobile ? "Swipe to navigate" : "\u2190 \u2192 arrow keys \u00b7 Esc to close"}
      </div>
    </div>
  );
}
