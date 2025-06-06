// frontend/src/components/common/Input.js
import React from 'react';

const Input = ({ 
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  maxLength,
  ...props 
}) => {
  const baseClasses = 'input';
  const classes = [
    baseClasses,
    disabled ? 'input-disabled' : '',
    className
  ].filter(Boolean).join(' ');

  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value, e);
    }
  };

  return (
    <input
      type={type}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={classes}
      maxLength={maxLength}
      {...props}
    />
  );
};

export default Input;