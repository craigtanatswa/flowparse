import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FlowParse — Turn bank statements into structured financial data",
    template: "%s · FlowParse",
  },
  description:
    "Convert PDF bank statements into reconciled Excel and CSV files. Digital and scanned statements supported, with an editable review step before you export.",
  applicationName: "FlowParse",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} antialiased`}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              color: "#101c18",
              border: "1px solid #e7ebe9",
              borderRadius: "14px",
              fontSize: "13px",
              boxShadow: "0 12px 32px -12px rgba(16, 28, 24, 0.18)",
            },
          }}
        />
      </body>
    </html>
  );
}
