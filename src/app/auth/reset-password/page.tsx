'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { resetPassword } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { Loader2, CheckCircle2, LockKeyhole } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [hasToken, setHasToken] = useState(false)

  // Check if we have a valid reset token in the URL
  useEffect(() => {
    // The token is in the URL hash, handled by Supabase
    // We just need to check if the page loaded
    setHasToken(true)
  }, [])

  const handleSubmit = async (formData: FormData) => {
    setErrors({})
    setFormError('')
    setSuccess(false)
    
    startTransition(async () => {
      const result = await resetPassword(formData)
      
      if (!result.success) {
        if (result.errors) {
          setErrors(result.errors)
        }
        if (result.error) {
          setFormError(result.error)
        }
      } else {
        // Success
        setSuccess(true)
        setSuccessMessage(result.message || 'Password updated successfully')
      }
    })
  }

  if (!hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <LockKeyhole className="h-10 w-10 text-red-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Invalid reset link</h2>
                <p className="text-gray-600">
                  This password reset link is invalid or has expired.
                </p>
              </div>
              <div className="pt-4">
                <Link href="/auth/forgot-password">
                  <Button variant="outline">
                    Request new reset link
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Password updated!</h2>
                <p className="text-gray-600">{successMessage}</p>
              </div>
              <div className="pt-4">
                <Link href="/login">
                  <Button>
                    Sign in with new password
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••••"
                autoComplete="new-password"
                disabled={isPending}
                className={errors.password ? 'border-red-500' : ''}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password}</p>
              )}
              <p className="text-xs text-gray-500">
                Must be at least 8 characters with uppercase, lowercase, number, and special character
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••••"
                autoComplete="new-password"
                disabled={isPending}
                className={errors.confirmPassword ? 'border-red-500' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex justify-center">
          <Link 
            href="/login"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
