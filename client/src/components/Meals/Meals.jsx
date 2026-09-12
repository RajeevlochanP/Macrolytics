import { useState } from 'react';
import MealEntryForm from './MealEntryForm';
import MealHistory from './MealHistory';

export default function Meals() {
  const [reloadCounter, setReloadCounter] = useState(0);

  const handleEntryAdded = () => {
    setReloadCounter(c => c + 1);
  };

  return (
    <div className="flex flex-col gap-6" style={{ marginTop: '20px' }}>
      <h1>Meal Tracking</h1>
      <MealEntryForm onEntryAdded={handleEntryAdded} />
      <MealHistory reloadCounter={reloadCounter} />
    </div>
  );
}
