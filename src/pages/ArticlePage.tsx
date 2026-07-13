import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { newsService } from '../services/newsService';
import { Article, Category } from '../types';
import { 
  Clock, 
  ArrowLeft, 
  Eye, 
  Share2, 
  Globe, 
  Folder, 
  Calendar,
  Bookmark,
  Headphones,
  Volume2,
  Play,
  Pause,
  Square,
  Video
} from 'lucide-react';

// A lightweight, highly resilient markdown to JSX renderer for premium typography
function renderMarkdown(text: string = '') {
  const lines = text.split('\n');
  let elements: React.JSX.Element[] = [];
  let currentList: { type: 'ul' | 'ol', items: string[] } | null = null;

  const pushList = (key: string) => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={key} className="list-disc pl-6 my-4 space-y-2 text-slate-700 dark:text-slate-300">
            {currentList.items.map((it, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: parseInline(it) }} />)}
          </ul>
        );
      } else {
        elements.push(
          <ol key={key} className="list-decimal pl-6 my-4 space-y-2 text-slate-700 dark:text-slate-300">
            {currentList.items.map((it, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: parseInline(it) }} />)}
          </ol>
        );
      }
      currentList = null;
    }
  };

  const parseInline = (str: string) => {
    // Bold: **text**
    let parsed = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    return parsed;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('## ')) {
      pushList(`list-before-h2-${index}`);
      elements.push(
        <h2 key={index} className="text-2xl font-extrabold text-slate-900 dark:text-white mt-10 mb-4 tracking-tight">
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      pushList(`list-before-h3-${index}`);
      elements.push(
        <h3 key={index} className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-6 mb-3 tracking-tight">
          {trimmed.slice(4)}
        </h3>
      );
    }
    // Blockquote
    else if (trimmed.startsWith('> ')) {
      pushList(`list-before-bq-${index}`);
      elements.push(
        <blockquote key={index} className="border-l-4 border-violet-500 pl-4 py-1 my-6 italic text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 rounded-r-lg">
          {parseInline(trimmed.slice(2))}
        </blockquote>
      );
    }
    // Horizontal Rule
    else if (trimmed === '---') {
      pushList(`list-before-hr-${index}`);
      elements.push(<hr key={index} className="my-8 border-slate-200 dark:border-slate-800" />);
    }
    // Bullet List
    else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (!currentList || currentList.type !== 'ul') {
        pushList(`list-transition-ul-${index}`);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(trimmed.slice(2));
    }
    // Numbered List
    else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s(.*)/);
      if (match) {
        if (!currentList || currentList.type !== 'ol') {
          pushList(`list-transition-ol-${index}`);
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(match[1]);
      }
    }
    // Empty line
    else if (trimmed === '') {
      pushList(`list-before-empty-${index}`);
    }
    // Paragraph
    else {
      pushList(`list-before-p-${index}`);
      elements.push(
        <p key={index} className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 mb-6" dangerouslySetInnerHTML={{ __html: parseInline(trimmed) }} />
      );
    }
  });

  pushList('list-final');
  return elements;
}

const ArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);

  // Background ambient auto-translation states (not exposed as a selector, built into the app)
  const [translatedFields, setTranslatedFields] = useState<{
    title: string;
    subtitle: string;
    content: string;
    languageName?: string;
  } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Journalist Narration TTS states
  const [isPlayingNarrator, setIsPlayingNarrator] = useState(false);
  const [isPausedNarrator, setIsPausedNarrator] = useState(false);
  const [narratorStatus, setNarratorStatus] = useState<string>('');

  // Auto translation background loop
  useEffect(() => {
    if (!article) return;

    const autoTranslate = async () => {
      try {
        const userLanguage = navigator.language || 'en';
        const primaryCode = userLanguage.split('-')[0].toLowerCase();

        // Standard language map to English names
        const languageMap: Record<string, string> = {
          fr: 'French',
          es: 'Spanish',
          de: 'German',
          it: 'Italian',
          ja: 'Japanese',
          pt: 'Portuguese',
          ru: 'Russian',
          zh: 'Chinese',
          ar: 'Arabic',
          ko: 'Korean',
          nl: 'Dutch',
          hi: 'Hindi',
          tr: 'Turkish',
          vi: 'Vietnamese',
          sv: 'Swedish'
        };

        const targetLangName = languageMap[primaryCode];

        // Only translate if browser is set to non-English and we have a target language mapped
        if (primaryCode !== 'en' && targetLangName) {
          setIsTranslating(true);
          const response = await fetch('/api/translate-news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: article.title,
              subtitle: article.subtitle,
              content: article.content,
              targetLanguage: targetLangName
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data && !data.error && !data.fallback) {
              setTranslatedFields({
                title: data.title,
                subtitle: data.subtitle,
                content: data.content,
                languageName: targetLangName
              });
            }
          }
        }
      } catch (err) {
        console.warn("Background auto-translation failed:", err);
      } finally {
        setIsTranslating(false);
      }
    };

    autoTranslate();
  }, [article]);

  // Clean up any ongoing TTS on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startNarrator = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setNarratorStatus('Speech synthesis is not supported in this browser.');
      return;
    }

    try {
      if (window.speechSynthesis.speaking) {
        if (isPausedNarrator) {
          window.speechSynthesis.resume();
          setIsPausedNarrator(false);
          setIsPlayingNarrator(true);
          setNarratorStatus('Broadcasting report details...');
          return;
        } else {
          window.speechSynthesis.cancel();
        }
      }
    } catch (err) {
      console.warn("Speech Synthesis controls failed:", err);
      setNarratorStatus('Could not access Speech Synthesis. Try opening the app in a new tab.');
      return;
    }

    // Use translated content if available, otherwise original
    const speakTitle = translatedFields?.title || article.title;
    const speakAuthor = article.author;
    const speakContent = translatedFields?.content || article.content;

    // Prepare journalist script
    const intro = `This is Boss News global dispatch. Today's primary broadcast is titled: ${speakTitle}, reported by ${speakAuthor}.`;
    
    // Clean content paragraphs (strip markdown indicators)
    const cleanContent = speakContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        return line
          .replace(/^#+\s+/, '')
          .replace(/^>\s+/, '')
          .replace(/^\*\s+/, '')
          .replace(/^\d+\.\s+/, '')
          .replace(/\*\*/g, '')
          .replace(/\*/g, '');
      });

    const outro = "That concludes this Boss News broadcast. Stay informed and vigilant.";
    
    const fullScript = [intro, ...cleanContent, outro];
    setIsPlayingNarrator(true);
    setIsPausedNarrator(false);

    let currentIdx = 0;
    setNarratorStatus('Broadcasting introduction...');

    const speakNext = () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      if (currentIdx >= fullScript.length) {
        setIsPlayingNarrator(false);
        setNarratorStatus('Broadcast concluded.');
        setTimeout(() => setNarratorStatus(''), 4000);
        return;
      }

      if (currentIdx === 0) {
        setNarratorStatus('Broadcasting introduction...');
      } else if (currentIdx === fullScript.length - 1) {
        setNarratorStatus('Broadcasting sign-off...');
      } else {
        setNarratorStatus(`Broadcasting paragraph ${currentIdx} of ${fullScript.length - 2}...`);
      }

      const text = fullScript[currentIdx];
      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.rate = 0.92; // Deliberate, clear, authoritative pacing
      utterance.pitch = 0.95; // Slightly deeper, authoritative frequency
      
      try {
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => 
          v.name.includes('Google US English') || 
          v.name.includes('Natural') || 
          v.lang.startsWith('en-US') || 
          v.lang.startsWith('en')
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      } catch (err) {
        console.warn("Could not retrieve system voices:", err);
      }

      utterance.onend = () => {
        currentIdx++;
        speakNext();
      };

      utterance.onerror = (e) => {
        console.error("Speech Synthesis error:", e);
        setIsPlayingNarrator(false);
        setIsPausedNarrator(false);
        
        if (e.error === 'not-allowed') {
          setNarratorStatus('Broadcast blocked by iframe policy. Please click "Open in New Tab" at the top-right to listen.');
        } else {
          setNarratorStatus(`Broadcast issue: ${e.error || 'Check browser permissions or open in a new tab'}`);
        }
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error("Speak call failed:", err);
        setIsPlayingNarrator(false);
        setIsPausedNarrator(false);
        setNarratorStatus('Narration is blocked or unsupported in this sandbox. Please open in a new tab.');
      }
    };

    speakNext();
  };

  const pauseNarrator = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.pause();
        setIsPausedNarrator(true);
        setIsPlayingNarrator(false);
        setNarratorStatus('Broadcast paused.');
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const stopNarrator = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        setIsPlayingNarrator(false);
        setIsPausedNarrator(false);
        setNarratorStatus('Broadcast stopped.');
        setTimeout(() => setNarratorStatus(''), 2000);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const art = await newsService.getArticleBySlug(slug);
        if (art) {
          setArticle(art);
          // Increment views count in database (non-blocking background call)
          newsService.incrementViews(art.id).catch(err => console.warn(err));
        }
        const cats = await newsService.getCategories();
        setCategories(cats);
      } catch (error) {
        console.error("Error loading article page:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [slug]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center py-20">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Retrieving Dispatch...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-center py-20">
        <p className="text-xl font-bold text-slate-500">The requested article could not be resolved in the secure news feed.</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-full">
          <ArrowLeft className="w-4 h-4" /> Return to Main Feed
        </Link>
      </div>
    );
  }

  const articleCategory = categories.find(c => c.slug === article.category);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "image": [
      article.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1200&auto=format&fit=crop'
    ],
    "datePublished": article.createdAt || new Date().toISOString(),
    "dateModified": article.createdAt || new Date().toISOString(),
    "author": [{
      "@type": "Person",
      "name": article.author || 'Akin S. Sokpah',
      "url": 'https://ais-pre-zuhodhxob77wcr6tb4yo4i-561699256494.europe-west1.run.app'
    }],
    "publisher": {
      "@type": "NewsMediaOrganization",
      "name": "BossNews",
      "logo": {
        "@type": "ImageObject",
        "url": 'https://ais-pre-zuhodhxob77wcr6tb4yo4i-561699256494.europe-west1.run.app/src/assets/images/boss_news_logo_1783871304137.jpg'
      }
    },
    "description": article.subtitle || article.snippet || "A premium breaking news article published on BossNews."
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-20">
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
      
      {/* 1. ARTICLE BANNER HERO */}
      <div className="relative w-full h-[380px] md:h-[500px] overflow-hidden bg-slate-950">
        <img 
          src={article.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1200&auto=format&fit=crop'} 
          alt={article.title}
          className="w-full h-full object-cover opacity-50 dark:opacity-40"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-transparent to-transparent" />
        
        {/* Upper controls over banner */}
        <div className="absolute top-6 left-6 md:left-12 z-10">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 text-white font-semibold text-xs uppercase tracking-widest backdrop-blur-md rounded-full transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Main Feed
          </Link>
        </div>
      </div>

      {/* 2. MAIN LAYOUT: Centered Reader */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-20">
        
        {/* Article Details Card Container */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-12 shadow-2xl border border-slate-100 dark:border-slate-800"
        >
          {/* Tag & Meta bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 text-[10px] font-black uppercase tracking-widest rounded-full">
              {articleCategory?.name || article.category}
            </span>
            <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              {article.region} ({article.country})
            </span>
            {article.breaking && (
              <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded animate-pulse">
                Breaking
              </span>
            )}
            {translatedFields && (
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Auto-Localized: {translatedFields.languageName}
              </span>
            )}
            {isTranslating && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                Analyzing Dynamic Translation Profile...
              </span>
            )}
          </div>

          {/* Title and Subtitle */}
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
            {translatedFields?.title || article.title}
          </h1>

          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">
            {translatedFields?.subtitle || article.subtitle}
          </p>

          {/* Author/Date Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-100 dark:border-slate-800/80 mb-8 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {article.author.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-extrabold text-slate-900 dark:text-white">
                  By {article.author}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  Author Core Dispatch • {article.authorEmail || 'newsdesk@bossnews.com'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400 font-semibold text-xs uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(article.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {(article.views + 1).toLocaleString()} views
              </span>
            </div>
          </div>

          {/* Journalist Narration TTS Panel */}
          <div className="my-6 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 rounded-xl">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Journalist Narration Center</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {narratorStatus || 'Steady, deliberate professional news broadcast.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isPlayingNarrator ? (
                <button
                  type="button"
                  onClick={startNarrator}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Listen Like Journalist
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={pauseNarrator}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" /> Pause
                  </button>
                  <button
                    type="button"
                    onClick={stopNarrator}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> Stop
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Real Audio File (if published by admin) */}
          {article.audioUrl && (
            <div className="mb-6 p-4 bg-violet-50/50 dark:bg-violet-950/10 border border-violet-100 dark:border-violet-900/40 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-violet-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attached Voice Broadcast</span>
              </div>
              <audio src={article.audioUrl} controls className="w-full bg-transparent outline-none" />
            </div>
          )}

          {/* Real Video File (if published by admin) */}
          {article.videoUrl && (
            <div className="mb-8 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl">
              <div className="relative w-full aspect-video bg-black">
                <video 
                  src={article.videoUrl} 
                  controls 
                  poster={article.imageUrl} 
                  className="w-full h-full object-contain" 
                />
              </div>
            </div>
          )}

          {/* 3. ARTICLE CONTENT */}
          <div className="article-rich-text text-slate-800 dark:text-slate-200">
            {renderMarkdown(translatedFields?.content || article.content)}
          </div>

          {/* 4. TAGS FOOTER & SHARE CONTROLS */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 mt-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Dispatch Tags:</span>
              {article.tags.map(tg => (
                <Link 
                  key={tg} 
                  to={`/?search=${encodeURIComponent(tg)}`} 
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  #{tg}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded-full transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                {shared ? 'URL Copied!' : 'Copy Link'}
              </button>
              
              <button 
                onClick={() => alert("Dispatch saved to your private terminal bookmarks.")}
                className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"
                title="Bookmark article"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
          </div>

        </motion.div>
      </div>

    </div>
  );
};

export default ArticlePage;
