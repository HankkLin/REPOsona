import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Human README — meet your repository", description: "Meet the original character behind your GitHub repository in a voice and video conversation." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
