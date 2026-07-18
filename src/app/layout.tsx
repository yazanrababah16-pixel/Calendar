import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import * as ToastPrimitive from "@base-ui/react/toast";
import { ToasterViewport } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clinic Calendar — Appointment Scheduling",
  description: "Clinic appointment scheduling system with automated workflow management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <QueryProvider>
            <ToastPrimitive.Toast.Provider timeout={4000} limit={5}>
              <ErrorBoundary>{children}</ErrorBoundary>
              <ToasterViewport />
            </ToastPrimitive.Toast.Provider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
