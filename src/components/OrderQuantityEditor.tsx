import React, { useState, useEffect } from 'react';
import { Minus, Plus, Zap } from 'lucide-react';

export interface OrderQuantityEditorProps {
  baseOrders?: number;
  multiplier?: number;
  value?: number;
  onChangeBaseOrders?: (newBase: number) => void;
  onChangeMultiplier?: (newMult: number) => void;
  onChange?: (newBase: number, newMult: number) => void;
  compact?: boolean;
}

export const OrderQuantityEditor: React.FC<OrderQuantityEditorProps> = ({
  baseOrders: propBaseOrders,
  multiplier = 1.0,
  value,
  onChangeBaseOrders,
  onChangeMultiplier,
  onChange,
  compact = false,
}) => {
  const currentBase = propBaseOrders !== undefined ? propBaseOrders : value !== undefined ? value : 0;

  const handleBaseChange = (newBase: number) => {
    if (onChangeBaseOrders) onChangeBaseOrders(newBase);
    if (onChange) onChange(newBase, multiplier);
  };

  const handleMultChange = (newMult: number) => {
    if (onChangeMultiplier) onChangeMultiplier(newMult);
    if (onChange) onChange(currentBase, newMult);
  };

  const [inputValue, setInputValue] = useState<string>(String(Math.round(currentBase)));
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(Math.round(currentBase)));
    }
  }, [currentBase, isEditing]);

  const commitValue = () => {
    setIsEditing(false);
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      handleBaseChange(parsed);
    } else {
      setInputValue(String(Math.round(currentBase)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setInputValue(String(Math.round(currentBase)));
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const stepChange = (delta: number) => {
    const nextVal = Math.max(0, Math.round(currentBase + delta));
    setInputValue(String(nextVal));
    handleBaseChange(nextVal);
  };

  const effectiveOrders = Math.round(currentBase * multiplier);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Stepper Buttons and Direct Input */}
      <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-2xs overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
        <button
          type="button"
          onClick={() => stepChange(-50)}
          className="p-1 hover:bg-slate-100 text-slate-600 transition"
          title="Subtract 50 orders"
          aria-label="Subtract 50 orders"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <input
          type="text"
          value={isEditing ? inputValue : String(Math.round(currentBase))}
          onFocus={() => setIsEditing(true)}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={handleKeyDown}
          className="w-14 text-center font-bold text-slate-900 border-x border-slate-200 py-0.5 outline-none tabular-nums text-xs"
          title="Click to edit daily orders. Enter to save, Esc to cancel."
          aria-label="Daily orders"
        />

        <button
          type="button"
          onClick={() => stepChange(50)}
          className="p-1 hover:bg-slate-100 text-slate-600 transition"
          title="Add 50 orders"
          aria-label="Add 50 orders"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Surge Multiplier Pills (1x, 1.5x, 2x) */}
      <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        {[1.0, 1.5, 2.0].map((rate) => {
          const isActive = multiplier === rate;
          return (
            <button
              key={rate}
              type="button"
              onClick={() => handleMultChange(rate)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title={`Surge multiplier ${rate}x`}
            >
              {rate}x
            </button>
          );
        })}
      </div>

      {/* Effective Orders Indicator if Surge is Active */}
      {multiplier !== 1.0 && (
        <span
          className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-800 border border-amber-200 tabular-nums"
          title={`Effective daily demand with ${multiplier}x surge multiplier`}
        >
          <Zap className="h-3 w-3 text-amber-600" />
          <span>= {effectiveOrders.toLocaleString()}</span>
        </span>
      )}
    </div>
  );
};
