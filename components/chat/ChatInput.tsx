import { useRef } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (message: string) => void;
  uploadedImages: string[];
  setUploadedImages: React.Dispatch<React.SetStateAction<string[]>>;
  sendMessage: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  textareaHeight: number;
  setTextareaHeight: (height: number) => void;
  isSidebarCollapsed: boolean;
  isMobile: boolean;
}

export default function ChatInput({
  inputMessage,
  setInputMessage,
  uploadedImages,
  setUploadedImages,
  sendMessage,
  isLoading,
  isAuthenticated,
  textareaHeight,
  setTextareaHeight,
  isSidebarCollapsed,
  isMobile
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          const base64 = await convertFileToBase64(file);
          newImages.push(base64);
        } catch (error) {
          console.error('Error converting file to base64:', error);
        }
      }
    }

    setUploadedImages((prev: string[]) => [...prev, ...newImages]);

    // Reset the input value to allow uploading the same file again
    if (event.target) {
      event.target.value = '';
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
  };

  return (
    <div className={`fixed bottom-0 bg-black/95 backdrop-blur-sm p-3 md:p-4 z-30 ${isMobile ? 'left-0 right-0' : isSidebarCollapsed ? 'left-0 right-0' : 'left-72 right-0'}`}>
      <div className="mx-auto w-full max-w-2xl">
        {/* Image Preview */}
        {uploadedImages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {uploadedImages.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image}
                  alt={`Upload ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg border border-white/10"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isAuthenticated ? `Ask anything...` : `Sign in to start chatting...`}
            className="flex-1 bg-white/5 border border-white/10 rounded-3xl px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none pl-14 pr-12 resize-none min-h-[48px] max-h-32 overflow-y-auto"
            autoComplete="off"
            data-tutorial="chat-input"
            rows={1}
            style={{
              height: 'auto',
              minHeight: '48px'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              const newHeight = Math.min(target.scrollHeight, 128);
              target.style.height = newHeight + 'px';
              setTextareaHeight(newHeight);
            }}
          />

          {/* Image upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!isAuthenticated}
            className={`absolute left-3 p-2 rounded-full bg-transparent hover:bg-white/10 disabled:opacity-50 disabled:bg-transparent transition-colors cursor-pointer ${textareaHeight <= 48 ? 'top-1/2 transform -translate-y-1/2' : 'bottom-2'}`}
            aria-label="Upload image"
          >
            <ImagePlus className="h-5 w-5 text-white" />
          </button>

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={isLoading || (!isAuthenticated && !inputMessage.trim() && uploadedImages.length === 0)}
            className={`absolute right-3 p-2 rounded-full bg-transparent hover:bg-white/10 disabled:opacity-50 disabled:bg-transparent transition-colors cursor-pointer ${textareaHeight <= 48 ? 'top-1/2 transform -translate-y-1/2' : 'bottom-2'}`}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Send className="h-5 w-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 