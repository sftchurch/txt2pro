// Full Windows-1251 mapping for 0x80-0xFF
const WIN1251_MAP: number[] = [
  // 0x80-0x8F
  0x0402, 0x0403, 0x201A, 0x0453, 0x201E, 0x2026, 0x2020, 0x2021,
  0x20AC, 0x2030, 0x0409, 0x2039, 0x040A, 0x040C, 0x040B, 0x040F,
  // 0x90-0x9F
  0x0452, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x0098, 0x2122, 0x0459, 0x203A, 0x045A, 0x045C, 0x045B, 0x045F,
  // 0xA0-0xAF
  0x00A0, 0x040E, 0x045E, 0x0408, 0x00A4, 0x0490, 0x00A6, 0x00A7,
  0x0401, 0x00A9, 0x0404, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x0407,
  // 0xB0-0xBF
  0x00B0, 0x00B1, 0x0406, 0x0456, 0x0491, 0x00B5, 0x00B6, 0x00B7,
  0x0451, 0x2116, 0x0454, 0x00BB, 0x0458, 0x0405, 0x0455, 0x0457,
  // 0xC0-0xCF (А-П)
  0x0410, 0x0411, 0x0412, 0x0413, 0x0414, 0x0415, 0x0416, 0x0417,
  0x0418, 0x0419, 0x041A, 0x041B, 0x041C, 0x041D, 0x041E, 0x041F,
  // 0xD0-0xDF (Р-Я)
  0x0420, 0x0421, 0x0422, 0x0423, 0x0424, 0x0425, 0x0426, 0x0427,
  0x0428, 0x0429, 0x042A, 0x042B, 0x042C, 0x042D, 0x042E, 0x042F,
  // 0xE0-0xEF (а-п)
  0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0437,
  0x0438, 0x0439, 0x043A, 0x043B, 0x043C, 0x043D, 0x043E, 0x043F,
  // 0xF0-0xFF (р-я)
  0x0440, 0x0441, 0x0442, 0x0443, 0x0444, 0x0445, 0x0446, 0x0447,
  0x0448, 0x0449, 0x044A, 0x044B, 0x044C, 0x044D, 0x044E, 0x044F,
];

function win1251ToUnicode(byte: number): string {
  if (byte < 0x80) return String.fromCharCode(byte);
  return String.fromCharCode(WIN1251_MAP[byte - 0x80] ?? byte);
}

export function stripRtf(content: string): string {
  if (!content.trimStart().startsWith('{\\rtf')) {
    return content;
  }

  let result = '';
  let i = 0;
  let depth = 0;
  let skipGroup = false;
  let skipDepth = 0;

  while (i < content.length) {
    const ch = content[i];

    if (ch === '{') {
      depth++;
      // Only check for new skip groups if we're not already skipping
      if (!skipGroup) {
        const ahead = content.slice(i + 1, i + 40);
        // Skip {\*\...} ignorable destinations (Word metadata, XML data, etc.)
        if (/^\{\\\*\\/.test(content.slice(i, i + 5))) {
          skipGroup = true;
          skipDepth = depth;
        }
        // Skip known non-ignorable groups that contain no renderable text
        else if (/^\\(fonttbl|colortbl|stylesheet|pict|info|header|footer|mmathPr|themedata|datastore|panose|pnseclvl)\b/.test(ahead)) {
          skipGroup = true;
          skipDepth = depth;
        }
      }
      i++;
      continue;
    }

    if (ch === '}') {
      if (skipGroup && depth === skipDepth) {
        skipGroup = false;
      }
      depth--;
      i++;
      continue;
    }

    if (skipGroup) {
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= content.length) break;

      // Hex escape \'XX
      if (content[i] === '\'') {
        i++;
        const hex = content.slice(i, i + 2);
        i += 2;
        const byte = parseInt(hex, 16);
        if (!isNaN(byte)) {
          result += win1251ToUnicode(byte);
        }
        continue;
      }

      // Unicode escape \uN
      if (content[i] === 'u' && /\d/.test(content[i + 1] || '')) {
        i++; // skip 'u'
        let numStr = '';
        if (content[i] === '-') {
          numStr += '-';
          i++;
        }
        while (i < content.length && /\d/.test(content[i])) {
          numStr += content[i];
          i++;
        }
        const codepoint = parseInt(numStr, 10);
        if (!isNaN(codepoint)) {
          result += String.fromCharCode(codepoint < 0 ? codepoint + 65536 : codepoint);
        }
        // Skip replacement character (one character or space after \uN)
        if (i < content.length && content[i] === ' ') i++;
        else if (i < content.length && content[i] !== '\\' && content[i] !== '{' && content[i] !== '}') i++;
        continue;
      }

      // Read control word
      let word = '';
      while (i < content.length && /[a-zA-Z]/.test(content[i])) {
        word += content[i];
        i++;
      }

      // Read optional numeric parameter
      let param = '';
      if (i < content.length && (content[i] === '-' || /\d/.test(content[i]))) {
        if (content[i] === '-') { param += '-'; i++; }
        while (i < content.length && /\d/.test(content[i])) {
          param += content[i];
          i++;
        }
      }

      // Consume the space delimiter after a control word
      if (i < content.length && content[i] === ' ') i++;

      // Process known control words
      switch (word) {
        case 'par':
        case 'line':
          result += '\n';
          break;
        case 'tab':
          result += '\t';
          break;
        case 'rquote':
          result += '\u2019';
          break;
        case 'lquote':
          result += '\u2018';
          break;
        case 'rdblquote':
          result += '\u201D';
          break;
        case 'ldblquote':
          result += '\u201C';
          break;
        case 'emdash':
          result += '\u2014';
          break;
        case 'endash':
          result += '\u2013';
          break;
        case 'bullet':
          result += '\u2022';
          break;
        // Other control words are stripped
      }
      continue;
    }

    // Skip newlines and carriage returns in RTF source
    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    result += ch;
    i++;
  }

  // Normalize whitespace
  return result
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
