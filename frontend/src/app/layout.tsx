import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kabi Receipts - AI-Powered Receipt Management",
  description: "Upload receipts, extract data with AI, and store for future use",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased text-gray-100`}>
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "!bg-[#1a1a2e] !text-gray-100 !border !border-white/10",
              duration: 4000,
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
