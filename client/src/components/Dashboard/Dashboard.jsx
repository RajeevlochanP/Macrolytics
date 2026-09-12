import GoalsCard from './GoalsCard';
import WeeklyTrends from './WeeklyTrends';

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6" style={{ marginTop: '20px' }}>
      <h1>Dashboard</h1>
      <GoalsCard />
      <WeeklyTrends />
    </div>
  );
}
