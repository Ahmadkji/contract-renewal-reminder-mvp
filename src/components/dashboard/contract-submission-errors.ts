export type ContractSubmissionErrorDetails = {
  title: string
  message: string
}

export function getContractSubmissionErrorDetails(
  error: unknown
): ContractSubmissionErrorDetails {
  const title = 'Failed to create contract'
  let message = 'Please try again.'

  if (!(error instanceof Error)) {
    return { title, message }
  }

  message = error.message
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('authentication') ||
    normalizedMessage.includes('unauthorized')
  ) {
    return {
      title: 'Authentication required',
      message: 'Please sign in and try again.',
    }
  }

  if (
    normalizedMessage.includes('free_mode_migration_pending') ||
    normalizedMessage.includes('supabase free-mode migration has not been applied')
  ) {
    return {
      title: 'Setup required',
      message:
        'Free mode is enabled in the app, but the Supabase free-mode migration is still pending.',
    }
  }

  if (normalizedMessage.includes('free email reminder quota exhausted')) {
    return {
      title: 'Free reminder limit reached',
      message:
        'Your free plan includes 5 reminder emails. Upgrade in Billing to continue reminder delivery.',
    }
  }

  if (
    normalizedMessage.includes(
      'additional reminder recipients require an active premium subscription'
    )
  ) {
    return {
      title: 'Upgrade required',
      message:
        'Free reminder emails send only to your account email. Upgrade to add extra reminder recipients.',
    }
  }

  if (
    normalizedMessage.includes('premium subscription') ||
    normalizedMessage.includes('feature_requires_premium')
  ) {
    return {
      title: 'Upgrade required',
      message:
        'Unlimited reminder emails and extra recipients are available on premium. Adjust reminder settings or upgrade in Billing.',
    }
  }

  if (normalizedMessage.includes('validation') || normalizedMessage.includes('required')) {
    return {
      title: 'Validation error',
      message: 'Please check your form data and try again.',
    }
  }

  if (normalizedMessage.includes('vendor contact')) {
    return {
      title: 'Vendor contact error',
      message: 'Could not save vendor contact. Please check the email format.',
    }
  }

  if (normalizedMessage.includes('reminder')) {
    return {
      title: 'Reminder error',
      message,
    }
  }

  if (normalizedMessage.includes('database') || normalizedMessage.includes('constraint')) {
    return {
      title: 'Database error',
      message: 'A database error occurred. Please try again.',
    }
  }

  return { title, message }
}
