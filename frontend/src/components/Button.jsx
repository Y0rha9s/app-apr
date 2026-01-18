function Button({ children, onClick, variant = 'primary', type = 'button', className = '', disabled = false }) {
  const baseClasses = 'px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-gradient-to-r from-primary-400 to-primary-500 text-gray-900 hover:from-primary-500 hover:to-primary-600 font-bold',
    secondary: 'bg-gradient-to-r from-secondary-500 to-secondary-600 text-white hover:from-secondary-600 hover:to-secondary-700',
    success: 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700',
    outline: 'bg-white border-2 border-primary-500 text-primary-700 hover:bg-primary-50',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export default Button;