import type { Metadata } from "next";
import { Deck } from "@/components/deck";
export const metadata: Metadata = { title: "REPOsona — presentation", description: "A short slideshow introducing REPOsona and the team behind it." };
export default function PresentPage() { return <Deck />; }
