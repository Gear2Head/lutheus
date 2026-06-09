// SECTION: APP_BOOTSTRAP
// PURPOSE: Root layout for the Next.js application, including metadata and global styles import.
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "Lutheus - AI Moderation & Discord Bot Dashboard",
  description: "Lutheus AI Moderation Suite, Discord Bot Control Panel, and Punishment Reporting System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased min-h-screen bg-[#0b0c10] text-[#f5f5f7]">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
