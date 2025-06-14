import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shuffle, Save, Palette, Smile, Eye, Shirt } from "lucide-react";

interface AvatarConfig {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeStyle: string;
  eyeColor: string;
  clothingStyle: string;
  clothingColor: string;
  accessory: string;
  expression: string;
}

interface AvatarGeneratorProps {
  onSave?: (avatarSvg: string, config: AvatarConfig) => void;
  initialConfig?: Partial<AvatarConfig>;
  size?: number;
}

const AVATAR_OPTIONS = {
  skinTones: ['#FDBCB4', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#6B4423'],
  hairStyles: ['short', 'long', 'curly', 'bald', 'buzz', 'wavy'],
  hairColors: ['#8B4513', '#2C1B18', '#B8860B', '#FF4500', '#4B0082', '#FF69B4'],
  eyeStyles: ['normal', 'round', 'sleepy', 'wink', 'star', 'heart'],
  eyeColors: ['#8B4513', '#228B22', '#0000FF', '#808080', '#800080', '#FF6347'],
  clothingStyles: ['shirt', 'hoodie', 'dress', 'suit', 'tank', 'sweater'],
  clothingColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'],
  accessories: ['none', 'glasses', 'hat', 'earrings', 'necklace', 'scarf'],
  expressions: ['happy', 'neutral', 'excited', 'cool', 'surprised', 'winking']
};

export default function AvatarGenerator({ onSave, initialConfig, size = 120 }: AvatarGeneratorProps) {
  const [config, setConfig] = useState<AvatarConfig>({
    skinTone: AVATAR_OPTIONS.skinTones[0],
    hairStyle: AVATAR_OPTIONS.hairStyles[0],
    hairColor: AVATAR_OPTIONS.hairColors[0],
    eyeStyle: AVATAR_OPTIONS.eyeStyles[0],
    eyeColor: AVATAR_OPTIONS.eyeColors[0],
    clothingStyle: AVATAR_OPTIONS.clothingStyles[0],
    clothingColor: AVATAR_OPTIONS.clothingColors[0],
    accessory: AVATAR_OPTIONS.accessories[0],
    expression: AVATAR_OPTIONS.expressions[0],
    ...initialConfig
  });

  const generateRandomAvatar = () => {
    setConfig({
      skinTone: AVATAR_OPTIONS.skinTones[Math.floor(Math.random() * AVATAR_OPTIONS.skinTones.length)],
      hairStyle: AVATAR_OPTIONS.hairStyles[Math.floor(Math.random() * AVATAR_OPTIONS.hairStyles.length)],
      hairColor: AVATAR_OPTIONS.hairColors[Math.floor(Math.random() * AVATAR_OPTIONS.hairColors.length)],
      eyeStyle: AVATAR_OPTIONS.eyeStyles[Math.floor(Math.random() * AVATAR_OPTIONS.eyeStyles.length)],
      eyeColor: AVATAR_OPTIONS.eyeColors[Math.floor(Math.random() * AVATAR_OPTIONS.eyeColors.length)],
      clothingStyle: AVATAR_OPTIONS.clothingStyles[Math.floor(Math.random() * AVATAR_OPTIONS.clothingStyles.length)],
      clothingColor: AVATAR_OPTIONS.clothingColors[Math.floor(Math.random() * AVATAR_OPTIONS.clothingColors.length)],
      accessory: AVATAR_OPTIONS.accessories[Math.floor(Math.random() * AVATAR_OPTIONS.accessories.length)],
      expression: AVATAR_OPTIONS.expressions[Math.floor(Math.random() * AVATAR_OPTIONS.expressions.length)]
    });
  };

  const generateAvatarSVG = (avatarConfig: AvatarConfig): string => {
    const { skinTone, hairStyle, hairColor, eyeStyle, eyeColor, clothingStyle, clothingColor, accessory, expression } = avatarConfig;
    
    // Hair paths based on style
    const getHairPath = (style: string) => {
      switch (style) {
        case 'short':
          return `<path d="M20 25 C15 15, 25 10, 40 15 C55 10, 65 15, 60 25 C65 20, 70 25, 65 35 C60 30, 20 30, 15 35 C10 25, 15 20, 20 25 Z" fill="${hairColor}" />`;
        case 'long':
          return `<path d="M15 25 C10 15, 20 8, 40 12 C60 8, 70 15, 65 25 C68 30, 70 40, 65 50 C60 45, 55 50, 50 55 C45 50, 35 50, 30 55 C25 50, 20 45, 15 50 C10 40, 12 30, 15 25 Z" fill="${hairColor}" />`;
        case 'curly':
          return `<circle cx="25" cy="20" r="8" fill="${hairColor}" /><circle cx="35" cy="15" r="7" fill="${hairColor}" /><circle cx="45" cy="15" r="7" fill="${hairColor}" /><circle cx="55" cy="20" r="8" fill="${hairColor}" /><circle cx="60" cy="30" r="6" fill="${hairColor}" /><circle cx="20" cy="30" r="6" fill="${hairColor}" />`;
        case 'bald':
          return '';
        case 'buzz':
          return `<path d="M18 28 C15 20, 22 12, 40 15 C58 12, 65 20, 62 28 C65 25, 68 28, 65 35 C62 32, 18 32, 15 35 C12 28, 15 25, 18 28 Z" fill="${hairColor}" opacity="0.7" />`;
        case 'wavy':
          return `<path d="M18 25 C15 15, 25 10, 30 15 C35 10, 45 15, 50 10 C55 15, 65 15, 62 25 C65 20, 68 25, 65 35 C60 30, 20 30, 15 35 C12 25, 15 20, 18 25 Z" fill="${hairColor}" />`;
        default:
          return `<path d="M20 25 C15 15, 25 10, 40 15 C55 10, 65 15, 60 25 C65 20, 70 25, 65 35 C60 30, 20 30, 15 35 C10 25, 15 20, 20 25 Z" fill="${hairColor}" />`;
      }
    };

    // Eye paths based on style
    const getEyes = (style: string, color: string) => {
      switch (style) {
        case 'round':
          return `<circle cx="30" cy="40" r="4" fill="white" /><circle cx="50" cy="40" r="4" fill="white" /><circle cx="30" cy="40" r="2" fill="${color}" /><circle cx="50" cy="40" r="2" fill="${color}" />`;
        case 'sleepy':
          return `<path d="M26 38 C28 42, 32 42, 34 38" stroke="${color}" stroke-width="2" fill="none" /><path d="M46 38 C48 42, 52 42, 54 38" stroke="${color}" stroke-width="2" fill="none" />`;
        case 'wink':
          return `<circle cx="30" cy="40" r="4" fill="white" /><circle cx="30" cy="40" r="2" fill="${color}" /><path d="M46 38 C48 42, 52 42, 54 38" stroke="${color}" stroke-width="2" fill="none" />`;
        case 'star':
          return `<polygon points="30,36 31,38 33,38 31.5,40 32,42 30,41 28,42 28.5,40 27,38 29,38" fill="${color}" /><polygon points="50,36 51,38 53,38 51.5,40 52,42 50,41 48,42 48.5,40 47,38 49,38" fill="${color}" />`;
        case 'heart':
          return `<path d="M27 38 C27 36, 29 36, 30 38 C31 36, 33 36, 33 38 C33 40, 30 42, 30 42 C30 42, 27 40, 27 38 Z" fill="${color}" /><path d="M47 38 C47 36, 49 36, 50 38 C51 36, 53 36, 53 38 C53 40, 50 42, 50 42 C50 42, 47 40, 47 38 Z" fill="${color}" />`;
        default:
          return `<circle cx="30" cy="40" r="3" fill="white" /><circle cx="50" cy="40" r="3" fill="white" /><circle cx="30" cy="40" r="1.5" fill="${color}" /><circle cx="50" cy="40" r="1.5" fill="${color}" />`;
      }
    };

    // Mouth based on expression
    const getMouth = (expr: string) => {
      switch (expr) {
        case 'happy':
          return `<path d="M35 52 C38 56, 42 56, 45 52" stroke="#333" stroke-width="2" fill="none" />`;
        case 'excited':
          return `<ellipse cx="40" cy="54" rx="5" ry="3" fill="#333" /><ellipse cx="40" cy="54" rx="3" ry="1.5" fill="white" />`;
        case 'cool':
          return `<line x1="36" y1="52" x2="44" y2="52" stroke="#333" stroke-width="2" />`;
        case 'surprised':
          return `<ellipse cx="40" cy="52" rx="2" ry="4" fill="#333" />`;
        case 'winking':
          return `<path d="M35 52 C38 55, 42 55, 45 52" stroke="#333" stroke-width="2" fill="none" />`;
        default:
          return `<path d="M36 52 C38 54, 42 54, 44 52" stroke="#333" stroke-width="2" fill="none" />`;
      }
    };

    // Clothing
    const getClothing = (style: string, color: string) => {
      switch (style) {
        case 'hoodie':
          return `<path d="M20 65 C20 60, 25 58, 40 58 C55 58, 60 60, 60 65 L60 80 L20 80 Z" fill="${color}" /><path d="M25 58 C25 55, 30 53, 40 53 C50 53, 55 55, 55 58" stroke="${color}" stroke-width="3" fill="none" />`;
        case 'dress':
          return `<path d="M25 65 C25 60, 30 58, 40 58 C50 58, 55 60, 55 65 L58 80 L22 80 Z" fill="${color}" />`;
        case 'suit':
          return `<path d="M20 65 C20 60, 25 58, 40 58 C55 58, 60 60, 60 65 L60 80 L20 80 Z" fill="${color}" /><path d="M30 65 L30 80 M40 58 L40 80 M50 65 L50 80" stroke="#333" stroke-width="1" />`;
        case 'tank':
          return `<path d="M25 65 C25 60, 30 58, 40 58 C50 58, 55 60, 55 65 L55 80 L25 80 Z" fill="${color}" />`;
        case 'sweater':
          return `<path d="M18 65 C18 60, 23 58, 40 58 C57 58, 62 60, 62 65 L62 80 L18 80 Z" fill="${color}" /><path d="M18 68 L62 68" stroke="#333" stroke-width="1" opacity="0.3" />`;
        default:
          return `<path d="M22 65 C22 60, 27 58, 40 58 C53 58, 58 60, 58 65 L58 80 L22 80 Z" fill="${color}" />`;
      }
    };

    // Accessories
    const getAccessory = (acc: string) => {
      switch (acc) {
        case 'glasses':
          return `<circle cx="30" cy="40" r="8" stroke="#333" stroke-width="2" fill="none" opacity="0.8" /><circle cx="50" cy="40" r="8" stroke="#333" stroke-width="2" fill="none" opacity="0.8" /><line x1="38" y1="40" x2="42" y2="40" stroke="#333" stroke-width="2" />`;
        case 'hat':
          return `<ellipse cx="40" cy="15" rx="20" ry="5" fill="#8B4513" /><ellipse cx="40" cy="10" rx="15" ry="8" fill="#8B4513" />`;
        case 'earrings':
          return `<circle cx="18" cy="42" r="2" fill="#FFD700" /><circle cx="62" cy="42" r="2" fill="#FFD700" />`;
        case 'necklace':
          return `<ellipse cx="40" cy="62" rx="12" ry="3" stroke="#FFD700" stroke-width="2" fill="none" />`;
        case 'scarf':
          return `<path d="M20 60 C25 58, 40 58, 55 58 C60 60, 62 65, 60 68 C55 66, 25 66, 20 68 C18 65, 18 62, 20 60 Z" fill="#FF6B6B" />`;
        default:
          return '';
      }
    };

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <!-- Hair -->
        ${getHairPath(hairStyle)}
        
        <!-- Head -->
        <circle cx="40" cy="40" r="20" fill="${skinTone}" />
        
        <!-- Eyes -->
        ${getEyes(eyeStyle, eyeColor)}
        
        <!-- Nose -->
        <ellipse cx="40" cy="46" rx="1" ry="2" fill="${skinTone}" stroke="#333" stroke-width="0.5" opacity="0.5" />
        
        <!-- Mouth -->
        ${getMouth(expression)}
        
        <!-- Clothing -->
        ${getClothing(clothingStyle, clothingColor)}
        
        <!-- Accessories -->
        ${getAccessory(accessory)}
      </svg>
    `;
  };

  const avatarSvg = generateAvatarSVG(config);

  const handleSave = () => {
    if (onSave) {
      onSave(avatarSvg, config);
    }
  };

  return (
    <div className="space-y-4">
      {/* Avatar Preview */}
      <Card>
        <CardContent className="p-6 text-center">
          <div 
            className="mx-auto mb-4 rounded-full border-4 border-primary/20 inline-block"
            dangerouslySetInnerHTML={{ __html: avatarSvg }}
          />
          <div className="flex gap-2 justify-center">
            <Button onClick={generateRandomAvatar} variant="outline" size="sm">
              <Shuffle className="h-4 w-4 mr-2" />
              Random
            </Button>
            {onSave && (
              <Button onClick={handleSave} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Avatar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customization Options */}
      <div className="grid gap-4">
        {/* Skin Tone */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Skin Tone
          </label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_OPTIONS.skinTones.map((tone) => (
              <button
                key={tone}
                className={`w-8 h-8 rounded-full border-2 ${config.skinTone === tone ? 'border-primary' : 'border-gray-300'}`}
                style={{ backgroundColor: tone }}
                onClick={() => setConfig({ ...config, skinTone: tone })}
              />
            ))}
          </div>
        </div>

        {/* Hair Style */}
        <div>
          <label className="text-sm font-medium mb-2 block">Hair Style</label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_OPTIONS.hairStyles.map((style) => (
              <Badge
                key={style}
                variant={config.hairStyle === style ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setConfig({ ...config, hairStyle: style })}
              >
                {style}
              </Badge>
            ))}
          </div>
        </div>

        {/* Hair Color */}
        <div>
          <label className="text-sm font-medium mb-2 block">Hair Color</label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_OPTIONS.hairColors.map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded-full border-2 ${config.hairColor === color ? 'border-primary' : 'border-gray-300'}`}
                style={{ backgroundColor: color }}
                onClick={() => setConfig({ ...config, hairColor: color })}
              />
            ))}
          </div>
        </div>

        {/* Eyes */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Eye Style
          </label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_OPTIONS.eyeStyles.map((style) => (
              <Badge
                key={style}
                variant={config.eyeStyle === style ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setConfig({ ...config, eyeStyle: style })}
              >
                {style}
              </Badge>
            ))}
          </div>
        </div>

        {/* Expression */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Smile className="h-4 w-4" />
            Expression
          </label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_OPTIONS.expressions.map((expr) => (
              <Badge
                key={expr}
                variant={config.expression === expr ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setConfig({ ...config, expression: expr })}
              >
                {expr}
              </Badge>
            ))}
          </div>
        </div>

        {/* Clothing */}
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Shirt className="h-4 w-4" />
            Clothing
          </label>
          <div className="flex gap-2 flex-wrap mb-2">
            {AVATAR_OPTIONS.clothingStyles.map((style) => (
              <Badge
                key={style}
                variant={config.clothingStyle === style ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setConfig({ ...config, clothingStyle: style })}
              >
                {style}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_OPTIONS.clothingColors.map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded-full border-2 ${config.clothingColor === color ? 'border-primary' : 'border-gray-300'}`}
                style={{ backgroundColor: color }}
                onClick={() => setConfig({ ...config, clothingColor: color })}
              />
            ))}
          </div>
        </div>

        {/* Accessories */}
        <div>
          <label className="text-sm font-medium mb-2 block">Accessories</label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_OPTIONS.accessories.map((acc) => (
              <Badge
                key={acc}
                variant={config.accessory === acc ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setConfig({ ...config, accessory: acc })}
              >
                {acc}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { type AvatarConfig };