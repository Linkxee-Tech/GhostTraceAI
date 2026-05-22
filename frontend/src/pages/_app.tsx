import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#151b23',
            color: '#e8edf2',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: '"Space Mono", monospace',
            fontSize: '12px',
          },
          success: { iconTheme: { primary: '#00e5a0', secondary: '#0a0c0f' } },
          error:   { iconTheme: { primary: '#ff3b5c', secondary: '#0a0c0f' } },
        }}
      />
    </>
  );
}
