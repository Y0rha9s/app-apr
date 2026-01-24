import { useState } from 'react';

function Logo({ className = '', size = 'md' }) {
  const [imageError, setImageError] = useState(false);
  
  const sizeClasses = {
    sm: 'h-8 w-auto',
    md: 'h-12 w-auto',
    lg: 'h-16 w-auto',
    xl: 'h-20 w-auto',
    '2xl': 'h-24 w-auto'
  };

  const emojiSizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-6xl',
    '2xl': 'text-7xl'
  };

  // Si hay error, mostrar emoji
  if (imageError) {
    return <span className={`${emojiSizes[size]} ${className}`}>💧</span>;
  }

  return (
    <img 
      src="/logo-apr.png" 
      alt="Logo APR" 
      className={`${sizeClasses[size]} ${className} object-contain`}
      onError={() => {
        console.log('Error cargando logo: /logo-apr.png no encontrado');
        setImageError(true);
      }}
      onLoad={() => {
        console.log('Logo cargado correctamente');
      }}
    />
  );
}

export default Logo;
