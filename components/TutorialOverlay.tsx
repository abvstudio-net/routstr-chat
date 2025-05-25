'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, MessageSquare, Settings, PlusCircle, ChevronDown } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
}

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Routstr Chat',
    description: 'Experience decentralized AI chat powered by Bitcoin Lightning.',
    position: 'center',
    icon: <MessageSquare className="h-6 w-6" />
  },
  {
    id: 'model-selection',
    title: 'Choose Your AI Model',
    description: 'Access models from various providers. Each model has different capabilities and pricing - choose what works best for you.',
    target: 'model-selector',
    position: 'bottom',
    icon: <ChevronDown className="h-5 w-5" />
  },
  {
    id: 'new-chat',
    title: 'Start Fresh Conversations',
    description: 'Create new chat sessions to explore different topics. Your conversations stay private and are stored only on your device.',
    target: 'new-chat-button',
    position: 'right',
    icon: <PlusCircle className="h-5 w-5" />
  },
  {
    id: 'settings',
    title: 'Lightning-Fast Payments',
    description: 'Top up your balance with Bitcoin Lightning for instant, private payments. No credit cards needed.',
    target: 'settings-button',
    position: 'right',
    icon: <Settings className="h-5 w-5" />
  },
  {
    id: 'chat-input',
    title: 'Start Chatting',
    description: 'Ask anything - from coding help to creative writing. Your privacy is guaranteed with our decentralized architecture.',
    target: 'chat-input',
    position: 'top',
    icon: <MessageSquare className="h-5 w-5" />
  }
];

export default function TutorialOverlay({ isOpen, onClose, onComplete }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightElement, setHighlightElement] = useState<HTMLElement | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const step = tutorialSteps[currentStep];
    if (step.target) {
      const element = document.querySelector(`[data-tutorial="${step.target}"]`) as HTMLElement;
      setHighlightElement(element);
      if (element) {
        setHighlightRect(element.getBoundingClientRect());
      }
    } else {
      setHighlightElement(null);
      setHighlightRect(null);
    }
  }, [currentStep, isOpen]);

  // Update highlight position on scroll/resize
  useEffect(() => {
    if (!highlightElement || !isOpen) return;

    const updateHighlight = () => {
      setHighlightRect(highlightElement.getBoundingClientRect());
    };

    window.addEventListener('scroll', updateHighlight);
    window.addEventListener('resize', updateHighlight);

    return () => {
      window.removeEventListener('scroll', updateHighlight);
      window.removeEventListener('resize', updateHighlight);
    };
  }, [highlightElement, isOpen]);

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  const skipTutorial = () => {
    onClose();
  };

  if (!isOpen) return null;

  const currentStepData = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!highlightRect || currentStepData.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 60
      };
    }

    const rect = highlightRect;
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const offset = 16;
    const verticalOffset = -200; // Increased shift up to 100px for better positioning

    let style: React.CSSProperties = {
      position: 'fixed' as const,
      zIndex: 60
    };

    switch (currentStepData.position) {
      case 'top':
        style.top = rect.top - tooltipHeight - offset;
        style.left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        style.top = rect.bottom + offset;
        style.left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        style.top = rect.top + (rect.height / 2) - (tooltipHeight / 2) + verticalOffset;
        style.left = rect.left - tooltipWidth - offset;
        break;
      case 'right':
        style.top = rect.top + (rect.height / 2) - (tooltipHeight / 2) + verticalOffset;
        style.left = rect.right + offset;
        break;
    }

    // Ensure tooltip stays within viewport
    if (style.left && typeof style.left === 'number') {
      style.left = Math.max(16, Math.min(style.left, window.innerWidth - tooltipWidth - 16));
    }
    if (style.top && typeof style.top === 'number') {
      style.top = Math.max(16, Math.min(style.top, window.innerHeight - tooltipHeight - 16));
    }

    return style;
  };

  return (
    <>
      {/* Backdrop with minimal opacity and no blur */}
      <div className="fixed inset-0 bg-black/20 z-50" />

      {/* Highlight overlay */}
      {highlightRect && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
            border: '2px solid #ffffff',
            borderRadius: '8px',
            boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.2)',
            animation: 'pulse 2s infinite'
          }}
        />
      )}

      {/* Tutorial tooltip */}
      <div
        className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-80 p-6 text-white"
        style={{
          ...getTooltipPosition(),
          ...(currentStepData.id === 'settings' && {
            transform: 'none',
            width: '320px'
          })
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {currentStepData.icon && (
              <div className="p-2 bg-white/10 rounded-lg text-white">
                {currentStepData.icon}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-white text-lg">
                {currentStepData.title}
              </h3>
              <p className="text-xs text-white/50">
                Step {currentStep + 1} of {tutorialSteps.length}
              </p>
            </div>
          </div>
          <button
            onClick={skipTutorial}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-white/70" />
          </button>
        </div>

        {/* Content */}
        <p className="text-white/80 text-sm mb-6 leading-relaxed">
          {currentStepData.description}
        </p>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-white/50 mb-2">
            <span>Progress</span>
            <span>{Math.round(((currentStep + 1) / tutorialSteps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div
              className="bg-white h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={skipTutorial}
            className="text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-white/90 transition-colors"
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </>
  );
} 