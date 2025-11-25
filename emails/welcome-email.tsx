import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface WelcomeEmailProps {
  userName?: string
  loginUrl?: string
}

export const WelcomeEmail = ({
  userName = 'there',
  loginUrl = 'https://summaryr.com/login',
}: WelcomeEmailProps) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://summaryr.com'

  return (
    <Html>
      <Head />
      <Preview>Welcome to Summaryr - Your AI-Powered Study Platform</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={`${baseUrl}/logo.png`}
              width="120"
              height="34"
              alt="Summaryr"
              style={logo}
            />
          </Section>
          <Heading style={h1}>Welcome to Summaryr! 🎉</Heading>
          <Text style={text}>
            Hi {userName},
          </Text>
          <Text style={text}>
            We're thrilled to have you join Summaryr! You're now part of a community that's transforming the way students learn and study.
          </Text>
          <Text style={text}>
            With Summaryr, you can:
          </Text>
          <Text style={listItem}>
            • Upload videos and documents to create study materials
          </Text>
          <Text style={listItem}>
            • Generate AI-powered flashcards with spaced repetition
          </Text>
          <Text style={listItem}>
            • Create practice quizzes to test your knowledge
          </Text>
          <Text style={listItem}>
            • Get instant transcriptions and summaries
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Get Started
            </Button>
          </Section>
          <Text style={text}>
            If you have any questions, feel free to reach out to us. We're here to help!
          </Text>
          <Text style={text}>
            Happy studying,
            <br />
            The Summaryr Team
          </Text>
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Summaryr. All rights reserved.
            </Text>
            <Link href={`${baseUrl}`} style={link}>
              Visit Summaryr
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
}

const header = {
  padding: '32px 24px',
  backgroundColor: '#4B3F72',
  borderRadius: '8px 8px 0 0',
}

const logo = {
  margin: '0 auto',
}

const h1 = {
  color: '#4B3F72',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
}

const text = {
  color: '#1F2937',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
}

const listItem = {
  color: '#1F2937',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '8px 0',
  paddingLeft: '8px',
}

const buttonContainer = {
  padding: '27px 0 27px',
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#FBBF24',
  borderRadius: '6px',
  color: '#1F2937',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  width: '200px',
  margin: '0 auto',
}

const footer = {
  borderTop: '1px solid #E5E7EB',
  marginTop: '32px',
  paddingTop: '24px',
}

const footerText = {
  color: '#6B7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
  textAlign: 'center' as const,
}

const link = {
  color: '#4B3F72',
  fontSize: '14px',
  textDecoration: 'underline',
  display: 'block',
  textAlign: 'center' as const,
  marginTop: '8px',
}

