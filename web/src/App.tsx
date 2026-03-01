import { useState, useEffect, useCallback } from 'react';
import { useWidth } from './hooks/useWidth';
import { useDarkMode } from './hooks/useDarkMode';
import { T, applyScheme, pageBase, container, globalCSS } from './theme';
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
import type { Service, ClientSong, ClientSlide, PublishResult } from './lib/types';

type View = 'services' | 'editor';

interface FontSizes {
  origPt: number;
  transPt: number;
}

interface FsState {
  slides: ClientSlide[];
  start: number;
  songIndex?: number;
}

function slidesToFile(slides: ClientSlide[], filename: string): File {
  const text = slides.map(s => {
    const parts: string[] = [];
    if (s.original.length > 0) parts.push(s.original.join('\n'));
    if (s.translation.length > 0) parts.push(s.translation.join('\n'));
    return parts.join('\n\n');
  }).join('\n\n');
  return new File([text], filename, { type: 'text/plain' });
}

// Convert lyrics API data into ClientSong[] for display (read-only, no File object)
function lyricsToSongs(lyrics: { title: string; filename: string; slides: { original: string[]; translation: string[] }[] }[]): ClientSong[] {
  return lyrics.map(song => ({
    title: song.title,
    filename: song.filename,
    file: null as unknown as File, // no file for previously published songs
    ok: true,
    warn: null,
    count: song.slides.length,
    slides: song.slides.map(s => ({ original: s.original, translation: s.translation })),
  }));
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
  const [songFonts, setSongFonts] = useState<Record<number, FontSizes>>({});

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

  // Load existing songs when entering a published service
  useEffect(() => {
    if (view !== 'editor' || !svc || svc.current_version === 0) return;
    setLoadingSongs(true);
    fetchLyrics(svc.id, svc.current_version)
      .then(lyrics => setSongs(lyricsToSongs(lyrics)))
      .catch(console.error)
      .finally(() => setLoadingSongs(false));
  }, [view, svc?.id]);

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
          showHistory={showHist}
          onBack={() => go(() => { setView('services'); history.pushState(null, '', '/'); })}
          onToggleHistory={() => setShowHist(!showHist)}
        />

        {showHist && svc && (
          <VersionHistory serviceId={svc.id} mobile={mob} />
        )}

        {published && (
          <SuccessBanner result={published} mobile={mob} />
        )}

        {loadingSongs ? (
          <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 13 }}>Loading songs...</div>
        ) : (
          <DropZone
            songs={songs}
            onSongsChange={newSongs => {
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
            songFonts={songFonts}
            onExpand={setExp}
            onRemove={i => setSongs(songs.filter((_, j) => j !== i))}
            onFullscreen={(songIdx, slideIdx) => setFs({ slides: songs[songIdx].slides, start: slideIdx, songIndex: songIdx })}
            onSlideInsert={(songIdx, afterSlideIdx) => {
              setSongs(prev => prev.map((song, si) => {
                if (si !== songIdx) return song;
                const newSlides = [...song.slides];
                newSlides.splice(afterSlideIdx + 1, 0, { original: [], translation: [] });
                return { ...song, slides: newSlides, count: newSlides.length, file: slidesToFile(newSlides, song.filename) };
              }));
              setPublished(null);
            }}
            onSlideDelete={(songIdx, slideIdx) => {
              setSongs(prev => prev.map((song, si) => {
                if (si !== songIdx || song.slides.length <= 1) return song;
                const newSlides = song.slides.filter((_, j) => j !== slideIdx);
                return { ...song, slides: newSlides, count: newSlides.length, file: slidesToFile(newSlides, song.filename) };
              }));
              setPublished(null);
            }}
          />
        )}

        {songs.length > 0 && !published && songs.some(s => s.file) && (
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
          initialOrigPt={fs.songIndex !== undefined ? songFonts[fs.songIndex]?.origPt : undefined}
          initialTransPt={fs.songIndex !== undefined ? songFonts[fs.songIndex]?.transPt : undefined}
          onClose={(editedSlides, fontSizes) => {
            if (fs.songIndex !== undefined && fontSizes) {
              setSongFonts(prev => ({ ...prev, [fs.songIndex!]: fontSizes }));
            }
            if (editedSlides && fs.songIndex !== undefined) {
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
