import type { Metadata } from "next";
import { Toaster } from "sonner";
import { APP_DESCRIPTION, APP_NAME } from "@/config/app";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
