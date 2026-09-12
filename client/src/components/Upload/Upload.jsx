import ImageUploader from './ImageUploader';

export default function Upload() {
  return (
    <div className="flex flex-col gap-6" style={{ marginTop: '20px' }}>
      <h1>Upload Meal Photo</h1>
      <ImageUploader />
    </div>
  );
}
