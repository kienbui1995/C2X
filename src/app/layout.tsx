import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { LanguageProvider } from "@/components/language-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "chat-to-x · C2X",
  description:
    "Unofficial. Chat web nghĩ. Chọn Codex, Claude Code, Grok Build, OpenCode, Kiro CLI — một hoặc vài cái cùng phiên. Không liên kết OpenAI, Anthropic, Google, xAI, Amazon, OpenCode.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={cn("dark font-sans", geist.variable, geistMono.variable)}>
      <body>
        <TooltipProvider>
          <LanguageProvider>
            <AppShell>{children}</AppShell>
          </LanguageProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
