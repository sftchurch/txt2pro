import { useState, useEffect, useRef, useCallback } from 'react';
import { I } from './Icons';
import { T, font, fontMono } from '../theme';
import type { ClientSlide } from '../lib/types';

const proFont = `'Linux Biolinum', 'Linux Libertine', Georgia, serif`;
const transColor = "rgb(231, 142, 36)";

const origTop = (51.405 / 1080) * 100;
const origHeight = (401.233 / 1080) * 100;
const transTop = (452.638 / 1080) * 100;
const transHeight = (627.362 / 1080) * 100;

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
`;

/** Ref-based contentEditable line — avoids React overwriting user edits */
function EditableLine({ text, field, lineIdx, color, fontSize, fontWeight, editable, onUpdate, onInsertLine, onFieldFocus, onFieldBlur }: {
  text: string;
  field: 'original' | 'translation';
  lineIdx: number;
  color: string;
  fontSize: number;
  fontWeight: number;
  editable?: boolean;
  onUpdate: (field: 'original' | 'translation', lineIdx: number, text: string) => void;
  onInsertLine?: (field: 'original' | 'translation', afterLineIdx: number) => void;
  onFieldFocus: (field: 'original' | 'translation') => void;
  onFieldBlur: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const localText = useRef(text);

  // Set content on mount and when text changes from parent state
  useEffect(() => {
    if (ref.current) {
      // Only update DOM if the state value differs from what we're tracking
      if (localText.current !== text) {
        ref.current.textContent = text;
      }
      localText.current = text;
    }
  }, [text]);

  return (
    <div
      ref={el => {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        // Set initial content on mount
        if (el && !el.textContent) el.textContent = text;
      }}
      contentEditable={editable}
      suppressContentEditableWarning
      data-edit-region
      data-field={field}
      data-line-idx={lineIdx}
      onFocus={() => onFieldFocus(field)}
      onInput={() => {
        if (ref.current) localText.current = ref.current.textContent || '';
      }}
      onBlur={() => {
        const t = localText.current;
        if (t !== text) onUpdate(field, lineIdx, t);
        onFieldBlur();
      }}
      onKeyDown={editable ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          // Save current text then insert new line after this one
          const t = localText.current;
          if (t !== text) onUpdate(field, lineIdx, t);
          onInsertLine?.(field, lineIdx);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      } : undefined}
      style={{
        color, fontSize, fontWeight, textAlign: "center",
        fontFamily: proFont, lineHeight: 1.3, outline: "none",
        caretColor: editable ? "currentColor" : undefined,
        cursor: editable ? "text" : undefined,
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

interface FullscreenProps {
  slides: ClientSlide[];
  start: number;
  onClose: (editedSlides?: ClientSlide[]) => void;
  mobile: boolean;
  editable?: boolean;
}

export function Fullscreen({ slides: initialSlides, start, onClose, mobile, editable }: FullscreenProps) {
  const [i, setI] = useState(start);
  const [activeField, setActiveField] = useState<'original' | 'translation' | null>(null);
  const [slides, setSlides] = useState(() => initialSlides.map(s => ({
    original: [...s.original],
    translation: [...s.translation],
    origPt: s.origPt ?? 120,
    transPt: s.transPt ?? 100,
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

  useEffect(() => {
    const h = () => setVw(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    return () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); };
  }, []);

  const s = slides[i];
  const origPt = s.origPt;
  const transPt = s.transPt;

  const slideW = mobile ? vw - 24 : Math.min(vw * 0.82, 960);
  const slideH = slideW * 9 / 16;

  // Clamp font size so text fits within its container
  const origBoxH = slideH * origHeight / 100;
  const transBoxH = slideH * transHeight / 100;
  const origLines = Math.max(s.original.length, 1);
  const transLines = Math.max(s.translation.length, 1);
  const origFontPx = Math.min(slideH * (origPt / 1080) * 0.9, origBoxH / (origLines * 1.35));
  const transFontPx = Math.min(slideH * (transPt / 1080) * 0.9, transBoxH / (transLines * 1.35));

  const markDirty = () => { setDirty(true); dirtyRef.current = true; };

  const updateLine = useCallback((field: 'original' | 'translation', lineIdx: number, text: string) => {
    setSlides(prev => {
      const idx = i; // capture current slide index
      const updated = prev.map((sl, si) => {
        if (si !== idx) return sl;
        const u = { ...sl, [field]: [...sl[field]] };
        u[field][lineIdx] = text;
        return u;
      });
      slidesRef.current = updated;
      return updated;
    });
    markDirty();
  }, [i]);

  const addLine = useCallback((field: 'original' | 'translation', text: string) => {
    setSlides(prev => {
      const idx = i;
      const updated = prev.map((sl, si) => {
        if (si !== idx) return sl;
        return { ...sl, [field]: [...sl[field], text] };
      });
      slidesRef.current = updated;
      return updated;
    });
    markDirty();
  }, [i]);

  const insertLineAfter = useCallback((field: 'original' | 'translation', afterLineIdx: number) => {
    setSlides(prev => {
      const idx = i;
      const updated = prev.map((sl, si) => {
        if (si !== idx) return sl;
        const lines = [...sl[field]];
        lines.splice(afterLineIdx + 1, 0, '');
        return { ...sl, [field]: lines };
      });
      slidesRef.current = updated;
      return updated;
    });
    markDirty();
    // Focus the new line after React re-renders
    setTimeout(() => {
      const el = document.querySelector(`[data-field="${field}"][data-line-idx="${afterLineIdx + 1}"]`) as HTMLElement | null;
      el?.focus();
    }, 30);
  }, [i]);

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    setSlides(prev => {
      const updated = prev.filter((_, si) => si !== idx);
      slidesRef.current = updated;
      return updated;
    });
    setI(prev => idx < prev ? prev - 1 : Math.min(prev, slides.length - 2));
    markDirty();
  };

  const insertSlide = (afterIdx: number) => {
    setSlides(prev => {
      const empty = { original: [] as string[], translation: [] as string[], origPt: 120, transPt: 100 };
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

  const lineStyle = (color: string, fontSize: number, fontWeight: number): React.CSSProperties => ({
    color, fontSize, fontWeight, textAlign: "center",
    fontFamily: proFont, lineHeight: 1.3, outline: "none",
    caretColor: editable ? "currentColor" : undefined,
    cursor: editable ? "text" : undefined,
  });

  const renderPlaceholder = (field: 'original' | 'translation', color: string, fontSize: number, fontWeight: number) => (
    <div
      key={`${i}-${field}-placeholder`}
      contentEditable
      suppressContentEditableWarning
      data-edit-region
      onFocus={e => {
        handleFieldFocus(field);
        if (e.currentTarget.textContent === 'Text') {
          e.currentTarget.textContent = '';
          e.currentTarget.style.opacity = '1';
        }
      }}
      onBlur={e => {
        const t = (e.currentTarget.textContent || '').trim();
        if (t) {
          addLine(field, t);
        } else {
          e.currentTarget.textContent = 'Text';
          e.currentTarget.style.opacity = '0.3';
        }
        handleFieldBlur();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
      }}
      style={{ ...lineStyle(color, fontSize, fontWeight), opacity: 0.3 }}
    >Text</div>
  );

  const clampPt = (v: number) => Math.max(20, Math.min(300, Math.round(v)));

  const setOrigPt = (v: number) => {
    setSlides(prev => {
      const updated = prev.map((sl, si) => si !== i ? sl : { ...sl, origPt: v });
      slidesRef.current = updated;
      return updated;
    });
    markDirty();
  };

  const setTransPt = (v: number) => {
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
        <div style={{ fontFamily: fontMono, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          {i + 1} / {slides.length}
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
          {sizeControl("Main", origPt, setOrigPt)}
          {sizeControl("Trans", transPt, setTransPt)}
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
          width: mobile ? "calc(100vw - 24px)" : "min(82vw,960px)",
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

        <div data-edit-region style={{
          position: "absolute", left: 0, right: 0,
          top: `${origTop}%`, height: `${origHeight}%`,
          display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start",
          padding: `0 ${slideW * 0.031}px`, overflow: "hidden",
          border: editable && s.original.length === 0 ? '1px dashed rgba(255,255,255,0.15)' : 'none',
          borderRadius: 4,
        }}>
          {s.original.length > 0
            ? s.original.map((l, j) => (
              <EditableLine
                key={`${i}-original-${j}`}
                text={l}
                field="original"
                lineIdx={j}
                color="#fff"
                fontSize={origFontPx}
                fontWeight={700}
                editable={editable}
                onUpdate={updateLine}
                onInsertLine={insertLineAfter}
                onFieldFocus={handleFieldFocus}
                onFieldBlur={handleFieldBlur}
              />
            ))
            : editable && renderPlaceholder('original', "#fff", origFontPx, 700)}
        </div>
        <div data-edit-region style={{
          position: "absolute", left: 0, right: 0,
          top: `${transTop}%`, height: `${transHeight}%`,
          display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start",
          padding: `0 ${slideW * 0.031}px`, overflow: "hidden",
          border: editable && s.translation.length === 0 ? '1px dashed rgba(255,255,255,0.15)' : 'none',
          borderRadius: 4,
        }}>
          {s.translation.length > 0
            ? s.translation.map((l, j) => (
              <EditableLine
                key={`${i}-translation-${j}`}
                text={l}
                field="translation"
                lineIdx={j}
                color={transColor}
                fontSize={transFontPx}
                fontWeight={400}
                editable={editable}
                onUpdate={updateLine}
                onInsertLine={insertLineAfter}
                onFieldFocus={handleFieldFocus}
                onFieldBlur={handleFieldBlur}
              />
            ))
            : editable && renderPlaceholder('translation', transColor, transFontPx, 400)}
        </div>
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
        {isEditing ? "Enter to confirm \u00b7 Shift+Enter for new line \u00b7 Esc to finish" : mobile ? "Swipe to navigate" : "\u2190 \u2192 arrow keys \u00b7 Esc to close"}
      </div>
    </div>
  );
}
