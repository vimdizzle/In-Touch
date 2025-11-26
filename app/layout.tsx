import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "In Touch",
  description: "Stay in touch with the people who matter",
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

