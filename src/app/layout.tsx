import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "REPOsona — meet your repository", description: "Meet the original character behind your GitHub repository in a voice and video conversation." };
export const viewport: Viewport = { themeColor: "#f7f6f3", viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
