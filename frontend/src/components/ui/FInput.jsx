import { forwardRef } from 'react';
import { COLORS } from '../../constants/theme.js';

/**
 * Input estilizado.
 * Compatible con react-hook-form (`{...register('campo')}` por refForwarding).
 */
const FInput = forwardRef(function FInput(
  { label, placeholder, type = 'text', error, ...rest }, ref,
) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        {...rest}
        style={{
          background: COLORS.surface,
          border: `1px solid ${error ? COLORS.red : COLORS.border}`,
          borderRadius: 9, padding: '10px 14px',
          color: COLORS.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={(e) => (e.target.style.borderColor = COLORS.accent)}
        onBlur={(e) => (e.target.style.borderColor = error ? COLORS.red : COLORS.border)}
      />
      {error && (
        <span style={{ color: COLORS.red, fontSize: 11 }}>{error}</span>
      )}
    </div>
  );
});

export default FInput;
