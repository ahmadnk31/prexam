'use client'

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Save, Loader2 } from 'lucide-react'
import { createClient } from '@/supabase/client'

interface DocumentNotesPanelProps {
  documentId: string
}

export default function DocumentNotesPanel({ documentId }: DocumentNotesPanelProps) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [documentId])

  const loadNotes = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('document_notes')
        .select('content')
        .eq('document_id', documentId)
        .single()

      if (!error && data) {
        setNotes(data.content || '')
      }
    } catch (error) {
      console.error('Error loading notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveNotes = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('You must be logged in to save notes')
        return
      }

      const { error } = await supabase
        .from('document_notes')
        .upsert(
          {
            document_id: documentId,
            user_id: user.id,
            content: notes,
          },
          {
            onConflict: 'document_id,user_id',
          }
        )

      if (error) {
        throw error
      }

      alert('Notes saved successfully!')
    } catch (error: any) {
      console.error('Error saving notes:', error)
      alert('Failed to save notes: ' + (error.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex-1 min-h-0 flex flex-col space-y-2">
        <p className="text-sm text-gray-600 flex-shrink-0">
          Take notes while reading the document. Your notes are automatically saved.
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Write your notes here..."
          className="flex-1 resize-none"
        />
      </div>
      <Button onClick={saveNotes} disabled={saving} className="w-full flex-shrink-0">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Notes
          </>
        )}
      </Button>
    </div>
  )
}

