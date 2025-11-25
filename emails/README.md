# Email Templates

This directory contains React Email templates for the Summaryr application.

## Available Templates

### Welcome Email (`welcome-email.tsx`)
Sent to new users after signup. Includes:
- Welcome message
- Feature highlights
- Call-to-action button to get started

### Password Reset Email (`password-reset-email.tsx`)
Sent when users request a password reset. Includes:
- Reset link
- Security notice
- Expiration information

## Usage

### Sending Emails via API

```typescript
// Welcome email
fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'welcome',
    to: 'user@example.com',
    userName: 'John Doe',
    loginUrl: 'https://summaryr.com/login',
  }),
})

// Password reset email
fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'password-reset',
    to: 'user@example.com',
    resetUrl: 'https://summaryr.com/reset-password?token=...',
    userName: 'John Doe',
  }),
})

// Custom email
fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'custom',
    to: 'user@example.com',
    subject: 'Your Subject',
    html: '<h1>Your HTML content</h1>',
    text: 'Your plain text content',
  }),
})
```

### Using Email Functions Directly

```typescript
import { sendWelcomeEmail, sendPasswordResetEmail, sendEmail } from '@/lib/email'

// Welcome email
await sendWelcomeEmail({
  to: 'user@example.com',
  userName: 'John Doe',
  loginUrl: 'https://summaryr.com/login',
})

// Password reset
await sendPasswordResetEmail({
  to: 'user@example.com',
  resetUrl: 'https://summaryr.com/reset-password?token=...',
  userName: 'John Doe',
})

// Custom email
await sendEmail({
  to: 'user@example.com',
  subject: 'Your Subject',
  html: '<h1>Your HTML content</h1>',
  text: 'Your plain text content',
})
```

## Creating New Templates

1. Create a new `.tsx` file in this directory
2. Use React Email components from `@react-email/components`
3. Export the component as default
4. Add a corresponding function in `lib/email.ts`
5. Add the email type to the API route if needed

Example:

```tsx
import { Body, Container, Heading, Html, Text } from '@react-email/components'

export const MyEmail = ({ name }: { name: string }) => {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Hello {name}!</Heading>
          <Text>This is my custom email.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default MyEmail
```

## Previewing Emails

You can preview emails using React Email's dev server:

```bash
npx email dev
```

This will start a development server where you can preview all email templates.

## Styling

All emails use inline styles for maximum compatibility across email clients. The templates follow the Summaryr brand colors:
- Primary: `#4B3F72` (purple)
- Accent: `#FBBF24` (yellow)
- Text: `#1F2937` (dark gray)
- Background: `#ffffff` (white)

