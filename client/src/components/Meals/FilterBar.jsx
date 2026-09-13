import React from 'react';

export default function FilterBar({ filters, onFilterChange }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange(name, value);
  };

  return (
    <div className="flex gap-4 items-center flex-wrap" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
      <div className="flex flex-col gap-1">
        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Start Date</label>
        <input 
          type="date" 
          name="startDate" 
          value={filters.startDate} 
          onChange={handleChange}
          style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border)' }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>End Date</label>
        <input 
          type="date" 
          name="endDate" 
          value={filters.endDate} 
          onChange={handleChange}
          style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border)' }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Meal Type</label>
        <select 
          name="mealType" 
          value={filters.mealType} 
          onChange={handleChange}
          style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border)', minWidth: '120px' }}
        >
          <option value="All">All</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
          <option value="Snacks">Snacks</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1" style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
        <button onClick={() => onFilterChange('clear', null)} className="danger">
          Clear Filters
        </button>
      </div>
    </div>
  );
}
