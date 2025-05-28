export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface Message {
  role: string;
  content: string | MessageContent[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

export interface Model {
  id: string;
  name: string;
  description?: string;
  sats_pricing: {
    completion: number;
  };
} 