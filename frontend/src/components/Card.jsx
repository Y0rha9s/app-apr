function Card({ children, title, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-soft hover:shadow-medium transition-shadow duration-300 p-8 ${className}`}>
      {title && (
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800 border-b-2 border-gray-100 pb-4">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

export default Card;