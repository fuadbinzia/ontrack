import type { PropsWithChildren } from 'react';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="apple-itunes-app" content="app-id=6789723522" />
        <meta
          name="description"
          content="Open shared checklists, travel plans, dates, and itineraries in onTrack."
        />
        {/* Defense-in-depth against XSS on the web invite shell. Prefer HTTP
            headers at the edge when available; meta cannot set frame-ancestors. */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; object-src 'none'; base-uri 'self'"
        />
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html, body, #root { height: 100%; min-height: 100%; margin: 0; } #root { display: flex; } body { min-height: 100vh; min-height: 100dvh; background: #FBFAF7; } * { scrollbar-width: none; -ms-overflow-style: none; } *::-webkit-scrollbar { display: none; width: 0; height: 0; }',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
