import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Human README — meet your repository", description: "Give your GitHub repository a personality, an Octocat avatar, and a voice." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
