export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div
        aria-label="Loading"
        className="w-8 h-8 rounded-full border-2 border-accent/20 border-t-accent"
        style={{ animation: "spin 0.8s linear infinite" }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
