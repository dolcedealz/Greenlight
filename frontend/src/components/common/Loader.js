// frontend/src/components/common/Loader.js
import React from 'react';

const Loader = ({ 
  size = 'medium', 
  className = '',
  text = null 
}) => {
  const sizeClasses = {
    small: 'loader-small',
    medium: 'loader-medium', 
    large: 'loader-large'
  };

  const classes = [
    'loader',
    sizeClasses[size] || sizeClasses.medium,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="loader-container">
      <div className={classes}>
        <div className="loader-spinner"></div>
      </div>
      {text && <div className="loader-text">{text}</div>}
    </div>
  );
};

export default Loader;