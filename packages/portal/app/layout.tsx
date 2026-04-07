import type { Metadata } from "next";
import "./tailwind.css";

export const metadata: Metadata = {
  title: "Agora Developer Portal",
  description: "Manage your Agora API keys, view usage, and manage billing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-[#e5e5e5] font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
