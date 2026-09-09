const ALLOWED_TAGS = new Set([
  "span",
  "font",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "br",
  "div",
  "p",
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "font-variant",
  "color",
  "text-align",
  "text-decoration",
  "background-color",
]);

const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|javascript:|@import/i;
const TAG_PATTERN =
  /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE_PATTERN = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function filterStyle(styleValue) {
  if (typeof styleValue !== "string") {
    return "";
  }
  return styleValue
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator <= 0) {
        return null;
      }
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) {
        return null;
      }
      if (!value || value.length > 200 || /[<>]/.test(value)) {
        return null;
      }
      if (UNSAFE_STYLE_VALUE.test(value)) {
        return null;
      }
      return `${property}: ${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

function rebuildTag(isClosing, tagName, attributeText) {
  if (isClosing) {
    return `</${tagName}>`;
  }
  let style = "";
  let match;
  ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((match = ATTRIBUTE_PATTERN.exec(attributeText)) !== null) {
    if (match[1].toLowerCase() !== "style") {
      continue;
    }
    style = filterStyle(match[2] ?? match[3] ?? match[4] ?? "");
    break;
  }
  return style ? `<${tagName} style="${style}">` : `<${tagName}>`;
}

export function sanitizeRichText(html) {
  if (typeof html !== "string") {
    return "";
  }
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "");
  cleaned = cleaned.replace(TAG_PATTERN, (raw, closing, tagName, attributeText) => {
    const lowerTag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(lowerTag)) {
      return "";
    }
    if (lowerTag === "br") {
      return "<br>";
    }
    return rebuildTag(Boolean(closing), lowerTag, attributeText);
  });
  return cleaned;
}

export function escapeHtmlText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

export function plainTextToRichHtml(text) {
  return escapeHtmlText(String(text ?? "")).replace(/\r\n|\r|\n/g, "<br>");
}

export function stripHtml(html) {
  if (typeof html !== "string") {
    return "";
  }
  return html
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(div|p)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
