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
      <div className={`
        relative bg-gradient-to-br ${variantClasses.bg} border-4 ${variantClasses.border} 
        rounded-2xl shadow-2xl p-8 max-w-md mx-4 transform transition-all duration-300
        animate-in zoom-in-95 fade-in-0
      `}>
        {/* Icon */}
        <div className={`
          w-16 h-16 bg-gradient-to-br ${variantClasses.iconBg} rounded-full 
          flex items-center justify-center text-3xl mx-auto mb-4
        `}>
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
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
