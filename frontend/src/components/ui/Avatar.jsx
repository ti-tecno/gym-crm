export default function Avatar({ initials, size = 36, color }) {
  const bg = color || '#c47e0f';
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, ${bg}88, ${bg}44)`,
        border: `1px solid ${bg}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: '#EAEDF3',
        fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
