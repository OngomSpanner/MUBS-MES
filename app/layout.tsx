import type { Metadata } from "next";
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fontsource/dm-sans/300.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/dm-sans/800.css';
import IdleTimeout from '@/components/IdleTimeout';
import BootstrapClient from '@/components/BootstrapClient';

export const metadata: Metadata = {
  title: "MUBS M&E System",
  description: "MUBS Monitoring & Evaluation System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-bs-theme="light">
      <head />
      <body style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <IdleTimeout />
        <BootstrapClient />
        {children}
      </body>
    </html>
  );
}