/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            code: {
              backgroundColor: "var(--muted)",
              borderRadius: "calc(var(--radius) * 0.6)",
              color: "var(--foreground)",
              fontWeight: "500",
              padding: "0.125rem 0.375rem",
            },
            "code::before": {
              content: "none",
            },
            "code::after": {
              content: "none",
            },
            pre: {
              backgroundColor: "var(--muted)",
              color: "var(--foreground)",
            },
            "pre code": {
              backgroundColor: "transparent",
              borderRadius: "0",
              color: "inherit",
              fontWeight: "inherit",
              padding: "0",
            },
          },
        },
      },
    },
  },
};
