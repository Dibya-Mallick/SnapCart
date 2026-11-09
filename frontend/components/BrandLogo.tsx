type BrandLogoProps = {
  size?: number;
  className?: string;
  title?: string;
};

/** SnapCart's compact shopping-bag/camera mark in PayPal's navy, blue, and gold palette. */
export function BrandLogo({ size = 34, className = "", title = "SnapCart" }: BrandLogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="snapcart-bag" x1="5" y1="4" x2="43" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#003087" />
          <stop offset="0.62" stopColor="#0070BA" />
          <stop offset="1" stopColor="#FFC439" />
        </linearGradient>
      </defs>
      <path d="M14 16V12a10 10 0 0 1 20 0v4" fill="none" stroke="#003087" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M7.5 15.5h33a3 3 0 0 1 3 3v21a4 4 0 0 1-4 4h-31a4 4 0 0 1-4-4v-21a3 3 0 0 1 3-3Z" fill="url(#snapcart-bag)" />
      <path d="M9 25.5h30a5 5 0 0 1 5 5v5.5a7.5 7.5 0 0 1-7.5 7.5h-25A7.5 7.5 0 0 1 4 36v-5.5a5 5 0 0 1 5-5Z" fill="#fff" />
      <circle cx="24" cy="34" r="7" fill="none" stroke="#0070BA" strokeWidth="3" />
      <circle cx="24" cy="34" r="3.6" fill="#003087" />
      <circle cx="34.5" cy="29.5" r="1.8" fill="#FFC439" />
    </svg>
  );
}
