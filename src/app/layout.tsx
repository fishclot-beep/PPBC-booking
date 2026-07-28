import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "動力運動館｜線上預約",
  description: "複合式運動場館線上預約系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
