'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Brain, Copy, Check } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface ThinkingSectionProps {
  thinking?: string;
  isStreaming?: boolean;
}

export default function ThinkingSection({ thinking, isStreaming = false }: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!thinking && !isStreaming) return null;

  const handleCopy = async () => {
    if (!thinking) return;
    try {
      await navigator.clipboard.writeText(thinking);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy thinking text:', err);
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        <Brain className="w-3 h-3" />
        <span>{isStreaming ? 'thinking...' : 'thinking'}</span>
        <ChevronDown 
          className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
        />
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded-lg relative group">
              {thinking && (
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 rounded transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Copy thinking text"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              <div className="text-xs text-gray-300 font-mono leading-relaxed">
                {thinking ? (
                  <MarkdownRenderer content={thinking} />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" />
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}