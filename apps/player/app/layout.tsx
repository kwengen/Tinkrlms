import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tinkrakademiet — player",
  description: "cmi5-launcher og iframe-host, egen origin fra hovedappen",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
