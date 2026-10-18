import Dashboard from "./dashboard-client";

export const metadata = {
  title: "Eepy Dog visitor dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <Dashboard />;
}
