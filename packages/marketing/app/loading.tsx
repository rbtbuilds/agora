export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#050508",
      }}
    >
      <div
        aria-label="Loading"
        style={{
          width: 32,
          height: 32,
          border: "2px solid rgba(167,139,250,0.2)",
          borderTopColor: "#a78bfa",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
