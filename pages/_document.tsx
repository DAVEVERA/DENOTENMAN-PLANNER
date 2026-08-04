import Document, { Html, Head, Main, NextScript, type DocumentContext, type DocumentInitialProps } from 'next/document'

interface PlannerDocumentProps extends DocumentInitialProps {
  inspectionMode: boolean
}

export default class PlannerDocument extends Document<PlannerDocumentProps> {
  static async getInitialProps(ctx: DocumentContext): Promise<PlannerDocumentProps> {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps, inspectionMode: ctx.pathname.startsWith('/inspectie') }
  }

  render() {
    const { inspectionMode } = this.props
    return (
      <Html lang={inspectionMode ? 'nl-BE' : 'nl'}>
        <Head>
          <meta charSet="utf-8" />
          <meta name="theme-color" content={inspectionMode ? '#100C0A' : '#C8882A'} />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" href="/favicon.png" type="image/png" />
          <link rel="apple-touch-icon" href="/favicon.png" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          {!inspectionMode && <link rel="preconnect" href="https://fonts.googleapis.com" />}
          {!inspectionMode && <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />}
          {!inspectionMode && <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />}
        </Head>
        <body>
          <Main />
          <NextScript />
          <script dangerouslySetInnerHTML={{ __html: `
            if (location.pathname.startsWith('/inspectie') && 'serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                return Promise.all(registrations.map(function(registration) { return registration.unregister(); }));
              }).catch(function() {});
            } else if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              });
            }
          ` }} />
        </body>
      </Html>
    )
  }
}
