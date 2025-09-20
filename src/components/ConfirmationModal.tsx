import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'warning' | 'danger' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning'
}) => {
  if (!isOpen) return null;

  const getVariantClasses = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: '⚠️',
          bg: 'from-red-600 to-red-700',
          border: 'border-red-400',
          confirmBtn: 'bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border-red-400',
          iconBg: 'from-red-200 to-red-300'
        };
      case 'info':
        return {
          icon: 'ℹ️',
          bg: 'from-blue-600 to-blue-700',
          border: 'border-blue-400',
          confirmBtn: 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-400',
          iconBg: 'from-blue-200 to-blue-300'
        };
      default: // warning
        return {
          icon: '⚠️',
          bg: 'from-amber-600 to-amber-700',
          border: 'border-amber-400',
          confirmBtn: 'bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border-amber-400',
          iconBg: 'from-amber-200 to-amber-300'
        };
    }
  };

  const variantClasses = getVariantClasses();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div 
        className={`
          relative bg-gradient-to-br ${variantClasses.bg} border-4 ${variantClasses.border} 
          rounded-2xl shadow-2xl p-8 max-w-md mx-4 transform transition-all duration-300
          animate-in zoom-in-95 fade-in-0
        `}
        style={{
          backgroundColor: variant === 'danger' ? '#dc2626' : variant === 'info' ? '#2563eb' : '#d97706', // Fallback modal background
          backgroundImage: variant === 'danger' 
            ? 'linear-gradient(to bottom right, #dc2626, #b91c1c)' 
            : variant === 'info' 
            ? 'linear-gradient(to bottom right, #2563eb, #1d4ed8)'
            : 'linear-gradient(to bottom right, #d97706, #b45309)', // Fallback modal gradient
          border: variant === 'danger' ? '4px solid #f87171' : variant === 'info' ? '4px solid #60a5fa' : '4px solid #fbbf24' // Fallback modal border
        }}
      >
        {/* Icon */}
        <div 
          className={`
            w-16 h-16 bg-gradient-to-br ${variantClasses.iconBg} rounded-full 
            flex items-center justify-center text-3xl mx-auto mb-4
          `}
          style={{
            backgroundColor: variant === 'danger' ? '#fecaca' : variant === 'info' ? '#bfdbfe' : '#fef3c7', // Fallback icon background
            backgroundImage: variant === 'danger' 
              ? 'linear-gradient(to bottom right, #fecaca, #fca5a5)' 
              : variant === 'info' 
              ? 'linear-gradient(to bottom right, #bfdbfe, #93c5fd)'
              : 'linear-gradient(to bottom right, #fef3c7, #fde68a)' // Fallback icon gradient
          }}
        >
          {variantClasses.icon}
        </div>
        
        {/* Title */}
        <h3 className="text-2xl font-bold text-white text-center mb-4">
          {title}
        </h3>
        
        {/* Message */}
        <p className="text-white/90 text-center mb-8 leading-relaxed">
          {message}
        </p>
        
        {/* Buttons */}
        <div className="flex space-x-4 justify-center">
          <button
            onClick={onCancel}
            className="
              px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl
              transition-all duration-200 transform hover:scale-105 active:scale-95
              border-2 border-gray-400 hover:border-white/30
              focus:outline-none focus:ring-4 focus:ring-gray-400/30
            "
            style={{
              backgroundColor: '#4b5563', // gray-600
              backgroundImage: 'linear-gradient(to bottom right, #4b5563, #374151)', // gray-600 to gray-700
              border: '2px solid #9ca3af' // gray-400
            }}
          >
            {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            className={`
              px-6 py-3 ${variantClasses.confirmBtn} text-white font-bold rounded-xl
              transition-all duration-200 transform hover:scale-105 active:scale-95
              border-2 hover:border-white/30 shadow-lg
              focus:outline-none focus:ring-4 focus:ring-white/30
            `}
            style={{
              backgroundColor: variant === 'danger' ? '#dc2626' : variant === 'info' ? '#2563eb' : '#d97706', // Fallback colors
              backgroundImage: variant === 'danger' 
                ? 'linear-gradient(to bottom right, #dc2626, #b91c1c)' 
                : variant === 'info' 
                ? 'linear-gradient(to bottom right, #2563eb, #1d4ed8)'
                : 'linear-gradient(to bottom right, #d97706, #b45309)', // Fallback gradients
              border: variant === 'danger' ? '2px solid #f87171' : variant === 'info' ? '2px solid #60a5fa' : '2px solid #fbbf24' // Fallback borders
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
