import { Studio } from "@/components/studio";
export default function Page() { return <Studio demo={process.env.DEMO_MODE !== "false"} />; }
