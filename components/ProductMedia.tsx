"use client";

import { useEffect, useState } from "react";
import {
  AudioLines,
  BatteryCharging,
  Camera,
  Gamepad2,
  Headphones,
  House,
  Laptop,
  Monitor,
  Radio,
  Smartphone,
  Speaker,
  Tablet,
  Watch,
  Keyboard,
} from "lucide-react";
import type { Product } from "@/lib/types";

const icons = [Smartphone, Laptop, Tablet, Headphones, AudioLines, Watch, Gamepad2, Gamepad2, Speaker, Camera, House, Radio, Monitor, Keyboard, BatteryCharging];
const categoryIndex: Record<string, number> = {
  smartphones: 0, laptops: 1, tablets: 2, headphones: 3, earbuds: 4, "smart-watches": 5,
  "gaming-accessories": 6, "gaming-consoles": 7, speakers: 8, cameras: 9, "smart-home": 10,
  "computer-accessories": 11, monitors: 12, "keyboards-mice": 13, "power-banks-chargers": 14,
};

export default function ProductMedia({ product, className = "", priority = false }: { product: Product; className?: string; priority?: boolean }) {
  const [broken, setBroken] = useState(false);
  const Icon = icons[categoryIndex[product.category] ?? 0] || Smartphone;
  const image = product.images?.[0];
  useEffect(() => setBroken(false), [image]);

  return (
    <div className={`product-media ${className}`}>
      {!broken && image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image}
          alt={`${product.brand} ${product.name}`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className={`product-art product-art-${product.category}`} aria-label={`${product.category} illustration`}>
          <span className="art-orbit art-orbit-one" />
          <span className="art-orbit art-orbit-two" />
          <div className="art-core"><Icon strokeWidth={1.1} /></div>
          <div className="art-label"><span>NEXVORO SELECT</span><strong>{product.brand}</strong></div>
        </div>
      )}
    </div>
  );
}
