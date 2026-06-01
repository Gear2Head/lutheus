import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-card border border-border/50 rounded-[20px] shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
}
