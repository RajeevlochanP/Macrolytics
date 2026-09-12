import { useState, useRef, useEffect } from 'react';
import { apiClient } from '../../api/client';

export default function ImageUploader() {
  const [file, setFile] = useState(null);
  const [mealType, setMealType] = useState('Breakfast');
  const [status, setStatus] = useState('IDLE'); // IDLE, UPLOADING, AWAITING_PROCESSING, COMPLETED, FAILED
  const [jobId, setJobId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const pollInterval = useRef(null);

  const startPolling = (jobId) => {
    pollInterval.current = setInterval(async () => {
      try {
        const job = await apiClient(`/jobs/${jobId}`);
        if (job.status === 'COMPLETED') {
          setStatus('COMPLETED');
          setResult(job);
          clearInterval(pollInterval.current);
        } else if (job.status === 'FAILED') {
          setStatus('FAILED');
          setError(job.failedReason || 'Processing failed');
          clearInterval(pollInterval.current);
        } else {
          setStatus('PROCESSING');
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setStatus('UPLOADING');
    setError(null);
    setResult(null);

    try {
      // 1. Get presigned URL
      const { url, key, jobId: newJobId } = await apiClient('/uploads/presigned-url', {
        method: 'POST',
        body: {
          fileName: file.name,
          contentType: file.type,
          mealType
        }
      });

      // 2. Upload directly to S3
      const uploadRes = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadRes.ok) throw new Error('Failed to upload to storage');

      // 3. Start polling
      setJobId(newJobId);
      setStatus('AWAITING_PROCESSING');
      startPolling(newJobId);

    } catch (e) {
      setStatus('FAILED');
      setError(e.message);
    }
  };

  const renderBadge = () => {
    switch (status) {
      case 'UPLOADING': return <span className="badge">Uploading to S3...</span>;
      case 'AWAITING_PROCESSING': return <span className="badge">In Queue...</span>;
      case 'PROCESSING': return <span className="badge">AI Extracting...</span>;
      case 'COMPLETED': return <span className="badge success">Extraction Complete</span>;
      case 'FAILED': return <span className="badge danger">Failed</span>;
      default: return null;
    }
  };

  return (
    <div className="card flex flex-col gap-4" style={{ maxWidth: '600px' }}>
      <h3 style={{ margin: 0 }}>AI Vision Extraction</h3>
      
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">Meal Type
          <select value={mealType} onChange={e => setMealType(e.target.value)}>
            <option>Breakfast</option>
            <option>Lunch</option>
            <option>Dinner</option>
            <option>Snacks</option>
          </select>
        </label>
        
        <label className="flex flex-col gap-1">Meal Image (JPEG, PNG, HEIC)
          <input 
            type="file" 
            accept="image/*" 
            onChange={e => setFile(e.target.files[0])}
            disabled={status !== 'IDLE' && status !== 'COMPLETED' && status !== 'FAILED'}
          />
        </label>

        <div className="flex items-center gap-4">
          <button 
            type="submit" 
            disabled={!file || (status !== 'IDLE' && status !== 'COMPLETED' && status !== 'FAILED')}
          >
            Process Image
          </button>
          {renderBadge()}
        </div>
      </form>

      {error && (
        <div style={{ color: 'var(--danger)', marginTop: '10px' }}>
          <strong>Error: </strong> {error}
        </div>
      )}

      {result && result.extraction && (
        <div style={{ marginTop: '10px', padding: '10px', background: 'var(--hover)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Extracted Nutrition</h4>
          <div className="flex flex-col gap-2 mono" style={{ fontSize: '12px' }}>
            <div>Item: {result.extraction.item_name}</div>
            <div>Quantity: {result.extraction.quantity} {result.extraction.quantity_unit}</div>
            <div>Calories: {result.extraction.calories} kcal</div>
            <div>P: {result.extraction.protein}g / C: {result.extraction.carbs}g / F: {result.extraction.fat}g</div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
            This entry has been automatically saved to your meal history.
          </p>
        </div>
      )}
    </div>
  );
}
