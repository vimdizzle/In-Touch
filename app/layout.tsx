import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "In Touch - Supabase Demo",
  description: "Simple app to store data in Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

