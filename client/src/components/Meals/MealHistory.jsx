import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';

export default function MealHistory({ reloadCounter }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchEntries();
  }, [reloadCounter]);

  const fetchEntries = async () => {
    try {
      const data = await apiClient('/nutrition/entries');
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
      fetchEntries(); // reload to get exact DB values
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

  if (loading) return <div>Loading history...</div>;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Meal History</h3>
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
                  
                  {editingId === entry.id ? (
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
    </div>
  );
}
