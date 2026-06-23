import { useState, useEffect, useCallback, useRef } from 'react';
import { useWidth } from './hooks/useWidth';
import { useDarkMode } from './hooks/useDarkMode';
import { T, font, applyScheme, pageBase, container, globalCSS } from './theme';
import { I } from './components/Icons';
import { ServiceList } from './components/ServiceList';
import { EditorHeader } from './components/EditorHeader';
import { VersionHistory } from './components/VersionHistory';
import { SuccessBanner } from './components/SuccessBanner';
import { DropZone } from './components/DropZone';
import { SongList } from './components/SongList';
import { PublishBar } from './components/PublishBar';
import { PublishModal } from './components/PublishModal';
import { Fullscreen } from './components/Fullscreen';
import { fetchLyrics, fetchService } from './lib/api';
import { slidesToFile, saveDraft, loadDraft, removeDraft, draftToSongs } from './lib/draft';
import type { Service, ClientSong, ClientSlide, PublishResult } from './lib/types';

type View = 'services' | 'editor';

interface FsState {
  slides: ClientSlide[];
  start: number;
  songIndex?: number;
}

// Convert lyrics API data into ClientSong[] for display
function lyricsToSongs(lyrics: { title: string; filename: string; slides: { original: string[]; translation: string[]; origPt?: number; transPt?: number }[] }[]): ClientSong[] {
  return lyrics.map(song => {
    const slides = song.slides.map(s => ({
      original: s.original,
      translation: s.translation,
      ...(s.origPt ? { origPt: s.origPt } : {}),
      ...(s.transPt ? { transPt: s.transPt } : {}),
    }));
    return {
      title: song.title,
      filename: song.filename,
      file: slidesToFile(slides, song.filename),
      ok: true,
      warn: null,
      count: song.slides.length,
      slides,
    };
  });
}

// Parse service ID from URL path like /service/:id
function getServiceIdFromUrl(): string | null {
  const m = window.location.pathname.match(/^\/service\/([^/]+)/);
  return m ? m[1] : null;
}

export default function App() {
  const dark = useDarkMode();
  applyScheme(dark);

  const screenW = useWidth();
  const mob = screenW < 640;

  const initialServiceId = getServiceIdFromUrl();
  const [view, setView] = useState<View>(initialServiceId ? 'editor' : 'services');
  const [svc, setSvc] = useState<Service | null>(null);
  const [songs, setSongs] = useState<ClientSong[]>([]);
  const [exp, setExp] = useState<number | null>(null);
  const [fs, setFs] = useState<FsState | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [modal, setModal] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [fade, setFade] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(!!initialServiceId);
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | null>(null);
  const savedSongsRef = useRef<ClientSong[] | null>(null);
  const songsRef = useRef(songs);
  songsRef.current = songs;

  // Mark the working set as edited so it gets persisted as a local draft
  const touch = () => setDirty(true);

  const handlePreviewVersion = async (version: number) => {
    if (!svc) return;
    // Save current songs on first preview
    if (!savedSongsRef.current) savedSongsRef.current = songs;
    setLoadingVersion(version);
    try {
      const lyrics = await fetchLyrics(svc.id, version);
      setSongs(lyricsToSongs(lyrics));
      setPreviewVersion(version);
      setExp(null);
    } catch (err) {
      console.error('Failed to load version:', err);
    } finally {
      setLoadingVersion(null);
    }
  };

  const handleRestoreVersion = () => {
    // Commit the previewed songs as the working set
    savedSongsRef.current = null;
    setPreviewVersion(null);
    setPublished(null);
    touch();
  };

  const handleCancelPreview = () => {
    // Go back to original songs
    if (savedSongsRef.current) {
      setSongs(savedSongsRef.current);
      savedSongsRef.current = null;
    }
    setPreviewVersion(null);
    setExp(null);
  };

  const go = (cb: () => void) => {
    setFade(false);
    setTimeout(() => { cb(); setFade(true); }, 50);
  };

  // Restore service from URL on initial load
  useEffect(() => {
    if (!initialServiceId) return;
    fetchService(initialServiceId)
      .then(detail => {
        const s = detail.service as unknown as Service;
        // Merge version metadata
        const latestVersion = detail.versions[0];
        setSvc({
          ...s,
          checksum: latestVersion?.checksum ?? null,
          song_count: latestVersion?.song_count ?? null,
          published_at: latestVersion?.published_at ?? null,
        });
      })
      .catch(() => {
        // Service not found, go back to list
        setView('services');
        setLoadingSongs(false);
        history.replaceState(null, '', '/');
      });
  }, []);

  // Load songs when entering a service: restore any locally-saved draft first,
  // otherwise fetch the published version from the server.
  useEffect(() => {
    if (view !== 'editor' || !svc) return;
    setRestored(false);
    setDirty(false);
    setSaveState(null);
    const draft = loadDraft(svc.id);
    if (draft && draft.songs.length > 0) {
      setSongs(draftToSongs(draft));
      setRestored(true);
      setLoadingSongs(false);
      return;
    }
    if (svc.current_version === 0) { setLoadingSongs(false); return; }
    setLoadingSongs(true);
    fetchLyrics(svc.id, svc.current_version)
      .then(lyrics => setSongs(lyricsToSongs(lyrics)))
      .catch(console.error)
      .finally(() => setLoadingSongs(false));
  }, [view, svc?.id]);

  // Persist edits to localStorage so a refresh or leaving mid-edit doesn't lose work
  useEffect(() => {
    if (view !== 'editor' || !svc || !dirty) return;
    if (previewVersion !== null) return; // don't overwrite the draft while previewing history
    if (songs.length === 0) { removeDraft(svc.id); setSaveState(null); return; }
    setSaveState('saving');
    saveDraft(svc.id, svc.current_version, songs, Date.now());
    // Settle to "saved" once edits stop streaming in (cleared if another edit lands first)
    const t = setTimeout(() => setSaveState('saved'), 500);
    return () => clearTimeout(t);
  }, [songs, dirty, view, svc?.id, svc?.current_version, previewVersion]);

  const discardDraft = () => {
    if (!svc) return;
    removeDraft(svc.id);
    setRestored(false);
    setDirty(false);
    if (svc.current_version === 0) { setSongs([]); return; }
    setLoadingSongs(true);
    fetchLyrics(svc.id, svc.current_version)
      .then(lyrics => setSongs(lyricsToSongs(lyrics)))
      .catch(console.error)
      .finally(() => setLoadingSongs(false));
  };

  // Handle browser back/forward
  const onPopState = useCallback(() => {
    const id = getServiceIdFromUrl();
    if (!id) {
      go(() => {
        setView('services');
        setSvc(null);
        setSongs([]);
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onPopState]);

  const navigateToService = (s: Service) => go(() => {
    setSvc(s);
    setSongs([]);
    setExp(null);
    setPublished(null);
    setShowHist(false);
    setView('editor');
    history.pushState(null, '', `/service/${s.id}`);
  });

  if (view === 'services') {
    return (
      <div style={pageBase()}>
        <style>{globalCSS}</style>
        <div style={container(mob)}>
          <ServiceList
            mobile={mob}
            fade={fade}
            onSelect={navigateToService}
            onCreate={navigateToService}
          />
        </div>
      </div>
    );
  }

  // Show loading state while fetching service from URL
  if (!svc) {
    return (
      <div style={pageBase()}>
        <style>{globalCSS}</style>
        <div style={container(mob)}>
          <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 13 }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageBase()}>
      <style>{globalCSS}</style>
      <div style={container(mob)}>
        <EditorHeader
          service={svc}
          mobile={mob}
          fade={fade}
          hasSongs={songs.length > 0}
          saveStatus={previewVersion === null ? saveState : null}
          showHistory={showHist}
          onBack={() => go(() => { setView('services'); history.pushState(null, '', '/'); })}
          onToggleHistory={() => setShowHist(!showHist)}
        />

        {showHist && svc && (
          <VersionHistory
            serviceId={svc.id}
            mobile={mob}
            previewVersion={previewVersion}
            loadingVersion={loadingVersion}
            onPreview={handlePreviewVersion}
            onRestore={handleRestoreVersion}
            onCancelPreview={handleCancelPreview}
          />
        )}

        {published && (
          <SuccessBanner result={published} mobile={mob} />
        )}

        {restored && !published && (
          <div style={{
            background: T.primaryLight, border: `1px solid ${T.primaryMedium}`, borderRadius: 12,
            padding: mob ? "11px 12px" : "12px 16px", marginBottom: 18,
            display: "flex", alignItems: "center", gap: 10,
            animation: "sd .3s cubic-bezier(.16,1,.3,1)",
          }}>
            <span style={{ color: T.primary, flexShrink: 0, display: "flex" }}><I.History s={15} /></span>
            <div style={{ flex: 1, fontSize: 12.5, color: T.primaryText, lineHeight: 1.4 }}>
              Restored your unsaved changes from this device.
            </div>
            <button
              onClick={discardDraft}
              style={{
                flexShrink: 0, padding: "5px 11px", borderRadius: 7,
                border: `1px solid ${T.primaryMedium}`, background: T.surface,
                color: T.primaryText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font,
              }}
            >Discard</button>
            <button
              onClick={() => setRestored(false)}
              aria-label="Dismiss"
              style={{
                flexShrink: 0, width: 24, height: 24, borderRadius: "50%", border: "none",
                background: "transparent", color: T.textMuted, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
              }}
            ><I.X s={13} /></button>
          </div>
        )}

        {loadingSongs ? (
          <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 13 }}>Loading songs...</div>
        ) : (
          <DropZone
            songs={songs}
            onSongsChange={newSongs => {
              touch();
              setFade(false);
              setTimeout(() => { setSongs(newSongs); setFade(true); }, 50);
            }}
            mobile={mob}
            fade={fade}
          />
        )}

        {songs.length > 0 && (
          <SongList
            songs={songs}
            expandedSong={exp}
            mobile={mob}
            fade={fade}
            serviceId={svc?.id ?? null}
            version={published ? published.version : (svc?.current_version ?? 0)}
            onExpand={setExp}
            onRemove={i => { touch(); setSongs(songs.filter((_, j) => j !== i)); }}
            onMove={(from, to) => {
              if (to < 0 || to >= songs.length) return;
              touch();
              setSongs(prev => {
                const updated = [...prev];
                const [moved] = updated.splice(from, 1);
                updated.splice(to, 0, moved);
                // Update section to match new neighbors
                const above = to > 0 ? updated[to - 1] : null;
                const below = to < updated.length - 1 ? updated[to + 1] : null;
                const neighborSection = above ? above.section : (below ? below.section : undefined);
                updated[to] = { ...updated[to], section: neighborSection };
                return updated;
              });
              // Keep expanded song tracking the moved song
              if (exp === from) setExp(to);
              else if (exp !== null) {
                if (from < exp && to >= exp) setExp(exp - 1);
                else if (from > exp && to <= exp) setExp(exp + 1);
              }
              setPublished(null);
            }}
            onSectionChange={(songIdx, section) => {
              touch();
              setSongs(prev => prev.map((song, i) => i === songIdx ? { ...song, section: section || undefined } : song));
            }}
            onFullscreen={(songIdx, slideIdx) => setFs({ slides: songs[songIdx].slides, start: slideIdx, songIndex: songIdx })}
            onSlideInsert={(songIdx, afterSlideIdx) => {
              touch();
              setSongs(prev => prev.map((song, si) => {
                if (si !== songIdx) return song;
                const newSlides = [...song.slides];
                newSlides.splice(afterSlideIdx + 1, 0, { original: [], translation: [] });
                return { ...song, slides: newSlides, count: newSlides.length, file: slidesToFile(newSlides, song.filename) };
              }));
              setPublished(null);
            }}
            onSlideDelete={(songIdx, slideIdx) => {
              touch();
              setSongs(prev => prev.map((song, si) => {
                if (si !== songIdx || song.slides.length <= 1) return song;
                const newSlides = song.slides.filter((_, j) => j !== slideIdx);
                return { ...song, slides: newSlides, count: newSlides.length, file: slidesToFile(newSlides, song.filename) };
              }));
              setPublished(null);
            }}
          />
        )}

        {songs.length > 0 && !published && !previewVersion && songs.some(s => s.file) && (
          <PublishBar
            songs={songs}
            mobile={mob}
            onPublish={() => setModal(true)}
            onPreviewAll={() => setFs({ slides: songs.flatMap(s => s.slides), start: 0 })}
          />
        )}

        {modal && svc && (
          <PublishModal
            service={svc}
            songs={songs}
            mobile={mob}
            onClose={() => setModal(false)}
            onPublished={result => {
              setModal(false);
              setPublished(result);
              // Work is saved on the server now — clear the local draft
              if (svc) removeDraft(svc.id);
              setRestored(false);
              setDirty(false);
              setSaveState(null);
              if (svc) setSvc({ ...svc, current_version: result.version });
            }}
          />
        )}
      </div>

      {fs && (
        <Fullscreen
          slides={fs.slides}
          start={fs.start}
          editable={fs.songIndex !== undefined}
          saveStatus={saveState}
          onChange={editedSlides => {
            // Live autosave while the editor is open (commit on blur / structural edit)
            if (fs.songIndex === undefined) return;
            touch();
            setPublished(null);
            setSongs(prev => prev.map((song, idx) => idx !== fs.songIndex ? song : {
              ...song,
              slides: editedSlides,
              count: editedSlides.length,
              file: slidesToFile(editedSlides, song.filename),
            }));
          }}
          onFlush={editedSlides => {
            // Synchronous write on refresh/backgrounding — can't wait for React effects
            if (!svc || fs.songIndex === undefined || previewVersion !== null) return;
            const updated = songsRef.current.map((song, idx) => idx !== fs.songIndex ? song : {
              ...song,
              slides: editedSlides,
              count: editedSlides.length,
            });
            saveDraft(svc.id, svc.current_version, updated, Date.now());
          }}
          onClose={(editedSlides) => {
            if (editedSlides && fs.songIndex !== undefined) {
              touch();
              setSongs(prev => prev.map((song, idx) => {
                if (idx !== fs.songIndex) return song;
                return {
                  ...song,
                  slides: editedSlides,
                  count: editedSlides.length,
                  file: slidesToFile(editedSlides, song.filename),
                };
              }));
              setPublished(null);
            }
            setFs(null);
          }}
          mobile={mob}
        />
      )}
    </div>
  );
}
