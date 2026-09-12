import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';

export default function WeeklyTrends() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const today = new Intl.DateTimeFormat('en-CA').format(new Date());
      const data = await apiClient(`/nutrition/reports/weekly?localDate=${today}`);
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading trends...</div>;

  // Max calories for scaling the chart
  const maxCalories = Math.max(...report.map(d => d.calories), 2000);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Weekly Caloric Trend</h3>
      <div className="flex items-end gap-2" style={{ height: '200px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        {report.map((day, i) => {
          const heightPct = Math.min(100, Math.round((day.calories / maxCalories) * 100));
          
          // Format date like 'Mon, Sep 6'
          // day.date is YYYY-MM-DD, parsing it as local time:
          const [y, m, d] = day.date.split('-');
          const localDate = new Date(y, m - 1, d);
          const formattedDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(localDate);

          return (
            <div key={i} className="flex flex-col items-center justify-end gap-1" style={{ flex: 1, height: '100%' }}>
              <span className="mono" style={{ fontSize: '10px' }}>{Math.round(day.calories)}</span>
              <div 
                style={{ 
                  width: '100%', 
                  maxWidth: '40px',
                  background: 'var(--accent)', 
                  height: `${heightPct}%`,
                  minHeight: '2px'
                }}
              ></div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {formattedDate}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
