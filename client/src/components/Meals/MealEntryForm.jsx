import { useState } from 'react';
import { apiClient } from '../../api/client';

export default function MealEntryForm({ onEntryAdded }) {
  const [formData, setFormData] = useState({
    meal_type: 'Breakfast',
    item_name: '',
    quantity: 1,
    quantity_unit: 'serving',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const entry = await apiClient('/nutrition/entries', {
        method: 'POST',
        body: {
          ...formData,
          date: new Date().toLocaleDateString('en-CA')
        }
      });
      onEntryAdded(entry);
      // Reset form
      setFormData({
        meal_type: 'Breakfast',
        item_name: '',
        quantity: 1,
        quantity_unit: 'serving',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  return (
    <div className="card flex flex-col gap-4">
      <h3 style={{ margin: 0 }}>Manual Entry</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-4">
          <label className="flex flex-col gap-1">Meal Type
            <select name="meal_type" value={formData.meal_type} onChange={handleChange}>
              <option>Breakfast</option>
              <option>Lunch</option>
              <option>Dinner</option>
              <option>Snacks</option>
            </select>
          </label>
          <label className="flex flex-col gap-1" style={{ flex: 1 }}>Item Name
            <input name="item_name" value={formData.item_name} onChange={handleChange} required />
          </label>
        </div>

        <div className="flex gap-4">
          <label className="flex flex-col gap-1" style={{ width: '80px' }}>Qty
            <input name="quantity" type="number" step="0.1" value={formData.quantity} onChange={handleChange} required />
          </label>
          <label className="flex flex-col gap-1" style={{ flex: 1 }}>Unit
            <input name="quantity_unit" value={formData.quantity_unit} onChange={handleChange} required />
          </label>
          <label className="flex flex-col gap-1" style={{ width: '80px' }}>Calories
            <input name="calories" type="number" value={formData.calories} onChange={handleChange} required />
          </label>
        </div>

        <div className="flex gap-4">
          <label className="flex flex-col gap-1" style={{ flex: 1 }}>Protein (g)
            <input name="protein" type="number" step="0.1" value={formData.protein} onChange={handleChange} required />
          </label>
          <label className="flex flex-col gap-1" style={{ flex: 1 }}>Carbs (g)
            <input name="carbs" type="number" step="0.1" value={formData.carbs} onChange={handleChange} required />
          </label>
          <label className="flex flex-col gap-1" style={{ flex: 1 }}>Fat (g)
            <input name="fat" type="number" step="0.1" value={formData.fat} onChange={handleChange} required />
          </label>
        </div>
        
        <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Add Entry'}</button>
      </form>
    </div>
  );
}
