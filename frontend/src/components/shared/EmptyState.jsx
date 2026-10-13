import React from 'react';
import { SearchX, ShoppingBag, Store, Leaf, Wrench, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconMap = {
  search: SearchX, orders: ShoppingBag, stores: Store,
  agriculture: Leaf, services: Wrench, classifieds: Tag,
};

export default function EmptyState({
  type = 'search', title = 'Nothing here yet',
  description = '', action, actionLabel = 'Try again', icon: CustomIcon
}) {
  const Icon = CustomIcon || iconMap[type] || SearchX;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4 max-w-xs">{description}</p>}
      {action && (
        <Button onClick={action} variant="outline" size="sm" className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
