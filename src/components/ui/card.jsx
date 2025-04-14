import React from 'react';

export function Card({ className, ...props }) {
  return (
    <div
      className={`bg-white shadow-lg rounded-lg p-4 ${className}`}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return (
    <div className={`p-4 ${className}`} {...props} />
  );
}
