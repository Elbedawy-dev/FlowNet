import { Users, Rocket, Globe, Sparkles, Star, Code, BookOpen, Heart } from 'lucide-react';

export const getGroupIcon = (iconName, className = 'w-6 h-6') => {
  switch (iconName) {
    case 'rocket':
      return <Rocket className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'code':
      return <Code className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'users':
    default:
      return <Users className={className} />;
  }
};
