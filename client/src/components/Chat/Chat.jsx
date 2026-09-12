import Assistant from './Assistant';

export default function Chat() {
  return (
    <div className="flex flex-col gap-6" style={{ marginTop: '20px' }}>
      <h1>AI Assistant</h1>
      <p style={{ marginTop: '-10px', color: 'var(--text-muted)' }}>
        Stateless conversational interface.
      </p>
      <Assistant />
    </div>
  );
}
