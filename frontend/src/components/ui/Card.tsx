import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import clsx from 'clsx'

export interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'glass' | 'gradient' | 'subtle'
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Card({
  variant = 'default',
  hover = true,
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  }[padding]

  const variantStyles = {
    default:
      'bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--card-shadow)]',
    glass:
      'bg-[var(--bg-glass)] backdrop-blur-md border border-[var(--border)] shadow-[var(--card-shadow)]',
    gradient:
      'bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-secondary)] border border-[var(--border)] shadow-[var(--card-shadow)]',
    subtle:
      'bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]',
  }[variant]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      whileHover={
        hover
          ? {
              y: -2,
              boxShadow: 'var(--card-hover-shadow)',
              transition: { duration: 0.2 },
            }
          : undefined
      }
      className={clsx(
        'rounded-2xl transition-colors relative overflow-hidden',
        variantStyles,
        paddingStyles,
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export default Card
