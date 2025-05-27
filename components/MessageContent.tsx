'use client';

import MarkdownRenderer from './MarkdownRenderer';

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface MessageContentProps {
  content: string | MessageContent[];
}

export default function MessageContentRenderer({ content }: MessageContentProps) {
  if (typeof content === 'string') {
    return <MarkdownRenderer content={content} />;
  }

  // Count the number of images
  const imageCount = content.filter(item => item.type === 'image_url').length;

  // Separate text and images
  const textContent = content.filter(item => item.type === 'text');
  const imageContent = content.filter(item => item.type === 'image_url');

  return (
    <div className="space-y-2">
      {/* Render text content first */}
      {textContent.map((item, index) => (
        <MarkdownRenderer key={`text-${index}`} content={item.text || ''} />
      ))}

      {/* Render images in a flex container */}
      {imageContent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageContent.map((item, index) => (
            <img
              key={`image-${index}`}
              src={item.image_url?.url}
              alt="User uploaded image"
              className={`${imageCount > 1 ? 'max-w-[200px] max-h-[200px]' : 'max-w-[300px] max-h-[300px]'} w-auto h-auto object-contain rounded-lg border border-white/10`}
            />
          ))}
        </div>
      )}
    </div>
  );
} 