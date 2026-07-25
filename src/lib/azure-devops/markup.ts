import sanitizeHtml from "sanitize-html";

export type AzureDevOpsMarkup = {
  content: string;
  format: "html" | "markdown" | "unknown";
};

type SanitizeAzureDevOpsHtmlOptions = {
  transformImageSource?: (source: string) => string | null | undefined;
};

const SANITIZE_ALLOWED_TAGS = [
  ...(sanitizeHtml.defaults.allowedTags ?? []),
  "img",
  "input",
  "span",
];
const SANITIZE_ALLOWED_ATTRIBUTES = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: [
    ...(sanitizeHtml.defaults.allowedAttributes.a ?? []),
    "data-vss-mention",
    "rel",
    "target",
  ],
  img: ["alt", "decoding", "loading", "src", "title"],
  input: ["checked", "disabled", "type"],
  span: [
    ...(sanitizeHtml.defaults.allowedAttributes.span ?? []),
    "data-vss-mention",
  ],
};

export function sanitizeAzureDevOpsHtml(
  value: unknown,
  options: SanitizeAzureDevOpsHtmlOptions = {},
) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return sanitizeHtml(value, {
    allowedAttributes: SANITIZE_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedTags: SANITIZE_ALLOWED_TAGS,
    transformTags: {
      a: (tagName, attribs) => {
        const href = typeof attribs.href === "string" ? attribs.href : "";
        const nextAttribs = { ...attribs };

        if (typeof nextAttribs["data-vss-mention"] === "string") {
          delete nextAttribs.href;
          delete nextAttribs.rel;
          delete nextAttribs.target;

          return {
            attribs: nextAttribs,
            tagName: "span",
          };
        }

        if (href.startsWith("http://") || href.startsWith("https://")) {
          nextAttribs.rel = "noreferrer noopener";
          nextAttribs.target = "_blank";
        }

        return {
          attribs: nextAttribs,
          tagName,
        };
      },
      img: (tagName, attribs) => {
        const source = typeof attribs.src === "string" ? attribs.src : "";
        const transformedSource = source
          ? options.transformImageSource?.(source)
          : null;
        const nextAttribs = {
          ...attribs,
          ...(transformedSource ? { src: transformedSource } : {}),
        };

        return {
          attribs: {
            ...nextAttribs,
            decoding: "async",
            loading: "lazy",
          },
          tagName,
        };
      },
      input: (tagName, attribs) => {
        const type = typeof attribs.type === "string"
          ? attribs.type.toLowerCase()
          : "";

        if (type !== "checkbox") {
          return {
            attribs: {},
            tagName: "span",
          };
        }

        return {
          attribs: {
            type: "checkbox",
            disabled: "disabled",
            ...(Object.prototype.hasOwnProperty.call(attribs, "checked")
              ? { checked: "checked" }
              : {}),
          },
          tagName,
        };
      },
    },
  });
}
