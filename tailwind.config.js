import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './contexts/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#334155',
            '--tw-prose-headings': '#1e293b',
            '--tw-prose-lead': '#475569',
            '--tw-prose-links': '#2563eb',
            '--tw-prose-bold': '#0f172a',
            '--tw-prose-counters': '#64748b',
            '--tw-prose-bullets': '#94a3b8',
            '--tw-prose-hr': '#e2e8f0',
            '--tw-prose-quotes': '#0f172a',
            '--tw-prose-quote-borders': '#e2e8f0',
            '--tw-prose-captions': '#64748b',
            '--tw-prose-code': '#0f172a',
            '--tw-prose-pre-code': '#e2e8f0',
            '--tw-prose-pre-bg': '#1e293b',
            '--tw-prose-invert-body': '#cbd5e1',
            '--tw-prose-invert-headings': '#e2e8f0',
            '--tw-prose-invert-lead': '#94a3b8',
            '--tw-prose-invert-links': '#60a5fa',
            '--tw-prose-invert-bold': '#ffffff',
            '--tw-prose-invert-counters': '#94a3b8',
            '--tw-prose-invert-bullets': '#475569',
            '--tw-prose-invert-hr': '#334155',
            '--tw-prose-invert-quotes': '#f1f5f9',
            '--tw-prose-invert-quote-borders': '#334155',
            '--tw-prose-invert-captions': '#94a3b8',
            '--tw-prose-invert-code': '#ffffff',
            '--tw-prose-invert-pre-code': '#cbd5e1',
            '--tw-prose-invert-pre-bg': 'rgb(0 0 0 / 50%)',
            '--tw-prose-invert-th-borders': '#475569',
            '--tw-prose-invert-td-borders': '#334155',
          },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
};