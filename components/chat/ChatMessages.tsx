import { Message, MessageContent } from '@/types/chat';
import { Edit, MessageSquare } from 'lucide-react';
import MessageContentRenderer from '@/components/MessageContent';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ThinkingSection from '@/components/ui/ThinkingSection';
import { RefObject } from 'react';

interface ChatMessagesProps {
  messages: Message[];
  streamingContent: string;
  editingMessageIndex: number | null;
  editingContent: string;
  setEditingContent: (content: string) => void;
  startEditingMessage: (index: number) => void;
  cancelEditing: () => void;
  saveInlineEdit: () => void;
  retryMessage: (index: number) => void;
  getTextFromContent: (content: string | MessageContent[]) => string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export default function ChatMessages({
  messages,
  streamingContent,
  editingMessageIndex,
  editingContent,
  setEditingContent,
  startEditingMessage,
  cancelEditing,
  saveInlineEdit,
  retryMessage,
  getTextFromContent,
  messagesEndRef
}: ChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto pt-[60px] pb-[80px]">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6 py-4 md:py-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 pt-24">
            <MessageSquare className="h-16 w-16 mb-6 text-white/20" />
            <p className="text-base text-white/80">Send a message to start chatting</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className="mb-8 last:mb-0">
              {message.role === 'user' ? (
                <div className="flex justify-end mb-6">
                  <div className="max-w-[85%]">
                    {editingMessageIndex === index ? (
                      <div className="flex flex-col w-full">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm text-white focus:outline-none focus:border-white/40"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                          <button
                            onClick={cancelEditing}
                            className="text-xs text-gray-300 hover:text-white bg-white/10 px-3 py-1.5 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveInlineEdit}
                            className="text-xs text-white bg-black px-3 py-1.5 rounded hover:bg-black/80"
                          >
                            Save & Send
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="group relative">
                          <div className="bg-gray-700/70 rounded-2xl py-3 px-4 text-white">
                            <div className="text-sm">
                              <MessageContentRenderer content={message.content} />
                            </div>
                          </div>
                          <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => startEditingMessage(index)}
                              className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                              aria-label="Edit message"
                            >
                              <Edit className="w-3 h-3 text-white/70" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : message.role === 'system' ? (
                <div className="flex justify-center mb-6 group">
                  <div className="flex flex-col">
                    <div className="bg-red-500/20 border border-red-500/30 rounded-lg py-3 px-4 text-red-200">
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-300">
                          <path d="M12 9v4M12 21h.01M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <p className="text-sm font-medium">{getTextFromContent(message.content)}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => retryMessage(index)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-black/50 hover:bg-black/70 rounded-md px-3 py-1.5 transition-colors cursor-pointer"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="rotate-45"
                        >
                          <path
                            d="M21.168 8A10.003 10.003 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M17 8h4.4a.6.6 0 0 0 .6-.6V3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start mb-6 group">
                  {message.thinking && (
                    <ThinkingSection thinking={message.thinking} />
                  )}
                  <div className="max-w-[95%] text-gray-100 py-2 px-0.5">
                    <MessageContentRenderer content={message.content} />
                  </div>
                  <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => retryMessage(index)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-black/50 hover:bg-black/70 rounded-md px-3 py-1.5 transition-colors cursor-pointer"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="rotate-45"
                      >
                        <path
                          d="M21.168 8A10.003 10.003 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M17 8h4.4a.6.6 0 0 0 .6-.6V3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {streamingContent && (
          <div className="flex flex-col items-start mb-6">
            <div className="max-w-[95%] text-gray-100 py-2 px-0.5">
              <MarkdownRenderer content={streamingContent} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
} 