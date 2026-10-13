import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
