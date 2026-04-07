import type { Metadata } from "next";
import "./tailwind.css";

export const metadata: Metadata = {
  title: "Agora Demo — AI Shopping Agent",
  description:
    "Search and discover products across e-commerce stores using AI. Powered by the Agora API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-[#e5e5e5] font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
