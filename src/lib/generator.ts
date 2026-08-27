import { randomUUID } from 'crypto';
import type { ParsedSong, SlideTemplateDef, TextStyle } from './types.js';
import { buildRtf } from './rtf-build.js';
import { TEMPLATES, sectionColor, isSectionLabel } from './templates.js';
// @ts-ignore - generated static protobuf module
import { rv } from './proto-static.js';

const Presentation = rv.data.Presentation;

function uuid(value?: string): { string: string } {
  return { string: value || randomUUID().toUpperCase() };
}

// Standard rectangle path with normalized (0-1) coordinates
const RECT_PATH = {
  closed: true,
  points: [
    { point: { x: 0, y: 0 }, q0: { x: 0, y: 0 }, q1: { x: 0, y: 0 }, curved: false },
    { point: { x: 1, y: 0 }, q0: { x: 1, y: 0 }, q1: { x: 1, y: 0 }, curved: false },
    { point: { x: 1, y: 1 }, q0: { x: 1, y: 1 }, q1: { x: 1, y: 1 }, curved: false },
    { point: { x: 0, y: 1 }, q0: { x: 0, y: 1 }, q1: { x: 0, y: 1 }, curved: false },
  ],
  shape: { type: 1 }, // TYPE_RECTANGLE
};

// Default fill color used by ProPresenter for elements
const DEFAULT_FILL_COLOR = {
  red: 0.12941177189350128,
  green: 0.5882353186607361,
  blue: 0.9490196108818054,
  alpha: 1,
};

function makeSlideElement(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rtfData: Uint8Array,
  style: TextStyle,
  verticalAlignment: number = 0,
): Record<string, unknown> {
  return {
    data_links: [],
    childBuilds: [],
    element: {
      uuid: uuid(),
      name,
      bounds: {
        origin: { x, y },
        size: { width, height },
      },
      rotation: 0,
      opacity: 1,
      locked: false,
      aspect_ratio_locked: false,
      path: RECT_PATH,
      fill: {
        enable: false,
        color: DEFAULT_FILL_COLOR,
      },
      stroke: {
        pattern: [],
        style: 0,
        width: 3,
        color: { red: 1, green: 1, blue: 1, alpha: 1 },
        enable: false,
      },
      shadow: {
        style: 0,
        angle: 315,
        offset: 5,
        radius: 5,
        color: { red: 0, green: 0, blue: 0, alpha: 1 },
        opacity: 0.75,
        enable: false,
      },
      feather: {
        style: 0,
        radius: 0.05,
        enable: false,
      },
      text: {
        alternate_texts: [],
        attributes: {
          custom_attributes: [],
          font: {
            name: style.fontName,
            size: style.fontSize,
            italic: style.italic,
            bold: style.bold,
            family: style.fontFamily,
            face: '',
          },
          capitalization: 0,
          underline_style: { style: 0, pattern: 0, by_word: false },
          underline_color: null,
          paragraph_style: {
            tab_stops: [],
            text_lists: [],
            alignment: 2, // CENTER
            first_line_head_indent: 0,
            head_indent: 0,
            tail_indent: 0,
            line_height_multiple: 1,
            maximum_line_height: 0,
            minimum_line_height: 0,
            line_spacing: 0,
            paragraph_spacing: 0,
            paragraph_spacing_before: 0,
            default_tab_interval: 0,
            text_list: {
              is_enabled: false,
              number_type: 0,
              prefix: '',
              postfix: '',
              starting_number: 0,
            },
          },
          kerning: 0,
          superscript: 0,
          strikethrough_style: { style: 0, pattern: 0, by_word: false },
          strikethrough_color: null,
          stroke_width: 0,
          stroke_color: null,
          background_color: null,
          ligature_style: 0,
          text_solid_fill: {
            red: style.color.r,
            green: style.color.g,
            blue: style.color.b,
            alpha: style.color.a,
          },
        },
        shadow: {
          style: 0,
          angle: 315,
          offset: 5,
          radius: 5,
          color: { red: 0, green: 0, blue: 0, alpha: 1 },
          opacity: 0.74,
          enable: true,
        },
        rtf_data: rtfData,
        vertical_alignment: verticalAlignment,
        scale_behavior: 0, // NONE
        margins: { left: 0, right: 0, top: 0, bottom: 0 },
        is_superscript_standardized: true,
        transform: 0,
        transformDelimiter: '  \u2022  ',
        chord_pro: {
          enabled: false,
          notation: 0,
          color: { red: 0, green: 0, blue: 0, alpha: 1 },
        },
      },
      flipMode: 0,
      hidden: false,
      text_line_mask: {
        enabled: false,
        height_offset: 0,
        vertical_offset: 0,
        mask_style: 0,
        width_offset: 0,
        horizontal_offset: 0,
      },
    },
    build_in: null,
    build_out: null,
    info: 3, // IS_TEMPLATE_ELEMENT | IS_TEXT_ELEMENT
    reveal_type: 0,
    reveal_from_index: 0,
    text_scroller: {
      should_scroll: false,
      scroll_rate: 0.5,
      should_repeat: true,
      repeat_distance: 0.05208333333333334,
      scrolling_direction: 0,
      starts_off_screen: false,
      fade_left: 0,
      fade_right: 0,
    },
  };
}

interface CueGroupAccum {
  name: string;
  color: { red: number; green: number; blue: number; alpha: number } | null;
  cueIds: { string: string }[];
}

export function generatePresentation(
  songs: ParsedSong[],
  template: SlideTemplateDef = TEMPLATES.main,
): Uint8Array {
  // Presentation is imported from static proto module

  const presentationUuid = uuid();
  const cues: Record<string, unknown>[] = [];
  const groups: CueGroupAccum[] = [];

  // The single-group mode always emits its group, even with zero slides —
  // matching the pre-template generator's output exactly
  if (!template.groupBySection) {
    groups.push({ name: '', color: null, cueIds: [] });
  }

  for (const song of songs) {
    // Section groups never span songs — each song starts a fresh group
    let currentGroup: CueGroupAccum | null = null;

    for (const slide of song.slides) {
      const cueUuid = uuid();

      if (template.groupBySection) {
        if (isSectionLabel(slide.label)) {
          // A real section label ([Verse 1], [Chorus]…) starts a named, colored group
          currentGroup = { name: slide.label, color: sectionColor(slide.label), cueIds: [] };
          groups.push(currentGroup);
        } else if (!currentGroup) {
          // Unlabeled slides continue the previous group, or an unnamed one
          currentGroup = { name: '', color: null, cueIds: [] };
          groups.push(currentGroup);
        }
      } else {
        currentGroup = groups[0];
      }
      currentGroup.cueIds.push(cueUuid);

      // Each template box renders one or more slide fields (youth merges both
      // into its single full-screen box)
      const elements: Record<string, unknown>[] = [];
      for (const box of template.boxes) {
        const text = box.fields
          .map(f => (f === 'original' ? slide.originalLines : slide.translationLines))
          .filter(lines => lines.length > 0)
          .map(lines => lines.join('\n'))
          .join('\n');

        // Per-slide font-size overrides; a merged box follows the original size
        const sizeOverride = box.fields.includes('original') ? slide.origPt : slide.transPt;
        const style = sizeOverride ? { ...box.style, fontSize: sizeOverride } : box.style;

        elements.push(makeSlideElement(
          box.name,
          box.x,
          box.y,
          box.width,
          box.height,
          buildRtf(text, style),
          style,
          box.verticalAlignment,
        ));
      }

      const cue: Record<string, unknown> = {
        uuid: cueUuid,
        name: '',
        actions: [
          {
            uuid: uuid(),
            name: '',
            label: null,
            delay_time: 0,
            old_type: null,
            isEnabled: true,
            layer_identification: null,
            duration: 0,
            type: 11, // ACTION_TYPE_PRESENTATION_SLIDE
            slide: {
              presentation: {
                template_guidelines: [],
                base_slide: {
                  elements,
                  element_build_order: [],
                  guidelines: [],
                  draws_background_color: false,
                  background_color: { red: 0, green: 0, blue: 0, alpha: 1 },
                  size: { width: template.width, height: template.height },
                  uuid: uuid(),
                },
                notes: null,
                chord_chart: { platform: 0 },
                transition: null,
              },
            },
          },
        ],
        pending_imports: [],
        completion_target_type: 0,
        completion_target_uuid: null,
        completion_action_type: 1,
        completion_action_uuid: null,
        trigger_time: null,
        hot_key: {
          code: 0,
          control_identifier: '',
        },
        isEnabled: true,
        completion_time: 0,
      };

      cues.push(cue);
    }
  }

  // main: a single unnamed group with every cue; youth: one named, colored
  // group per section
  const cueGroups: Record<string, unknown>[] = groups.map(g => ({
    group: {
      uuid: uuid(),
      name: g.name,
      color: g.color,
      hotKey: {
        code: 0,
        control_identifier: '',
      },
      application_group_identifier: null,
      application_group_name: '',
    },
    cue_identifiers: g.cueIds,
  }));

  const presentationName = songs.map(s => s.title).join(', ');

  const presentation: Record<string, unknown> = {
    application_info: {
      platform: 1, // PLATFORM_MACOS
      platform_version: {
        major_version: 26,
        minor_version: 3,
        patch_version: 0,
        build: '',
      },
      application: 1, // APPLICATION_PROPRESENTER
      application_version: {
        major_version: 7,
        minor_version: 16,
        patch_version: 3,
        build: '118489862',
      },
    },
    uuid: presentationUuid,
    name: presentationName,
    cue_groups: cueGroups,
    cues,
    arrangements: [],
    category: '',
    notes: '',
    ccli: {
      author: '',
      artist_credits: '',
      song_title: '',
      publisher: '',
      copyright_year: 0,
      song_number: 0,
      display: false,
      album: '',
      artwork: '',
    },
    content_destination: 0,
  };

  const errMsg = Presentation.verify(presentation);
  if (errMsg) {
    throw new Error(`Protobuf verification failed: ${errMsg}`);
  }

  const message = Presentation.create(presentation);
  return Presentation.encode(message).finish();
}
