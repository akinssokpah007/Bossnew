export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
}

export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  content: string;
  author: string;
  authorEmail?: string;
  country: string; // e.g. "US", "GB", "Global"
  region: string;  // e.g. "North America", "Europe", "Asia", "World"
  category: string; // slug of category
  tags: string[];   // list of tag names/slugs
  featured: boolean;
  breaking: boolean;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt: string; // ISO String
  scheduledAt?: string; // ISO String
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  views: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  timestamp: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  imageUrl?: string;
  category: string;
  condition: 'new' | 'used' | 'refurbished' | 'not_applicable';
  sellerName: string;
  sellerPhone: string;
  sellerWhatsApp?: string;
  sellerEmail?: string;
  status: 'available' | 'sold' | 'archived';
  createdAt: string;
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  imageUrl?: string; // Poster or background image
  category: string;  // e.g. "Documentary", "Special Investigation", "Sovereign Cinematic"
  publishedAt: string;
  likes: number;
  likedBy: string[]; // User IDs who liked
  shreds: number;
  shreddedBy: string[]; // User IDs who shredded
  downloads: number;
  views: number;
  duration?: string; // e.g. "02:15" or "1:45:00"
  author: string;
}


