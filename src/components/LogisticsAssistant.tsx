import React, { useState, useEffect, useRef } from 'react';
import { Currency } from '../types';
import { formatMoney } from '../lib/currency';
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings2,
  RefreshCw,
} from 'lucide-react';

interface ExtractedParams {
  warehouse_count?: number | null;
  warehouse_capacity?: number | null;
  max_service_radius_km?: number | null;
  cost_per_km?: number | null;
  fixed_cost_per_warehouse?: number | null;
  priority_preset?: 'cost' | 'speed' | 'sustainability' | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  confirmationCard?: {
    params: ExtractedParams;
    readyToOptimize: boolean;
    warnings?: string[];
  };
  groundedFacts?: string[];
}

interface LogisticsAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyParams: (params: {
    p?: number;
    warehouseCapacity?: number;
    radiusMaxKm?: number | null;
    deliveryCostInr?: number;
    fixedLeaseInr?: number;
    priorityPreset?: 'cost' | 'speed' | 'sustainability';
  }) => void;
  pageContext: Record<string, any>;
  currency: Currency;
}

export const LogisticsAssistant: React.FC<LogisticsAssistantProps> = ({
  isOpen,
  onClose,
  onApplyParams,
  pageContext,
  currency,
}) => {
  const [mode, setMode] = useState<'setup' | 'explain'>('setup');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your Logistics AI Assistant. You can describe your network requirements in natural language (e.g. "Optimize 3 warehouses with 4000 daily capacity and 20 km radius") or ask me to explain the mathematical optimization results on your screen.',
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable confirmation card state
  const [editingParams, setEditingParams] = useState<ExtractedParams | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 150);
    }
  }, [isOpen, messages]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Suggested Prompts
  const setupPrompts = [
    'Optimize 3 warehouses for Bengaluru with 4000 capacity',
    'Set up 4 distribution hubs with 20 km max service radius',
    'Green network prioritizing emissions with 2 hubs',
  ];

  const explainPrompts = [
    'Why is this warehouse configuration mathematically optimal?',
    'What is our capacity headroom and throughput buffer?',
    'Why were these specific sites selected over runner-up candidates?',
  ];

  const handleSend = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || isLoading) return;

    setInput('');
    setErrorMessage(null);

    const userMsgId = `user-${Date.now()}`;
    const newMessages: Message[] = [
      ...messages,
      { id: userMsgId, role: 'user', content: promptText },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      if (mode === 'setup') {
        const historyPayload = newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch('/api/agent/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: promptText,
            history: historyPayload.slice(-6),
            known_params: editingParams || {},
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Agent request failed (${res.status})`);
        }

        const data = await res.json();
        const extracted = data.extracted_params || {};

        setEditingParams(extracted);

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.reply || 'I have extracted your optimization parameters.',
            confirmationCard: {
              params: extracted,
              readyToOptimize: data.ready_to_optimize ?? true,
              warnings: data.warnings,
            },
          },
        ]);
      } else {
        // Explain Mode
        const historyPayload = newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch('/api/agent/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page: 'networkOverview',
            message: promptText,
            page_context: pageContext,
            history: historyPayload.slice(-6),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Explanation request failed (${res.status})`);
        }

        const data = await res.json();

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.reply,
            groundedFacts: data.grounded_facts,
          },
        ]);
      }
    } catch (err: any) {
      console.error('Logistics Assistant error:', err);
      setErrorMessage(
        err.message || 'Unable to communicate with the Logistics Assistant service. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyOptimization = () => {
    if (!editingParams) return;

    onApplyParams({
      p: editingParams.warehouse_count ?? undefined,
      warehouseCapacity: editingParams.warehouse_capacity ?? undefined,
      radiusMaxKm: editingParams.max_service_radius_km ?? undefined,
      deliveryCostInr: editingParams.cost_per_km ?? undefined,
      fixedLeaseInr: editingParams.fixed_cost_per_warehouse ?? undefined,
      priorityPreset: editingParams.priority_preset ?? undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-md transform bg-white shadow-2xl transition-all duration-300 flex flex-col border-l border-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 id="assistant-title" className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Logistics AI Assistant</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                    Grounded
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500">Natural-language parameterization & mathematical explanation</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Close Assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-5 py-2 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('setup')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                mode === 'setup'
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>1. Network Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('explain')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                mode === 'explain'
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>2. Explain Results</span>
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs leading-relaxed ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Grounded Facts List (if in Explain mode) */}
                  {msg.groundedFacts && msg.groundedFacts.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Grounded Mathematical Facts:</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {msg.groundedFacts.map((fact, idx) => (
                          <li key={idx}>{fact}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Parameter Confirmation Card (if extracted in Setup mode) */}
                  {msg.confirmationCard && (
                    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-slate-900">
                      <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 mb-2">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-blue-900 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                          <span>Extracted Parameters</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.2 rounded">
                            {currency}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Validated
                          </span>
                        </div>
                      </div>

                      <div className="mb-2 text-[10px] text-slate-600">
                        Default lease baseline: {formatMoney(editingParams?.fixed_cost_per_warehouse ?? 15000, currency)}/site/day
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded bg-white/80 p-2 border border-blue-100">
                          <label className="text-[10px] text-slate-500 font-medium">Warehouses (p):</label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={editingParams?.warehouse_count ?? 3}
                            onChange={(e) =>
                              setEditingParams((prev) => ({
                                ...(prev || {}),
                                warehouse_count: parseInt(e.target.value, 10) || 1,
                              }))
                            }
                            className="w-full font-bold text-slate-900 bg-transparent outline-none"
                          />
                        </div>

                        <div className="rounded bg-white/80 p-2 border border-blue-100">
                          <label className="text-[10px] text-slate-500 font-medium">Capacity (orders/day):</label>
                          <input
                            type="number"
                            step={500}
                            value={editingParams?.warehouse_capacity ?? 4000}
                            onChange={(e) =>
                              setEditingParams((prev) => ({
                                ...(prev || {}),
                                warehouse_capacity: parseFloat(e.target.value) || 1000,
                              }))
                            }
                            className="w-full font-bold text-slate-900 bg-transparent outline-none"
                          />
                        </div>

                        <div className="rounded bg-white/80 p-2 border border-blue-100">
                          <label className="text-[10px] text-slate-500 font-medium">Max Service Radius:</label>
                          <input
                            type="number"
                            value={editingParams?.max_service_radius_km ?? 25}
                            onChange={(e) =>
                              setEditingParams((prev) => ({
                                ...(prev || {}),
                                max_service_radius_km: parseFloat(e.target.value) || null,
                              }))
                            }
                            className="w-full font-bold text-slate-900 bg-transparent outline-none"
                          />
                        </div>

                        <div className="rounded bg-white/80 p-2 border border-blue-100">
                          <label className="text-[10px] text-slate-500 font-medium">Priority Preset:</label>
                          <select
                            value={editingParams?.priority_preset ?? 'cost'}
                            onChange={(e) =>
                              setEditingParams((prev) => ({
                                ...(prev || {}),
                                priority_preset: e.target.value as any,
                              }))
                            }
                            className="w-full font-bold text-slate-900 bg-transparent outline-none"
                          >
                            <option value="cost">Cost Focus</option>
                            <option value="speed">Speed (20km)</option>
                            <option value="sustainability">Green</option>
                          </select>
                        </div>
                      </div>

                      {msg.confirmationCard.warnings && msg.confirmationCard.warnings.length > 0 && (
                        <div className="mt-2 text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                          {msg.confirmationCard.warnings.join(' • ')}
                        </div>
                      )}

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleApplyOptimization}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Apply & Run Optimization</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Error Notification Banner */}
            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold">Assistant Notice: </span>
                  <span>{errorMessage}</span>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleSend(messages[messages.length - 1]?.content)}
                      className="inline-flex items-center gap-1 rounded bg-red-200/80 px-2.5 py-1 text-[11px] font-bold text-red-900 hover:bg-red-300"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span>Assistant is processing your request...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="border-t border-slate-200 bg-slate-50/90 px-4 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Suggested queries:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(mode === 'setup' ? setupPrompts : explainPrompts).map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-900 transition disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Input Bar */}
          <div className="border-t border-slate-200 bg-white p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === 'setup'
                    ? 'e.g. Set up 3 warehouses with 4000 capacity...'
                    : 'e.g. Why is this solution optimal?'
                }
                disabled={isLoading}
                className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsAssistant;
