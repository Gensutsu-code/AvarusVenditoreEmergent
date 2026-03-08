import { useState } from 'react';

/* Parses rich text with **bold**, _italic_, [links](url), - lists, and [IMG:url:width] */
export default function RichContent({ text }) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="rich-content space-y-2">
      {lines.map((line, i) => {
        // Image tag: [IMG:url:width]
        const imgMatch = line.match(/\[IMG:(.+?):(\d+)\]/);
        if (imgMatch) {
          return <ResizableImage key={i} src={imgMatch[1]} defaultWidth={parseInt(imgMatch[2])} />;
        }

        // List item
        if (line.startsWith('- ')) {
          return <li key={i} className="ml-4 list-disc">{renderInline(line.substring(2))}</li>;
        }

        // Empty line
        if (!line.trim()) return <br key={i} />;

        // Regular paragraph
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function ResizableImage({ src, defaultWidth }) {
  const [width, setWidth] = useState(defaultWidth);

  return (
    <div className="my-3">
      <img src={src} alt="" className="rounded-lg object-contain" style={{ width: `${width}px`, maxWidth: '100%' }} />
    </div>
  );
}

function renderInline(text) {
  // Process: **bold**, _italic_, [text](url), emojis pass through naturally
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic: _text_
    const italicMatch = remaining.match(/_(.+?)_/);
    // Link: [text](url)
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    // Find earliest match
    const matches = [
      boldMatch && { index: remaining.indexOf(boldMatch[0]), type: 'bold', match: boldMatch },
      italicMatch && { index: remaining.indexOf(italicMatch[0]), type: 'italic', match: italicMatch },
      linkMatch && { index: remaining.indexOf(linkMatch[0]), type: 'link', match: linkMatch },
    ].filter(Boolean).sort((a, b) => a.index - b.index);

    if (matches.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const first = matches[0];
    // Text before match
    if (first.index > 0) {
      parts.push(<span key={key++}>{remaining.substring(0, first.index)}</span>);
    }

    if (first.type === 'bold') {
      parts.push(<strong key={key++}>{first.match[1]}</strong>);
      remaining = remaining.substring(first.index + first.match[0].length);
    } else if (first.type === 'italic') {
      parts.push(<em key={key++}>{first.match[1]}</em>);
      remaining = remaining.substring(first.index + first.match[0].length);
    } else if (first.type === 'link') {
      parts.push(<a key={key++} href={first.match[2]} className="text-teal-600 underline hover:text-teal-700" target="_blank" rel="noreferrer">{first.match[1]}</a>);
      remaining = remaining.substring(first.index + first.match[0].length);
    }
  }

  return parts;
}
