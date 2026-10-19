import Dashboard from "./dashboard-client";

export const metadata = {
  title: "Sleepy Dogs Club visitor dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <Dashboard />;
}
