import { z } from 'zod'

/**
 * Signup form validation schema
 * Enforces strong password requirements and valid email format
 */
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional()
})

/**
 * Login form validation schema
 * Validates email format and ensures password is provided
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

/**
 * Forgot password form validation schema
 * Validates email format for password reset
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
})

/**
 * Reset password form validation schema
 * Enforces strong password requirements for password reset
 */
export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

/**
 * Profile update form validation schema
 * Validates profile information updates
 */
export const profileUpdateSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional(),
  timezone: z.string().optional(),
  email_notifications: z.boolean().optional()
})

export type SignupFormData = z.infer<typeof signupSchema>
export type LoginFormData = z.infer<typeof loginSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>
