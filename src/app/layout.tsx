import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elenchus — Multi-LLM Debate Orchestrator",
  description:
    "Challenge your ideas with multiple AI models that debate, critique, and converge on well-tested conclusions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="relative">{children}</body>
    </html>
  );
}
