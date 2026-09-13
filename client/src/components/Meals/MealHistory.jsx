import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import FilterBar from './FilterBar';

export default function MealHistory({ reloadCounter }) {
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    mealType: 'All',
  });
  
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    fetchEntries();
  }, [reloadCounter, filters, page]);

  useEffect(() => {
    const hasProcessing = entries.some(e => e.status === 'PROCESSING');
    if (!hasProcessing) return;

    const intervalId = setInterval(() => {
      fetchEntries();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [entries]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      let url = `/nutrition/entries?page=${page}&limit=${limit}`;
      if (filters.startDate) url += `&startDate=${filters.startDate}`;
      if (filters.endDate) url += `&endDate=${filters.endDate}`;
      if (filters.mealType && filters.mealType !== 'All') url += `&mealType=${filters.mealType}`;
      
      const data = await apiClient(url);
      
      if (data && typeof data === 'object' && 'entries' in data) {
        setEntries(data.entries);
        setTotalCount(data.totalCount);
      } else {
        setEntries(data);
        setTotalCount(data.length);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    if (name === 'clear') {
      setFilters({ startDate: '', endDate: '', mealType: 'All' });
      setPage(1);
      return;
    }
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1); // Reset to page 1 on filter change
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({
      quantity: entry.quantity,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: Number(value) }));
  };

  const saveEdit = async (id) => {
    try {
      await apiClient(`/nutrition/entries/${id}`, {
        method: 'PUT',
        body: editForm
      });
      setEditingId(null);
      fetchEntries(); 
    } catch (e) {
      alert('Failed to update entry');
    }
  };

  const deleteEntry = async (id) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await apiClient(`/nutrition/entries/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      alert('Failed to delete entry');
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  if (loading && entries.length === 0) return <div>Loading history...</div>;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Meal History</h3>
      
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
      
      {entries.length === 0 ? (
        <p>No entries found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Cals</th>
                <th>P / C / F</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(entry.logged_at).toLocaleDateString()}
                  </td>
                  <td>{entry.meal_type}</td>
                  <td>{entry.item_name}</td>
                  
                  {entry.status === 'PROCESSING' ? (
                    <td colSpan="4">
                      <span className="badge">Processing...</span>
                    </td>
                  ) : entry.status === 'FAILED' ? (
                    <td colSpan="4">
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--danger)' }}>Failed to process image</span>
                        <button className="danger" onClick={() => deleteEntry(entry.id)}>Del</button>
                      </div>
                    </td>
                  ) : editingId === entry.id ? (
                    <>
                      <td><input name="quantity" type="number" step="0.1" value={editForm.quantity} onChange={handleEditChange} style={{ width: '60px' }} /> {entry.quantity_unit}</td>
                      <td><input name="calories" type="number" value={editForm.calories} onChange={handleEditChange} style={{ width: '60px' }} /></td>
                      <td className="mono">
                        <input name="protein" type="number" step="0.1" value={editForm.protein} onChange={handleEditChange} style={{ width: '40px' }} /> / 
                        <input name="carbs" type="number" step="0.1" value={editForm.carbs} onChange={handleEditChange} style={{ width: '40px' }} /> / 
                        <input name="fat" type="number" step="0.1" value={editForm.fat} onChange={handleEditChange} style={{ width: '40px' }} />
                      </td>
                      <td className="flex gap-2">
                        <button onClick={() => saveEdit(entry.id)}>Save</button>
                        <button onClick={() => setEditingId(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{entry.quantity} {entry.quantity_unit}</td>
                      <td className="mono">{entry.calories}</td>
                      <td className="mono">{entry.protein} / {entry.carbs} / {entry.fat}</td>
                      <td className="flex gap-2">
                        <button onClick={() => startEdit(entry)}>Edit</button>
                        <button className="danger" onClick={() => deleteEntry(entry.id)}>Del</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-between items-center" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.85rem' }}>Page {page} of {totalPages}</span>
          <button 
            disabled={page === totalPages} 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
