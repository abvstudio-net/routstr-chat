import { Message, MessageContent } from '@/types/chat';

/**
 * Extracts text content from a message that can be either string or multimodal content
 * @param content The message content (string or MessageContent array)
 * @returns The text content as a string
 */
export const getTextFromContent = (content: string | MessageContent[]): string => {
  if (typeof content === 'string') return content;
  const textContent = content.find(item => item.type === 'text');
  return textContent?.text || '';
};

/**
 * Converts a Message object to the format expected by the API
 * @param message The message to convert
 * @returns Object with role and content for API consumption
 */
export const convertMessageForAPI = (message: Message): { role: string; content: string | MessageContent[] } => {
  return {
    role: message.role,
    content: message.content
  };
};

/**
 * Creates a simple text message
 * @param role The message role (user, assistant, system)
 * @param text The text content
 * @returns A Message object with text content
 */
export const createTextMessage = (role: string, text: string): Message => {
  return {
    role,
    content: text
  };
};

/**
 * Creates a multimodal message with text and images
 * @param role The message role (user, assistant, system)
 * @param text The text content
 * @param images Array of image URLs
 * @returns A Message object with multimodal content
 */
export const createMultimodalMessage = (role: string, text: string, images: string[]): Message => {
  const content: MessageContent[] = [
    { type: 'text', text }
  ];

  images.forEach(imageUrl => {
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl }
    });
  });

  return {
    role,
    content
  };
};

/**
 * Strips image data from messages for storage optimization
 * @param messages Array of messages to process
 * @returns Array of messages with image data removed
 */
export const stripImageDataFromMessages = (messages: Message[]): Message[] => {
  return messages.map(msg => {
    if (Array.isArray(msg.content)) {
      const textContent = msg.content.filter(item => item.type === 'text');
      if (textContent.length === 0 && msg.content.some(item => item.type === 'image_url')) {
        // If only images were present, save a placeholder
        return { ...msg, content: '[Image(s) not saved to local storage]' };
      }
      return { ...msg, content: textContent.length > 0 ? textContent : '[Content removed]' };
    }
    return msg;
  });
};