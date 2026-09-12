import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';

export default function GoalsCard() {
  const [goals, setGoals] = useState({
    daily_calorie_target: 2000,
    protein_grams: 150,
    carb_grams: 200,
    fat_grams: 65,
    weight_goal: 0
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [todaySummary, setTodaySummary] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [goalsRes, summaryRes] = await Promise.all([
        apiClient('/nutrition/goals').catch(() => null), // 404 if no goals set yet
        apiClient(`/nutrition/reports/weekly?date=${new Date().toISOString().split('T')[0]}`)
      ]);
      
      if (goalsRes) setGoals(goalsRes);
      
      if (summaryRes && summaryRes.length > 0) {
        // The last item in the 7-day report is today
        setTodaySummary(summaryRes[summaryRes.length - 1]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await apiClient('/nutrition/goals', {
        method: 'PUT',
        body: goals
      });
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to save goals', e);
      alert('Failed to save goals');
    }
  };

  if (loading) return <div>Loading...</div>;

  const renderMacro = (label, current, target) => {
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return (
      <div className="flex flex-col gap-1" style={{ flex: 1 }}>
        <div className="flex justify-between" style={{ fontSize: '12px' }}>
          <strong>{label}</strong>
          <span className="mono">{Math.round(current)} / {target}g ({pct}%)</span>
        </div>
        <div style={{ height: '8px', background: 'var(--border)', width: '100%', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: pct >= 100 ? 'var(--danger)' : 'var(--accent)', width: `${pct}%` }}></div>
        </div>
      </div>
    );
  };

  if (isEditing) {
    return (
      <div className="card flex flex-col gap-4">
        <h3>Edit Goals</h3>
        <div className="flex gap-4">
          <label className="flex flex-col gap-1">Calories
            <input type="number" value={goals.daily_calorie_target} onChange={e => setGoals({...goals, daily_calorie_target: parseInt(e.target.value)})} />
          </label>
          <label className="flex flex-col gap-1">Protein (g)
            <input type="number" value={goals.protein_grams} onChange={e => setGoals({...goals, protein_grams: parseInt(e.target.value)})} />
          </label>
          <label className="flex flex-col gap-1">Carbs (g)
            <input type="number" value={goals.carb_grams} onChange={e => setGoals({...goals, carb_grams: parseInt(e.target.value)})} />
          </label>
          <label className="flex flex-col gap-1">Fat (g)
            <input type="number" value={goals.fat_grams} onChange={e => setGoals({...goals, fat_grams: parseInt(e.target.value)})} />
          </label>
          <label className="flex flex-col gap-1">Weight Goal (kg)
            <input type="number" value={goals.weight_goal || 0} onChange={e => setGoals({...goals, weight_goal: parseFloat(e.target.value)})} />
          </label>
        </div>
        <div>
          <button onClick={handleSave}>Save</button>
          <button style={{ marginLeft: '10px' }} onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 style={{ margin: 0 }}>Today's Progress</h2>
        <button onClick={() => setIsEditing(true)}>Edit Goals</button>
      </div>

      <div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {Math.round(todaySummary.calories)} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {goals.daily_calorie_target} kcal</span>
        </div>
      </div>

      <div className="flex gap-6 mt-2">
        {renderMacro('Protein', todaySummary.protein, goals.protein_grams)}
        {renderMacro('Carbs', todaySummary.carbs, goals.carb_grams)}
        {renderMacro('Fat', todaySummary.fat, goals.fat_grams)}
      </div>
    </div>
  );
}
