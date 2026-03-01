import { useState, useEffect, useRef, useCallback } from 'react';
import { I } from './Icons';
import { T, font, fontMono } from '../theme';
import type { ClientSlide } from '../lib/types';

const proFont = `'Linux Biolinum', 'Linux Libertine', Georgia, serif`;
const transColor = "rgb(231, 142, 36)";

const origTop = (-180 / 1080) * 100;
const origHeight = (750 / 1080) * 100;
const transTop = (270 / 1080) * 100;
const transHeight = (600 / 1080) * 100;

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
function EditableLine({ text, field, lineIdx, color, fontSize, fontWeight, editable, onUpdate, onFieldFocus, onFieldBlur }: {
  text: string;
  field: 'original' | 'translation';
  lineIdx: number;
  color: string;
  fontSize: number;
  fontWeight: number;
  editable?: boolean;
  onUpdate: (field: 'original' | 'translation', lineIdx: number, text: string) => void;
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
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
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
  onClose: (editedSlides?: ClientSlide[], fontSizes?: { origPt: number; transPt: number }) => void;
  mobile: boolean;
  editable?: boolean;
  initialOrigPt?: number;
  initialTransPt?: number;
}

export function Fullscreen({ slides: initialSlides, start, onClose, mobile, editable, initialOrigPt = 120, initialTransPt = 100 }: FullscreenProps) {
  const [i, setI] = useState(start);
  const [activeField, setActiveField] = useState<'original' | 'translation' | null>(null);
  const [origPt, setOrigPt] = useState(initialOrigPt);
  const [transPt, setTransPt] = useState(initialTransPt);
  const [slides, setSlides] = useState(() => initialSlides.map(s => ({
    original: [...s.original],
    translation: [...s.translation],
  })));
  const [dirty, setDirty] = useState(false);
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const touchRef = useRef({ startX: 0, startY: 0 });
  const [vw, setVw] = useState(window.innerWidth);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEditing = activeField !== null;

  // Refs for synchronous access in handleClose
  const slidesRef = useRef(slides);
  const dirtyRef = useRef(dirty);
  const origPtRef = useRef(origPt);
  const transPtRef = useRef(transPt);

  const setOrigPtSync = (v: number) => { setOrigPt(v); origPtRef.current = v; };
  const setTransPtSync = (v: number) => { setTransPt(v); transPtRef.current = v; };

  useEffect(() => {
    const h = () => setVw(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    return () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); };
  }, []);

  const s = slides[i];

  const slideW = mobile ? vw - 24 : Math.min(vw * 0.82, 960);
  const slideH = slideW * 9 / 16;
  const origFontPx = slideH * (origPt / 1080);
  const transFontPx = slideH * (transPt / 1080);

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
      const empty: ClientSlide = { original: [], translation: [] };
      const updated = [...prev.slice(0, afterIdx + 1), empty, ...prev.slice(afterIdx + 1)];
      slidesRef.current = updated;
      return updated;
    });
    setI(afterIdx + 1);
    setActiveField('original');
    markDirty();
  };

  const handleClose = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Small delay to let blur handlers save text before reading refs
    setTimeout(() => {
      setActiveField(null);
      const fontSizes = { origPt: origPtRef.current, transPt: transPtRef.current };
      onClose(dirtyRef.current ? slidesRef.current : undefined, fontSizes);
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
    setI(idx);
  }, []);

  const handleFieldFocus = useCallback((field: 'original' | 'translation') => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setActiveField(field);
  }, []);

  const handleFieldBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => {
      const active = document.activeElement;
      if (!active || !active.closest('[data-edit-region]')) {
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
        <div style={{
          position: "absolute", top: mobile ? 54 : 66, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 3,
          animation: "fi .15s ease",
        }}>
          {sizeControl("Main", origPt, setOrigPtSync)}
          {sizeControl("Trans", transPt, setTransPtSync)}
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
          <button onClick={() => deleteSlide(i)} style={{
            position: "absolute", top: 8, left: 8, zIndex: 4,
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(255,60,60,0.8)", border: "none",
            color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fi .15s ease",
          }}><I.X s={12} /></button>
        )}

        <div data-edit-region style={{
          position: "absolute", left: 0, right: 0,
          top: `${origTop}%`, height: `${origHeight}%`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: `0 ${slideW * 0.031}px`,
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
                onFieldFocus={handleFieldFocus}
                onFieldBlur={handleFieldBlur}
              />
            ))
            : editable && renderPlaceholder('original', "#fff", origFontPx, 700)}
        </div>
        <div data-edit-region style={{
          position: "absolute", left: 0, right: 0,
          top: `${transTop}%`, height: `${transHeight}%`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: `0 ${slideW * 0.031}px`,
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
                onFieldFocus={handleFieldFocus}
                onFieldBlur={handleFieldBlur}
              />
            ))
            : editable && renderPlaceholder('translation', transColor, transFontPx, 400)}
        </div>
      </div>

      {/* Navigation dots with insert zones */}
      <div style={{ display: "flex", alignItems: "center", gap: mobile ? 12 : 16, marginTop: mobile ? 16 : 24 }}>
        {!mobile && (
          <button onClick={() => goToSlide(Math.max(0, i - 1))} disabled={i === 0} style={{
            width: 44, height: 44, borderRadius: "50%",
            background: i === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: i === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
            cursor: i === 0 ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><I.Left /></button>
        )}
        <div style={{ display: "flex", gap: mobile ? 5 : 6, flexWrap: "wrap", justifyContent: "center", maxWidth: mobile ? "70vw" : "auto", alignItems: "center" }}>
          {slides.map((_, j) => (
            <div key={j} style={{ display: "flex", alignItems: "center", gap: mobile ? 5 : 6 }}>
              {j === 0 && !mobile && editable && <InsertZone onClick={() => insertSlide(-1)} />}
              <button onClick={() => goToSlide(j)} style={{
                width: j === i ? (mobile ? 18 : 22) : (mobile ? 6 : 8),
                height: mobile ? 6 : 8, borderRadius: 4,
                background: j === i ? T.primary : "rgba(255,255,255,0.2)",
                border: "none", cursor: "pointer", transition: "all .2s ease", padding: 0,
              }} />
              {!mobile && editable && <InsertZone onClick={() => insertSlide(j)} />}
            </div>
          ))}
        </div>
        {!mobile && (
          <button onClick={() => goToSlide(Math.min(slides.length - 1, i + 1))} disabled={i === slides.length - 1} style={{
            width: 44, height: 44, borderRadius: "50%",
            background: i === slides.length - 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: i === slides.length - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
            cursor: i === slides.length - 1 ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><I.Right /></button>
        )}
      </div>

      {/* Mobile: Add/Delete buttons */}
      {mobile && editable && (
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button onClick={() => insertSlide(i)} style={{
            height: 32, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
            cursor: "pointer", padding: "0 16px", fontSize: 12, fontFamily: font,
            display: "flex", alignItems: "center", gap: 5,
          }}><I.Plus s={11} /> Add slide</button>
          {slides.length > 1 && (
            <button onClick={() => deleteSlide(i)} style={{
              height: 32, borderRadius: 16, border: "1px solid rgba(255,60,60,0.25)",
              background: "rgba(255,60,60,0.08)", color: "rgba(255,100,100,0.8)",
              cursor: "pointer", padding: "0 16px", fontSize: 12, fontFamily: font,
              display: "flex", alignItems: "center", gap: 5,
            }}><I.X s={11} /> Delete slide</button>
          )}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: font }}>
        {isEditing ? "Click text to edit \u00b7 Enter to confirm \u00b7 Esc to finish" : mobile ? "Swipe to navigate" : "\u2190 \u2192 arrow keys \u00b7 Esc to close"}
      </div>
    </div>
  );
}
