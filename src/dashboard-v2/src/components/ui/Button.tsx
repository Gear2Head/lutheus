import { cn } from '../../lib/utils';

type Variant = 'default' | 'primary' | 'outline' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20',
  outline: 'border border-border/60 bg-background/50 text-foreground hover:bg-secondary/50',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
  ghost: 'bg-transparent text-foreground hover:bg-secondary/50',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
};

export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-[12px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
