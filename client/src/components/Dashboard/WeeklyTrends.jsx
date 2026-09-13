import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';

export default function WeeklyTrends() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calories'); // 'calories' | 'macros'

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

  // Max values for scaling
  const maxCalories = Math.max(...report.map(d => d.calories), 2000);
  const maxMacros = Math.max(
    ...report.map(d => d.protein + d.carbs + d.fat), 
    150 // Fallback max for macros (e.g. 150g total) to avoid divide by zero if empty
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Weekly Trend</h3>
        <select 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value)}
          style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
        >
          <option value="calories">Calories</option>
          <option value="macros">Macros (P/C/F)</option>
        </select>
      </div>

      {viewMode === 'macros' && (
        <div className="flex gap-4 items-center justify-center" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
          <div className="flex items-center gap-1"><span style={{ display: 'inline-block', width: '10px', height: '10px', background: 'var(--accent-blue, #3b82f6)' }}></span> Protein</div>
          <div className="flex items-center gap-1"><span style={{ display: 'inline-block', width: '10px', height: '10px', background: 'var(--accent-green, #10b981)' }}></span> Carbs</div>
          <div className="flex items-center gap-1"><span style={{ display: 'inline-block', width: '10px', height: '10px', background: 'var(--accent-orange, #f59e0b)' }}></span> Fat</div>
        </div>
      )}

      <div className="flex items-end gap-2" style={{ height: '200px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        {report.map((day, i) => {
          // Format date like 'Mon, Sep 6'
          const [y, m, d] = day.date.split('-');
          const localDate = new Date(y, m - 1, d);
          const formattedDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(localDate);

          if (viewMode === 'calories') {
            const heightPct = Math.min(100, Math.round((day.calories / maxCalories) * 100));
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
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formattedDate}</span>
              </div>
            );
          } else {
            // Stacked bar for macros
            const totalMacros = day.protein + day.carbs + day.fat;
            const proteinPct = totalMacros > 0 ? (day.protein / totalMacros) * 100 : 0;
            const carbsPct = totalMacros > 0 ? (day.carbs / totalMacros) * 100 : 0;
            const fatPct = totalMacros > 0 ? (day.fat / totalMacros) * 100 : 0;
            const totalHeightPct = Math.min(100, Math.round((totalMacros / maxMacros) * 100));

            return (
              <div key={i} className="flex flex-col items-center justify-end gap-1" style={{ flex: 1, height: '100%' }}>
                <span className="mono" style={{ fontSize: '10px', opacity: totalMacros > 0 ? 1 : 0 }}>
                  {Math.round(totalMacros)}g
                </span>
                
                <div 
                  className="flex flex-col justify-end"
                  style={{ 
                    width: '100%', 
                    maxWidth: '40px',
                    height: `${totalHeightPct}%`,
                    minHeight: '2px'
                  }}
                >
                  <div style={{ height: `${proteinPct}%`, background: 'var(--accent-blue, #3b82f6)', width: '100%' }}></div>
                  <div style={{ height: `${carbsPct}%`, background: 'var(--accent-green, #10b981)', width: '100%' }}></div>
                  <div style={{ height: `${fatPct}%`, background: 'var(--accent-orange, #f59e0b)', width: '100%' }}></div>
                </div>

                <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formattedDate}</span>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
