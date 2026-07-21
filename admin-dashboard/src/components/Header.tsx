import React from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  loadingData: boolean;
}

export const Header: React.FC<HeaderProps> = ({ loadingData }) => {
  const location = useLocation();

  const getTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'إدارة تراخيص Beidar POS';
      case '/create':
        return 'إنشاء ترخيص بيع جديد';
      case '/keys':
        return 'إدارة مفاتيح الذكاء الاصطناعي';
      case '/logs':
        return 'سجلات الأنشطة والتدقيق';
      default:
        return 'لوحة التحكم';
    }
  };

  return (
    <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-surface shrink-0">
      <div className="flex items-center gap-2">
        <h2 className="font-black text-lg text-text-main">
          {getTitle()}
        </h2>
      </div>
      {loadingData && (
        <div className="flex items-center gap-2 text-xs text-blue-500 font-semibold bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10 animate-pulse">
          <RefreshCw size={12} className="animate-spin" />
          <span>جاري تحميل التحديثات...</span>
        </div>
      )}
    </header>
  );
};
