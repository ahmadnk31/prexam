'use client'

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Save, Loader2 } from 'lucide-react'
import { createClient } from '@/supabase/client'
import { useToast } from '@/components/ui/use-toast'

interface NotesPanelProps {
  videoId: string
}

export default function NotesPanel({ videoId }: NotesPanelProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [videoId])

  const loadNotes = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notes')
        .select('content')
        .eq('video_id', videoId)
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
        toast({
          variant: 'destructive',
          title: 'Authentication required',
          description: 'You must be logged in to save notes',
        })
        return
      }

      const { error } = await supabase
        .from('notes')
        .upsert(
          {
            video_id: videoId,
            user_id: user.id,
            content: notes,
          },
          {
            onConflict: 'video_id,user_id',
          }
        )

      if (error) {
        throw error
      }

      toast({
        variant: 'success',
        title: 'Notes saved!',
        description: 'Your notes have been saved successfully.',
      })
    } catch (error: any) {
      console.error('Error saving notes:', error)
      toast({
        variant: 'destructive',
        title: 'Failed to save notes',
        description: error.message || 'Unknown error occurred',
      })
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
          Take notes while watching the video. Your notes are automatically saved.
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

