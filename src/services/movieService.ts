import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Movie } from '../types';

// --- ROBUST FALLBACK MOVIE SEED DATA ---
export const DEFAULT_MOVIES: Movie[] = [
  {
    id: 'movie-1',
    title: 'The Sovereign Network: Inside Quantum Infrastructure',
    description: 'An exclusive investigation into the ultra-secure distributed ledgers and quantum encryption networks being deployed across Switzerland\'s private banking sectors.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-blue-lights-42287-large.mp4',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop',
    category: 'Documentary',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    likes: 382,
    likedBy: [],
    shreds: 4,
    shreddedBy: [],
    downloads: 128,
    views: 3410,
    duration: '02:45',
    author: 'Elena Rostova'
  },
  {
    id: 'movie-2',
    title: 'Algorithmic Capital: The Zurich Secret',
    description: 'Explores the secretive autonomous trading algorithms operating without human intervention inside Zurich\'s high-frequency finance districts.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-matrix-style-code-screen-background-42939-large.mp4',
    imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600&auto=format&fit=crop',
    category: 'Investigation',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    likes: 512,
    likedBy: [],
    shreds: 12,
    shreddedBy: [],
    downloads: 245,
    views: 5290,
    duration: '01:50',
    author: 'Kaelen Vance'
  },
  {
    id: 'movie-3',
    title: 'Deep Ocean Nautilus: The Engineering Marvel',
    description: 'Breathtaking high-definition cinematic footage of the brand new, €340 Million hydrogen-powered mega-yacht sailing through open ocean trials.',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-shot-of-a-yacht-on-the-sea-43094-large.mp4',
    imageUrl: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?q=80&w=600&auto=format&fit=crop',
    category: 'Sovereign Cinematic',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
    likes: 819,
    likedBy: [],
    shreds: 1,
    shreddedBy: [],
    downloads: 412,
    views: 8900,
    duration: '03:10',
    author: 'Julian Mercer'
  }
];

// --- LOCAL STORAGE HELPERS ---
function getLocalMovies(): Movie[] {
  try {
    const data = localStorage.getItem('boss_news_movies');
    if (!data) {
      localStorage.setItem('boss_news_movies', JSON.stringify(DEFAULT_MOVIES));
      return DEFAULT_MOVIES;
    }
    return JSON.parse(data);
  } catch (e) {
    return DEFAULT_MOVIES;
  }
}

function saveLocalMovies(movies: Movie[]) {
  try {
    localStorage.setItem('boss_news_movies', JSON.stringify(movies));
  } catch (e) {
    console.error("Local storage movies save failed", e);
  }
}

// --- MOVIE DATABASE SERVICES ---
export const movieService = {
  async getMovies(): Promise<Movie[]> {
    const localMovies = getLocalMovies();
    try {
      const colRef = collection(db, 'movies');
      const snapPromise = getDocs(colRef);
      const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));
      
      const snap = await Promise.race([snapPromise, timeoutPromise]);
      if (snap) {
        const dbMovies = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movie));
        
        // Merge cloud with local (preserve unsynced local creations and user-created content to avoid deletion on sync latency)
        const dbIdSet = new Set(dbMovies.map(m => m.id));
        const localPreserved = localMovies.filter(m => 
          !dbIdSet.has(m.id) && 
          (m.id.startsWith('movie-local-') || (!m.id.startsWith('movie-') || m.id.length > 8))
        );
        
        const merged = [...dbMovies, ...localPreserved];
        saveLocalMovies(merged);
        return merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      }
    } catch (error) {
      console.warn("Firestore offline or timeout. Falling back to local movies storage.", error);
    }
    return localMovies.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  },

  async createMovie(movie: Omit<Movie, 'id'>): Promise<string> {
    const id = 'movie-local-' + Math.random().toString(36).substr(2, 9);
    const newMovie: Movie = { id, ...movie };
    
    const local = getLocalMovies();
    local.unshift(newMovie);
    saveLocalMovies(local);

    try {
      const colRef = collection(db, 'movies');
      const cleaned = Object.fromEntries(
        Object.entries(movie).filter(([_, v]) => v !== undefined)
      );
      
      const writePromise = addDoc(colRef, cleaned).then(docRef => {
        const updatedLocal = getLocalMovies();
        const index = updatedLocal.findIndex(m => m.id === id);
        if (index !== -1) {
          updatedLocal[index].id = docRef.id;
          saveLocalMovies(updatedLocal);
        }
        return docRef.id;
      });

      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
      );

      return await Promise.race([writePromise, timeoutPromise]);
    } catch (error) {
      console.warn("Could not sync movie to cloud Firestore. Saved in client database.", error);
      return id;
    }
  },

  async updateMovie(id: string, movie: Partial<Movie>): Promise<void> {
    const local = getLocalMovies();
    const index = local.findIndex(m => m.id === id);
    if (index !== -1) {
      local[index] = { ...local[index], ...movie };
      saveLocalMovies(local);
    }

    try {
      const docRef = doc(db, 'movies', id);
      const cleaned = Object.fromEntries(
        Object.entries(movie).filter(([_, v]) => v !== undefined)
      );
      
      const writePromise = updateDoc(docRef, cleaned);
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
      );

      await Promise.race([writePromise, timeoutPromise]);
    } catch (error) {
      console.warn("Could not sync movie update to Firestore.", error);
    }
  },

  async deleteMovie(id: string): Promise<void> {
    const local = getLocalMovies();
    const filtered = local.filter(m => m.id !== id);
    saveLocalMovies(filtered);

    try {
      const docRef = doc(db, 'movies', id);
      const writePromise = deleteDoc(docRef);
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
      );

      await Promise.race([writePromise, timeoutPromise]);
    } catch (error) {
      console.warn("Could not sync movie deletion to cloud.", error);
    }
  },

  async likeMovie(id: string, userId: string): Promise<void> {
    const local = getLocalMovies();
    const index = local.findIndex(m => m.id === id);
    let action: 'like' | 'unlike' = 'like';
    
    if (index !== -1) {
      const m = local[index];
      m.likedBy = m.likedBy || [];
      if (m.likedBy.includes(userId)) {
        m.likedBy = m.likedBy.filter(uid => uid !== userId);
        m.likes = Math.max(0, m.likes - 1);
        action = 'unlike';
      } else {
        m.likedBy.push(userId);
        m.likes = (m.likes || 0) + 1;
        action = 'like';
      }
      saveLocalMovies(local);
    }

    try {
      const docRef = doc(db, 'movies', id);
      const writePromise = updateDoc(docRef, {
        likes: increment(action === 'like' ? 1 : -1),
        likedBy: action === 'like' ? arrayUnion(userId) : arrayRemove(userId)
      });
      const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));
      await Promise.race([writePromise, timeoutPromise]);
    } catch (error) {
      console.warn("Could not sync like state to cloud.", error);
    }
  },

  async shredMovie(id: string, userId: string): Promise<void> {
    const local = getLocalMovies();
    const index = local.findIndex(m => m.id === id);
    let action: 'shred' | 'unshred' = 'shred';
    
    if (index !== -1) {
      const m = local[index];
      m.shreddedBy = m.shreddedBy || [];
      if (m.shreddedBy.includes(userId)) {
        m.shreddedBy = m.shreddedBy.filter(uid => uid !== userId);
        m.shreds = Math.max(0, m.shreds - 1);
        action = 'unshred';
      } else {
        m.shreddedBy.push(userId);
        m.shreds = (m.shreds || 0) + 1;
        action = 'shred';
      }
      saveLocalMovies(local);
    }

    try {
      const docRef = doc(db, 'movies', id);
      const writePromise = updateDoc(docRef, {
        shreds: increment(action === 'shred' ? 1 : -1),
        shreddedBy: action === 'shred' ? arrayUnion(userId) : arrayRemove(userId)
      });
      const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));
      await Promise.race([writePromise, timeoutPromise]);
    } catch (error) {
      console.warn("Could not sync shred state to cloud.", error);
    }
  },

  async incrementMovieViews(id: string): Promise<void> {
    const local = getLocalMovies();
    const index = local.findIndex(m => m.id === id);
    if (index !== -1) {
      local[index].views = (local[index].views || 0) + 1;
      saveLocalMovies(local);
    }

    try {
      const docRef = doc(db, 'movies', id);
      const writePromise = updateDoc(docRef, {
        views: increment(1)
      });
      const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));
      await Promise.race([writePromise, timeoutPromise]);
    } catch (error) {
      console.warn("Could not increment movie views.", error);
    }
  },

  async incrementMovieDownloads(id: string): Promise<void> {
    const local = getLocalMovies();
    const index = local.findIndex(m => m.id === id);
    if (index !== -1) {
      local[index].downloads = (local[index].downloads || 0) + 1;
      saveLocalMovies(local);
    }

    try {
      const docRef = doc(db, 'movies', id);
      const writePromise = updateDoc(docRef, {
        downloads: increment(1)
      });
      const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));
      await Promise.race([writePromise, timeoutPromise]);
    } catch (error) {
      console.warn("Could not increment movie downloads.", error);
    }
  }
};
