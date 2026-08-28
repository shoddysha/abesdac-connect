import { useState } from 'react';
import { Play } from 'lucide-react';
import { extractYouTubeId, getYouTubeThumbnail } from '@/services/resources';

interface YouTubePreviewProps {
  url: string;
  title?: string;
  autoplay?: boolean;
  className?: string;
}

export function YouTubePreview({ url, title, autoplay = false, className = '' }: YouTubePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const videoId = extractYouTubeId(url);

  if (!videoId) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-lg ${className}`}>
        <p className="text-sm text-slate-500">Invalid YouTube URL</p>
      </div>
    );
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&rel=0`;
  const thumbnailUrl = getYouTubeThumbnail(videoId, 'maxres');

  if (!isPlaying) {
    return (
      <div
        className={`relative cursor-pointer group overflow-hidden rounded-lg ${className}`}
        onClick={() => setIsPlaying(true)}
      >
        <img
          src={thumbnailUrl}
          alt={title || 'Video thumbnail'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to lower quality if maxres doesn't exist
            (e.target as HTMLImageElement).src = getYouTubeThumbnail(videoId, 'hq');
          }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" fill="currentColor" />
          </div>
        </div>
        {title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
            <p className="text-white font-medium text-sm md:text-base line-clamp-2">{title}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <iframe
        src={embedUrl}
        title={title || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full rounded-lg"
      />
    </div>
  );
}

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
}

export function YouTubeEmbed({ videoId, title, className = '' }: YouTubeEmbedProps) {
  return (
    <div className={`relative ${className}`}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0`}
        title={title || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full rounded-lg"
      />
    </div>
  );
}
