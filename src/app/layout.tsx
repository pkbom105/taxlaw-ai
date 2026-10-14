import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TaxLaw AI — ระบบค้นหากฎหมายภาษี (Zero-Hallucination RAG)",
  description: "ระบบ AI ค้นหากฎหมายและประมวลรัษฎากรไทย อ้างอิงแหล่งที่มา 100% ไม่มโนมาตรา สำหรับนักบัญชี ทนายความ และ SME",
  keywords: ["Thai Tax Law", "Revenue Code", "RAG", "AI", "Zero-Hallucination", "สรรพากร", "ประมวลรัษฎากร"],
  authors: [{ name: "TaxLaw AI" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Google Fonts: Sarabun (Thai) — React 19 จะ hoist <link> เข้า <head> ให้อัตโนมัติ */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"
        />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
