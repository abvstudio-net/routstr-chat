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

export interface TransactionHistory {
  type: 'spent' | 'mint' | 'send' | 'import' | 'refund';
  amount: number;
  timestamp: number;
  status: 'success' | 'failed';
  model?: string;
  message?: string;
  balance?: number;
}